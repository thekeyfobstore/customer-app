import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Test Clover module structure
describe("Clover API module", () => {
  const filePath = path.resolve(__dirname, "../lib/clover.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  it("exports createCloverOrder function", () => {
    expect(content).toContain("export async function createCloverOrder");
  });

  it("exports getCloverPayments function", () => {
    expect(content).toContain("export async function getCloverPayments");
  });

  it("exports getCloverOrderPayments function", () => {
    expect(content).toContain("export async function getCloverOrderPayments");
  });

  it("exports validateCloverCredentials function", () => {
    expect(content).toContain("export async function validateCloverCredentials");
  });
});

// Test types
describe("Type definitions", () => {
  const filePath = path.resolve(__dirname, "../lib/types.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  it("ServiceRecord type has required fields", () => {
    expect(content).toContain("ServiceRecord");
    expect(content).toContain("vehicleId");
    expect(content).toContain("date");
  });

  it("CloverOrder type has required fields", () => {
    expect(content).toContain("CloverOrder");
    expect(content).toContain("cloverOrderId");
  });

  it("Vehicle type has required fields", () => {
    expect(content).toContain("Vehicle");
    expect(content).toContain("make");
    expect(content).toContain("model");
    expect(content).toContain("vin");
  });
});

// Test storage functions (file-based since dynamic import fails on native modules)
describe("Storage module - Clover config", () => {
  const filePath = path.resolve(__dirname, "../lib/storage.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  it("exports loadCloverConfig function", () => {
    expect(content).toContain("export async function loadCloverConfig");
  });

  it("exports saveCloverConfig function", () => {
    expect(content).toContain("export async function saveCloverConfig");
  });

  it("exports clearCloverConfig function", () => {
    expect(content).toContain("export async function clearCloverConfig");
  });

  it("exports loadServiceRecords function", () => {
    expect(content).toContain("export async function loadServiceRecords");
  });

  it("exports saveServiceRecords function", () => {
    expect(content).toContain("export async function saveServiceRecords");
  });

  it("exports loadCloverOrders function", () => {
    expect(content).toContain("export async function loadCloverOrders");
  });

  it("exports saveCloverOrders function", () => {
    expect(content).toContain("export async function saveCloverOrders");
  });

  it("delegates API key storage to SecureStore", () => {
    expect(content).toContain("loadApiKeySecure");
    expect(content).toContain("saveApiKeySecure");
    expect(content).toContain("clearApiKeySecure");
  });
});

// Test notification module
describe("Notifications module", () => {
  it("notifications.ts file exists and has required exports", () => {
    const filePath = path.resolve(__dirname, "../lib/notifications.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("requestNotificationPermissions");
    expect(content).toContain("scheduleAppointmentReminder");
    expect(content).toContain("cancelAppointmentReminder");
    expect(content).toContain("scheduleAllReminders");
    expect(content).toContain("cancelAllReminders");
  });

  it("notifications.ts handles web platform by returning early", () => {
    const filePath = path.resolve(__dirname, "../lib/notifications.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain('Platform.OS === "web"');
  });
});

// Test helpers
describe("Helpers", () => {
  it("generateId produces unique IDs", async () => {
    const { generateId } = await import("../lib/helpers");
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("formatDate handles ISO date strings", async () => {
    const { formatDate } = await import("../lib/helpers");
    const result = formatDate("2025-06-15");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("getStatusColor returns valid color tokens", async () => {
    const { getStatusColor } = await import("../lib/helpers");
    expect(getStatusColor("scheduled")).toBe("primary");
    expect(getStatusColor("completed")).toBe("success");
    expect(getStatusColor("cancelled")).toBe("error");
    expect(getStatusColor("no-show")).toBe("warning");
  });
});
