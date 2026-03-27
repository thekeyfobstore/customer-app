import { Customer, Message, OpenPhoneContact } from "./types";

const BASE_URL = "https://api.openphone.com/v1";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export async function fetchOpenPhoneContacts(apiKey: string): Promise<OpenPhoneContact[]> {
  const response = await fetch(`${BASE_URL}/contacts`, {
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
  const contacts: OpenPhoneContact[] = (data.data || []).map((c: any) => ({
    id: c.id,
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    phoneNumbers: c.phoneNumbers || [],
    emails: c.emails || [],
    company: c.company || "",
    selected: true,
  }));

  return contacts;
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
      firstName: customer.firstName,
      lastName: customer.lastName,
    };
    if (customer.phone) {
      body.phoneNumbers = [{ number: customer.phone }];
    }
    if (customer.email) {
      body.emails = [{ address: customer.email }];
    }
    if (customer.company) {
      body.company = customer.company;
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

export function convertToCustomers(contacts: OpenPhoneContact[]): Customer[] {
  const now = new Date().toISOString();
  return contacts
    .filter((c) => c.selected)
    .map((c) => ({
      id: generateId(),
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phoneNumbers?.[0]?.number || "",
      email: c.emails?.[0]?.address || "",
      company: c.company || "",
      notes: "",
      tags: [],
      vehicles: [],
      createdAt: now,
      updatedAt: now,
      openPhoneContactId: c.id,
    }));
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
