import express from "express";
import {
  getCheckInStatus,
  processCheckIn,
  processScanCheckIn,
  getHospitalQueueOverview,
  getAppointmentQRSummary,
  getAppointmentLiveQueueStatus,
} from "../controllers/checkInController.js";
import { authenticate, optionalAuth } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Patient App endpoints
router.get("/status/:appointmentId", authenticate, getCheckInStatus);
router.post("/process", authenticate, processCheckIn);
router.get("/appointment/:appointmentId/qr", optionalAuth, getAppointmentQRSummary);
router.get("/appointment/:appointmentId/queue-status", optionalAuth, getAppointmentLiveQueueStatus);

// Hospital Admin Check-In Scanner & Live Queue
router.post("/scan", authenticate, processScanCheckIn);
router.get("/hospital/queue-overview", authenticate, getHospitalQueueOverview);

export default router;
