export const CLIENTBOOK_FIELD_NAME = "ClientBook";
export const DEFAULT_CLIENTBOOK_BASE_URL =
  "https://custcrmapp-nxdjk2u8.manus.space";

export interface QuoCustomFieldDefinition {
  name: string;
  key: string;
  type: string;
}

export interface QuoContactUpdateInput {
  company?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface QuoContactRecord {
  defaultFields?: Record<string, any>;
  customFields?: Array<Record<string, any>>;
}

export function buildClientBookUrl(
  phone: string,
  baseUrl: string = DEFAULT_CLIENTBOOK_BASE_URL,
): string | null {
  const phoneDigits = phone.replace(/\D/g, "").slice(-10);
  if (phoneDigits.length < 7) return null;
  return `${baseUrl.replace(/\/$/, "")}/link?phone=${phoneDigits}`;
}

export function buildPreservedContactPatch(
  contact: QuoContactRecord,
  updates: QuoContactUpdateInput,
  clientBookField?: QuoCustomFieldDefinition | null,
  baseUrl: string = DEFAULT_CLIENTBOOK_BASE_URL,
) {
  const defaultFields = {
    ...(contact.defaultFields || {}),
  };

  if (updates.company !== undefined) defaultFields.company = updates.company;
  if (updates.firstName !== undefined)
    defaultFields.firstName = updates.firstName;
  if (updates.lastName !== undefined) defaultFields.lastName = updates.lastName;

  const customFields = (contact.customFields || []).map((field) => ({
    name: field.name,
    key: field.key,
    type: field.type,
    value: field.value ?? null,
  }));

  const link = updates.phone
    ? buildClientBookUrl(updates.phone, baseUrl)
    : null;
  if (link && clientBookField) {
    const existing = customFields.find(
      (field) => field.key === clientBookField.key,
    );
    if (existing) {
      existing.name = clientBookField.name;
      existing.type = clientBookField.type;
      existing.value = link;
    } else {
      customFields.push({
        name: clientBookField.name,
        key: clientBookField.key,
        type: clientBookField.type,
        value: link,
      });
    }
  }

  return { defaultFields, customFields };
}
