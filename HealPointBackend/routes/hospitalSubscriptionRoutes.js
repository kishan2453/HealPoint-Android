import express from "express";
import {
  getHospitalPlans,
  createHospitalPlan,
  updateHospitalPlan,
  getHospitalSubscription,
  assignHospitalPlan,
  getHospitalInvoices,
  getSuperAdminSubscriptionOverview,
} from "../controllers/hospitalSubscriptionController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Plan Management
router.get("/plans", getHospitalPlans);
router.post("/plans", authenticate, createHospitalPlan);
router.put("/plans/:id", authenticate, updateHospitalPlan);

// Hospital Subscription & Usage Limits
router.get("/current", authenticate, getHospitalSubscription);
router.get("/hospital/:hospitalId", authenticate, getHospitalSubscription);
router.post("/assign", authenticate, assignHospitalPlan);

// Simulated Invoices
router.get("/invoices", authenticate, getHospitalInvoices);
router.get("/invoices/hospital/:hospitalId", authenticate, getHospitalInvoices);

// Super Admin Overview
router.get("/overview", authenticate, getSuperAdminSubscriptionOverview);

export default router;
