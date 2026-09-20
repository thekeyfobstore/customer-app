import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildClientBookUrl,
  buildPreservedContactPatch,
  type QuoCustomFieldDefinition,
} from "../lib/quo-contact-update";
import { mapServerContactToCustomer } from "../lib/server-contact";
import { updateOpenPhoneContact } from "../lib/openphone";

const clientBookField: QuoCustomFieldDefinition = {
  name: "ClientBook",
  key: "clientbook-field-key",
  type: "url",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ClientBook contact links", () => {
  it("normalizes a phone number to the last ten digits", () => {
    expect(buildClientBookUrl("+1 (902) 565-1502")).toBe(
      "https://custcrmapp-nxdjk2u8.manus.space/link?phone=9025651502",
    );
  });

  it("preserves every existing default and custom field while adding the link", () => {
    const patch = buildPreservedContactPatch(
      {
        defaultFields: {
          company: "Old Company",
          firstName: null,
          lastName: null,
          phoneNumbers: [
            { name: "Mobile", value: "+19025651502", id: "phone-id" },
          ],
          emails: [
            { name: "Work", value: "customer@example.com", id: "email-id" },
          ],
          role: "Customer",
        },
        customFields: [
          {
            name: "Route",
            key: "route",
            type: "multi-select",
            value: ["SYD"],
            id: "route-value-id",
          },
        ],
      },
      { company: "Updated Company", phone: "+1 (902) 565-1502" },
      clientBookField,
    );

    expect(patch.defaultFields.company).toBe("Updated Company");
    expect(patch.defaultFields.phoneNumbers).toEqual([
      { name: "Mobile", value: "+19025651502", id: "phone-id" },
    ]);
    expect(patch.defaultFields.emails).toEqual([
      { name: "Work", value: "customer@example.com", id: "email-id" },
    ]);
    expect(patch.defaultFields.role).toBe("Customer");
    expect(patch.customFields).toContainEqual({
      name: "Route",
      key: "route",
      type: "multi-select",
      value: ["SYD"],
    });
    expect(patch.customFields).toContainEqual({
      name: "ClientBook",
      key: "clientbook-field-key",
      type: "url",
      value: "https://custcrmapp-nxdjk2u8.manus.space/link?phone=9025651502",
    });
  });

  it("updates an existing ClientBook property without creating a duplicate", () => {
    const patch = buildPreservedContactPatch(
      {
        defaultFields: {
          phoneNumbers: [{ name: "Mobile", value: "+19025651502" }],
        },
        customFields: [
          {
            name: "ClientBook",
            key: clientBookField.key,
            type: "url",
            value: "https://old.example/link",
          },
        ],
      },
      { phone: "9025651502" },
      clientBookField,
      "https://preview.example",
    );

    const links = patch.customFields.filter(
      (field) => field.key === clientBookField.key,
    );
    expect(links).toHaveLength(1);
    expect(links[0].value).toBe(
      "https://preview.example/link?phone=9025651502",
    );
  });

  it("reads the remote contact before PATCH and preserves unrelated fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              defaultFields: {
                company: "Old Company",
                phoneNumbers: [{ name: "Mobile", value: "+19025651502" }],
                emails: [{ name: "Work", value: "customer@example.com" }],
              },
              customFields: [
                {
                  name: "Route",
                  key: "route",
                  type: "multi-select",
                  value: ["SYD"],
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [clientBookField] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: "contact-id" } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const updated = await updateOpenPhoneContact("api-key", "contact-id", {
      company: "Updated Company",
      phone: "+1 (902) 565-1502",
    });

    expect(updated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const patchCall = fetchMock.mock.calls[2];
    expect(patchCall[0]).toBe(
      "https://api.openphone.com/v1/contacts/contact-id",
    );
    const patchBody = JSON.parse(String(patchCall[1]?.body));
    expect(patchBody.defaultFields).toMatchObject({
      company: "Updated Company",
      phoneNumbers: [{ name: "Mobile", value: "+19025651502" }],
      emails: [{ name: "Work", value: "customer@example.com" }],
    });
    expect(patchBody.customFields).toContainEqual({
      name: "Route",
      key: "route",
      type: "multi-select",
      value: ["SYD"],
    });
    expect(patchBody.customFields).toContainEqual({
      name: "ClientBook",
      key: "clientbook-field-key",
      type: "url",
      value: "https://custcrmapp-nxdjk2u8.manus.space/link?phone=9025651502",
    });
    expect(patchBody.source).toBeUndefined();
    expect(patchBody.sourceUrl).toBeUndefined();
  });
});

describe("server contact mapping", () => {
  it("uses the OpenPhone id expected by the detail route", () => {
    const customer = mapServerContactToCustomer({
      id: 90007,
      openPhoneId: "6aad625e4c2ecc4002881ddb",
      firstName: "Craig",
      lastName: "MacDonald",
      phone: "+19025651502",
      company: "Craig MacDonald 22 F350",
      vehicleYearMakeModel: "2022 Ford F350",
      route: "SYD",
      createdAt: new Date("2026-09-19T12:00:00Z"),
      updatedAt: new Date("2026-09-19T13:00:00Z"),
    });

    expect(customer.id).toBe("op-6aad625e4c2ecc4002881ddb");
    expect(customer.openPhoneContactId).toBe("6aad625e4c2ecc4002881ddb");
    expect(customer.phone).toBe("+19025651502");
    expect(customer.vehicles?.[0]).toMatchObject({
      year: "2022",
      make: "Ford",
      model: "F350",
    });
    expect(customer.createdAt).toBe("2026-09-19T12:00:00.000Z");
  });
});
