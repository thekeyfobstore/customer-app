import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { contacts, appSettings } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";

/**
 * OpenPhone message webhook handler.
 * When a customer texts, OpenPhone sends a webhook event here.
 * We use AI to extract customer info and auto-update/create their profile in the DB.
 * The app's 30-second polling picks up the changes automatically.
 */

const BASE_URL = "https://api.openphone.com/v1";

// ── Types ────────────────────────────────────────────────────────────

interface OpenPhoneMessageEvent {
  type: string;
  data: {
    object: {
      id: string;
      conversationId: string;
      from: string;
      to: string;
      body: string;
      direction: "incoming" | "outgoing";
      createdAt: string;
      media?: Array<{ url: string; type: string }>;
    };
  };
}

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

// ── Helpers ──────────────────────────────────────────────────────────

/** Normalize phone to last 10 digits. */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Get stored OpenPhone API key. */
async function getApiKey(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, "openphone_api_key")).limit(1);
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

// ── Conversation Fetcher ─────────────────────────────────────────────

/**
 * Fetch recent messages from an OpenPhone conversation for context.
 * Uses phoneNumberId (the "to" field from the webhook) and the customer's phone.
 */
async function fetchConversationMessages(
  apiKey: string,
  phoneNumberId: string,
  participantPhone: string,
  limit: number = 20
): Promise<string[]> {
  try {
    const url = `${BASE_URL}/messages?phoneNumberId=${phoneNumberId}&participants=${encodeURIComponent(participantPhone)}&maxResults=${limit}`;
    const response = await fetch(url, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (!response.ok) return [];

    const data = await response.json();
    const messages = data.data || [];

    return messages
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((m: any) => {
        const dir = m.direction === "incoming" ? "Customer" : "You";
        return `${dir}: ${m.body || ""}`;
      })
      .filter((m: string) => m.trim().length > 5);
  } catch (err) {
    console.error("[Message Webhook] Error fetching conversation:", err);
    return [];
  }
}

// ── AI Extraction ────────────────────────────────────────────────────

/**
 * Use the built-in LLM to extract customer info from message conversation.
 * Returns only explicitly mentioned data — never guesses.
 */
async function extractInfoFromMessages(messages: string[]): Promise<ExtractedData | null> {
  if (messages.length === 0) return null;

  const messageText = messages.join("\n");

  try {
    const result = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a data extraction assistant for a mobile automotive locksmith / key fob business.
Analyze the SMS conversation and extract any customer information mentioned.

Look for:
- Customer name (first and last)
- Vehicle info: year, make, model combined into one string (e.g. "2019 Honda Civic")
- VIN number (17-character alphanumeric code)
- Location / city / area (e.g. "Dartmouth", "Pictou", "Halifax")
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
    console.error("[Message Webhook] AI extraction error:", err);
    return null;
  }
}

// ── Main Webhook Processor ───────────────────────────────────────────

/**
 * Process an incoming message webhook event:
 * 1. Find or create the contact by phone number
 * 2. Fetch conversation history for context
 * 3. Use AI to extract info
 * 4. Update the contact in the database
 *
 * The app's 30-second server poll will pick up the changes automatically.
 */
export async function processMessageWebhook(event: OpenPhoneMessageEvent): Promise<{
  action: "created" | "updated" | "skipped";
  phone: string;
  extracted: ExtractedData | null;
}> {
  const message = event.data?.object;
  if (!message) return { action: "skipped", phone: "", extracted: null };

  // Only process incoming messages (from customers)
  if (message.direction !== "incoming") {
    return { action: "skipped", phone: "", extracted: null };
  }

  // Skip empty messages
  if (!message.body || message.body.trim().length === 0) {
    return { action: "skipped", phone: "", extracted: null };
  }

  const customerPhone = normalizePhone(message.from);
  if (!customerPhone) return { action: "skipped", phone: "", extracted: null };

  console.log(`[Message Webhook] Processing incoming from ${customerPhone}: "${message.body.substring(0, 80)}..."`);

  const db = await getDb();
  if (!db) {
    console.error("[Message Webhook] Database not available");
    return { action: "skipped", phone: customerPhone, extracted: null };
  }

  // ── Build conversation context ──
  const apiKey = await getApiKey();
  let conversationMessages = [`Customer: ${message.body}`];

  if (apiKey) {
    try {
      const moreMessages = await fetchConversationMessages(apiKey, message.to, message.from, 20);
      if (moreMessages.length > 0) {
        conversationMessages = moreMessages;
      }
    } catch {
      console.log("[Message Webhook] Could not fetch history, using single message");
    }
  }

  // ── AI extraction ──
  const extracted = await extractInfoFromMessages(conversationMessages);
  if (!extracted) {
    console.log("[Message Webhook] No info extracted");
    // Still record the message timestamp on the contact if they exist
    await touchContact(db, customerPhone, message.body);
    return { action: "skipped", phone: customerPhone, extracted: null };
  }

  console.log("[Message Webhook] Extracted:", JSON.stringify(extracted));

  // ── Find existing contact ──
  const existing = await findContactByPhone(db, customerPhone);

  if (existing) {
    // Update existing — only fill empty fields, never overwrite
    const updates = buildUpdates(existing, extracted, message.body);

    if (Object.keys(updates).length > 0) {
      await db.update(contacts).set(updates).where(eq(contacts.id, existing.id));
      console.log(`[Message Webhook] Updated contact ${existing.id}:`, Object.keys(updates));
      return { action: "updated", phone: customerPhone, extracted };
    }

    console.log(`[Message Webhook] No new info for contact ${existing.id}`);
    return { action: "skipped", phone: customerPhone, extracted };
  } else {
    // Create new contact
    await createContactFromExtraction(db, customerPhone, extracted, message.body);
    console.log(`[Message Webhook] Created new contact for ${customerPhone}`);
    return { action: "created", phone: customerPhone, extracted };
  }
}

// ── Database Helpers ─────────────────────────────────────────────────

async function findContactByPhone(db: any, phone10: string) {
  // Try exact match
  let rows = await db.select().from(contacts).where(eq(contacts.phone, phone10)).limit(1);
  if (rows.length > 0) return rows[0];

  // Try with +1 prefix
  rows = await db.select().from(contacts).where(eq(contacts.phone, `+1${phone10}`)).limit(1);
  if (rows.length > 0) return rows[0];

  // Try with 1 prefix
  rows = await db.select().from(contacts).where(eq(contacts.phone, `1${phone10}`)).limit(1);
  if (rows.length > 0) return rows[0];

  return null;
}

/** Update lastMessageAt on a contact even when no extraction happens. */
async function touchContact(db: any, phone10: string, body: string) {
  const existing = await findContactByPhone(db, phone10);
  if (!existing) return;

  try {
    const rawData = existing.rawJson ? JSON.parse(existing.rawJson) : {};
    rawData.lastMessageAt = new Date().toISOString();
    rawData.lastMessageBody = body.substring(0, 200);
    await db.update(contacts).set({ rawJson: JSON.stringify(rawData) }).where(eq(contacts.id, existing.id));
  } catch { /* ignore */ }
}

/** Build update object — only fill empty fields. */
function buildUpdates(existing: any, extracted: ExtractedData, messageBody: string): Record<string, any> {
  const updates: Record<string, any> = {};

  if (!existing.firstName && extracted.firstName) updates.firstName = extracted.firstName;
  if (!existing.lastName && extracted.lastName) updates.lastName = extracted.lastName;
  if (!existing.vehicleYearMakeModel && extracted.vehicle) updates.vehicleYearMakeModel = extracted.vehicle;
  if (!existing.vin && extracted.vin) updates.vin = extracted.vin;
  if (!existing.keyCode && extracted.keyCode) updates.keyCode = extracted.keyCode;
  if (!existing.address && extracted.address) updates.address = extracted.address;
  if (!existing.address && !extracted.address && extracted.location) updates.address = extracted.location;

  // Always update rawJson with latest message info + extracted metadata
  try {
    const rawData = existing.rawJson ? JSON.parse(existing.rawJson) : {};
    if (extracted.serviceNeeded) rawData.serviceNeeded = extracted.serviceNeeded;
    if (extracted.location) rawData.location = extracted.location;
    rawData.lastMessageAt = new Date().toISOString();
    rawData.lastMessageBody = messageBody.substring(0, 200);
    rawData.lastExtraction = {
      ...extracted,
      extractedAt: new Date().toISOString(),
    };
    updates.rawJson = JSON.stringify(rawData);
  } catch { /* ignore */ }

  return updates;
}

/** Create a new contact from extracted message data. */
async function createContactFromExtraction(
  db: any,
  phone: string,
  extracted: ExtractedData,
  messageBody: string
) {
  // Build company field in user's preferred format: "Name Vehicle Location"
  const companyParts: string[] = [];
  if (extracted.firstName) companyParts.push(extracted.firstName);
  if (extracted.lastName) companyParts.push(extracted.lastName);
  if (extracted.vehicle) companyParts.push(extracted.vehicle);
  if (extracted.location) companyParts.push(extracted.location);

  const rawData: Record<string, any> = {
    source: "message_webhook",
    lastMessageAt: new Date().toISOString(),
    lastMessageBody: messageBody.substring(0, 200),
    lastExtraction: { ...extracted, extractedAt: new Date().toISOString() },
  };
  if (extracted.serviceNeeded) rawData.serviceNeeded = extracted.serviceNeeded;
  if (extracted.location) rawData.location = extracted.location;

  await db.insert(contacts).values({
    openPhoneId: `msg_${phone}_${Date.now()}`,
    firstName: extracted.firstName || null,
    lastName: extracted.lastName || null,
    phone,
    email: null,
    company: companyParts.length > 0 ? companyParts.join(" ") : null,
    vehicleYearMakeModel: extracted.vehicle || null,
    vin: extracted.vin || null,
    keyCode: extracted.keyCode || null,
    dealerComparison: null,
    partNumber: null,
    address: extracted.address || extracted.location || null,
    rawJson: JSON.stringify(rawData),
  });
}

// ── Webhook Registration ─────────────────────────────────────────────

/** Register a webhook with OpenPhone API. */
export async function registerWebhook(
  apiKey: string,
  webhookUrl: string
): Promise<{ id: string; url: string } | null> {
  try {
    const response = await fetch(`${BASE_URL}/webhooks`, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        events: ["message.received"],
        resourceIds: ["*"],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Message Webhook] Failed to register:", err);
      return null;
    }

    const data = await response.json();
    console.log("[Message Webhook] Webhook registered:", data.data?.id);
    return { id: data.data?.id, url: webhookUrl };
  } catch (err) {
    console.error("[Message Webhook] Registration error:", err);
    return null;
  }
}

/** Check if our webhook is already registered. */
export async function getExistingWebhook(
  apiKey: string,
  webhookUrl: string
): Promise<string | null> {
  try {
    const response = await fetch(`${BASE_URL}/webhooks`, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (!response.ok) return null;

    const data = await response.json();
    const existing = (data.data || []).find(
      (w: any) => w.url === webhookUrl && w.status === "enabled"
    );
    return existing?.id || null;
  } catch {
    return null;
  }
}

/** List all registered webhooks. */
export async function listWebhooks(apiKey: string): Promise<any[]> {
  try {
    const response = await fetch(`${BASE_URL}/webhooks`, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}
