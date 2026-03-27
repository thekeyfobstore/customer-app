import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { contacts, appSettings } from "../drizzle/schema";
import { processMessageWebhook } from "./message-webhook";

/**
 * Message Poller — Fallback for webhook delivery.
 * Polls OpenPhone for recent messages every 2 minutes.
 * If a message is newer than our last poll, we process it through the extraction pipeline.
 * This ensures no messages are missed even if the webhook fails.
 */

const BASE_URL = "https://api.openphone.com/v1";
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const LAST_POLL_KEY = "last_message_poll_time";

/** Track processed message IDs to avoid duplicates (in-memory, resets on restart). */
const processedMessageIds = new Set<string>();
const MAX_PROCESSED_IDS = 5000;

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

async function getLastPollTime(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, LAST_POLL_KEY)).limit(1);
    return rows.length > 0 ? rows[0].value : null;
  } catch {
    return null;
  }
}

async function setLastPollTime(time: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(appSettings)
      .values({ key: LAST_POLL_KEY, value: time })
      .onDuplicateKeyUpdate({ set: { value: time } });
  } catch { /* ignore */ }
}

/**
 * Fetch phone number IDs from OpenPhone (needed to query messages).
 */
async function fetchPhoneNumberIds(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(`${BASE_URL}/phone-numbers`, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map((pn: any) => pn.id);
  } catch {
    return [];
  }
}

/**
 * Fetch recent messages for a phone number since a given time.
 */
async function fetchRecentMessages(
  apiKey: string,
  phoneNumberId: string,
  since: string
): Promise<any[]> {
  try {
    const url = `${BASE_URL}/messages?phoneNumberId=${phoneNumberId}&maxResults=50&createdAfter=${encodeURIComponent(since)}`;
    const response = await fetch(url, {
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Run one poll cycle: fetch recent incoming messages and process them.
 */
async function pollMessages(): Promise<void> {
  const apiKey = await getApiKey();
  if (!apiKey) return;

  // Default to 5 minutes ago if no last poll time
  const lastPoll = await getLastPollTime();
  const since = lastPoll || new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const phoneNumberIds = await fetchPhoneNumberIds(apiKey);
  if (phoneNumberIds.length === 0) return;

  let processedCount = 0;

  for (const pnId of phoneNumberIds) {
    const messages = await fetchRecentMessages(apiKey, pnId, since);

    for (const msg of messages) {
      // Skip if already processed
      if (processedMessageIds.has(msg.id)) continue;
      // Only process incoming messages
      if (msg.direction !== "incoming") continue;
      // Skip empty
      if (!msg.body || msg.body.trim().length === 0) continue;

      // Process through the same extraction pipeline as webhooks
      try {
        await processMessageWebhook({
          type: "message.received",
          data: {
            object: {
              id: msg.id,
              conversationId: msg.conversationId || "",
              from: msg.from || "",
              to: pnId,
              body: msg.body,
              direction: "incoming",
              createdAt: msg.createdAt,
            },
          },
        });

        processedMessageIds.add(msg.id);
        processedCount++;

        // Trim processed IDs set to prevent memory leak
        if (processedMessageIds.size > MAX_PROCESSED_IDS) {
          const idsArray = Array.from(processedMessageIds);
          for (let i = 0; i < 1000; i++) {
            processedMessageIds.delete(idsArray[i]);
          }
        }
      } catch (err) {
        console.error(`[Message Poller] Error processing message ${msg.id}:`, err);
      }
    }
  }

  // Update last poll time
  await setLastPollTime(new Date().toISOString());

  if (processedCount > 0) {
    console.log(`[Message Poller] Processed ${processedCount} new messages`);
  }
}

/**
 * Start the message polling loop.
 * Runs every 2 minutes alongside the contact sync.
 */
export function startMessagePoller(): void {
  console.log(`[Message Poller] Starting (interval: ${POLL_INTERVAL_MS / 1000}s)`);

  // First poll after 30 seconds (let server start up)
  setTimeout(() => {
    pollMessages().catch((err) => console.error("[Message Poller] Error:", err));
  }, 30000);

  // Then poll on interval
  setInterval(() => {
    pollMessages().catch((err) => console.error("[Message Poller] Error:", err));
  }, POLL_INTERVAL_MS);
}

/**
 * Trigger an immediate poll (e.g., from the app).
 */
export async function triggerMessagePoll(): Promise<{ processed: number }> {
  try {
    await pollMessages();
    return { processed: processedMessageIds.size };
  } catch (err) {
    console.error("[Message Poller] Manual trigger error:", err);
    return { processed: 0 };
  }
}
