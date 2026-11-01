import express from "express";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

/**
 * Patient Handovers
 * GET /api/v1/clinical-handover/patient/my
 */
router.get("/patient/my", authenticate, async (req, res) => {
  return res.status(200).json({
    success: true,
    count: 0,
    totalCount: 0,
    handovers: [],
    message: "No active clinical handovers",
  });
});

export default router;

