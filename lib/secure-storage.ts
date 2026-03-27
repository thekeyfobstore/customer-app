/**
 * Secure storage wrapper for sensitive API keys and tokens.
 * Uses expo-secure-store (encrypted keychain/keystore) on native devices,
 * with a localStorage fallback on web for development/preview.
 *
 * SECURITY:
 * - On iOS: stored in Keychain (hardware-encrypted, persists across reinstalls)
 * - On Android: stored in SharedPreferences encrypted with Android Keystore
 * - On Web: falls back to localStorage (NOT encrypted — for preview only)
 */
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const SECURE_KEYS = {
  OPENPHONE_API_KEY: "clientbook_openphone_key",
  CLOVER_API_TOKEN: "clientbook_clover_token",
  CLOVER_MERCHANT_ID: "clientbook_clover_merchant",
};

// --- Core helpers with platform fallback ---

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage unavailable
    }
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.removeItem(key);
    } catch {
      // localStorage unavailable
    }
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

// --- OpenPhone API Key ---

export async function loadApiKeySecure(): Promise<string> {
  try {
    const key = await secureGet(SECURE_KEYS.OPENPHONE_API_KEY);
    return key || "";
  } catch {
    return "";
  }
}

export async function saveApiKeySecure(key: string): Promise<void> {
  await secureSet(SECURE_KEYS.OPENPHONE_API_KEY, key);
}

export async function clearApiKeySecure(): Promise<void> {
  await secureDelete(SECURE_KEYS.OPENPHONE_API_KEY);
}

// --- Clover Config ---

export async function loadCloverConfigSecure(): Promise<{
  apiToken: string;
  merchantId: string;
}> {
  try {
    const [apiToken, merchantId] = await Promise.all([
      secureGet(SECURE_KEYS.CLOVER_API_TOKEN),
      secureGet(SECURE_KEYS.CLOVER_MERCHANT_ID),
    ]);
    return { apiToken: apiToken || "", merchantId: merchantId || "" };
  } catch {
    return { apiToken: "", merchantId: "" };
  }
}

export async function saveCloverConfigSecure(
  apiToken: string,
  merchantId: string
): Promise<void> {
  await Promise.all([
    secureSet(SECURE_KEYS.CLOVER_API_TOKEN, apiToken),
    secureSet(SECURE_KEYS.CLOVER_MERCHANT_ID, merchantId),
  ]);
}

export async function clearCloverConfigSecure(): Promise<void> {
  await Promise.all([
    secureDelete(SECURE_KEYS.CLOVER_API_TOKEN),
    secureDelete(SECURE_KEYS.CLOVER_MERCHANT_ID),
  ]);
}

// --- Migration helper: move keys from AsyncStorage to SecureStore ---

export async function migrateKeysToSecureStore(): Promise<void> {
  if (Platform.OS === "web") return; // No migration needed on web

  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

  try {
    // Migrate OpenPhone key
    const opKey = await AsyncStorage.getItem("@clientbook_openphone_key");
    if (opKey) {
      await secureSet(SECURE_KEYS.OPENPHONE_API_KEY, opKey);
      await AsyncStorage.removeItem("@clientbook_openphone_key");
    }

    // Migrate Clover token
    const cloverToken = await AsyncStorage.getItem("@clientbook_clover_token");
    if (cloverToken) {
      await secureSet(SECURE_KEYS.CLOVER_API_TOKEN, cloverToken);
      await AsyncStorage.removeItem("@clientbook_clover_token");
    }

    // Migrate Clover merchant ID
    const cloverMerchant = await AsyncStorage.getItem("@clientbook_clover_merchant");
    if (cloverMerchant) {
      await secureSet(SECURE_KEYS.CLOVER_MERCHANT_ID, cloverMerchant);
      await AsyncStorage.removeItem("@clientbook_clover_merchant");
    }
  } catch {
    // Migration is best-effort — if it fails, user can re-enter keys
  }
}
