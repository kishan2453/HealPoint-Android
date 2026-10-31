import express from "express";
import {
  chatWithAi,
  getChatHistory,
  clearChatHistory,
  getConsultationAiSummary,
  getHospitalAiStats,
  getPlatformAiStats,
} from "../controllers/aiController.js";
import { authenticate, optionalAuth, authorizeRoles } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Patient AI Chat (Optional auth allows guest triage, authenticated sessions save history)
router.post("/chat", optionalAuth, chatWithAi);

// Patient Chat History (Strictly authenticated to the patient)
router.get("/history", authenticate, getChatHistory);
router.delete("/history", authenticate, clearChatHistory);

// Doctor Consultation AI Summary (Doctor, Hospital Admin, Super Admin)
router.post(
  "/consultation-summary/:appointmentId",
  authenticate,
  authorizeRoles("doctor", "hospital_admin", "super_admin"),
  getConsultationAiSummary
);

// Hospital Admin Aggregated AI Analytics
router.get(
  "/hospital-stats",
  authenticate,
  authorizeRoles("hospital_admin", "super_admin"),
  getHospitalAiStats
);

// Super Admin Platform Aggregated AI Analytics
router.get(
  "/platform-stats",
  authenticate,
  authorizeRoles("super_admin"),
  getPlatformAiStats
);

export default router;
