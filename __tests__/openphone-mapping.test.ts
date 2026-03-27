import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Import after mocking
import {
  fetchOpenPhoneContacts,
  convertToCustomers,
} from "../lib/openphone";

describe("OpenPhone Contact Mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("correctly maps contacts with defaultFields structure", async () => {
    // This is the actual structure returned by the OpenPhone (Quo) API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "contact-1",
            defaultFields: {
              firstName: "John",
              lastName: "Doe",
              company: "Acme Corp",
              phoneNumbers: [
                { name: "Mobile", value: "+14165551234", id: "pn-1" },
              ],
              emails: [
                { name: "Work", value: "john@acme.com", id: "em-1" },
              ],
              role: "Manager",
            },
            customFields: [],
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
          {
            id: "contact-2",
            defaultFields: {
              firstName: "Jane",
              lastName: "Smith",
              company: "",
              phoneNumbers: [
                { name: "Cell", value: "+16475559876", id: "pn-2" },
              ],
              emails: [],
              role: "",
            },
            customFields: [],
            createdAt: "2024-02-01T00:00:00Z",
            updatedAt: "2024-02-01T00:00:00Z",
          },
        ],
        totalItems: 2,
      }),
    });

    const contacts = await fetchOpenPhoneContacts("test-api-key");

    expect(contacts).toHaveLength(2);

    // First contact
    expect(contacts[0].firstName).toBe("John");
    expect(contacts[0].lastName).toBe("Doe");
    expect(contacts[0].company).toBe("Acme Corp");
    expect(contacts[0].phoneNumbers[0].number).toBe("+14165551234");
    expect(contacts[0].emails[0].address).toBe("john@acme.com");
    expect(contacts[0].selected).toBe(true);

    // Second contact
    expect(contacts[1].firstName).toBe("Jane");
    expect(contacts[1].lastName).toBe("Smith");
    expect(contacts[1].phoneNumbers[0].number).toBe("+16475559876");
  });

  it("handles contacts with no defaultFields (fallback to top-level)", async () => {
    // Some older API responses might have fields at top level
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "contact-3",
            firstName: "Bob",
            lastName: "Jones",
            phoneNumbers: [{ number: "+15551112222" }],
            emails: [{ address: "bob@test.com" }],
            company: "Test Inc",
          },
        ],
        totalItems: 1,
      }),
    });

    const contacts = await fetchOpenPhoneContacts("test-api-key");

    expect(contacts).toHaveLength(1);
    expect(contacts[0].firstName).toBe("Bob");
    expect(contacts[0].lastName).toBe("Jones");
    expect(contacts[0].phoneNumbers[0].number).toBe("+15551112222");
    expect(contacts[0].emails[0].address).toBe("bob@test.com");
  });

  it("handles contacts with missing fields gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "contact-4",
            defaultFields: {
              // Only has a phone number, no name
              phoneNumbers: [{ value: "+15553334444" }],
            },
          },
        ],
        totalItems: 1,
      }),
    });

    const contacts = await fetchOpenPhoneContacts("test-api-key");

    expect(contacts).toHaveLength(1);
    expect(contacts[0].firstName).toBe("");
    expect(contacts[0].lastName).toBe("");
    expect(contacts[0].phoneNumbers[0].number).toBe("+15553334444");
    expect(contacts[0].company).toBe("");
  });

  it("paginates through multiple pages of contacts", async () => {
    // Page 1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "contact-p1",
            defaultFields: {
              firstName: "Page1",
              lastName: "Contact",
              phoneNumbers: [{ value: "+11111111111" }],
              emails: [],
            },
          },
        ],
        totalItems: 2,
        nextPageToken: "page2token",
      }),
    });

    // Page 2 (last page, no nextPageToken)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "contact-p2",
            defaultFields: {
              firstName: "Page2",
              lastName: "Contact",
              phoneNumbers: [{ value: "+12222222222" }],
              emails: [],
            },
          },
        ],
        totalItems: 2,
      }),
    });

    const contacts = await fetchOpenPhoneContacts("test-api-key");

    expect(contacts).toHaveLength(2);
    expect(contacts[0].firstName).toBe("Page1");
    expect(contacts[1].firstName).toBe("Page2");

    // Should have made 2 fetch calls
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should include pageToken
    const secondCallUrl = mockFetch.mock.calls[1][0];
    expect(secondCallUrl).toContain("pageToken=page2token");
  });

  it("convertToCustomers correctly maps OpenPhoneContact to Customer", () => {
    const contacts = [
      {
        id: "op-1",
        firstName: "Alice",
        lastName: "Wonder",
        phoneNumbers: [{ number: "+14165550001" }],
        emails: [{ address: "alice@test.com" }],
        company: "Wonder Co",
        selected: true,
      },
      {
        id: "op-2",
        firstName: "Unselected",
        lastName: "Person",
        phoneNumbers: [{ number: "+14165550002" }],
        emails: [],
        company: "",
        selected: false,
      },
    ];

    const customers = convertToCustomers(contacts);

    // Only selected contacts should be converted
    expect(customers).toHaveLength(1);
    expect(customers[0].firstName).toBe("Alice");
    expect(customers[0].lastName).toBe("Wonder");
    expect(customers[0].phone).toBe("+14165550001");
    expect(customers[0].email).toBe("alice@test.com");
    expect(customers[0].company).toBe("Wonder Co");
    expect(customers[0].openPhoneContactId).toBe("op-1");
  });

  it("throws error on API failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(fetchOpenPhoneContacts("bad-key")).rejects.toThrow(
      "OpenPhone API error (401)"
    );
  });
});
