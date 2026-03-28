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
 * Fetch all conversations from OpenPhone API with pagination.
 * This captures everyone who has texted/called, even if not saved as a contact.
 */
async function fetchAllConversations(apiKey: string): Promise<any[]> {
  const allConversations: any[] = [];
  let nextPageToken: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 500; // Up to 50,000 conversations

  do {
    let url = `${BASE_URL}/conversations?maxResults=100`;
    if (nextPageToken) {
      url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });

    if (!response.ok) {
      console.error(`[OpenPhone Sync] Conversations API error: ${response.status}`);
      return allConversations;
    }

    const data = await response.json();
    allConversations.push(...(data.data || []));
    nextPageToken = data.nextPageToken;
    pageCount++;
  } while (nextPageToken && pageCount < MAX_PAGES);

  return allConversations;
}

/**
 * Sync conversation participants into the contacts table.
 * For each conversation, if the participant phone number doesn't match
 * any existing contact, create a new contact entry.
 */
async function syncConversationParticipants(): Promise<{ added: number }> {
  const apiKey = await getOpenPhoneApiKey();
  if (!apiKey) return { added: 0 };

  const db = await getDb();
  if (!db) return { added: 0 };

  console.log("[OpenPhone Sync] Fetching conversations for participant discovery...");
  const conversations = await fetchAllConversations(apiKey);
  console.log(`[OpenPhone Sync] Fetched ${conversations.length} conversations`);

  // Get all existing contact phone numbers for fast lookup
  const existingContacts = await db.select({ phone: contacts.phone, openPhoneId: contacts.openPhoneId }).from(contacts);
  const existingPhones = new Set<string>();
  const existingOpenPhoneIds = new Set<string>();
  for (const c of existingContacts) {
    if (c.phone) {
      // Normalize: strip everything except digits, keep last 10
      const digits = c.phone.replace(/\D/g, "").slice(-10);
      if (digits.length >= 7) existingPhones.add(digits);
    }
    if (c.openPhoneId) existingOpenPhoneIds.add(c.openPhoneId);
  }

  let added = 0;

  for (const conv of conversations) {
    const participants: string[] = conv.participants || [];
    const convName = conv.name || "";
    const lastActivityAt = conv.lastActivityAt ? new Date(conv.lastActivityAt) : null;
    const convId = conv.id || "";

    for (const participant of participants) {
      // participant is a phone number in E.164 format
      const digits = participant.replace(/\D/g, "").slice(-10);
      if (digits.length < 7) continue;

      // Skip if we already have this phone number
      if (existingPhones.has(digits)) {
        // But update lastActivityAt if the conversation is more recent
        // We'll handle this via the contacts sync which already has lastActivityAt
        continue;
      }

      // New participant — create a contact from conversation data
      const openPhoneId = `conv-${convId}-${digits}`;
      if (existingOpenPhoneIds.has(openPhoneId)) continue;

      // Parse name from conversation name if available
      let firstName = "";
      let lastName = "";
      if (convName && convName !== participant) {
        const parsed = parseNameFromCompany(convName);
        firstName = parsed.firstName;
        lastName = parsed.lastName;
        // If parsing didn't work, use the whole name as firstName
        if (!firstName && !lastName) {
          const nameParts = convName.trim().split(/\s+/);
          firstName = nameParts[0] || "";
          lastName = nameParts.slice(1).join(" ");
        }
      }

      try {
        await db.insert(contacts).values({
          openPhoneId,
          firstName: firstName || null,
          lastName: lastName || null,
          phone: participant,
          email: null,
          company: convName || null,
          vehicleYearMakeModel: null,
          vin: null,
          keyCode: null,
          dealerComparison: null,
          partNumber: null,
          address: null,
          route: null,
          lastActivityAt,
          rawJson: JSON.stringify(conv),
        });
        added++;
        existingPhones.add(digits);
        existingOpenPhoneIds.add(openPhoneId);
      } catch (err) {
        // Likely duplicate — skip
      }
    }
  }

  console.log(`[OpenPhone Sync] Conversation participants: ${added} new contacts added`);
  return { added };
}

/**
 * Update lastActivityAt for existing contacts from conversation data.
 * This ensures the sort order matches OpenPhone even for contacts
 * that don't have lastActivityAt from the contacts API.
 */
async function updateActivityFromConversations(): Promise<void> {
  const apiKey = await getOpenPhoneApiKey();
  if (!apiKey) return;

  const db = await getDb();
  if (!db) return;

  const conversations = await fetchAllConversations(apiKey);

  // Build a map: normalized phone -> most recent lastActivityAt
  const phoneActivityMap = new Map<string, Date>();
  for (const conv of conversations) {
    const lastActivity = conv.lastActivityAt ? new Date(conv.lastActivityAt) : null;
    if (!lastActivity) continue;

    for (const participant of (conv.participants || [])) {
      const digits = participant.replace(/\D/g, "").slice(-10);
      if (digits.length < 7) continue;

      const existing = phoneActivityMap.get(digits);
      if (!existing || lastActivity > existing) {
        phoneActivityMap.set(digits, lastActivity);
      }
    }
  }

  // Update contacts that have no lastActivityAt or an older one
  const allContacts = await db.select().from(contacts);
  let updatedCount = 0;

  for (const c of allContacts) {
    if (!c.phone) continue;
    const digits = c.phone.replace(/\D/g, "").slice(-10);
    const convActivity = phoneActivityMap.get(digits);
    if (!convActivity) continue;

    // Update if no existing activity or conversation is more recent
    if (!c.lastActivityAt || convActivity > c.lastActivityAt) {
      await db
        .update(contacts)
        .set({ lastActivityAt: convActivity })
        .where(eq(contacts.id, c.id));
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    console.log(`[OpenPhone Sync] Updated lastActivityAt for ${updatedCount} contacts from conversations`);
  }
}

/**
 * Run a single sync and record the timestamp.
 */
async function runSync() {
  try {
    const result = await syncContacts();
    // Also sync conversation participants to catch people not saved as contacts
    const convResult = await syncConversationParticipants();
    // Update lastActivityAt from conversation data so sort order matches OpenPhone
    await updateActivityFromConversations();
    const db = await getDb();
    if (db && (result.total > 0 || convResult.added > 0)) {
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
