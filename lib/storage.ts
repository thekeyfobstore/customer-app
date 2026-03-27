import AsyncStorage from "@react-native-async-storage/async-storage";
import { Customer, Appointment, Message } from "./types";

const KEYS = {
  CUSTOMERS: "@clientbook_customers",
  APPOINTMENTS: "@clientbook_appointments",
  MESSAGES: "@clientbook_messages",
  OPENPHONE_API_KEY: "@clientbook_openphone_key",
};

export async function loadCustomers(): Promise<Customer[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.CUSTOMERS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveCustomers(customers: Customer[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CUSTOMERS, JSON.stringify(customers));
}

export async function loadAppointments(): Promise<Appointment[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.APPOINTMENTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveAppointments(appointments: Appointment[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(appointments));
}

export async function loadMessages(): Promise<Message[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.MESSAGES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveMessages(messages: Message[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.MESSAGES, JSON.stringify(messages));
}

export async function loadApiKey(): Promise<string> {
  try {
    const key = await AsyncStorage.getItem(KEYS.OPENPHONE_API_KEY);
    return key || "";
  } catch {
    return "";
  }
}

export async function saveApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.OPENPHONE_API_KEY, key);
}

export async function clearApiKey(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.OPENPHONE_API_KEY);
}

export async function exportAllData(): Promise<string> {
  const customers = await loadCustomers();
  const appointments = await loadAppointments();
  const messages = await loadMessages();
  return JSON.stringify({ customers, appointments, messages }, null, 2);
}
