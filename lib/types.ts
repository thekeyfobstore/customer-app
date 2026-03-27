export interface Vehicle {
  id: string;
  year: string;
  make: string;
  model: string;
  vin: string;
  keyCode?: string;
  dealerComparison?: string;
  partNumber?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export type CustomerStatus =
  | "need-price-part"
  | "quote-sent"
  | "rejected"
  | "book-later"
  | "booked-needs-confirmation"
  | "confirmed"
  | "none";

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  "none": "No Status",
  "need-price-part": "Need Price & Part #",
  "quote-sent": "Quote Sent",
  "rejected": "Rejected",
  "book-later": "Said Yes - Book Later",
  "booked-needs-confirmation": "Booked - Needs Confirmation",
  "confirmed": "Confirmed",
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, { bg: string; text: string }> = {
  "none": { bg: "#E5E7EB", text: "#6B7280" },
  "need-price-part": { bg: "#FEF3C7", text: "#92400E" },
  "quote-sent": { bg: "#DBEAFE", text: "#1E40AF" },
  "rejected": { bg: "#FEE2E2", text: "#991B1B" },
  "book-later": { bg: "#E0E7FF", text: "#3730A3" },
  "booked-needs-confirmation": { bg: "#FED7AA", text: "#9A3412" },
  "confirmed": { bg: "#D1FAE5", text: "#065F46" },
};

/** Route codes for service areas */
export const ROUTE_CODES = ["HRM", "PHK", "NG", "INV"] as const;
export type RouteCode = (typeof ROUTE_CODES)[number];

export const ROUTE_LABELS: Record<RouteCode, string> = {
  HRM: "Halifax Regional",
  PHK: "Port Hawkesbury",
  NG: "New Glasgow",
  INV: "Inverness",
};

export const ROUTE_DESCRIPTIONS: Record<RouteCode, string> = {
  HRM: "Halifax areas (Bedford, Dartmouth, etc.)",
  PHK: "Petit de Grat to St. Peter's to Antigonish",
  NG: "PHK to Truro corridor",
  INV: "Cabot Trail: Baddeck, Inverness, Mabou, Port Hood",
};

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
  tags: string[];
  address?: Address;
  vehicles?: Vehicle[];
  status?: CustomerStatus;
  confirmedBy?: string; // who confirmed
  confirmedAt?: string; // ISO date when confirmed
  statusUpdatedAt?: string; // ISO date when status last changed
  route?: string; // e.g., "HRM - Bedford", "PHK - Arichat", "NG - Truro"
  createdAt: string;
  updatedAt: string;
  openPhoneContactId?: string;
  photos?: CustomerPhoto[];
}

export interface CustomerPhoto {
  id: string;
  uri: string;
  caption?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  customerId: string;
  body: string;
  direction: "inbound" | "outbound";
  createdAt: string;
  from: string;
  to: string;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled" | "no-show";

export interface AppointmentLocation {
  type: "customer" | "drop-in" | "custom";
  dropInId?: string; // if type is drop-in
  address: Address;
  latitude?: number;
  longitude?: number;
}

export interface Appointment {
  id: string;
  customerId: string;
  date: string; // ISO date string
  time: string; // HH:mm format
  duration: number; // minutes
  service: string;
  status: AppointmentStatus;
  notes: string;
  location?: AppointmentLocation;
  createdAt: string;
  updatedAt: string;
}

export interface OpenPhoneContact {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumbers: { number: string }[];
  emails: { address: string }[];
  company: string;
  selected?: boolean;
  // Custom fields from OpenPhone
  customFields?: {
    vehicle?: string;
    vin?: string;
    keyCode?: string;
    dealerComparison?: string;
    partNumber?: string;
    address?: string;
    route?: string;
  };
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  customerId: string;
  appointmentId?: string;
  service: string;
  description: string;
  cost: number; // in cents
  date: string;
  createdAt: string;
}

export interface CloverOrder {
  id: string;
  customerId: string;
  appointmentId?: string;
  cloverOrderId?: string;
  title: string;
  lineItems: CloverLineItem[];
  totalAmount: number; // in cents
  status: "pending" | "sent" | "paid" | "failed";
  cloverPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloverLineItem {
  name: string;
  price: number; // in cents
  quantity: number;
}

export interface CloverPayment {
  id: string;
  orderId: string;
  amount: number; // in cents
  tipAmount: number;
  taxAmount: number;
  result: string;
  createdTime: number;
}

export type FollowUpType = "new-lead" | "repeat-customer";
export type FollowUpStatus = "pending" | "contacted" | "booked" | "declined";

export interface FollowUp {
  id: string;
  customerId: string;
  type: FollowUpType;
  status: FollowUpStatus;
  area: string; // zone/area name for grouping
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DropInLocation {
  id: string;
  name: string;
  address: Address;
  latitude?: number;
  longitude?: number;
  notes: string;
  createdAt: string;
}

export interface RouteStop {
  id: string;
  appointmentId: string;
  customerId: string;
  address: Address;
  latitude?: number;
  longitude?: number;
  order: number; // stop order in the route
  estimatedArrival?: string;
  estimatedDriveMinutes?: number; // drive time from previous stop
}

export interface DayRoute {
  id: string;
  date: string; // ISO date
  area: string;
  stops: RouteStop[];
  totalDriveMinutes?: number;
  status: "draft" | "active" | "completed";
  createdAt: string;
}

/** A single quote option (e.g., OEM key vs aftermarket key) */
export interface QuoteOption {
  id: string;
  label: string; // e.g., "OEM Key Fob", "Aftermarket Key"
  description: string;
  price: number; // in cents
}

/** A quote sent to a customer */
export interface Quote {
  id: string;
  customerId: string;
  vehicleId?: string;
  service: string; // e.g., "Key Fob Programming"
  options: QuoteOption[];
  notes: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  acceptedOptionId?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Data extracted from message history by AI */
export interface ExtractedInfo {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: Address;
  vehicles?: Vehicle[];
  company?: string;
}
