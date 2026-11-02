import express from "express";
import {
  getAppointmentPreparation,
  saveAppointmentQuestions,
  updatePreparationChecklist,
  getPatientFollowUps,
  bookAppointment,
  createPaymentOrder,
  verifyAppointmentPayment,
  getUserAppointments,
  getAllAppointments,
  getDoctorAppointments,
  getAppointmentDetails,
  cancelAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
  getAvailableSlots,
  validateSlot,
  getHealthWallet,
  getPatientMedicalHistory,
  getPatientMedicationReminders,
  updateMedicationDoseStatus,
  createMedicationReminder,
  deleteMedicationReminder,
  triggerAppointmentReminders,
} from "../controllers/appointmentController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Slot availability & validation (Public or authenticated)
router.get("/get-available-slots/:doctorId", getAvailableSlots);
router.get("/slots/availability/:doctorId", getAvailableSlots);
router.post("/validate-slot/:doctorId", validateSlot);

// Health Wallet & Medical History (MUST precede dynamic /:id route)
router.get("/health-wallet", authenticate, getHealthWallet);
router.get("/patient/medical-history", authenticate, getPatientMedicalHistory);
router.get("/patient/follow-ups", authenticate, getPatientFollowUps);
router.get("/patient/care-continuity", authenticate, getPatientFollowUps);
router.get("/patient/medication-reminders", authenticate, getPatientMedicationReminders);
router.post("/patient/medication-reminders/status", authenticate, updateMedicationDoseStatus);
router.patch("/patient/medication-reminders/:reminderId/action", authenticate, updateMedicationDoseStatus);
router.delete("/patient/medication-reminders/:reminderId", authenticate, deleteMedicationReminder);
router.post("/patient/medication-reminders", authenticate, createMedicationReminder);
router.post("/reminders/process", triggerAppointmentReminders);
router.get("/reminders/process", triggerAppointmentReminders);

// Payment endpoints
router.post("/payment/order/:id", authenticate, createPaymentOrder);
router.post("/payment/order", authenticate, createPaymentOrder);
router.post("/create-payment-order/:id", authenticate, createPaymentOrder);
router.post("/create-payment-order", authenticate, createPaymentOrder);
router.post("/verify-payment", authenticate, verifyAppointmentPayment);

router.post("/create", authenticate, bookAppointment);
router.post("/book", authenticate, bookAppointment);
router.post("/book-appointment", authenticate, bookAppointment);
router.get("/get-all-appointments", authenticate, getAllAppointments);
router.get("/all", authenticate, getAllAppointments);
router.get("/doctor/:id", authenticate, getDoctorAppointments);
router.get("/get-user-appointments/:id", authenticate, getUserAppointments);
router.get("/get-user-appointments", authenticate, getUserAppointments);
router.get("/my", authenticate, getUserAppointments);
router.get("/get-user-appointment-details/:id", authenticate, getAppointmentDetails);
// Pre-Consultation Preparation Center (Task 5)
router.get("/preparation/:id", authenticate, getAppointmentPreparation);
router.post("/preparation/:id/questions", authenticate, saveAppointmentQuestions);
router.patch("/preparation/:id/checklist", authenticate, updatePreparationChecklist);

router.get("/:id", authenticate, getAppointmentDetails);
router.post("/cancel/:id", authenticate, cancelAppointment);
router.post("/reschedule/:id", authenticate, rescheduleAppointment);
router.patch("/reschedule/:id", authenticate, rescheduleAppointment);
router.patch("/:id/status", authenticate, updateAppointmentStatus);
router.post("/:id/status", authenticate, updateAppointmentStatus);

export default router;

