/**
 * HealPoint Mobile — Real-Time Cross-Portal Socket Client.
 *
 * Connects to the centralized backend Socket.IO server running on port 8080.
 * Automatically handles authentication handshakes, reconnection with backoff,
 * and scoped real-time event subscriptions (appointments, queue, consultations).
 */
import { io, Socket } from "socket.io-client";
import { resolveApiUrl } from "@/lib/env";

let socketInstance: Socket | null = null;
let currentToken: string | null = null;

export function getSocketServerUrl(): string {
  const apiUrl = resolveApiUrl();
  return apiUrl.replace(/\/api\/v1\/?$/, "");
}

/**
 * Initialize or reuse the singleton socket connection with bearer token.
 */
export function initSocket(token?: string | null): Socket {
  const serverUrl = getSocketServerUrl();

  if (socketInstance && token === currentToken && socketInstance.connected) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  currentToken = token || null;

  socketInstance = io(serverUrl, {
    transports: ["websocket", "polling"],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socketInstance.on("connect", () => {
    if (__DEV__) {
      console.log("[Socket.IO] Connected to HealPoint server:", serverUrl);
    }
  });

  socketInstance.on("connect_error", (err) => {
    if (__DEV__) {
      console.warn("[Socket.IO] Connection error:", err.message);
    }
  });

  socketInstance.on("disconnect", (reason) => {
    if (__DEV__) {
      console.log("[Socket.IO] Disconnected:", reason);
    }
  });

  return socketInstance;
}

export function getSocket(): Socket | null {
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentToken = null;
  }
}

export interface AppointmentSyncPayload {
  eventType: string;
  appointmentId: string;
  status?: string;
  paymentStatus?: string;
  slotDate?: string;
  slotTime?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface QueueSyncPayload {
  action?: string;
  appointmentId?: string;
  tokenNumber?: number | string;
  queueStatus?: string;
  consultationStatus?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Subscribe to appointment sync events. Returns unsubscribe function.
 */
export function subscribeToAppointmentSync(
  callback: (payload: AppointmentSyncPayload) => void,
): () => void {
  if (!socketInstance) return () => {};

  const handler = (data: AppointmentSyncPayload) => {
    try {
      callback(data);
    } catch (e) {
      console.error("[Socket.IO] Error handling appointment:sync:", e);
    }
  };

  socketInstance.on("appointment:sync", handler);
  return () => {
    socketInstance?.off("appointment:sync", handler);
  };
}

/**
 * Subscribe to queue sync events. Returns unsubscribe function.
 */
export function subscribeToQueueSync(
  callback: (payload: QueueSyncPayload) => void,
): () => void {
  if (!socketInstance) return () => {};

  const handler = (data: QueueSyncPayload) => {
    try {
      callback(data);
    } catch (e) {
      console.error("[Socket.IO] Error handling queue:sync:", e);
    }
  };

  socketInstance.on("queue:sync", handler);
  return () => {
    socketInstance?.off("queue:sync", handler);
  };
}
