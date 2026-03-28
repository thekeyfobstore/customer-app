import { describe, it, expect } from "vitest";

/**
 * Test the SYNC_CONTACTS merge logic extracted from data-context.tsx.
 * This tests that:
 * 1. All contacts from server are included (even without phone)
 * 2. Duplicates by phone are properly deduped (using last 10 digits)
 * 3. Duplicates by openPhoneId are properly deduped
 * 4. Existing local contacts are updated, not duplicated
 * 5. Local-only fields (status) are preserved during merge
 */

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  openPhoneContactId?: string;
  route?: string;
  lastActivityAt?: string;
  status?: string;
  vehicles?: any[];
  address?: any;
}

function normalizePhone(p: string): string {
  const digits = (p || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-10) : digits;
}

function syncContacts(existing: Customer[], serverPayload: Customer[]): Customer[] {
  const merged = [...existing];
  const existingByOpenPhoneId = new Map(
    merged.filter(c => c.openPhoneContactId).map(c => [c.openPhoneContactId!, c])
  );
  const existingByPhone = new Map(
    merged.filter(c => c.phone).map(c => [normalizePhone(c.phone), c])
  );
  const addedOpenPhoneIds = new Set(
    merged.filter(c => c.openPhoneContactId).map(c => c.openPhoneContactId!)
  );
  const addedPhones = new Set(
    merged.filter(c => c.phone).map(c => normalizePhone(c.phone))
  );

  for (const serverContact of serverPayload) {
    const opId = serverContact.openPhoneContactId || "";
    const phoneNorm = normalizePhone(serverContact.phone);

    const existingById = opId ? existingByOpenPhoneId.get(opId) : undefined;
    const existingByPh = phoneNorm.length >= 7 ? existingByPhone.get(phoneNorm) : undefined;
    const existing2 = existingById || existingByPh;

    if (existing2) {
      const idx = merged.findIndex(c => c.id === existing2.id);
      if (idx >= 0) {
        merged[idx] = {
          ...existing2,
          firstName: serverContact.firstName || existing2.firstName,
          lastName: serverContact.lastName || existing2.lastName,
          email: serverContact.email || existing2.email,
          company: serverContact.company || existing2.company,
          openPhoneContactId: serverContact.openPhoneContactId || existing2.openPhoneContactId,
          route: serverContact.route || existing2.route,
          lastActivityAt: serverContact.lastActivityAt || existing2.lastActivityAt,
        };
      }
    } else {
      const isDuplicateOpId = opId && addedOpenPhoneIds.has(opId);
      const isDuplicatePhone = phoneNorm.length >= 7 && addedPhones.has(phoneNorm);
      if (!isDuplicateOpId && !isDuplicatePhone) {
        merged.push(serverContact);
        if (opId) addedOpenPhoneIds.add(opId);
        if (phoneNorm.length >= 7) addedPhones.add(phoneNorm);
      }
    }
  }
  return merged;
}

describe("SYNC_CONTACTS merge logic", () => {
  it("adds all server contacts when local is empty", () => {
    const server: Customer[] = [
      { id: "op-1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "", openPhoneContactId: "abc1" },
      { id: "op-2", firstName: "Jane", lastName: "Smith", phone: "+19025555678", email: "", company: "", openPhoneContactId: "abc2" },
      { id: "op-3", firstName: "Bob", lastName: "Jones", phone: "+19025559999", email: "", company: "", openPhoneContactId: "abc3" },
    ];
    const result = syncContacts([], server);
    expect(result.length).toBe(3);
  });

  it("includes contacts without phone numbers", () => {
    const server: Customer[] = [
      { id: "op-1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "", openPhoneContactId: "abc1" },
      { id: "op-2", firstName: "No Phone", lastName: "Person", phone: "", email: "", company: "", openPhoneContactId: "abc2" },
      { id: "op-3", firstName: "Also", lastName: "NoPhone", phone: "", email: "", company: "", openPhoneContactId: "abc3" },
    ];
    const result = syncContacts([], server);
    expect(result.length).toBe(3);
    expect(result.find(c => c.firstName === "No Phone")).toBeDefined();
    expect(result.find(c => c.firstName === "Also")).toBeDefined();
  });

  it("deduplicates by phone number (last 10 digits)", () => {
    const server: Customer[] = [
      { id: "op-1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "", openPhoneContactId: "abc1" },
      { id: "op-2", firstName: "John", lastName: "Doe2", phone: "+19025551234", email: "", company: "", openPhoneContactId: "abc2" },
    ];
    const result = syncContacts([], server);
    // Same phone, different openPhoneId -> only first one kept
    expect(result.length).toBe(1);
    expect(result[0].firstName).toBe("John");
    expect(result[0].lastName).toBe("Doe");
  });

  it("deduplicates by openPhoneId", () => {
    const server: Customer[] = [
      { id: "op-1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "", openPhoneContactId: "abc1" },
      { id: "op-1b", firstName: "John", lastName: "Updated", phone: "+19025559999", email: "", company: "", openPhoneContactId: "abc1" },
    ];
    const result = syncContacts([], server);
    // Same openPhoneId -> only first one kept
    expect(result.length).toBe(1);
  });

  it("updates existing local contacts by openPhoneId", () => {
    const local: Customer[] = [
      { id: "op-abc1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "", openPhoneContactId: "abc1", status: "quote-sent" },
    ];
    const server: Customer[] = [
      { id: "op-abc1", firstName: "John", lastName: "Updated", phone: "+19025551234", email: "john@example.com", company: "", openPhoneContactId: "abc1" },
    ];
    const result = syncContacts(local, server);
    expect(result.length).toBe(1);
    expect(result[0].lastName).toBe("Updated");
    expect(result[0].email).toBe("john@example.com");
    // Local-only field preserved
    expect(result[0].status).toBe("quote-sent");
  });

  it("updates existing local contacts by phone number", () => {
    const local: Customer[] = [
      { id: "local-1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "", status: "confirmed" },
    ];
    const server: Customer[] = [
      { id: "op-abc1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "Acme", openPhoneContactId: "abc1" },
    ];
    const result = syncContacts(local, server);
    expect(result.length).toBe(1);
    expect(result[0].company).toBe("Acme");
    expect(result[0].openPhoneContactId).toBe("abc1");
    expect(result[0].status).toBe("confirmed");
  });

  it("adds new conversation participants alongside existing contacts", () => {
    const local: Customer[] = [
      { id: "op-abc1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "", openPhoneContactId: "abc1" },
    ];
    const server: Customer[] = [
      { id: "op-abc1", firstName: "John", lastName: "Doe", phone: "+19025551234", email: "", company: "", openPhoneContactId: "abc1" },
      { id: "op-conv-1", firstName: "New", lastName: "Person", phone: "+15485551234", email: "", company: "", openPhoneContactId: "conv-123-5485551234" },
    ];
    const result = syncContacts(local, server);
    expect(result.length).toBe(2);
    expect(result.find(c => c.firstName === "New")).toBeDefined();
  });

  it("handles large payload with mixed duplicates correctly", () => {
    const server: Customer[] = [];
    // 100 unique contacts
    for (let i = 0; i < 100; i++) {
      server.push({
        id: `op-${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        phone: `+1902555${String(i).padStart(4, "0")}`,
        email: "",
        company: "",
        openPhoneContactId: `id-${i}`,
      });
    }
    // 20 duplicates of the first 20 (same phone, different openPhoneId)
    for (let i = 0; i < 20; i++) {
      server.push({
        id: `op-dup-${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        phone: `+1902555${String(i).padStart(4, "0")}`,
        email: "",
        company: "",
        openPhoneContactId: `id-dup-${i}`,
      });
    }
    // 5 contacts without phone
    for (let i = 0; i < 5; i++) {
      server.push({
        id: `op-nophone-${i}`,
        firstName: `NoPhone${i}`,
        lastName: "",
        phone: "",
        email: "",
        company: "",
        openPhoneContactId: `id-nophone-${i}`,
      });
    }

    const result = syncContacts([], server);
    // 100 unique + 5 no phone = 105 (20 duplicates dropped)
    expect(result.length).toBe(105);
  });

  it("normalizes phone numbers with country code correctly", () => {
    const server: Customer[] = [
      { id: "op-1", firstName: "A", lastName: "", phone: "+19025551234", email: "", company: "", openPhoneContactId: "a" },
      { id: "op-2", firstName: "B", lastName: "", phone: "9025551234", email: "", company: "", openPhoneContactId: "b" },
    ];
    const result = syncContacts([], server);
    // +19025551234 -> last 10 = 9025551234
    // 9025551234 -> last 10 = 9025551234
    // Same phone, so only first one kept
    expect(result.length).toBe(1);
    expect(result[0].firstName).toBe("A");
  });
});
