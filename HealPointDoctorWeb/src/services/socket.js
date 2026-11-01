import { io } from "socket.io-client";

let socket = null;
let currentToken = null;

export const getSocketServerUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  }
  return window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : window.location.origin;
};

export const initDoctorSocket = (token) => {
  const serverUrl = getSocketServerUrl();

  if (socket && token === currentToken && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token || null;

  socket = io(serverUrl, {
    transports: ["websocket", "polling"],
    auth: token ? { token } : undefined,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("[Socket.IO] Doctor connected to server:", serverUrl);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket.IO] Doctor connection error:", err.message);
  });

  return socket;
};

export const getDoctorSocket = () => socket;

export const disconnectDoctorSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};

export const subscribeDoctorSync = ({
  onAppointmentSync,
  onQueueSync,
  onConsultationSync,
  onNotification,
  onEmergencyAlert,
  onEmergencyStatus,
}) => {
  if (!socket) return () => {};

  if (onAppointmentSync) socket.on("appointment:sync", onAppointmentSync);
  if (onQueueSync) socket.on("queue:sync", onQueueSync);
  if (onConsultationSync) socket.on("consultation:sync", onConsultationSync);
  if (onNotification) socket.on("notification:new", onNotification);
  if (onEmergencyAlert) socket.on("emergency:alert", onEmergencyAlert);
  if (onEmergencyStatus) socket.on("emergency:status", onEmergencyStatus);

  return () => {
    if (!socket) return;
    if (onAppointmentSync) socket.off("appointment:sync", onAppointmentSync);
    if (onQueueSync) socket.off("queue:sync", onQueueSync);
    if (onConsultationSync) socket.off("consultation:sync", onConsultationSync);
    if (onNotification) socket.off("notification:new", onNotification);
    if (onEmergencyAlert) socket.off("emergency:alert", onEmergencyAlert);
    if (onEmergencyStatus) socket.off("emergency:status", onEmergencyStatus);
  };
};
