import express from "express";
import {
  getAllDoctors,
  getDoctorDetails,
  getOnlineDoctors,
  loginDoctor,
  getDoctorProfile,
  updateDoctorProfile,
  changeDoctorPassword,
  updateDoctorNotificationSettings,
  getDoctorDashboardAndPanel,
  getDoctorQueue,
  handleDoctorQueueAction,
  toggleDoctorQueuePause,
  updateDoctorCapacityAndBreak,
  startDoctorConsultation,
  getDoctorReports,
  uploadDoctorReport,
  deleteDoctorReport,
  getDoctorSchedule,
  updateDoctorSchedule,
  toggleDoctorAvailability,
  getDoctorCalendar,
  generateDoctorSlots,
  blockDoctorSlot,
  unblockDoctorSlot,
  getDoctorPatients,
  getDoctorPatientDetails,
  getDoctorPatientEMR,
  updatePatientClinicalProfile,
  getDoctorReviews,
  getDoctorPrescriptions,
  getDoctorAppointmentPrescription,
  saveDoctorAppointmentPrescription,
  getDoctorEarnings,
  getDoctorAnalytics,
  getDoctorNotifications,
  markDoctorNotificationRead,
  markAllDoctorNotificationsRead,
  getDoctorConsultationDetails,
  saveDoctorConsultation,
  completeDoctorConsultation,
  getDoctorAppointments,
  updateDoctorAppointmentStatus,
  rescheduleDoctorAppointment,
  submitDoctorVerification,
} from "../controllers/doctorController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// ==========================================
// 1. PUBLIC & CATALOG
// ==========================================
router.get("/get-all", getAllDoctors);
router.get("/get-all-doctors", getAllDoctors);
router.get("/all", getAllDoctors);
router.get("/online", getOnlineDoctors);
router.post("/login", loginDoctor);

// ==========================================
// 2. AUTHENTICATED DOCTOR PANEL ROUTES
// ==========================================

// Profile & Settings
router.get("/panel/:id/profile", authenticate, getDoctorProfile);
router.patch("/panel/:id/profile", authenticate, updateDoctorProfile);
router.post("/panel/:id/change-password", authenticate, changeDoctorPassword);
router.patch("/panel/:id/notification-settings", authenticate, updateDoctorNotificationSettings);

// OPD Patient Queue
router.get("/panel/:id/queue", authenticate, getDoctorQueue);
router.patch("/panel/:id/queue/:appointmentId/action", authenticate, handleDoctorQueueAction);
router.post("/panel/:id/queue/toggle-pause", authenticate, toggleDoctorQueuePause);
router.put("/panel/:id/capacity-settings", authenticate, updateDoctorCapacityAndBreak);

// Consultation Flow
router.patch("/panel/:id/consultation/:appointmentId/start", authenticate, startDoctorConsultation);
router.get("/panel/:id/consultation/:appointmentId", authenticate, getDoctorConsultationDetails);
router.post("/panel/:id/consultation/:appointmentId/save", authenticate, saveDoctorConsultation);
router.post("/panel/:id/consultation/:appointmentId/complete", authenticate, completeDoctorConsultation);

// Diagnostic & Medical Reports
router.get("/panel/:id/reports", authenticate, getDoctorReports);
router.post("/panel/:id/appointment/:aptId/report", authenticate, uploadDoctorReport);
router.delete("/panel/:id/appointment/:aptId/report/:reportId", authenticate, deleteDoctorReport);

// Availability & Schedule Management
router.get("/panel/:id/schedule", authenticate, getDoctorSchedule);
router.patch("/panel/:id/schedule", authenticate, updateDoctorSchedule);
router.patch("/panel/:id/availability", authenticate, toggleDoctorAvailability);
router.get("/panel/:id/calendar", authenticate, getDoctorCalendar);
router.post("/panel/:id/slots/generate", authenticate, generateDoctorSlots);
router.patch("/panel/:id/slots/block", authenticate, blockDoctorSlot);
router.patch("/panel/:id/slots/unblock", authenticate, unblockDoctorSlot);

// Patients Directory & EMR
router.get("/panel/:id/patients", authenticate, getDoctorPatients);
router.get("/panel/:id/patient/:patientId/details", authenticate, getDoctorPatientDetails);
router.get("/panel/:id/emr/:patientId", authenticate, getDoctorPatientEMR);
router.patch("/panel/:id/emr/:patientId/clinical-profile", authenticate, updatePatientClinicalProfile);

// Reviews & Ratings
router.get("/panel/:id/reviews", authenticate, getDoctorReviews);

// Prescriptions
router.get("/panel/:id/prescriptions", authenticate, getDoctorPrescriptions);
router.get("/panel/:id/appointment/:aptId/prescription", authenticate, getDoctorAppointmentPrescription);
router.post("/panel/:id/appointment/:aptId/prescription", authenticate, saveDoctorAppointmentPrescription);

// Earnings & Analytics
router.get("/panel/:id/earnings", authenticate, getDoctorEarnings);
router.get("/panel/:id/analytics", authenticate, getDoctorAnalytics);

// Notifications
router.get("/panel/:id/notifications", authenticate, getDoctorNotifications);
router.patch("/panel/:id/notifications/mark-all", authenticate, markAllDoctorNotificationsRead);
router.patch("/panel/:id/notifications/:notifId/read", authenticate, markDoctorNotificationRead);

// Appointments & Reschedule
router.get("/panel/:id/appointments", authenticate, getDoctorAppointments);
router.patch("/panel/:id/appointment/:aptId/status", authenticate, updateDoctorAppointmentStatus);
router.post("/panel/:id/appointment/:aptId/status", authenticate, updateDoctorAppointmentStatus);
router.patch("/panel/:id/appointment/:aptId/reschedule", authenticate, rescheduleDoctorAppointment);
router.post("/panel/:id/appointment/:aptId/reschedule", authenticate, rescheduleDoctorAppointment);

// Verification & Document Upload
router.post("/panel/:id/verification/submit", authenticate, submitDoctorVerification);
router.post("/upload-documents/:id", authenticate, submitDoctorVerification);

// Complete Doctor Dashboard and Panel
router.get("/panel/:id", authenticate, getDoctorDashboardAndPanel);

// ==========================================
// 3. LEGACY / DIRECT SHORT ROUTES
// ==========================================
router.get("/profile", authenticate, getDoctorProfile);
router.get("/appointments", authenticate, getDoctorAppointments);
router.get("/:id/appointments", authenticate, getDoctorAppointments);
router.patch("/appointment/:id/status", authenticate, updateDoctorAppointmentStatus);

// ==========================================
// 4. PARAMETERIZED DETAILS (MUST BE LAST)
// ==========================================
router.get("/get-details/:id", getDoctorDetails);
router.get("/get-doctor-details/:id", getDoctorDetails);
router.get("/:id", getDoctorDetails);

export default router;
