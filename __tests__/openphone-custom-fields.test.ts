import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  fetchOpenPhoneContacts,
  convertToCustomers,
  parseCompanyField,
  parseVehicleString,
  extractCustomFields,
} from "../lib/openphone";

describe("parseCompanyField", () => {
  it("parses 'Rennie Maclellan 2017 jeep cherokee pictou repair'", () => {
    const result = parseCompanyField("Rennie Maclellan 2017 jeep cherokee pictou repair");
    expect(result.firstName).toBe("Rennie");
    expect(result.lastName).toBe("Maclellan");
    expect(result.vehicleYear).toBe("2017");
    expect(result.vehicleMake.toLowerCase()).toBe("jeep");
    expect(result.vehicleModel.toLowerCase()).toContain("cherokee");
  });

  it("parses 'Tim Reeves 2016 Jeep Bridgewater'", () => {
    const result = parseCompanyField("Tim Reeves 2016 Jeep Bridgewater");
    expect(result.firstName).toBe("Tim");
    expect(result.lastName).toBe("Reeves");
    expect(result.vehicleYear).toBe("2016");
    expect(result.vehicleMake.toLowerCase()).toBe("jeep");
  });

  it("parses 'Ron MacDonald Mabu 2020 Chevy ignition'", () => {
    const result = parseCompanyField("Ron MacDonald Mabu 2020 Chevy ignition");
    expect(result.firstName).toBe("Ron");
    expect(result.lastName).toContain("MacDonald");
    expect(result.vehicleYear).toBe("2020");
    expect(result.vehicleMake.toLowerCase()).toContain("chevy");
  });

  it("parses '2016 Toyota Corolla (782) 321-6197'", () => {
    const result = parseCompanyField("2016 Toyota Corolla (782) 321-6197");
    expect(result.vehicleYear).toBe("2016");
    expect(result.vehicleMake.toLowerCase()).toBe("toyota");
    expect(result.vehicleModel.toLowerCase()).toContain("corolla");
    // No name expected since it starts with year
    expect(result.firstName).toBe("");
  });

  it("parses 'AKL West Bay rd Dodge ram'", () => {
    const result = parseCompanyField("AKL West Bay rd Dodge ram");
    expect(result.vehicleMake.toLowerCase()).toBe("dodge");
    expect(result.vehicleModel.toLowerCase()).toBe("ram");
  });

  it("handles empty string", () => {
    const result = parseCompanyField("");
    expect(result.firstName).toBe("");
    expect(result.lastName).toBe("");
    expect(result.vehicleYear).toBe("");
  });

  it("parses 'Kristen Landry 2017 Jeep flip key Truro'", () => {
    const result = parseCompanyField("Kristen Landry 2017 Jeep flip key Truro");
    expect(result.firstName).toBe("Kristen");
    expect(result.lastName).toBe("Landry");
    expect(result.vehicleYear).toBe("2017");
    expect(result.vehicleMake.toLowerCase()).toBe("jeep");
  });
});

describe("parseVehicleString", () => {
  it("parses '2017 jeep cherokee Fobik'", () => {
    const result = parseVehicleString("2017 jeep cherokee Fobik");
    expect(result.year).toBe("2017");
    expect(result.make.toLowerCase()).toBe("jeep");
    expect(result.model.toLowerCase()).toBe("cherokee");
  });

  it("parses 'Dodge ram'", () => {
    const result = parseVehicleString("Dodge ram");
    expect(result.year).toBe("");
    expect(result.make.toLowerCase()).toBe("dodge");
    expect(result.model.toLowerCase()).toBe("ram");
  });

  it("parses '2020 Toyota Camry'", () => {
    const result = parseVehicleString("2020 Toyota Camry");
    expect(result.year).toBe("2020");
    expect(result.make.toLowerCase()).toBe("toyota");
    expect(result.model.toLowerCase()).toBe("camry");
  });
});

describe("extractCustomFields", () => {
  it("extracts all known custom fields", () => {
    const raw = [
      { key: "vehicle", name: "Year Make Model", type: "string", value: "2017 jeep cherokee" },
      { key: "8439366", name: "VIN", type: "string", value: "1C4RJFBG5HC123456" },
      { key: "key-code", name: "key code", type: "string", value: "ABC123" },
      { key: "1069986", name: "Dealer comparison & part #", type: "string", value: "68239014AA" },
      { key: "address", name: "Address", type: "address", value: "123 Main St" },
    ];
    const result = extractCustomFields(raw)!;
    expect(result!.vehicle).toBe("2017 jeep cherokee");
    expect(result!.vin).toBe("1C4RJFBG5HC123456");
    expect(result!.keyCode).toBe("ABC123");
    expect(result!.dealerComparison).toBe("68239014AA");
    expect(result!.address).toBe("123 Main St");
  });

  it("detects part number by name", () => {
    const raw = [
      { key: "part-number", name: "Part Number", type: "string", value: "PN-12345" },
    ];
    const result = extractCustomFields(raw)!;
    expect(result!.partNumber).toBe("PN-12345");
  });

  it("skips Notion customer made field", () => {
    const raw = [
      { key: "entered-in-quickbooks", name: "Notion customer made", type: "boolean", value: true },
    ];
    const result = extractCustomFields(raw)!;
    expect(result!.vehicle).toBeUndefined();
    expect(result!.vin).toBeUndefined();
  });

  it("handles empty custom fields array", () => {
    const result = extractCustomFields([])!;
    expect(result!.vehicle).toBeUndefined();
  });
});

describe("convertToCustomers with custom fields", () => {
  it("creates vehicle from custom fields", () => {
    const contacts = [
      {
        id: "test1",
        firstName: "John",
        lastName: "Doe",
        phoneNumbers: [{ number: "+19025551234" }],
        emails: [],
        company: "",
        selected: true,
        customFields: {
          vehicle: "2020 Toyota Camry",
          vin: "4T1B11HK5LU123456",
          keyCode: "KEY123",
          dealerComparison: "68239014AA",
          partNumber: "PN-999",
        },
      },
    ];

    const customers = convertToCustomers(contacts);
    expect(customers).toHaveLength(1);
    expect(customers[0].vehicles).toHaveLength(1);

    const v = customers[0].vehicles![0];
    expect(v.year).toBe("2020");
    expect(v.make.toLowerCase()).toBe("toyota");
    expect(v.model.toLowerCase()).toBe("camry");
    expect(v.vin).toBe("4T1B11HK5LU123456");
    expect(v.keyCode).toBe("KEY123");
    expect(v.dealerComparison).toBe("68239014AA");
    expect(v.partNumber).toBe("PN-999");
  });

  it("extracts vehicle from company field when no custom fields", () => {
    const contacts = [
      {
        id: "test2",
        firstName: "Jane",
        lastName: "Smith",
        phoneNumbers: [{ number: "+19025559876" }],
        emails: [],
        company: "Jane Smith 2019 Honda Civic Halifax",
        selected: true,
      },
    ];

    const customers = convertToCustomers(contacts);
    expect(customers).toHaveLength(1);
    expect(customers[0].vehicles).toHaveLength(1);

    const v = customers[0].vehicles![0];
    expect(v.year).toBe("2019");
    expect(v.make.toLowerCase()).toBe("honda");
    expect(v.model.toLowerCase()).toContain("civic");
  });

  it("maps address from custom field", () => {
    const contacts = [
      {
        id: "test3",
        firstName: "Bob",
        lastName: "Jones",
        phoneNumbers: [{ number: "+19025554321" }],
        emails: [],
        company: "",
        selected: true,
        customFields: {
          address: "Near Eskasoni",
        },
      },
    ];

    const customers = convertToCustomers(contacts);
    expect(customers[0].address).toBeDefined();
    expect(customers[0].address!.street).toBe("Near Eskasoni");
  });
});

describe("fetchOpenPhoneContacts with custom fields", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("extracts custom fields and parses company name", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "contact1",
            defaultFields: {
              firstName: null,
              lastName: null,
              company: "Rennie Maclellan 2017 jeep cherokee pictou repair",
              phoneNumbers: [{ value: "+19025551111" }],
              emails: [],
            },
            customFields: [
              { key: "vehicle", name: "Year Make Model", type: "string", value: "2017 jeep cherokee Fobik" },
              { key: "8439366", name: "VIN", type: "string", value: "1C4RJFBG5HC999999" },
              { key: "key-code", name: "key code", type: "string", value: "KEYABC" },
              { key: "entered-in-quickbooks", name: "Notion customer made", type: "boolean", value: true },
            ],
          },
        ],
        totalItems: 1,
        nextPageToken: null,
      }),
    });

    const contacts = await fetchOpenPhoneContacts("test-api-key");
    expect(contacts).toHaveLength(1);

    const c = contacts[0];
    // Name parsed from company field
    expect(c.firstName).toBe("Rennie");
    expect(c.lastName).toBe("Maclellan");
    // Company preserved
    expect(c.company).toBe("Rennie Maclellan 2017 jeep cherokee pictou repair");
    // Custom fields extracted
    expect(c.customFields?.vehicle).toBe("2017 jeep cherokee Fobik");
    expect(c.customFields?.vin).toBe("1C4RJFBG5HC999999");
    expect(c.customFields?.keyCode).toBe("KEYABC");
  });
});
