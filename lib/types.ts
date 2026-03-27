export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
  tags: string[];
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
