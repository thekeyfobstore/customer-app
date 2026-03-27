import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";

const CLOVER_BASE_URL = "https://api.clover.com";

function getHeaders(apiToken: string) {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export const cloverProxyRouter = router({
  /** Validate Clover credentials by fetching merchant info */
  validate: publicProcedure
    .input(
      z.object({
        apiToken: z.string().min(1),
        merchantId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { apiToken, merchantId } = input;
      try {
        const res = await fetch(
          `${CLOVER_BASE_URL}/v3/merchants/${merchantId}`,
          {
            method: "GET",
            headers: getHeaders(apiToken),
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          return { valid: false, error: `Clover returned ${res.status}: ${errText}` };
        }

        const data = await res.json();
        return { valid: true, merchantName: data.name || "", error: null };
      } catch (err: any) {
        return { valid: false, error: err.message || "Network error" };
      }
    }),

  /** Create an order in Clover */
  createOrder: publicProcedure
    .input(
      z.object({
        apiToken: z.string().min(1),
        merchantId: z.string().min(1),
        title: z.string(),
        lineItems: z.array(
          z.object({
            name: z.string(),
            price: z.number(),
            quantity: z.number(),
          })
        ),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { apiToken, merchantId, title, lineItems, note } = input;

      // Step 1: Create the order
      const orderRes = await fetch(
        `${CLOVER_BASE_URL}/v3/merchants/${merchantId}/orders`,
        {
          method: "POST",
          headers: getHeaders(apiToken),
          body: JSON.stringify({
            title,
            state: "open",
            note: note || "",
            manualTransaction: false,
          }),
        }
      );

      if (!orderRes.ok) {
        const err = await orderRes.text();
        throw new Error(`Failed to create Clover order: ${err}`);
      }

      const order = await orderRes.json();
      const orderId = order.id;

      // Step 2: Add line items
      for (const item of lineItems) {
        for (let i = 0; i < item.quantity; i++) {
          const lineRes = await fetch(
            `${CLOVER_BASE_URL}/v3/merchants/${merchantId}/orders/${orderId}/line_items`,
            {
              method: "POST",
              headers: getHeaders(apiToken),
              body: JSON.stringify({
                name: item.name,
                price: item.price,
              }),
            }
          );

          if (!lineRes.ok) {
            const err = await lineRes.text();
            throw new Error(`Failed to add line item: ${err}`);
          }
        }
      }

      return { orderId };
    }),

  /** Get recent payments */
  getPayments: publicProcedure
    .input(
      z.object({
        apiToken: z.string().min(1),
        merchantId: z.string().min(1),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input }) => {
      const { apiToken, merchantId, limit } = input;

      const res = await fetch(
        `${CLOVER_BASE_URL}/v3/merchants/${merchantId}/payments?limit=${limit}&expand=order&orderBy=createdTime+DESC`,
        {
          method: "GET",
          headers: getHeaders(apiToken),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to fetch payments: ${err}`);
      }

      const data = await res.json();
      return (data.elements || []).map((p: any) => ({
        id: p.id,
        orderId: p.order?.id || "",
        amount: p.amount || 0,
        tipAmount: p.tipAmount || 0,
        taxAmount: p.taxAmount || 0,
        result: p.result || "UNKNOWN",
        createdTime: p.createdTime || 0,
      }));
    }),
});
