import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getSyncedContacts,
  getSyncStatus,
  setOpenPhoneApiKey,
  triggerSync,
} from "./openphone-sync";
import { batchPushSourceUrls, batchExtractFromConversations } from "./batch-operations";
import { triggerMessagePoll } from "./message-poller";
import { listWebhooks } from "./message-webhook";
import { getDb } from "./db";
import { appSettings } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const contactsRouter = router({
  /**
   * Get all synced contacts from the database.
   * The app polls this every 30 seconds to pick up new contacts.
   */
  list: publicProcedure.query(async () => {
    const contacts = await getSyncedContacts();
    return contacts;
  }),

  /**
   * Resolve one synced contact by normalized phone number for OpenPhone deep links.
   */
  findByPhone: publicProcedure
    .input(z.object({ phone: z.string().min(7).max(32) }))
    .query(async ({ input }) => {
      const normalized = input.phone.replace(/\D/g, "").slice(-10);
      if (normalized.length < 7) return null;

      const syncedContacts = await getSyncedContacts();
      return syncedContacts.find((contact) => {
        const contactPhone = (contact.phone || "").replace(/\D/g, "").slice(-10);
        return contactPhone === normalized;
      }) ?? null;
    }),

  /**
   * Get the current sync status (configured, last sync time, contact count).
   */
  syncStatus: publicProcedure.query(async () => {
    return getSyncStatus();
  }),

  /**
   * Save the OpenPhone API key and trigger an immediate sync.
   */
  setApiKey: publicProcedure
    .input(z.object({ apiKey: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await setOpenPhoneApiKey(input.apiKey);
      // Trigger immediate sync after saving key
      await triggerSync();
      const status = await getSyncStatus();
      return { success: true, ...status };
    }),

  /**
   * Trigger an immediate sync (e.g., user presses "Sync Now" button).
   */
  syncNow: publicProcedure.mutation(async () => {
    await triggerSync();
    const status = await getSyncStatus();
    return { success: true, ...status };
  }),

  /**
   * Get the message automation status (webhook + poller).
   */
  messageAutomationStatus: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { active: false, webhookRegistered: false, lastPoll: null, extractionCount: 0 };

    // Check if API key is configured
    const apiKeyRows = await db.select().from(appSettings).where(eq(appSettings.key, "openphone_api_key")).limit(1);
    const apiKey = apiKeyRows.length > 0 ? apiKeyRows[0].value : null;

    // Check webhook registration
    let webhookRegistered = false;
    if (apiKey) {
      try {
        const webhooks = await listWebhooks(apiKey);
        webhookRegistered = webhooks.some(
          (w: any) => w.url?.includes("/api/webhooks/openphone") && w.status === "enabled"
        );
      } catch { /* ignore */ }
    }

    // Get last poll time
    const pollRows = await db.select().from(appSettings).where(eq(appSettings.key, "last_message_poll_time")).limit(1);
    const lastPoll = pollRows.length > 0 ? pollRows[0].value : null;

    // Get extraction count (contacts created from messages)
    let extractionCount = 0;
    try {
      const allContacts = await getSyncedContacts();
      extractionCount = allContacts.filter((c: any) => {
        try {
          const raw = c.rawJson ? JSON.parse(c.rawJson) : {};
          return raw.source === "message_webhook" || raw.lastExtraction;
        } catch { return false; }
      }).length;
    } catch { /* ignore */ }

    return {
      active: !!apiKey,
      webhookRegistered,
      lastPoll,
      extractionCount,
    };
  }),

  /**
   * Trigger an immediate message poll (check for new messages now).
   */
  pollMessagesNow: publicProcedure.mutation(async () => {
    const result = await triggerMessagePoll();
    return { success: true, ...result };
  }),

  /**
   * Add visible ClientBook URL properties to a bounded set of recent contacts.
   */
  batchPushLinks: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
    .mutation(async ({ input }) => {
      const result = await batchPushSourceUrls(input?.limit ?? 20);
      return { success: !result.blockedReason, ...result };
    }),

  /**
   * Batch extract customer info from conversation history.
   * Processes contacts missing name/vehicle/location by reading their OpenPhone messages.
   */
  batchExtract: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
    .mutation(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const result = await batchExtractFromConversations(limit);
      return { success: true, ...result };
    }),
});
