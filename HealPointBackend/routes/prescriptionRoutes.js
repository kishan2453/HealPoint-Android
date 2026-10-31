import express from "express";
import { authenticate } from "../middlewares/authMiddlewares.js";
import {
  savePrescriptionDraft,
  issuePrescription,
  amendPrescription,
  getPrescriptionById,
  downloadPrescriptionPdf,
  getPatientPrescriptions,
  getHospitalPrescriptionStats,
  getSuperAdminPrescriptionStats,
} from "../controllers/prescriptionController.js";
import { getDoctorPrescriptions } from "../controllers/doctorController.js";

const router = express.Router();

// Doctor Prescription Creation & Issuing
router.post("/draft", authenticate, savePrescriptionDraft);
router.post("/issue", authenticate, issuePrescription);
router.put("/:id/amend", authenticate, amendPrescription);

// Patient Access
router.get("/patient", authenticate, getPatientPrescriptions);

// Doctor History Access
router.get("/doctor/:id", authenticate, getDoctorPrescriptions);

// Protected PDF Download & Stream
router.get("/:id/pdf", authenticate, downloadPrescriptionPdf);

// Single Prescription Details
router.get("/:id", authenticate, getPrescriptionById);

// Analytics & Statistics
router.get("/hospital/:hospitalId/stats", authenticate, getHospitalPrescriptionStats);
router.get("/admin/stats", authenticate, getSuperAdminPrescriptionStats);

export default router;
