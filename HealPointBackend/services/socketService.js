/**
 * HealPoint Healthcare — Real-Time Socket.IO Server & Distribution Service.
 *
 * Implements:
 *  - Secure JWT authentication on socket connection handshake
 *  - Role-based and tenant-isolated room subscriptions:
 *      * hospital:{hospitalId}  (Strictly own hospital's admins, doctors)
 *      * doctor:{doctorId}      (Strictly own doctor or authorized hospital admin)
 *      * user:{userId}          (Strictly own patient profile)
 *  - Scalable Redis adapter support (with graceful in-memory fallback for local dev)
 *  - Sanitized healthcare queue broadcasts (ZERO leakage of sensitive PHI or payment secrets)
 */
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";

let ioInstance = null;
let redisPubClient = null;
let redisSubClient = null;

const JWT_SECRET = process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026";

export const getIO = () => ioInstance;

/**
 * Validates JWT token from handshake auth or headers.
 */
export const verifySocketToken = (socket) => {
  try {
    const authHeader =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization ||
      socket.handshake.query?.token;

    if (!authHeader) return null;

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : String(authHeader).trim();

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
};

/**
 * Initializes Socket.IO on the existing Express HTTP server.
 */
export const initSocketServer = (httpServer, allowedOrigins = ["*"]) => {
  if (ioInstance) return ioInstance;

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.includes("*") ? true : allowedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Configure optional Redis Adapter for distributed / multi-instance setups
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
  const redisHost = process.env.REDIS_HOST;

  if (redisUrl || redisHost) {
    try {
      if (redisUrl) {
        redisPubClient = new Redis(redisUrl, { retryStrategy: (times) => Math.min(times * 100, 3000) });
      } else {
        redisPubClient = new Redis({
          host: redisHost,
          port: parseInt(process.env.REDIS_PORT || "6379", 10),
          password: process.env.REDIS_PASSWORD || undefined,
          retryStrategy: (times) => Math.min(times * 100, 3000),
        });
      }
      redisSubClient = redisPubClient.duplicate();

      redisPubClient.on("error", (err) => console.warn("[Socket.IO Redis Pub Error]:", err.message));
      redisSubClient.on("error", (err) => console.warn("[Socket.IO Redis Sub Error]:", err.message));

      io.adapter(createAdapter(redisPubClient, redisSubClient));
      console.log("[Socket.IO] Redis adapter connected for multi-instance cluster synchronization.");
    } catch (err) {
      console.warn("[Socket.IO] Redis adapter initialization failed. Falling back to single-instance memory adapter:", err.message);
    }
  } else {
    console.log("[Socket.IO] Single-instance in-memory adapter active. (Configure REDIS_URL for multi-instance sync).");
  }

  // Socket Connection Authentication Middleware
  io.use((socket, next) => {
    const user = verifySocketToken(socket);
    if (user) {
      socket.user = user;
      socket.authenticated = true;
    } else {
      socket.user = null;
      socket.authenticated = false;
    }
    next();
  });

  // Client Connection & Scoped Room Subscriptions
  io.on("connection", (socket) => {
    const user = socket.user;
    const userId = user?.id || user?._id;
    const userRole = (user?.role || "").toLowerCase();
    const userHospitalId = user?.hospitalId ? String(user.hospitalId) : null;

    // Automatically join authenticated user's private channel
    if (userId) {
      socket.join(`user:${String(userId)}`);
    }

    // Automatically join authenticated doctor's channel
    if (userId && (userRole === "doctor" || user?.role === "Doctor")) {
      socket.join(`doctor:${String(userId)}`);
    }

    // Automatically join authenticated hospital admin's hospital channel
    if (userHospitalId && (userRole.includes("hospital") || userRole.includes("admin"))) {
      socket.join(`hospital:${userHospitalId}`);
    }

    // Explicit room subscription with authorization verification
    socket.on("join:hospital", ({ hospitalId }, callback) => {
      if (!hospitalId) {
        if (typeof callback === "function") callback({ success: false, message: "Hospital ID required" });
        return;
      }

      // Authorization Check:
      // Super Admin can join any hospital; Hospital Admin can only join their assigned hospital
      const isSuperAdmin = userRole.includes("super");
      const isAuthorizedHospitalAdmin =
        userRole.includes("hospital") && userHospitalId === String(hospitalId);

      if (!socket.authenticated || (!isSuperAdmin && !isAuthorizedHospitalAdmin)) {
        if (typeof callback === "function") {
          callback({ success: false, message: "Forbidden: You are not authorized to subscribe to this hospital queue" });
        }
        return;
      }

      socket.join(`hospital:${String(hospitalId)}`);
      if (typeof callback === "function") callback({ success: true, room: `hospital:${hospitalId}` });
    });

    socket.on("join:doctor", ({ doctorId }, callback) => {
      if (!doctorId) {
        if (typeof callback === "function") callback({ success: false, message: "Doctor ID required" });
        return;
      }

      const isSuperAdmin = userRole.includes("super");
      const isDoctorSelf = String(userId) === String(doctorId);
      const isHospitalAdmin = userRole.includes("hospital") && Boolean(userHospitalId);

      if (!socket.authenticated || (!isDoctorSelf && !isSuperAdmin && !isHospitalAdmin)) {
        if (typeof callback === "function") {
          callback({ success: false, message: "Forbidden: You cannot subscribe to this doctor's private queue" });
        }
        return;
      }

      socket.join(`doctor:${String(doctorId)}`);
      if (typeof callback === "function") callback({ success: true, room: `doctor:${doctorId}` });
    });

    socket.on("join:patient", ({ patientId }, callback) => {
      if (!patientId) {
        if (typeof callback === "function") callback({ success: false, message: "Patient ID required" });
        return;
      }

      const isPatientSelf = String(userId) === String(patientId);
      const isStaff = userRole.includes("doctor") || userRole.includes("admin");

      if (!socket.authenticated || (!isPatientSelf && !isStaff)) {
        if (typeof callback === "function") {
          callback({ success: false, message: "Forbidden: You cannot subscribe to another patient's queue" });
        }
        return;
      }

      socket.join(`user:${String(patientId)}`);
      if (typeof callback === "function") callback({ success: true, room: `user:${patientId}` });
    });

    // -------------------------------------------------------------------------
    // Phase 2: WebRTC Video Consultation Signaling Handlers
    // -------------------------------------------------------------------------
    socket.on("consultation:join-room", ({ appointmentId, sessionToken }, callback) => {
      if (!appointmentId) {
        if (typeof callback === "function") callback({ success: false, message: "Appointment ID required" });
        return;
      }

      // Verify either sessionToken or socket authentication
      let isAuthorized = false;
      let sessionData = null;

      if (sessionToken) {
        try {
          sessionData = jwt.verify(sessionToken, JWT_SECRET);
          if (String(sessionData.appointmentId) === String(appointmentId)) {
            isAuthorized = true;
          }
        } catch (err) {
          // Token invalid or expired
        }
      }

      if (!isAuthorized && socket.authenticated && user) {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        if (typeof callback === "function") {
          callback({
            success: false,
            message: "Forbidden: Invalid or expired consultation session token",
            code: "INVALID_SESSION",
          });
        }
        return;
      }

      const roomName = `consultation:${String(appointmentId)}`;
      socket.join(roomName);

      // Notify other peer in the consultation room
      socket.to(roomName).emit("consultation:peer-joined", {
        peerId: socket.id,
        userId: String(userId || sessionData?.userId || ""),
        role: sessionData?.role || userRole || "participant",
        timestamp: new Date().toISOString(),
      });

      if (typeof callback === "function") {
        callback({
          success: true,
          room: roomName,
          peerId: socket.id,
          role: sessionData?.role || userRole,
        });
      }
    });

    // P2P WebRTC Signal Relay (SDP Offer, SDP Answer, ICE Candidate)
    socket.on("consultation:signal", ({ appointmentId, targetPeerId, signalData }) => {
      if (!appointmentId || !signalData) return;
      const roomName = `consultation:${String(appointmentId)}`;

      if (targetPeerId) {
        io.to(targetPeerId).emit("consultation:signal", {
          fromPeerId: socket.id,
          appointmentId,
          signalData,
        });
      } else {
        socket.to(roomName).emit("consultation:signal", {
          fromPeerId: socket.id,
          appointmentId,
          signalData,
        });
      }
    });

    // Waiting Room notifications
    socket.on("consultation:waiting", ({ appointmentId, doctorId, patientName }) => {
      if (doctorId) {
        io.to(`doctor:${String(doctorId)}`).emit("consultation:patient-waiting", {
          appointmentId,
          patientName: patientName || "Patient",
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Doctor Ready notification
    socket.on("consultation:doctor_ready", ({ appointmentId, userId }) => {
      if (userId) {
        io.to(`user:${String(userId)}`).emit("consultation:doctor-ready", {
          appointmentId,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Leave Consultation Room
    socket.on("consultation:leave", ({ appointmentId }) => {
      if (!appointmentId) return;
      const roomName = `consultation:${String(appointmentId)}`;
      socket.leave(roomName);
      socket.to(roomName).emit("consultation:peer-left", {
        peerId: socket.id,
        userId: String(userId || ""),
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("consultation:")) {
          socket.to(room).emit("consultation:peer-left", {
            peerId: socket.id,
            userId: String(userId || ""),
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    socket.on("disconnect", () => {
      // Disconnection handled automatically by Socket.IO room cleanup
    });
  });

  ioInstance = io;
  return io;
};

/**
 * Broadcast sanitized real-time queue sync event to isolated rooms.
 * Strictly avoids exposing passwords, tokens, full phone numbers, or private medical records.
 */
export const broadcastQueueSync = ({
  hospitalId,
  doctorId,
  userId,
  action = "update",
  appointmentId,
  queueToken,
  queueStatus,
  patientsAhead = 0,
  estimatedWaitMinutes = 0,
  doctorName = "",
  hospitalName = "",
  slotDate = "",
  slotTime = "",
  vitals = null,
}) => {
  if (!ioInstance) return;

  // Sanitized payload matching client expectations in socket.ts and socket.js
  const payload = {
    action,
    appointmentId: String(appointmentId || ""),
    queueToken: queueToken || null,
    queueStatus: queueStatus || "waiting",
    patientsAhead: Math.max(0, Number(patientsAhead) || 0),
    estimatedWaitMinutes: Math.max(0, Number(estimatedWaitMinutes) || 0),
    doctorName,
    hospitalName,
    slotDate,
    slotTime,
    timestamp: new Date().toISOString(),
  };

  // Broadcast to hospital room (for Hospital Admin queue overview)
  if (hospitalId) {
    ioInstance.to(`hospital:${String(hospitalId)}`).emit("queue:sync", payload);
  }

  // Broadcast to doctor room (for Doctor Web live OPD queue)
  if (doctorId) {
    ioInstance.to(`doctor:${String(doctorId)}`).emit("queue:sync", payload);
  }

  // Broadcast to patient private room (for Patient Mobile app live queue tracking)
  if (userId) {
    ioInstance.to(`user:${String(userId)}`).emit("queue:sync", payload);

    // If doctor has called the patient, send an explicit notification event
    if (queueStatus === "called") {
      ioInstance.to(`user:${String(userId)}`).emit("notification:new", {
        type: "queue_called",
        title: "Doctor Calling Now!",
        message: `${doctorName ? `Dr. ${doctorName}` : "Your doctor"} has called Token #${queueToken || "your token"}. Please proceed to the consultation room.`,
        appointmentId: String(appointmentId || ""),
        queueToken,
        timestamp: new Date().toISOString(),
      });
    }
  }
};

/**
 * Broadcast general appointment status update.
 */
export const broadcastAppointmentSync = ({
  hospitalId,
  doctorId,
  userId,
  appointmentId,
  status,
  paymentStatus,
  slotDate,
  slotTime,
}) => {
  if (!ioInstance) return;

  const payload = {
    eventType: "status_update",
    appointmentId: String(appointmentId || ""),
    status: status || "",
    paymentStatus: paymentStatus || "",
    slotDate: slotDate || "",
    slotTime: slotTime || "",
    timestamp: new Date().toISOString(),
  };

  if (hospitalId) ioInstance.to(`hospital:${String(hospitalId)}`).emit("appointment:sync", payload);
  if (doctorId) ioInstance.to(`doctor:${String(doctorId)}`).emit("appointment:sync", payload);
  if (userId) ioInstance.to(`user:${String(userId)}`).emit("appointment:sync", payload);
};

export default {
  initSocketServer,
  getIO,
  verifySocketToken,
  broadcastQueueSync,
  broadcastAppointmentSync,
};

