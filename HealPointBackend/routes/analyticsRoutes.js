import express from "express";
import {
  getSuperAdminOverview,
  getSuperAdminHospitalPerformance,
  getSuperAdminDoctorPerformance,
  getHospitalAnalytics,
  getDoctorAnalytics,
  getPatientAnalytics,
  exportReport,
} from "../controllers/analyticsController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Super Admin platform analytics
router.get("/superadmin/overview", authenticate, getSuperAdminOverview);
router.get("/superadmin/hospitals-performance", authenticate, getSuperAdminHospitalPerformance);
router.get("/superadmin/doctors-performance", authenticate, getSuperAdminDoctorPerformance);

// Hospital Admin isolated analytics
router.get("/hospital/overview", authenticate, getHospitalAnalytics);
router.get("/hospital", authenticate, getHospitalAnalytics);

// Doctor isolated analytics
router.get("/doctor/:id", authenticate, getDoctorAnalytics);
router.get("/doctor", authenticate, getDoctorAnalytics);

// Patient dashboard stats
router.get("/patient/stats", authenticate, getPatientAnalytics);

// Reports export (PDF, CSV, Excel)
router.get("/export", authenticate, exportReport);

export default router;
