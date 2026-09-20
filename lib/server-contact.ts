import type { Customer, Vehicle } from "./types";

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}

export function mapServerContactToCustomer(sc: any): Customer {
  const vehicles: Vehicle[] = [];
  if (
    sc.vehicleYearMakeModel ||
    sc.vin ||
    sc.keyCode ||
    sc.dealerComparison ||
    sc.partNumber
  ) {
    const ymm = String(sc.vehicleYearMakeModel || "").trim();
    const parts = ymm ? ymm.split(/\s+/) : [];
    const yearMatch = parts[0]?.match(/^(19|20)\d{2}$/);
    vehicles.push({
      id: `v-${sc.openPhoneId || sc.id}`,
      year: yearMatch ? parts[0] : "",
      make: yearMatch ? parts[1] || "" : parts[0] || "",
      model: yearMatch ? parts.slice(2).join(" ") : parts.slice(1).join(" "),
      vin: sc.vin || "",
      keyCode: sc.keyCode || undefined,
      dealerComparison: sc.dealerComparison || undefined,
      partNumber: sc.partNumber || undefined,
    });
  }

  return {
    id: `op-${sc.openPhoneId || sc.id}`,
    firstName: sc.firstName || "",
    lastName: sc.lastName || "",
    phone: sc.phone || "",
    email: sc.email || "",
    company: sc.company || "",
    notes: "",
    tags: [],
    address: sc.address
      ? { street: sc.address, city: "", state: "", zip: "" }
      : undefined,
    vehicles,
    createdAt: toIsoString(sc.createdAt),
    updatedAt: toIsoString(sc.updatedAt),
    openPhoneContactId: sc.openPhoneId || undefined,
    route: sc.route || undefined,
    lastActivityAt: sc.lastActivityAt
      ? toIsoString(sc.lastActivityAt)
      : undefined,
  };
}
