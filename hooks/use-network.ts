import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { API_URL } from "@/lib/env";

export interface NetworkState {
  isOnline: boolean;
  isOffline: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  checkConnection: () => Promise<boolean>;
}

let globalIsOnline = true;
const listeners = new Set<(online: boolean) => void>();

function notifyListeners(online: boolean) {
  globalIsOnline = online;
  listeners.forEach((listener) => {
    try {
      listener(online);
    } catch {
      // Ignore
    }
  });
}

/** Check connectivity via fast endpoint probe */
async function probeConnectivity(): Promise<boolean> {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    if (!navigator.onLine) {
      notifyListeners(false);
      return false;
    }
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const healthUrl = `${API_URL.replace(/\/+$/, "")}/health`;

    const res = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    const online = res.status >= 200 && res.status < 500;
    notifyListeners(online);
    return online;
  } catch {
    // If local fetch fails, check web navigator or mark offline
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      const online = navigator.onLine;
      notifyListeners(online);
      return online;
    }
    notifyListeners(false);
    return false;
  }
}

export function useNetwork(): NetworkState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      return navigator.onLine;
    }
    return globalIsOnline;
  });
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(new Date());

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    const status = await probeConnectivity();
    setIsOnline(status);
    setIsChecking(false);
    setLastChecked(new Date());
    return status;
  }, []);

  useEffect(() => {
    const listener = (online: boolean) => {
      setIsOnline(online);
      setLastChecked(new Date());
    };
    listeners.add(listener);

    // Web online/offline event listeners
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handleOnline = () => {
        setIsOnline(true);
        notifyListeners(true);
        probeConnectivity();
      };
      const handleOffline = () => {
        setIsOnline(false);
        notifyListeners(false);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        listeners.delete(listener);
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    isChecking,
    lastChecked,
    checkConnection,
  };
}

export function isDeviceOnline(): boolean {
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    return navigator.onLine;
  }
  return globalIsOnline;
}

