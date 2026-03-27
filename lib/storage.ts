import AsyncStorage from "@react-native-async-storage/async-storage";
import { Customer, Appointment, Message, ServiceRecord, CloverOrder } from "./types";

const KEYS = {
  CUSTOMERS: "@clientbook_customers",
  APPOINTMENTS: "@clientbook_appointments",
  MESSAGES: "@clientbook_messages",
  OPENPHONE_API_KEY: "@clientbook_openphone_key",
  CLOVER_API_TOKEN: "@clientbook_clover_token",
  CLOVER_MERCHANT_ID: "@clientbook_clover_merchant",
  SERVICE_RECORDS: "@clientbook_service_records",
  CLOVER_ORDERS: "@clientbook_clover_orders",
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

// Clover config
export async function loadCloverConfig(): Promise<{ apiToken: string; merchantId: string }> {
  try {
    const [apiToken, merchantId] = await Promise.all([
      AsyncStorage.getItem(KEYS.CLOVER_API_TOKEN),
      AsyncStorage.getItem(KEYS.CLOVER_MERCHANT_ID),
    ]);
    return { apiToken: apiToken || "", merchantId: merchantId || "" };
  } catch {
    return { apiToken: "", merchantId: "" };
  }
}

export async function saveCloverConfig(apiToken: string, merchantId: string): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(KEYS.CLOVER_API_TOKEN, apiToken),
    AsyncStorage.setItem(KEYS.CLOVER_MERCHANT_ID, merchantId),
  ]);
}

export async function clearCloverConfig(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(KEYS.CLOVER_API_TOKEN),
    AsyncStorage.removeItem(KEYS.CLOVER_MERCHANT_ID),
  ]);
}

// Service records
export async function loadServiceRecords(): Promise<ServiceRecord[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SERVICE_RECORDS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveServiceRecords(records: ServiceRecord[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.SERVICE_RECORDS, JSON.stringify(records));
}

// Clover orders
export async function loadCloverOrders(): Promise<CloverOrder[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.CLOVER_ORDERS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveCloverOrders(orders: CloverOrder[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.CLOVER_ORDERS, JSON.stringify(orders));
}

export async function exportAllData(): Promise<string> {
  const [customers, appointments, messages, serviceRecords, cloverOrders] = await Promise.all([
    loadCustomers(),
    loadAppointments(),
    loadMessages(),
    loadServiceRecords(),
    loadCloverOrders(),
  ]);
  return JSON.stringify({ customers, appointments, messages, serviceRecords, cloverOrders }, null, 2);
}
