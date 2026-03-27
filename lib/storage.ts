import AsyncStorage from "@react-native-async-storage/async-storage";
import { Customer, Appointment, Message, ServiceRecord, CloverOrder, FollowUp, DropInLocation, DayRoute, Quote } from "./types";
import {
  loadApiKeySecure, saveApiKeySecure, clearApiKeySecure,
  loadCloverConfigSecure, saveCloverConfigSecure, clearCloverConfigSecure,
} from "./secure-storage";

const KEYS = {
  CUSTOMERS: "@clientbook_customers",
  APPOINTMENTS: "@clientbook_appointments",
  MESSAGES: "@clientbook_messages",
  OPENPHONE_API_KEY: "@clientbook_openphone_key",
  CLOVER_API_TOKEN: "@clientbook_clover_token",
  CLOVER_MERCHANT_ID: "@clientbook_clover_merchant",
  SERVICE_RECORDS: "@clientbook_service_records",
  CLOVER_ORDERS: "@clientbook_clover_orders",
  FOLLOW_UPS: "@clientbook_follow_ups",
  DROP_IN_LOCATIONS: "@clientbook_drop_in_locations",
  DAY_ROUTES: "@clientbook_day_routes",
  QUOTES: "@clientbook_quotes",
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

// API keys now use encrypted SecureStore — these wrappers maintain backward compatibility

export async function loadApiKey(): Promise<string> {
  return loadApiKeySecure();
}

export async function saveApiKey(key: string): Promise<void> {
  return saveApiKeySecure(key);
}

export async function clearApiKey(): Promise<void> {
  return clearApiKeySecure();
}

// Clover config — now uses encrypted SecureStore

export async function loadCloverConfig(): Promise<{ apiToken: string; merchantId: string }> {
  return loadCloverConfigSecure();
}

export async function saveCloverConfig(apiToken: string, merchantId: string): Promise<void> {
  return saveCloverConfigSecure(apiToken, merchantId);
}

export async function clearCloverConfig(): Promise<void> {
  return clearCloverConfigSecure();
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

// Follow-ups
export async function loadFollowUps(): Promise<FollowUp[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.FOLLOW_UPS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveFollowUps(followUps: FollowUp[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.FOLLOW_UPS, JSON.stringify(followUps));
}

// Drop-in locations
export async function loadDropInLocations(): Promise<DropInLocation[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.DROP_IN_LOCATIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveDropInLocations(locations: DropInLocation[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.DROP_IN_LOCATIONS, JSON.stringify(locations));
}

// Day routes
export async function loadDayRoutes(): Promise<DayRoute[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.DAY_ROUTES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveDayRoutes(routes: DayRoute[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.DAY_ROUTES, JSON.stringify(routes));
}

// Quotes
export async function loadQuotes(): Promise<Quote[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.QUOTES);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveQuotes(quotes: Quote[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.QUOTES, JSON.stringify(quotes));
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
