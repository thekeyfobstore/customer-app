export interface Vehicle {
  id: string;
  year: string;
  make: string;
  model: string;
  color: string;
  vin: string;
  licensePlate: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
}

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
  createdAt: string;
  updatedAt: string;
  openPhoneContactId?: string;
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

export interface Appointment {
  id: string;
  customerId: string;
  date: string; // ISO date string
  time: string; // HH:mm format
  duration: number; // minutes
  service: string;
  status: AppointmentStatus;
  notes: string;
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
