import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Secure Storage module", () => {
  const filePath = path.resolve(__dirname, "../lib/secure-storage.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  it("file exists and is non-empty", () => {
    expect(content.length).toBeGreaterThan(100);
  });

  it("uses expo-secure-store for native storage", () => {
    expect(content).toContain('import * as SecureStore from "expo-secure-store"');
  });

  it("has web platform fallback using localStorage", () => {
    expect(content).toContain('Platform.OS === "web"');
    expect(content).toContain("localStorage");
  });

  it("exports loadApiKeySecure function", () => {
    expect(content).toContain("export async function loadApiKeySecure");
  });

  it("exports saveApiKeySecure function", () => {
    expect(content).toContain("export async function saveApiKeySecure");
  });

  it("exports clearApiKeySecure function", () => {
    expect(content).toContain("export async function clearApiKeySecure");
  });

  it("exports loadCloverConfigSecure function", () => {
    expect(content).toContain("export async function loadCloverConfigSecure");
  });

  it("exports saveCloverConfigSecure function", () => {
    expect(content).toContain("export async function saveCloverConfigSecure");
  });

  it("exports clearCloverConfigSecure function", () => {
    expect(content).toContain("export async function clearCloverConfigSecure");
  });

  it("exports migrateKeysToSecureStore function", () => {
    expect(content).toContain("export async function migrateKeysToSecureStore");
  });

  it("migration skips web platform", () => {
    // The migration function should check for web and return early
    const migrationSection = content.substring(content.indexOf("migrateKeysToSecureStore"));
    expect(migrationSection).toContain('Platform.OS === "web"');
  });

  it("uses SecureStore.setItemAsync for saving", () => {
    expect(content).toContain("SecureStore.setItemAsync");
  });

  it("uses SecureStore.getItemAsync for loading", () => {
    expect(content).toContain("SecureStore.getItemAsync");
  });

  it("uses SecureStore.deleteItemAsync for clearing", () => {
    expect(content).toContain("SecureStore.deleteItemAsync");
  });
});

describe("Storage module redirects to SecureStore", () => {
  const filePath = path.resolve(__dirname, "../lib/storage.ts");
  const content = fs.readFileSync(filePath, "utf-8");

  it("imports from secure-storage module", () => {
    expect(content).toContain('from "./secure-storage"');
  });

  it("loadApiKey delegates to loadApiKeySecure", () => {
    expect(content).toContain("return loadApiKeySecure()");
  });

  it("saveApiKey delegates to saveApiKeySecure", () => {
    expect(content).toContain("return saveApiKeySecure(key)");
  });

  it("loadCloverConfig delegates to loadCloverConfigSecure", () => {
    expect(content).toContain("return loadCloverConfigSecure()");
  });

  it("saveCloverConfig delegates to saveCloverConfigSecure", () => {
    expect(content).toContain("return saveCloverConfigSecure(apiToken, merchantId)");
  });
});

describe("Data context runs migration on load", () => {
  const filePath = path.resolve(__dirname, "../lib/data-context.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  it("imports migrateKeysToSecureStore", () => {
    expect(content).toContain("migrateKeysToSecureStore");
  });

  it("calls migration before loading data", () => {
    const refreshIdx = content.indexOf("refreshData");
    const migrateIdx = content.indexOf("migrateKeysToSecureStore", refreshIdx);
    const loadIdx = content.indexOf("loadCustomers", migrateIdx);
    // Migration should come before data loading
    expect(migrateIdx).toBeGreaterThan(0);
    expect(loadIdx).toBeGreaterThan(migrateIdx);
  });
});
