import express from "express";
import { getPatientJourneyTimeline } from "../controllers/patientJourneyController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Patient views their own journey timeline
router.get("/my-journey", authenticate, getPatientJourneyTimeline);

// Authorized Doctor / Staff views specific patient's journey timeline
router.get("/patient/:patientId", authenticate, getPatientJourneyTimeline);

export default router;
