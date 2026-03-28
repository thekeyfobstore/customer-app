import { eq, isNull, and, or, sql } from "drizzle-orm";
import { getDb } from "./db";
import { contacts, appSettings } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";

const BASE_URL = "https://api.openphone.com/v1";

// ── Helpers ──────────────────────────────────────────────────────────

async function getApiKey(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, "openphone_api_key")).limit(1);
  return rows.length > 0 ? rows[0].value : null;
}

async function fetchPhoneNumberIds(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`${BASE_URL}/phone-numbers`, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((p: any) => p.id);
  } catch {
    return [];
  }
}

// ── Batch SourceUrl Push ─────────────────────────────────────────────

/**
 * Push sourceUrl (ClientBook deep link) to ALL real OpenPhone contacts.
 * This makes each contact in OpenPhone show a clickable "ClientBook" link.
 * Rate-limited to avoid hitting OpenPhone API limits.
 */
export async function batchPushSourceUrls(): Promise<{ updated: number; failed: number; total: number }> {
  const apiKey = await getApiKey();
  if (!apiKey) return { updated: 0, failed: 0, total: 0 };

  const db = await getDb();
  if (!db) return { updated: 0, failed: 0, total: 0 };

  // Get all real OpenPhone contacts (not conv- prefixed) that have a phone number
  const allContacts = await db.select().from(contacts);
  const realContacts = allContacts.filter(
    (c) => c.openPhoneId && !c.openPhoneId.startsWith("conv-") && c.phone
  );

  let updated = 0;
  let failed = 0;

  for (const contact of realContacts) {
    try {
      const phoneDigits = (contact.phone || "").replace(/\D/g, "");
      const sourceUrl = `https://custcrmapp-nxdjk2u8.manus.space/link?phone=${phoneDigits}`;

      const body = {
        sourceUrl,
        source: "ClientBook",
      };

      const res = await fetch(`${BASE_URL}/contacts/${contact.openPhoneId}`, {
        method: "PATCH",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        updated++;
      } else {
        failed++;
      }

      // Rate limit: 200ms between requests to stay under OpenPhone limits
      await new Promise((r) => setTimeout(r, 200));

      // Log progress every 100
      if ((updated + failed) % 100 === 0) {
        console.log(`[Batch SourceUrl] Progress: ${updated + failed}/${realContacts.length} (${updated} ok, ${failed} failed)`);
      }
    } catch {
      failed++;
    }
  }

  console.log(`[Batch SourceUrl] Done: ${updated} updated, ${failed} failed out of ${realContacts.length}`);
  return { updated, failed, total: realContacts.length };
}

// ── Batch Conversation Extraction ────────────────────────────────────

/**
 * For contacts missing name/vehicle/location, fetch their conversation history
 * from OpenPhone and use AI to extract the info.
 * 
 * This processes contacts in batches to avoid overwhelming the API.
 * Prioritizes contacts with recent activity.
 */
export async function batchExtractFromConversations(
  limit: number = 50
): Promise<{ processed: number; extracted: number; failed: number }> {
  const apiKey = await getApiKey();
  if (!apiKey) return { processed: 0, extracted: 0, failed: 0 };

  const db = await getDb();
  if (!db) return { processed: 0, extracted: 0, failed: 0 };

  const phoneNumberIds = await fetchPhoneNumberIds(apiKey);
  if (phoneNumberIds.length === 0) return { processed: 0, extracted: 0, failed: 0 };

  // Get contacts that need extraction: missing vehicle OR missing name, and have a phone
  const allContacts = await db.select().from(contacts);
  const needsExtraction = allContacts
    .filter((c) => {
      if (!c.phone) return false;
      // Missing vehicle or missing first name
      const missingVehicle = !c.vehicleYearMakeModel;
      const missingName = !c.firstName;
      return missingVehicle || missingName;
    })
    // Prioritize by lastActivityAt (most recent first)
    .sort((a, b) => {
      const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit);

  let processed = 0;
  let extracted = 0;
  let failed = 0;

  for (const contact of needsExtraction) {
    try {
      // Fetch conversation messages for this contact
      const phone = contact.phone || "";
      const phoneFormatted = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

      let messages: string[] = [];
      for (const pnId of phoneNumberIds) {
        const url = `${BASE_URL}/messages?phoneNumberId=${pnId}&participants=${encodeURIComponent(phoneFormatted)}&maxResults=20`;
        const res = await fetch(url, {
          headers: { Authorization: apiKey, "Content-Type": "application/json" },
        });
        if (!res.ok) continue;
        const data = await res.json();
        const msgs = data.data || [];
        if (msgs.length > 0) {
          messages = msgs
            .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map((m: any) => {
              const dir = m.direction === "incoming" ? "Customer" : "You";
              const text = m.text || m.body || "";
              return `${dir}: ${text}`;
            })
            .filter((m: string) => m.length > 5);
          break;
        }
      }

      if (messages.length === 0) {
        processed++;
        // Rate limit
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

      // Use AI to extract info
      const extractedData = await extractInfoFromMessages(messages);
      if (!extractedData) {
        processed++;
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      // Build updates — only fill empty fields
      const updates: Record<string, any> = {};
      if (!contact.firstName && extractedData.firstName) updates.firstName = extractedData.firstName;
      if (!contact.lastName && extractedData.lastName) updates.lastName = extractedData.lastName;
      if (!contact.vehicleYearMakeModel && extractedData.vehicle) updates.vehicleYearMakeModel = extractedData.vehicle;
      if (!contact.vin && extractedData.vin) updates.vin = extractedData.vin;
      if (!contact.address && (extractedData.address || extractedData.location)) {
        updates.address = extractedData.address || extractedData.location;
      }

      // Store extraction metadata in rawJson
      try {
        const rawData = contact.rawJson ? JSON.parse(contact.rawJson) : {};
        rawData.lastExtraction = { ...extractedData, extractedAt: new Date().toISOString() };
        if (extractedData.serviceNeeded) rawData.serviceNeeded = extractedData.serviceNeeded;
        if (extractedData.location) rawData.location = extractedData.location;
        updates.rawJson = JSON.stringify(rawData);
      } catch { /* ignore */ }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await db.update(contacts).set(updates).where(eq(contacts.id, contact.id));
        extracted++;
        console.log(`[Batch Extract] Updated ${contact.id} (${contact.phone}): ${Object.keys(updates).filter(k => k !== 'rawJson' && k !== 'updatedAt').join(', ')}`);
      }

      processed++;

      // Rate limit between AI calls
      await new Promise((r) => setTimeout(r, 500));

      // Log progress every 10
      if (processed % 10 === 0) {
        console.log(`[Batch Extract] Progress: ${processed}/${needsExtraction.length} (${extracted} extracted)`);
      }
    } catch (err) {
      console.error(`[Batch Extract] Error processing ${contact.phone}:`, err);
      failed++;
      processed++;
    }
  }

  console.log(`[Batch Extract] Done: ${processed} processed, ${extracted} extracted, ${failed} failed`);
  return { processed, extracted, failed };
}

// ── AI Extraction (reused from message-webhook) ─────────────────────

interface ExtractedData {
  firstName: string;
  lastName: string;
  vehicle: string;
  vin: string;
  location: string;
  serviceNeeded: string;
  keyCode: string;
  address: string;
}

async function extractInfoFromMessages(messages: string[]): Promise<ExtractedData | null> {
  if (messages.length === 0) return null;

  const messageText = messages.join("\n");

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a data extraction assistant for a mobile automotive locksmith / key fob business in Nova Scotia, Canada.
Analyze the SMS conversation and extract any customer information mentioned.

Look for:
- Customer name (first and last)
- Vehicle info: year, make, model combined into one string (e.g. "2019 Honda Civic")
- VIN number (17-character alphanumeric code)
- Location / city / area (e.g. "Dartmouth", "Pictou", "Halifax", "Sydney", "Truro")
- What service they need (e.g. "key fob programming", "ignition replacement", "spare key", "push to start")
- Key code if mentioned
- Full address if mentioned

Return ONLY information explicitly stated in the messages. Use empty strings for anything not found.
Do NOT guess or fabricate information.

Return a JSON object with these exact keys:
{
  "firstName": "",
  "lastName": "",
  "vehicle": "",
  "vin": "",
  "location": "",
  "serviceNeeded": "",
  "keyCode": "",
  "address": ""
}`,
        },
        {
          role: "user",
          content: `Extract customer info from this conversation:\n\n${messageText}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = result.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(typeof content === "string" ? content : "{}");
    return {
      firstName: parsed.firstName || parsed.first_name || "",
      lastName: parsed.lastName || parsed.last_name || "",
      vehicle: parsed.vehicle || parsed.vehicleInfo || parsed.year_make_model || "",
      vin: parsed.vin || parsed.VIN || "",
      location: parsed.location || parsed.city || parsed.area || "",
      serviceNeeded: parsed.serviceNeeded || parsed.service_needed || parsed.service || "",
      keyCode: parsed.keyCode || parsed.key_code || "",
      address: parsed.address || "",
    };
  } catch (err) {
    console.error("[Batch Extract] AI extraction error:", err);
    return null;
  }
}

// ── Auto-extraction during sync ──────────────────────────────────────

/**
 * Run a small batch of extractions automatically after each sync cycle.
 * Processes 5 contacts per cycle to avoid overloading.
 */
export async function autoExtractOnSync(): Promise<void> {
  try {
    const result = await batchExtractFromConversations(5);
    if (result.extracted > 0) {
      console.log(`[Auto Extract] Extracted info for ${result.extracted} contacts during sync`);
    }
  } catch (err) {
    console.error("[Auto Extract] Error:", err);
  }
}
