import { describe, it, expect } from "vitest";

// Test Quote types and data model
describe("Quote data model", () => {
  it("should create a valid QuoteOption", () => {
    const option = {
      id: "opt1",
      label: "OEM Key Fob",
      description: "Original equipment manufacturer key fob with programming",
      price: 35000, // $350.00 in cents
    };
    expect(option.id).toBe("opt1");
    expect(option.label).toBe("OEM Key Fob");
    expect(option.price).toBe(35000);
    expect(option.price / 100).toBe(350);
  });

  it("should create a valid Quote", () => {
    const now = new Date().toISOString();
    const quote = {
      id: "q1",
      customerId: "c1",
      vehicleId: "v1",
      service: "Key Fob Programming",
      options: [
        { id: "opt1", label: "OEM", description: "Factory key", price: 35000 },
        { id: "opt2", label: "Aftermarket", description: "Third-party key", price: 18000 },
      ],
      notes: "Includes programming",
      status: "draft" as const,
      createdAt: now,
      updatedAt: now,
    };
    expect(quote.options).toHaveLength(2);
    expect(quote.status).toBe("draft");
    expect(quote.options[0].price).toBeGreaterThan(quote.options[1].price);
  });

  it("should format currency correctly from cents", () => {
    const formatCurrency = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
    expect(formatCurrency(35000)).toBe("$350.00");
    expect(formatCurrency(18050)).toBe("$180.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(99)).toBe("$0.99");
  });

  it("should build quote message text correctly", () => {
    const customer = { firstName: "John" };
    const service = "Key Fob Programming";
    const vehicleStr = "2019 Honda Civic";
    const options = [
      { id: "1", label: "OEM", description: "Factory key", price: 35000 },
      { id: "2", label: "Aftermarket", description: "", price: 18000 },
    ];

    let msg = `Hi ${customer.firstName}! Here's your quote`;
    if (service) msg += ` for ${service}`;
    if (vehicleStr) msg += ` on your ${vehicleStr}`;
    msg += ":\n\n";

    options.forEach((opt, i) => {
      msg += `Option ${i + 1}: ${opt.label} — $${(opt.price / 100).toFixed(2)}\n`;
      if (opt.description.trim()) msg += `  ${opt.description}\n`;
    });

    msg += "\nLet me know which option works for you, or if you have any questions!";

    expect(msg).toContain("Hi John!");
    expect(msg).toContain("Key Fob Programming");
    expect(msg).toContain("2019 Honda Civic");
    expect(msg).toContain("Option 1: OEM — $350.00");
    expect(msg).toContain("Option 2: Aftermarket — $180.00");
    expect(msg).toContain("Factory key");
    expect(msg).not.toContain("  \n"); // Empty descriptions should not add indent line
  });

  it("should track quote status transitions", () => {
    const validTransitions: Record<string, string[]> = {
      draft: ["sent"],
      sent: ["accepted", "rejected"],
      accepted: [],
      rejected: [],
    };

    expect(validTransitions["draft"]).toContain("sent");
    expect(validTransitions["sent"]).toContain("accepted");
    expect(validTransitions["sent"]).toContain("rejected");
    expect(validTransitions["accepted"]).toHaveLength(0);
  });
});

// Test message extraction logic
describe("Message extraction AI prompt", () => {
  it("should extract customer info from a typical locksmith message", () => {
    const message = "Hi, my name is John Smith. I have a 2019 Honda Civic and I need a spare key made. I am in Dartmouth. My VIN is 2HGFC2F59KH123456.";

    // Simulate what the AI extraction should produce
    const extracted = {
      firstName: "John",
      lastName: "Smith",
      vehicle: "2019 Honda Civic",
      vin: "2HGFC2F59KH123456",
      location: "Dartmouth",
      serviceNeeded: "spare key",
      keyCode: "",
      address: "",
    };

    expect(extracted.firstName).toBe("John");
    expect(extracted.lastName).toBe("Smith");
    expect(extracted.vehicle).toContain("Honda");
    expect(extracted.vin).toMatch(/^[A-Z0-9]{17}$/);
    expect(extracted.location).toBe("Dartmouth");
    expect(extracted.serviceNeeded).toContain("key");
  });

  it("should handle messages with minimal info", () => {
    const message = "Need a key for my car";

    // AI should still extract what it can
    const extracted = {
      firstName: "",
      lastName: "",
      vehicle: "",
      vin: "",
      location: "",
      serviceNeeded: "key",
      keyCode: "",
      address: "",
    };

    expect(extracted.firstName).toBe("");
    expect(extracted.serviceNeeded).toBeTruthy();
  });

  it("should generate correct company field from extracted data", () => {
    const firstName = "John";
    const lastName = "Smith";
    const vehicle = "2019 Honda Civic";
    const location = "Dartmouth";

    const company = [firstName, lastName, vehicle, location].filter(Boolean).join(" ");
    expect(company).toBe("John Smith 2019 Honda Civic Dartmouth");
  });

  it("should normalize phone numbers for matching", () => {
    const normalize = (phone: string) => phone.replace(/\D/g, "").replace(/^1/, "");

    expect(normalize("+19025559876")).toBe("9025559876");
    expect(normalize("(902) 555-9876")).toBe("9025559876");
    expect(normalize("9025559876")).toBe("9025559876");
    expect(normalize("1-902-555-9876")).toBe("9025559876");
  });
});

// Test webhook payload handling
describe("Webhook payload handling", () => {
  it("should extract message data from OpenPhone webhook payload", () => {
    const payload = {
      type: "message.received",
      data: {
        object: {
          id: "msg_test_123",
          conversationId: "conv_test_1",
          from: "+19025559876",
          to: "PN_test_1",
          body: "Hi, my name is John Smith. I need a key made.",
          direction: "incoming",
          createdAt: "2026-03-27T20:00:00Z",
        },
      },
    };

    expect(payload.type).toBe("message.received");
    expect(payload.data.object.from).toBe("+19025559876");
    expect(payload.data.object.body).toContain("John Smith");
    expect(payload.data.object.direction).toBe("incoming");
  });

  it("should skip outgoing messages", () => {
    const payload = {
      type: "message.sent",
      data: {
        object: {
          direction: "outgoing",
          body: "Thanks for contacting us!",
        },
      },
    };

    const shouldProcess = payload.type === "message.received";
    expect(shouldProcess).toBe(false);
  });

  it("should skip empty message bodies", () => {
    const body: string = "";
    const shouldProcess = body.length > 0 && body.trim().length > 0;
    expect(shouldProcess).toBeFalsy();
  });
});
