import express from "express";
import {
  getStaffList,
  createStaff,
  updateStaff,
  deleteStaff,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getRoster,
  assignRosterShift,
  updateRosterStatus,
  deleteRoster,
  getLeaveRequests,
  requestLeave,
  reviewLeaveRequest,
  getDoctorRosterSchedule,
  getStaffRosterDashboardStats,
} from "../controllers/staffRosterController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Dashboard Stats
router.get("/dashboard-stats", authenticate, getStaffRosterDashboardStats);

// Staff Directory
router.get("/staff", authenticate, getStaffList);
router.post("/staff", authenticate, createStaff);
router.put("/staff/:id", authenticate, updateStaff);
router.delete("/staff/:id", authenticate, deleteStaff);

// Shifts
router.get("/shifts", authenticate, getShifts);
router.post("/shifts", authenticate, createShift);
router.put("/shifts/:id", authenticate, updateShift);
router.delete("/shifts/:id", authenticate, deleteShift);

// Duty Roster
router.get("/roster", authenticate, getRoster);
router.post("/roster", authenticate, assignRosterShift);
router.put("/roster/:id/status", authenticate, updateRosterStatus);
router.delete("/roster/:id", authenticate, deleteRoster);

// Leaves
router.get("/leaves", authenticate, getLeaveRequests);
router.post("/leaves", authenticate, requestLeave);
router.patch("/leaves/:id/review", authenticate, reviewLeaveRequest);

// Doctor specific roster view
router.get("/doctor/:id", authenticate, getDoctorRosterSchedule);

export default router;
