import express from "express";
import { getOnlineDoctors } from "../controllers/doctorController.js";
import {
  createConsultationSession,
  getConsultationSessionStatus,
  updateConsultationStatus,
  saveConsultationNotes,
  getHospitalConsultationStats,
  getPatientConsultationDetail,
  saveDoctorMeetingLink,
  removeDoctorMeetingLink,
} from "../controllers/consultationController.js";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// ---------------------------------------------------------------------------
// 1. Online Doctors Directory
// ---------------------------------------------------------------------------
router.get("/online-doctors", getOnlineDoctors);
router.get("/online", getOnlineDoctors);

// ---------------------------------------------------------------------------
// 2. Advanced WebRTC Consultation Session APIs (Phase 2)
// ---------------------------------------------------------------------------
router.post("/session/:appointmentId/create", authenticate, createConsultationSession);
router.get("/session/:appointmentId/status", authenticate, getConsultationSessionStatus);
router.patch("/session/:appointmentId/status", authenticate, updateConsultationStatus);
router.post("/session/:appointmentId/notes", authenticate, saveConsultationNotes);

// ---------------------------------------------------------------------------
// 3. Patient Consultation Lists & Detail
// ---------------------------------------------------------------------------
router.get("/patient/detail/:id", authenticate, getPatientConsultationDetail);
router.get("/patient/:userId", authenticate, async (req, res) => {
  try {
    const consultations = await appointmentModel
      .find({ userId: req.params.userId, consultationType: "video" })
      .populate("doctorId", "name speciality image rating fees")
      .populate("hospitalId", "name location")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: consultations.length, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. Doctor Consultation Management
// ---------------------------------------------------------------------------
router.get("/doctor/:doctorId", authenticate, async (req, res) => {
  try {
    const consultations = await appointmentModel
      .find({ doctorId: req.params.doctorId, consultationType: "video" })
      .populate("userId", "name email phone image")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: consultations.length, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch("/doctor/:doctorId/toggle", authenticate, async (req, res) => {
  try {
    const { online } = req.body;
    const doc = await doctorModel.findByIdAndUpdate(
      req.params.doctorId,
      { $set: { onlineConsultationEnabled: Boolean(online), onlineStatus: online ? "online" : "offline" } },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Doctor online consultation status updated", doctor: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch("/doctor/:doctorId/status/:appointmentId", authenticate, updateConsultationStatus);

// Preserved Google Meet fallback endpoints
router.post("/doctor/:doctorId/meeting-link/:appointmentId", authenticate, saveDoctorMeetingLink);
router.delete("/doctor/:doctorId/meeting-link/:appointmentId", authenticate, removeDoctorMeetingLink);

// ---------------------------------------------------------------------------
// 5. Analytics & Reporting (Strict Hospital-Isolation)
// ---------------------------------------------------------------------------
router.get("/hospital/stats", authenticate, getHospitalConsultationStats);

router.get("/super-admin/stats", authenticate, async (req, res) => {
  try {
    const totalVideo = await appointmentModel.countDocuments({ consultationType: "video" });
    const activeDoctors = await doctorModel.countDocuments({ onlineStatus: "online" });
    res.status(200).json({ success: true, totalConsultations: totalVideo, onlineDoctors: activeDoctors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
