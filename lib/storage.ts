/**
 * HealPoint - Universal Cross-Platform Storage Engine.
 *
 * Provides a resilient, unified key-value storage layer:
 * - On Mobile (iOS/Android): Uses `expo-secure-store` for hardware-backed keychain encryption.
 * - On Web: Uses standard browser `window.localStorage` (or in-memory fallback),
 *   completely preventing runtime errors like `n.default.setValueWithKeyAsync is not a function`.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// In-memory fallback if both SecureStore and localStorage are unavailable
const memoryFallback = new Map<string, string>();

/**
 * Synchronous storage reader.
 * On web, reads window.localStorage synchronously so tokens and users are
 * immediately available during component initialization without an async render tick.
 */
export function getStorageItemSync(key: string): string | null {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (err) {
      console.warn("[storage] Web localStorage.getItemSync failed", err);
    }
    return memoryFallback.get(key) || null;
  }
  return memoryFallback.get(key) || null;
}

/**
 * Synchronous storage writer (web only, updates memory cache everywhere).
 */
export function setStorageItemSync(key: string, value: string): void {
  memoryFallback.set(key, value);
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      console.warn("[storage] Web localStorage.setItemSync failed", err);
    }
  }
}

/**
 * Synchronous storage remover (web only, clears memory cache everywhere).
 */
export function deleteStorageItemSync(key: string): void {
  memoryFallback.delete(key);
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn("[storage] Web localStorage.removeItemSync failed", err);
    }
  }
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  memoryFallback.set(key, value);
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (err) {
      console.warn("[storage] Web localStorage.setItem failed, using memory fallback", err);
    }
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn("[storage] SecureStore.setItemAsync failed, using memory fallback", err);
  }
}

export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (err) {
      console.warn("[storage] Web localStorage.getItem failed", err);
    }
    return memoryFallback.get(key) || null;
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn("[storage] SecureStore.getItemAsync failed", err);
    return memoryFallback.get(key) || null;
  }
}

export async function deleteStorageItem(key: string): Promise<void> {
  memoryFallback.delete(key);
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (err) {
      console.warn("[storage] Web localStorage.removeItem failed", err);
    }
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn("[storage] SecureStore.deleteItemAsync failed", err);
  }
}

