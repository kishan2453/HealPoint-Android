import express from "express";
import dotenv from "dotenv";
import "colors";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";

import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import healthDocumentRoutes from "./routes/healthDocumentRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import checkInRoutes from "./routes/checkInRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import hospitalAdminRoutes from "./routes/hospitalAdminRoutes.js";
import consultationRoutes from "./routes/consultationRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import galleryRoutes from "./routes/galleryRoutes.js";
import webmessageRoutes from "./routes/webmessageRoutes.js";
import passportRoutes from "./routes/passportRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import medicationReminderRoutes from "./routes/medicationReminderRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import emergencyRoutes from "./routes/emergencyRoutes.js";
import { startReminderScheduler } from "./services/reminderScheduler.js";
import { getAvailableSlots, validateSlot } from "./controllers/appointmentController.js";

dotenv.config();

// Initiate database connection
connectDB().catch((err) => console.error("Initial database connection error:", err.message));

const app = express();

// Middleware: ensure MongoDB is ready for serverless / stateless invocations
app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    next();
  } catch (error) {
    console.error("[db-middleware] MongoDB connection failed:", error.message);
    return res.status(503).json({
      success: false,
      message: "Database connection unavailable. Please try again shortly.",
      code: "DATABASE_UNAVAILABLE",
    });
  }
});

// JSON body parser with 10MB limit (sufficient for Base64 documents & photos)
app.use(express.json({ limit: "10mb" }));

// CORS configuration: allow dev localhost and explicit production domains
const devOrigins = [
  "https://heal-point-mauve.vercel.app",
  "https://heal-point.vercel.app",
  "https://heal-point-doctor-web.vercel.app",
  "https://heal-point-hospital-admin.vercel.app",
  "https://heal-point-super-admin.vercel.app",
  "http://localhost:8081",
  "http://localhost:19000",
  "http://localhost:19006",
  "http://localhost:5173",
  "http://127.0.0.1:8081",
];

const configuredOrigins = (process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...devOrigins, ...configuredOrigins]);

export const corsOptions = {
  origin(origin, callback) {
    // Mobile apps using native fetch often do not send an Origin header
    if (!origin || allowedOrigins.has(origin) || process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith(".vercel.app")) {
        return callback(null, true);
      }
    } catch {
      // Invalid URL format
    }
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Origin", "X-Requested-With", "Accept"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(morgan("dev"));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Prevent caching of private healthcare responses
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Health check endpoint (compatible with both /health and /api/v1/health)
app.get(["/health", "/api/v1/health"], (req, res) => {
  const readyState = mongoose.connection.readyState;
  const database =
    readyState === 1 ? "connected" : readyState === 2 ? "connecting" : "disconnected";

  res.status(200).json({
    ok: readyState === 1,
    success: true,
    service: "HealPoint Healthcare Backend",
    server: "ok",
    database,
    databaseName: mongoose.connection.name || null,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint (compatible with both /test and /api/v1/test)
app.get(["/test", "/api/v1/test"], (req, res) => {
  res.status(200).json({
    ok: true,
    success: true,
    message: "HealPoint backend API is active and responsive",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Core API routes mounted under /api/v1
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/doctor", doctorRoutes);
app.use("/api/v1/hospital", hospitalRoutes);
app.use("/api/v1/appointment", appointmentRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);
app.use("/api/v1/document", healthDocumentRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/checkin", checkInRoutes);
app.use("/api/v1/notification", notificationRoutes);
app.use("/api/v1/review", reviewRoutes);
app.use("/api/v1/hospital-admin", hospitalAdminRoutes);
app.use("/api/v1/consultation", consultationRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/system-health", settingsRoutes);
app.use("/api/v1/gallery", galleryRoutes);
app.use("/api/v1/webmessage", webmessageRoutes);
app.use("/api/v1/passport", passportRoutes);
app.use("/passport", passportRoutes);
app.use("/api/v1/prescription", prescriptionRoutes);
app.use("/api/v1/prescriptions", prescriptionRoutes);
app.use("/api/v1/medication-reminder", medicationReminderRoutes);
app.use("/api/v1/medication-reminders", medicationReminderRoutes);
app.use("/api/v1/analytics", analyticsRoutes);
app.use("/api/v1/emergency", emergencyRoutes);

// Start background appointment reminder scheduler
startReminderScheduler(5);

app.get("/api/v1/slots/availability/:doctorId", getAvailableSlots);
app.post("/api/v1/slots/validate/:doctorId", validateSlot);
app.get("/api/v1/video-guide/get-all", (req, res) => {
  res.status(200).json({
    success: true,
    guides: [
      { id: "1", title: "Patient Onboarding Guide", duration: "3m 45s", category: "Patient", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      { id: "2", title: "Doctor Video Consultation Tutorial", duration: "4m 12s", category: "Doctor", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      { id: "3", title: "Hospital Admin Portal Guide", duration: "5m 30s", category: "Hospital Admin", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    ],
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    service: "HealPoint Healthcare - Appointment & Patient Service API",
    version: "1.0.0",
    health: "/api/v1/health",
  });
});

// JSON 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    code: "ROUTE_NOT_FOUND",
    path: req.originalUrl,
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error("[HealPoint Error]:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    code: err.code || "SERVER_ERROR",
  });
});

export default app;
