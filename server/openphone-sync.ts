import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import { contacts, appSettings, type InsertContact } from "../drizzle/schema";

const BASE_URL = "https://api.openphone.com/v1";
const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Known OpenPhone custom field keys for The Key Fob Store.
 */
const CUSTOM_FIELD_MAP: Record<string, string> = {
  vehicle: "vehicle",
  "8439366": "vin",
  "key-code": "keyCode",
  "1069986": "dealerComparison",
};

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

function extractCustomFields(rawCustomFields: any[]): Record<string, string> {
  const result: Record<string, string> = {};
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
    } else if (key === "route" || name === "route" || name.includes("route")) {
      result.route = String(value);
    }
  }
  return result;
}

/**
 * Parse the company field to extract first/last name.
 * Format: "FirstName LastName Year Make Model Location Extra"
 */
function parseNameFromCompany(company: string): { firstName: string; lastName: string } {
  if (!company || !company.trim()) return { firstName: "", lastName: "" };

  const words = company.trim().split(/\s+/);

  // Find the year (4-digit number starting with 19 or 20)
  let yearIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const cleaned = words[i].replace(/[^0-9]/g, "");
    if (/^(19|20)\d{2}$/.test(cleaned)) {
      yearIndex = i;
      break;
    }
  }

  // Find the vehicle make
  let makeIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase().replace(/[^a-z]/g, "");
    if (VEHICLE_MAKES.includes(word)) {
      makeIndex = i;
      break;
    }
  }

  const nameEndIndex = yearIndex >= 0 ? yearIndex : (makeIndex >= 0 ? makeIndex : -1);

  if (nameEndIndex > 0) {
    const nameWords = words.slice(0, nameEndIndex);
    if (nameWords.length >= 2) {
      return { firstName: nameWords[0], lastName: nameWords.slice(1).join(" ") };
    } else if (nameWords.length === 1) {
      return { firstName: nameWords[0], lastName: "" };
    }
  } else if (nameEndIndex < 0) {
    // No vehicle info found — try first two words as name
    const potentialNames: string[] = [];
    for (const w of words) {
      if (/\d/.test(w)) break;
      if (VEHICLE_MAKES.includes(w.toLowerCase())) break;
      potentialNames.push(w);
      if (potentialNames.length >= 2) break;
    }
    if (potentialNames.length >= 2) {
      return { firstName: potentialNames[0], lastName: potentialNames[1] };
    } else if (potentialNames.length === 1) {
      return { firstName: potentialNames[0], lastName: "" };
    }
  }

  return { firstName: "", lastName: "" };
}

/**
 * Get the stored OpenPhone API key from the database.
 */
async function getOpenPhoneApiKey(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "openphone_api_key"))
      .limit(1);
    return result.length > 0 ? result[0].value : null;
  } catch {
    return null;
  }
}

/**
 * Save the OpenPhone API key to the database.
 */
export async function setOpenPhoneApiKey(apiKey: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .insert(appSettings)
    .values({ key: "openphone_api_key", value: apiKey })
    .onDuplicateKeyUpdate({ set: { value: apiKey } });
}

/**
 * Fetch all contacts from OpenPhone API with pagination.
 */
async function fetchAllContacts(apiKey: string): Promise<any[]> {
  const allContacts: any[] = [];
  let nextPageToken: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 200;

  do {
    let url = `${BASE_URL}/contacts?pageSize=100`;
    if (nextPageToken) {
      url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error(`[OpenPhone Sync] API error: ${response.status}`);
      return allContacts; // Return what we have so far
    }

    const data = await response.json();
    allContacts.push(...(data.data || []));
    nextPageToken = data.nextPageToken;
    pageCount++;
  } while (nextPageToken && pageCount < MAX_PAGES);

  return allContacts;
}

/**
 * Sync contacts from OpenPhone to the database.
 * Upserts by openPhoneId so updates are captured.
 */
async function syncContacts(): Promise<{ added: number; updated: number; total: number }> {
  const apiKey = await getOpenPhoneApiKey();
  if (!apiKey) {
    console.log("[OpenPhone Sync] No API key configured, skipping sync");
    return { added: 0, updated: 0, total: 0 };
  }

  const db = await getDb();
  if (!db) {
    console.log("[OpenPhone Sync] Database not available, skipping sync");
    return { added: 0, updated: 0, total: 0 };
  }

  console.log("[OpenPhone Sync] Starting sync...");
  const rawContacts = await fetchAllContacts(apiKey);
  console.log(`[OpenPhone Sync] Fetched ${rawContacts.length} contacts from OpenPhone`);

  let added = 0;
  let updated = 0;

  for (const c of rawContacts) {
    const df = c.defaultFields || {};
    const rawCustom = c.customFields || [];
    const customFields = extractCustomFields(rawCustom);

    const firstName = df.firstName || c.firstName || "";
    const lastName = df.lastName || c.lastName || "";
    const company = df.company || c.company || "";

    // Parse name from company if needed
    let finalFirstName = firstName;
    let finalLastName = lastName;
    if (!firstName && !lastName && company) {
      const parsed = parseNameFromCompany(company);
      finalFirstName = parsed.firstName;
      finalLastName = parsed.lastName;
    }

    const phone = (df.phoneNumbers || c.phoneNumbers || [])[0]?.value ||
                  (df.phoneNumbers || c.phoneNumbers || [])[0]?.number || "";
    const email = (df.emails || c.emails || [])[0]?.value ||
                  (df.emails || c.emails || [])[0]?.address || "";

    // Extract lastActivityAt from OpenPhone — this is the timestamp of the most recent
    // conversation activity (message or call), which determines the contact order in OpenPhone
    const lastActivityRaw = c.lastActivityAt || c.updatedAt || c.createdAt || null;
    const lastActivityAt = lastActivityRaw ? new Date(lastActivityRaw) : null;

    const contactData: InsertContact = {
      openPhoneId: c.id,
      firstName: finalFirstName || null,
      lastName: finalLastName || null,
      phone: phone || null,
      email: email || null,
      company: company || null,
      vehicleYearMakeModel: customFields.vehicle || null,
      vin: customFields.vin || null,
      keyCode: customFields.keyCode || null,
      dealerComparison: customFields.dealerComparison || null,
      partNumber: customFields.partNumber || null,
      address: customFields.address || null,
      route: customFields.route || null,
      lastActivityAt,
      rawJson: JSON.stringify(c),
    };

    try {
      // Check if contact exists
      const existing = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.openPhoneId, c.id))
        .limit(1);

      if (existing.length > 0) {
        // Update
        await db
          .update(contacts)
          .set(contactData)
          .where(eq(contacts.openPhoneId, c.id));
        updated++;
      } else {
        // Insert
        await db.insert(contacts).values(contactData);
        added++;
      }
    } catch (err) {
      console.error(`[OpenPhone Sync] Error upserting contact ${c.id}:`, err);
    }
  }

  console.log(`[OpenPhone Sync] Complete: ${added} added, ${updated} updated, ${rawContacts.length} total`);
  return { added, updated, total: rawContacts.length };
}

/**
 * Get all synced contacts from the database.
 */
export async function getSyncedContacts() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(contacts).orderBy(desc(contacts.lastActivityAt));
}

/**
 * Get sync status info.
 */
export async function getSyncStatus() {
  const apiKey = await getOpenPhoneApiKey();
  const db = await getDb();

  let contactCount = 0;
  let lastSync: string | null = null;

  if (db) {
    try {
      const result = await db.select().from(appSettings).where(eq(appSettings.key, "last_sync_time")).limit(1);
      lastSync = result.length > 0 ? result[0].value : null;

      const countResult = await db.select().from(contacts);
      contactCount = countResult.length;
    } catch { /* ignore */ }
  }

  return {
    configured: !!apiKey,
    contactCount,
    lastSync,
    intervalMs: SYNC_INTERVAL_MS,
  };
}

/**
 * Run a single sync and record the timestamp.
 */
async function runSync() {
  try {
    const result = await syncContacts();
    const db = await getDb();
    if (db && result.total > 0) {
      const now = new Date().toISOString();
      await db
        .insert(appSettings)
        .values({ key: "last_sync_time", value: now })
        .onDuplicateKeyUpdate({ set: { value: now } });
    }
  } catch (err) {
    console.error("[OpenPhone Sync] Sync failed:", err);
  }
}

/**
 * Start the background sync loop.
 * Runs immediately on start, then every SYNC_INTERVAL_MS.
 */
export function startSyncLoop() {
  console.log(`[OpenPhone Sync] Starting sync loop (interval: ${SYNC_INTERVAL_MS / 1000}s)`);

  // Run immediately
  runSync();

  // Then run on interval
  setInterval(runSync, SYNC_INTERVAL_MS);
}

/**
 * Trigger an immediate sync (e.g., when API key is first saved).
 */
export async function triggerSync() {
  return runSync();
}
