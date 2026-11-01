import express from "express";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

/**
 * Patient Referrals
 * GET /api/v1/clinical-referral/patient/my
 */
router.get("/patient/my", authenticate, async (req, res) => {
  return res.status(200).json({
    success: true,
    count: 0,
    totalCount: 0,
    referrals: [],
    message: "No active clinical referrals",
  });
});

/**
 * Doctor Referrals Incoming / Outgoing
 */
router.get("/doctor/incoming", authenticate, async (req, res) => {
  return res.status(200).json({
    success: true,
    count: 0,
    referrals: [],
  });
});

router.get("/doctor/outgoing", authenticate, async (req, res) => {
  return res.status(200).json({
    success: true,
    count: 0,
    referrals: [],
  });
});

export default router;

