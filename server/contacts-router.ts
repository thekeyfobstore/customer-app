import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getSyncedContacts,
  getSyncStatus,
  setOpenPhoneApiKey,
  triggerSync,
} from "./openphone-sync";

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
});
