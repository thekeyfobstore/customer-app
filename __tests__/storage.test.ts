import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AsyncStorage
const mockStorage = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage.get(key) || null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

// Mock SecureStore
const mockSecureStorage = new Map<string, string>();
vi.mock("expo-secure-store", () => ({
  setItemAsync: vi.fn((key: string, value: string) => {
    mockSecureStorage.set(key, value);
    return Promise.resolve();
  }),
  getItemAsync: vi.fn((key: string) => Promise.resolve(mockSecureStorage.get(key) || null)),
  deleteItemAsync: vi.fn((key: string) => {
    mockSecureStorage.delete(key);
    return Promise.resolve();
  }),
}));

// Mock Platform as non-web so SecureStore is used
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import {
  loadCustomers,
  saveCustomers,
  loadAppointments,
  saveAppointments,
  loadApiKey,
  saveApiKey,
  clearApiKey,
  exportAllData,
} from "../lib/storage";
import type { Customer, Appointment } from "../lib/types";

beforeEach(() => {
  mockStorage.clear();
  mockSecureStorage.clear();
});

describe("Customer storage", () => {
  const testCustomer: Customer = {
    id: "test1",
    firstName: "John",
    lastName: "Doe",
    phone: "5551234567",
    email: "john@test.com",
    company: "Acme",
    notes: "",
    tags: ["vip"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  it("should return empty array when no customers exist", async () => {
    const result = await loadCustomers();
    expect(result).toEqual([]);
  });

  it("should save and load customers", async () => {
    await saveCustomers([testCustomer]);
    const result = await loadCustomers();
    expect(result).toHaveLength(1);
    expect(result[0].firstName).toBe("John");
    expect(result[0].id).toBe("test1");
  });
});

describe("Appointment storage", () => {
  const testAppointment: Appointment = {
    id: "apt1",
    customerId: "test1",
    date: "2024-06-15",
    time: "10:00",
    duration: 60,
    service: "Consultation",
    status: "scheduled",
    notes: "",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  it("should return empty array when no appointments exist", async () => {
    const result = await loadAppointments();
    expect(result).toEqual([]);
  });

  it("should save and load appointments", async () => {
    await saveAppointments([testAppointment]);
    const result = await loadAppointments();
    expect(result).toHaveLength(1);
    expect(result[0].service).toBe("Consultation");
  });
});

describe("API key storage (SecureStore)", () => {
  it("should return empty string when no key exists", async () => {
    const result = await loadApiKey();
    expect(result).toBe("");
  });

  it("should save and load API key via SecureStore", async () => {
    await saveApiKey("test-api-key-123");
    const result = await loadApiKey();
    expect(result).toBe("test-api-key-123");
  });

  it("should clear API key from SecureStore", async () => {
    await saveApiKey("test-api-key-123");
    await clearApiKey();
    const result = await loadApiKey();
    expect(result).toBe("");
  });
});

describe("exportAllData", () => {
  it("should export all data as JSON string", async () => {
    const result = await exportAllData();
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty("customers");
    expect(parsed).toHaveProperty("appointments");
    expect(parsed).toHaveProperty("messages");
    expect(Array.isArray(parsed.customers)).toBe(true);
  });
});
