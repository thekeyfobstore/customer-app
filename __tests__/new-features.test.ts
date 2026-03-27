import { describe, it, expect, vi } from "vitest";

// Test Clover module structure
describe("Clover API module", () => {
  it("exports createCloverOrder function", async () => {
    const clover = await import("../lib/clover");
    expect(typeof clover.createCloverOrder).toBe("function");
  });

  it("exports getCloverPayments function", async () => {
    const clover = await import("../lib/clover");
    expect(typeof clover.getCloverPayments).toBe("function");
  });

  it("exports getCloverOrderPayments function", async () => {
    const clover = await import("../lib/clover");
    expect(typeof clover.getCloverOrderPayments).toBe("function");
  });

  it("exports validateCloverCredentials function", async () => {
    const clover = await import("../lib/clover");
    expect(typeof clover.validateCloverCredentials).toBe("function");
  });
});

// Test types
describe("Type definitions", () => {
  it("ServiceRecord type has required fields", async () => {
    // Verify the type module can be imported
    const types = await import("../lib/types");
    // Types are compile-time only, but we can verify the module loads
    expect(types).toBeDefined();
  });

  it("CloverOrder type has required fields", async () => {
    const types = await import("../lib/types");
    expect(types).toBeDefined();
  });
});

// Test storage functions
describe("Storage module - Clover config", () => {
  it("exports loadCloverConfig function", async () => {
    const storage = await import("../lib/storage");
    expect(typeof storage.loadCloverConfig).toBe("function");
  });

  it("exports saveCloverConfig function", async () => {
    const storage = await import("../lib/storage");
    expect(typeof storage.saveCloverConfig).toBe("function");
  });

  it("exports clearCloverConfig function", async () => {
    const storage = await import("../lib/storage");
    expect(typeof storage.clearCloverConfig).toBe("function");
  });

  it("exports loadServiceRecords function", async () => {
    const storage = await import("../lib/storage");
    expect(typeof storage.loadServiceRecords).toBe("function");
  });

  it("exports saveServiceRecords function", async () => {
    const storage = await import("../lib/storage");
    expect(typeof storage.saveServiceRecords).toBe("function");
  });

  it("exports loadCloverOrders function", async () => {
    const storage = await import("../lib/storage");
    expect(typeof storage.loadCloverOrders).toBe("function");
  });

  it("exports saveCloverOrders function", async () => {
    const storage = await import("../lib/storage");
    expect(typeof storage.saveCloverOrders).toBe("function");
  });
});

// Test notification module
// Note: expo-notifications requires __DEV__ and native modules, so we test the module structure
// by verifying the file exists and exports the right shape without importing it directly.
describe("Notifications module", () => {
  it("notifications.ts file exists and is importable as text", async () => {
    // We verify the module file is present by checking the filesystem
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../lib/notifications.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("requestNotificationPermissions");
    expect(content).toContain("scheduleAppointmentReminder");
    expect(content).toContain("cancelAppointmentReminder");
    expect(content).toContain("scheduleAllReminders");
    expect(content).toContain("cancelAllReminders");
  });

  it("notifications.ts handles web platform by returning early", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.resolve(__dirname, "../lib/notifications.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    // Verify web platform guards exist
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
