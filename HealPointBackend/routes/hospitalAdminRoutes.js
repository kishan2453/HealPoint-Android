import express from "express";
import {
  hospitalAdminLogin,
  getDashboard,
  getHospitalProfile,
  updateHospitalProfile,
  getHospitalDoctors,
  createHospitalDoctor,
  updateHospitalDoctor,
  updateHospitalDoctorAvailability,
  updateHospitalDoctorSlots,
  updateHospitalDoctorStatus,
  deleteHospitalDoctor,
  getHospitalAppointments,
  updateHospitalAppointmentStatus,
  cancelHospitalAppointment,
  rescheduleHospitalAppointment,
  getHospitalPatients,
  getHospitalDepartments,
  createHospitalDepartment,
  updateHospitalDepartment,
  deleteHospitalDepartment,
  getHospitalDepartmentDoctors,
  getHospitalReviews,
  getHospitalGallery,
  getHospitalComplianceOverview,
  getHospitalAuditTrail,
  getHospitalClinicalGovernance,
  getHospitalSecurityEvents,
  getHospitalDataAccessGovernance,
  exportHospitalComplianceCSV,
  getHospitalSchedulingOverview,
  checkDoctorScheduleConflicts,
  saveDoctorSchedule,
  getDoctorCalendar,
  addDoctorLeave,
  deleteDoctorLeave,
} from "../controllers/hospitalAdminController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Authentication
router.post("/login", hospitalAdminLogin);

// Dashboard & Workspace Overview
router.get("/dashboard", authenticate, getDashboard);
router.get("/profile", authenticate, getHospitalProfile);
router.patch("/profile", authenticate, updateHospitalProfile);
router.put("/profile", authenticate, updateHospitalProfile);

// Doctors Management
router.get("/doctors", authenticate, getHospitalDoctors);
router.post("/doctors", authenticate, createHospitalDoctor);
router.put("/doctors/:id", authenticate, updateHospitalDoctor);
router.put("/doctors/:id/availability", authenticate, updateHospitalDoctorAvailability);
router.put("/doctors/:id/slots", authenticate, updateHospitalDoctorSlots);
router.put("/doctors/:id/status", authenticate, updateHospitalDoctorStatus);
router.delete("/doctors/:id", authenticate, deleteHospitalDoctor);

// Appointments Management
router.get("/appointments", authenticate, getHospitalAppointments);
router.patch("/appointments/:id/status", authenticate, updateHospitalAppointmentStatus);
router.put("/appointments/:id/status", authenticate, updateHospitalAppointmentStatus);
router.post("/appointments/:id/cancel", authenticate, cancelHospitalAppointment);
router.post("/appointments/:id/reschedule", authenticate, rescheduleHospitalAppointment);

// Patient Registry
router.get("/patients", authenticate, getHospitalPatients);

// Departments Management
router.get("/departments", authenticate, getHospitalDepartments);
router.post("/departments", authenticate, createHospitalDepartment);
router.put("/departments/:id", authenticate, updateHospitalDepartment);
router.patch("/departments/:id/status", authenticate, updateHospitalDepartment);
router.delete("/departments/:id", authenticate, deleteHospitalDepartment);
router.get("/departments/:id/doctors", authenticate, getHospitalDepartmentDoctors);

// Patient Reviews
router.get("/reviews", authenticate, getHospitalReviews);

// Facility Gallery
router.get("/gallery", authenticate, getHospitalGallery);

// Compliance & Governance Center
router.get("/compliance/overview", authenticate, getHospitalComplianceOverview);
router.get("/compliance/audit-trail", authenticate, getHospitalAuditTrail);
router.get("/compliance/clinical-governance", authenticate, getHospitalClinicalGovernance);
router.get("/compliance/security-events", authenticate, getHospitalSecurityEvents);
router.get("/compliance/data-access-governance", authenticate, getHospitalDataAccessGovernance);
router.get("/compliance/export", authenticate, exportHospitalComplianceCSV);

// Doctor Scheduling & Calendar Planner
router.get("/scheduling/overview", authenticate, getHospitalSchedulingOverview);
router.post("/scheduling/doctor/:id/check-conflicts", authenticate, checkDoctorScheduleConflicts);
router.put("/scheduling/doctor/:id/schedule", authenticate, saveDoctorSchedule);
router.post("/scheduling/doctor/:id/schedule", authenticate, saveDoctorSchedule);
router.get("/scheduling/doctor/:id/calendar", authenticate, getDoctorCalendar);
router.post("/scheduling/doctor/:id/leave/check-conflicts", authenticate, checkDoctorScheduleConflicts);
router.post("/scheduling/doctor/:id/leave", authenticate, addDoctorLeave);
router.delete("/scheduling/doctor/:id/leave/:leaveId", authenticate, deleteDoctorLeave);
router.post("/scheduling/doctor/:id/override/check-conflicts", authenticate, checkDoctorScheduleConflicts);
router.post("/scheduling/doctor/:id/override", authenticate, addDoctorLeave);
router.delete("/scheduling/doctor/:id/override/:overrideId", authenticate, deleteDoctorLeave);
router.post("/scheduling/doctor/:id/slots/preview", authenticate, checkDoctorScheduleConflicts);
router.post("/scheduling/doctor/:id/slots/generate", authenticate, saveDoctorSchedule);

export default router;
