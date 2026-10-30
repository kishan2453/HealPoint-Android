import express from "express";
import {
  getSubscriptionPlans,
  getSubscriptionOverview,
  getAllSubscriptions,
  getSubscriptionDetails,
  getMySubscription,
  getPatientEntitlement,
  createSubscriptionOrder,
  verifySubscriptionPayment,
} from "../controllers/subscriptionController.js";
import { authenticate, optionalAuth } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/plans", optionalAuth, getSubscriptionPlans);
router.get("/overview", authenticate, getSubscriptionOverview);
router.get("/get-all", authenticate, getAllSubscriptions);
router.get("/my", authenticate, getMySubscription);
router.get("/entitlement", authenticate, getPatientEntitlement);
router.post("/create-order", authenticate, createSubscriptionOrder);
router.post("/order", authenticate, createSubscriptionOrder);
router.post("/verify-payment", authenticate, verifySubscriptionPayment);
router.get("/:id", authenticate, getSubscriptionDetails);
router.get("/", authenticate, getAllSubscriptions);

export default router;
