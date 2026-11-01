import express from "express";
import {
  authenticate,
  authorizeRoles,
  enforceHospitalScope,
} from "../middlewares/authMiddlewares.js";
import {
  createEmergencyRequest,
  getActivePatientEmergency,
  getPatientEmergencyHistory,
  cancelEmergencyRequest,
  getHospitalEmergencies,
  updateEmergencyStatus,
  dispatchAmbulance,
  getEmergencyContacts,
  saveEmergencyContact,
  deleteEmergencyContact,
  getSuperAdminEmergencyOverview,
} from "../controllers/emergencyController.js";

const router = express.Router();

// Patient Emergency SOS & Management
router.post("/sos", authenticate, createEmergencyRequest);
router.post("/create", authenticate, createEmergencyRequest);
router.get("/active", authenticate, getActivePatientEmergency);
router.get("/my-history", authenticate, getPatientEmergencyHistory);
router.post("/:id/cancel", authenticate, cancelEmergencyRequest);

// Emergency Contacts
router.get("/contacts", authenticate, getEmergencyContacts);
router.post("/contacts", authenticate, saveEmergencyContact);
router.delete("/contacts/:contactId", authenticate, deleteEmergencyContact);

// Hospital Admin Emergency Operations (Hospital scoped)
router.get("/hospital", authenticate, enforceHospitalScope, getHospitalEmergencies);
router.patch("/:id/status", authenticate, updateEmergencyStatus);
router.post("/:id/status", authenticate, updateEmergencyStatus);
router.post("/:id/ambulance", authenticate, enforceHospitalScope, dispatchAmbulance);

// Super Admin Emergency Platform Overview
router.get(
  "/superadmin/overview",
  authenticate,
  authorizeRoles("super_admin", "admin", "Super Admin", "Admin"),
  getSuperAdminEmergencyOverview
);

export default router;

