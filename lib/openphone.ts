import { Customer, Message, OpenPhoneContact, Vehicle } from "./types";

const BASE_URL = "https://api.openphone.com/v1";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Known OpenPhone custom field keys for The Key Fob Store.
 * Maps the OpenPhone key to our internal field name.
 */
const CUSTOM_FIELD_MAP: Record<string, string> = {
  vehicle: "vehicle",       // "Year Make Model"
  "8439366": "vin",         // "VIN"
  "key-code": "keyCode",    // "key code"
  "1069986": "dealerComparison", // "Dealer comparison & part #"
  // "part-number" or similar key for Part Number — will be detected dynamically
};

/**
 * Extract custom fields from the raw OpenPhone customFields array.
 */
function extractCustomFields(rawCustomFields: any[]): OpenPhoneContact["customFields"] {
  const result: NonNullable<OpenPhoneContact["customFields"]> = {};

  for (const cf of rawCustomFields) {
    const key = cf.key || "";
    const value = cf.value;
    if (!value || value === "") continue;

    const name = (cf.name || "").toLowerCase();

    if (key === "vehicle" || name.includes("year") || name.includes("make")) {
      result.vehicle = String(value);
    } else if (key === "8439366" || name === "vin") {
      result.vin = String(value);
    } else if (key === "key-code" || name.includes("key code")) {
      result.keyCode = String(value);
    } else if (key === "1069986" || name.includes("dealer")) {
      result.dealerComparison = String(value);
    } else if (key === "address" || name === "address") {
      result.address = typeof value === "string" ? value : JSON.stringify(value);
    } else if (name.includes("part") && name.includes("number")) {
      result.partNumber = String(value);
    }
    // Skip "Notion customer made" / "entered-in-quickbooks"
  }

  return result;
}

/**
 * Common vehicle makes for parsing the company field.
 */
const VEHICLE_MAKES = [
  "acura", "alfa", "aston", "audi", "bentley", "bmw", "buick", "cadillac",
  "chevrolet", "chevy", "chrysler", "dodge", "ferrari", "fiat", "ford",
  "genesis", "gmc", "honda", "hyundai", "infiniti", "jaguar", "jeep",
  "kia", "lamborghini", "land rover", "lexus", "lincoln", "maserati",
  "mazda", "mclaren", "mercedes", "mini", "mitsubishi", "nissan",
  "porsche", "ram", "rolls", "saab", "subaru", "suzuki", "tesla",
  "toyota", "volkswagen", "vw", "volvo",
];

/**
 * Parse the company field to extract customer name, vehicle info, and location.
 * Format is typically: "FirstName LastName Year Make Model Location Extra"
 * e.g., "Rennie Maclellan 2017 jeep cherokee pictou repair"
 */
function parseCompanyField(company: string): {
  firstName: string;
  lastName: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  extra: string;
} {
  const result = {
    firstName: "",
    lastName: "",
    vehicleYear: "",
    vehicleMake: "",
    vehicleModel: "",
    extra: "",
  };

  if (!company || !company.trim()) return result;

  const text = company.trim();
  const words = text.split(/\s+/);

  // Find the year (4-digit number starting with 19 or 20)
  let yearIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const cleaned = words[i].replace(/[^0-9]/g, "");
    if (/^(19|20)\d{2}$/.test(cleaned)) {
      yearIndex = i;
      result.vehicleYear = cleaned;
      break;
    }
  }

  // Find the vehicle make
  let makeIndex = -1;
  for (let i = (yearIndex >= 0 ? yearIndex + 1 : 0); i < words.length; i++) {
    const word = words[i].toLowerCase().replace(/[^a-z]/g, "");
    if (VEHICLE_MAKES.includes(word)) {
      makeIndex = i;
      result.vehicleMake = words[i];
      break;
    }
  }

  // If we found a year or make, everything before it is the customer name
  const nameEndIndex = yearIndex >= 0 ? yearIndex : (makeIndex >= 0 ? makeIndex : -1);

  if (nameEndIndex > 0) {
    // Extract name from words before the vehicle info
    const nameWords = words.slice(0, nameEndIndex);
    if (nameWords.length >= 2) {
      result.firstName = nameWords[0];
      result.lastName = nameWords.slice(1).join(" ");
    } else if (nameWords.length === 1) {
      result.firstName = nameWords[0];
    }
  } else if (nameEndIndex === 0) {
    // Year/make is the first word — no name found
  } else {
    // No vehicle info found — try first two words as name if they look like names
    // (no digits, not a known car make)
    const potentialNames: string[] = [];
    for (const w of words) {
      if (/\d/.test(w)) break;
      if (VEHICLE_MAKES.includes(w.toLowerCase())) break;
      potentialNames.push(w);
      if (potentialNames.length >= 2) break;
    }
    if (potentialNames.length >= 2) {
      result.firstName = potentialNames[0];
      result.lastName = potentialNames[1];
    } else if (potentialNames.length === 1) {
      result.firstName = potentialNames[0];
    }
  }

  // Extract model: words after make until we hit a non-model word
  if (makeIndex >= 0) {
    const afterMake = words.slice(makeIndex + 1);
    const modelWords: string[] = [];
    const extraWords: string[] = [];
    let hitExtra = false;

    for (const w of afterMake) {
      if (hitExtra) {
        extraWords.push(w);
        continue;
      }
      const lower = w.toLowerCase();
      // Model words are typically alphanumeric (e.g., "Cherokee", "F-150", "Civic")
      // Stop at common non-model words
      const nonModelWords = [
        "repair", "key", "keys", "fob", "fobik", "flip", "remote", "ignition",
        "prox", "proximity", "push", "start", "smart", "blade", "cut",
        "program", "programming", "coded", "lost", "spare", "duplicate",
        "near", "in", "at", "from",
      ];
      if (nonModelWords.includes(lower) || (lower.length <= 2 && !/^\d+$/.test(lower))) {
        hitExtra = true;
        extraWords.push(w);
      } else {
        modelWords.push(w);
      }
    }

    result.vehicleModel = modelWords.join(" ");
    result.extra = extraWords.join(" ");
  } else if (yearIndex >= 0) {
    // We have a year but no recognized make — everything after year is potential make/model
    const afterYear = words.slice(yearIndex + 1);
    if (afterYear.length >= 1) result.vehicleMake = afterYear[0];
    if (afterYear.length >= 2) result.vehicleModel = afterYear.slice(1).join(" ");
  }

  return result;
}

/**
 * Fetch ALL contacts from OpenPhone with pagination.
 * The API returns contacts inside `defaultFields` with `nextPageToken` for pagination.
 * Also extracts custom fields and parses the company field for name/vehicle info.
 */
export async function fetchOpenPhoneContacts(apiKey: string): Promise<OpenPhoneContact[]> {
  const allContacts: OpenPhoneContact[] = [];
  let nextPageToken: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 200; // Safety limit to avoid infinite loops

  do {
    let url = `${BASE_URL}/contacts?pageSize=100`;
    if (nextPageToken) {
      url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenPhone API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const rawContacts = data.data || [];

    // Map contacts - OpenPhone nests fields inside `defaultFields`
    const contacts: OpenPhoneContact[] = rawContacts.map((c: any) => {
      const df = c.defaultFields || {};
      const rawCustom = c.customFields || [];
      const customFields = extractCustomFields(rawCustom);

      // Parse company field for name/vehicle when firstName/lastName are empty
      const firstName = df.firstName || c.firstName || "";
      const lastName = df.lastName || c.lastName || "";
      const company = df.company || c.company || "";

      let parsedFirstName = firstName;
      let parsedLastName = lastName;

      // If no first/last name, try to parse from company field
      if (!firstName && !lastName && company) {
        const parsed = parseCompanyField(company);
        parsedFirstName = parsed.firstName;
        parsedLastName = parsed.lastName;

        // If custom fields don't have vehicle info, use parsed vehicle
        if (customFields && !customFields.vehicle && (parsed.vehicleYear || parsed.vehicleMake)) {
          customFields.vehicle = [parsed.vehicleYear, parsed.vehicleMake, parsed.vehicleModel]
            .filter(Boolean)
            .join(" ");
        }
      }

      return {
        id: c.id || generateId(),
        firstName: parsedFirstName,
        lastName: parsedLastName,
        phoneNumbers: (df.phoneNumbers || c.phoneNumbers || []).map((p: any) => ({
          number: p.value || p.number || "",
        })),
        emails: (df.emails || c.emails || []).map((e: any) => ({
          address: e.value || e.address || "",
        })),
        company: company,
        selected: true,
        customFields,
      };
    });

    allContacts.push(...contacts);
    nextPageToken = data.nextPageToken;
    pageCount++;
  } while (nextPageToken && pageCount < MAX_PAGES);

  return allContacts;
}

export async function fetchOpenPhoneMessages(
  apiKey: string,
  phoneNumberId?: string
): Promise<any[]> {
  let url = `${BASE_URL}/messages?maxResults=50`;
  if (phoneNumberId) {
    url += `&phoneNumberId=${phoneNumberId}`;
  }

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

export async function fetchOpenPhoneNumbers(apiKey: string): Promise<any[]> {
  const response = await fetch(`${BASE_URL}/phone-numbers`, {
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Send an SMS message via OpenPhone API
 */
export async function sendOpenPhoneMessage(
  apiKey: string,
  phoneNumberId: string,
  to: string,
  content: string
): Promise<any> {
  const response = await fetch(`${BASE_URL}/messages`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      to: [to],
      from: phoneNumberId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send message (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Create a contact in OpenPhone
 * Uses the `defaultFields` structure for the API
 */
export async function createOpenPhoneContact(
  apiKey: string,
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    company?: string;
  }
): Promise<string | null> {
  try {
    const body: any = {
      defaultFields: {
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    };
    if (customer.phone) {
      body.defaultFields.phoneNumbers = [{ name: "Mobile", value: customer.phone }];
    }
    if (customer.email) {
      body.defaultFields.emails = [{ name: "Email", value: customer.email }];
    }
    if (customer.company) {
      body.defaultFields.company = customer.company;
    }

    const response = await fetch(`${BASE_URL}/contacts`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data?.id || null;
  } catch {
    return null;
  }
}

/**
 * Fetch messages for a specific conversation (by phone number)
 */
export async function fetchConversationMessages(
  apiKey: string,
  phoneNumberId: string,
  participantPhone: string
): Promise<any[]> {
  const url = `${BASE_URL}/messages?phoneNumberId=${phoneNumberId}&participants=${encodeURIComponent(participantPhone)}&maxResults=50`;

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Parse the "Year Make Model" custom field string into vehicle parts.
 * e.g., "2017 jeep cherokee Fobik" → { year: "2017", make: "jeep", model: "cherokee" }
 */
function parseVehicleString(vehicleStr: string): { year: string; make: string; model: string } {
  const words = vehicleStr.trim().split(/\s+/);
  let year = "";
  let make = "";
  let model = "";

  let startIdx = 0;

  // Check for year
  if (words.length > 0 && /^(19|20)\d{2}$/.test(words[0])) {
    year = words[0];
    startIdx = 1;
  }

  // Find make
  for (let i = startIdx; i < words.length; i++) {
    const lower = words[i].toLowerCase();
    if (VEHICLE_MAKES.includes(lower)) {
      make = words[i];
      // Model is the next word(s) until we hit a non-model word
      const modelWords: string[] = [];
      const nonModelWords = [
        "fobik", "flip", "key", "keys", "fob", "remote", "ignition",
        "prox", "proximity", "push", "start", "smart", "blade",
        "cut", "program", "programming", "coded", "lost", "spare",
      ];
      for (let j = i + 1; j < words.length; j++) {
        if (nonModelWords.includes(words[j].toLowerCase())) break;
        modelWords.push(words[j]);
      }
      model = modelWords.join(" ");
      break;
    }
  }

  // If no recognized make, use first word after year as make, rest as model
  if (!make && words.length > startIdx) {
    make = words[startIdx];
    if (words.length > startIdx + 1) {
      const nonModelWords = [
        "fobik", "flip", "key", "keys", "fob", "remote", "ignition",
        "prox", "proximity", "push", "start", "smart", "blade",
      ];
      const modelWords: string[] = [];
      for (let j = startIdx + 1; j < words.length; j++) {
        if (nonModelWords.includes(words[j].toLowerCase())) break;
        modelWords.push(words[j]);
      }
      model = modelWords.join(" ");
    }
  }

  return { year, make, model };
}

/**
 * Convert OpenPhone contacts to Customer objects, including custom fields.
 * Parses the company field for name/vehicle info when first/last name are empty.
 */
export function convertToCustomers(contacts: OpenPhoneContact[]): Customer[] {
  const now = new Date().toISOString();
  return contacts
    .filter((c) => c.selected)
    .map((c) => {
      const cf = c.customFields || {};

      // Build vehicle from custom fields
      const vehicles: Vehicle[] = [];
      const hasVehicleInfo = cf.vehicle || cf.vin || cf.keyCode || cf.dealerComparison || cf.partNumber;

      if (hasVehicleInfo) {
        const parsed = cf.vehicle ? parseVehicleString(cf.vehicle) : { year: "", make: "", model: "" };
        vehicles.push({
          id: generateId(),
          year: parsed.year,
          make: parsed.make,
          model: parsed.model,
          vin: cf.vin || "",
          keyCode: cf.keyCode || "",
          dealerComparison: cf.dealerComparison || "",
          partNumber: cf.partNumber || "",
        });
      } else {
        // Try to extract vehicle from company field
        const companyParsed = parseCompanyField(c.company);
        if (companyParsed.vehicleYear || companyParsed.vehicleMake) {
          vehicles.push({
            id: generateId(),
            year: companyParsed.vehicleYear,
            make: companyParsed.vehicleMake,
            model: companyParsed.vehicleModel,
            vin: "",
            keyCode: "",
            dealerComparison: "",
            partNumber: "",
          });
        }
      }

      // Build address from custom field
      let address = undefined;
      if (cf.address) {
        address = {
          street: cf.address,
          city: "",
          state: "",
          zip: "",
        };
      }

      return {
        id: generateId(),
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phoneNumbers?.[0]?.number || "",
        email: c.emails?.[0]?.address || "",
        company: c.company || "",
        notes: "",
        tags: [],
        vehicles,
        address,
        createdAt: now,
        updatedAt: now,
        openPhoneContactId: c.id,
      };
    });
}

export function convertToMessages(
  rawMessages: any[],
  customerMap: Map<string, string>
): Message[] {
  return rawMessages
    .filter((m) => {
      const phone = m.from || m.to;
      return phone && customerMap.has(phone);
    })
    .map((m) => {
      const phone = m.direction === "inbound" ? m.from : m.to;
      return {
        id: m.id || generateId(),
        customerId: customerMap.get(phone) || "",
        body: m.body || m.text || m.content || "",
        direction: m.direction === "inbound" ? ("inbound" as const) : ("outbound" as const),
        createdAt: m.createdAt || new Date().toISOString(),
        from: m.from || "",
        to: m.to || "",
      };
    })
    .filter((m) => m.customerId && m.body);
}

// Export for testing
export { parseCompanyField, parseVehicleString, extractCustomFields };
