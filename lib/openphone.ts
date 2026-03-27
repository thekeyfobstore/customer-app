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
        body: m.body || m.text || "",
        direction: m.direction === "inbound" ? ("inbound" as const) : ("outbound" as const),
        createdAt: m.createdAt || new Date().toISOString(),
        from: m.from || "",
        to: m.to || "",
      };
    })
    .filter((m) => m.customerId && m.body);
}
