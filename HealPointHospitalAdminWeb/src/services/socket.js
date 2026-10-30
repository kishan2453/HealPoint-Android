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

export const initHospitalSocket = (token) => {
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
    console.log("[Socket.IO] Hospital Admin connected to server:", serverUrl);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket.IO] Hospital Admin connection error:", err.message);
  });

  return socket;
};

export const getHospitalSocket = () => socket;

export const disconnectHospitalSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
};

export const subscribeHospitalSync = ({
  onAppointmentSync,
  onQueueSync,
  onConsultationSync,
  onReviewSync,
  onNotification,
  onAuditSync,
}) => {
  if (!socket) return () => {};

  if (onAppointmentSync) socket.on("appointment:sync", onAppointmentSync);
  if (onQueueSync) socket.on("queue:sync", onQueueSync);
  if (onConsultationSync) socket.on("consultation:sync", onConsultationSync);
  if (onReviewSync) socket.on("review:sync", onReviewSync);
  if (onNotification) socket.on("notification:new", onNotification);
  if (onAuditSync) socket.on("audit:sync", onAuditSync);

  return () => {
    if (!socket) return;
    if (onAppointmentSync) socket.off("appointment:sync", onAppointmentSync);
    if (onQueueSync) socket.off("queue:sync", onQueueSync);
    if (onConsultationSync) socket.off("consultation:sync", onConsultationSync);
    if (onReviewSync) socket.off("review:sync", onReviewSync);
    if (onNotification) socket.off("notification:new", onNotification);
    if (onAuditSync) socket.off("audit:sync", onAuditSync);
  };
};
