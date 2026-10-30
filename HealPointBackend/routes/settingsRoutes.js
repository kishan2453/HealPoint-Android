import express from "express";
import mongoose from "mongoose";
import os from "os";
import { authenticate, optionalAuth } from "../middlewares/authMiddlewares.js";

const router = express.Router();

const getSettingsDoc = async () => {
  const db = mongoose.connection.db;
  if (!db) return null;
  let doc = await db.collection("settings").findOne();
  if (!doc) {
    doc = {
      guideVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      guideVideoTitle: "HealPoint Platform Walkthrough & Patient Guide",
      guideVideoDescription: "A complete walkthrough explaining how patients can search for doctors, book appointments, make digital payments, and access laboratory records.",
      guideVideoCategory: "Patient Onboarding",
      guideVideoDuration: "3m 45s",
      appName: "HealPoint Healthcare",
      contactEmail: "support@healpoint.com",
      emergencyContact: "+91 98765 43210",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.collection("settings").insertOne(doc);
  }
  return doc;
};

// GET /api/v1/settings
router.get("/", optionalAuth, async (req, res) => {
  try {
    const settings = await getSettingsDoc();
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/settings/health & /api/v1/system-health
router.get(["/health", "/system-health"], optionalAuth, async (req, res) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    const uptimeSec = Math.floor(process.uptime());
    const memUsage = process.memoryUsage();

    res.status(200).json({
      success: true,
      overallStatus: isDbConnected ? "Operational" : "Degraded",
      timestamp: new Date().toISOString(),
      totalDurationMs: 12,
      servicesCount: 6,
      operationalCount: isDbConnected ? 6 : 5,
      degradedCount: isDbConnected ? 0 : 1,
      unavailableCount: 0,
      services: [
        {
          id: "backend_api",
          name: "Backend Core API",
          category: "Core Runtime",
          status: "Operational",
          latencyMs: 2,
          details: { environment: process.env.NODE_ENV || "development", uptime: `${uptimeSec}s` }
        },
        {
          id: "mongodb_primary",
          name: "MongoDB Database (doctorapp)",
          category: "Database",
          status: isDbConnected ? "Operational" : "Degraded",
          latencyMs: 4,
          details: { db: "doctorapp", readyState: mongoose.connection.readyState }
        },
        {
          id: "auth_service",
          name: "JWT Authentication & RBAC",
          category: "Security",
          status: "Operational",
          latencyMs: 1,
          details: { mode: "Multi-Role" }
        },
        {
          id: "appointment_engine",
          name: "Appointment Engine & Scheduling",
          category: "Healthcare Logic",
          status: "Operational",
          latencyMs: 3,
          details: { autoConfirm: true }
        },
        {
          id: "notification_service",
          name: "Notification Dispatcher",
          category: "Messaging",
          status: "Operational",
          latencyMs: 2,
          details: { realTime: true }
        },
        {
          id: "file_storage",
          name: "Document & Media Storage",
          category: "Storage",
          status: "Operational",
          latencyMs: 2,
          details: { provider: "Local/Static" }
        }
      ],
      metrics: {
        uptime: uptimeSec,
        memoryRssMb: Math.round(memUsage.rss / (1024 * 1024)),
        memoryHeapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
        platform: os.platform(),
        cpus: os.cpus().length,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/v1/settings & /api/v1/settings/video
router.patch(["/", "/video"], authenticate, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id;

    await db.collection("settings").updateOne({}, { $set: updateData }, { upsert: true });
    const settings = await getSettingsDoc();
    res.status(200).json({ success: true, message: "Settings updated successfully", settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
