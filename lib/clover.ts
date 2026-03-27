import type { CloverPayment } from "./types";
import { getApiBaseUrl } from "@/constants/oauth";

const CLOVER_BASE_URL = "https://api.clover.com";

interface CloverConfig {
  apiToken: string;
  merchantId: string;
}

function getHeaders(apiToken: string) {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/** Helper to call the server-side Clover proxy (avoids CORS) */
async function callServerProxy(
  procedure: string,
  input: Record<string, any>,
  method: "query" | "mutation" = "mutation"
): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/trpc/clover.${procedure}`;

  if (method === "query") {
    const encoded = encodeURIComponent(JSON.stringify({ json: input }));
    const res = await fetch(`${url}?input=${encoded}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Server proxy error: ${err}`);
    }
    const data = await res.json();
    return data?.result?.data?.json ?? data?.result?.data ?? data;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ json: input }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Server proxy error: ${err}`);
  }
  const data = await res.json();
  return data?.result?.data?.json ?? data?.result?.data ?? data;
}

/** Create an order in Clover with line items (via server proxy) */
export async function createCloverOrder(
  config: CloverConfig,
  title: string,
  lineItems: { name: string; price: number; quantity: number }[],
  note?: string
): Promise<{ orderId: string }> {
  try {
    // Try server proxy first (avoids CORS)
    return await callServerProxy("createOrder", {
      apiToken: config.apiToken,
      merchantId: config.merchantId,
      title,
      lineItems,
      note: note || "",
    });
  } catch {
    // Fallback to direct API call (works on native)
    return createCloverOrderDirect(config, title, lineItems, note);
  }
}

/** Direct Clover API call (for native apps where CORS isn't an issue) */
async function createCloverOrderDirect(
  config: CloverConfig,
  title: string,
  lineItems: { name: string; price: number; quantity: number }[],
  note?: string
): Promise<{ orderId: string }> {
  const { apiToken, merchantId } = config;

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
}

/** Get recent payments for the merchant */
export async function getCloverPayments(
  config: CloverConfig,
  limit: number = 50
): Promise<CloverPayment[]> {
  try {
    // Try server proxy first
    return await callServerProxy(
      "getPayments",
      { apiToken: config.apiToken, merchantId: config.merchantId, limit },
      "query"
    );
  } catch {
    // Fallback to direct
    return getCloverPaymentsDirect(config, limit);
  }
}

async function getCloverPaymentsDirect(
  config: CloverConfig,
  limit: number = 50
): Promise<CloverPayment[]> {
  const { apiToken, merchantId } = config;

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
}

/** Get payments for a specific order */
export async function getCloverOrderPayments(
  config: CloverConfig,
  orderId: string
): Promise<CloverPayment[]> {
  const { apiToken, merchantId } = config;

  const res = await fetch(
    `${CLOVER_BASE_URL}/v3/merchants/${merchantId}/orders/${orderId}/payments`,
    {
      method: "GET",
      headers: getHeaders(apiToken),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch order payments: ${err}`);
  }

  const data = await res.json();
  return (data.elements || []).map((p: any) => ({
    id: p.id,
    orderId: orderId,
    amount: p.amount || 0,
    tipAmount: p.tipAmount || 0,
    taxAmount: p.taxAmount || 0,
    result: p.result || "UNKNOWN",
    createdTime: p.createdTime || 0,
  }));
}

/** Get a specific order from Clover */
export async function getCloverOrder(
  config: CloverConfig,
  orderId: string
): Promise<any> {
  const { apiToken, merchantId } = config;

  const res = await fetch(
    `${CLOVER_BASE_URL}/v3/merchants/${merchantId}/orders/${orderId}?expand=lineItems,payments`,
    {
      method: "GET",
      headers: getHeaders(apiToken),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch order: ${err}`);
  }

  return res.json();
}

/** Validate Clover credentials (via server proxy to avoid CORS) */
export async function validateCloverCredentials(
  config: CloverConfig
): Promise<{ valid: boolean; merchantName?: string; error?: string | null }> {
  try {
    // Try server proxy first (avoids CORS on web/Expo Go)
    const result = await callServerProxy("validate", {
      apiToken: config.apiToken,
      merchantId: config.merchantId,
    });
    return result;
  } catch {
    // Fallback: try direct API call (works on native)
    try {
      const { apiToken, merchantId } = config;
      const res = await fetch(
        `${CLOVER_BASE_URL}/v3/merchants/${merchantId}`,
        {
          method: "GET",
          headers: getHeaders(apiToken),
        }
      );

      if (!res.ok) return { valid: false, error: `Clover returned status ${res.status}` };

      const data = await res.json();
      return { valid: true, merchantName: data.name || "" };
    } catch (err: any) {
      return { valid: false, error: err.message || "Network error" };
    }
  }
}
