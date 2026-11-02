import express from "express";
import {
  getInternalAlerts,
  markAlertRead,
  markAllAlertsRead,
  resolveAlert,
  createInternalAlert,
} from "../controllers/internalAlertController.js";

const router = express.Router();

router.get("/", getInternalAlerts);
router.post("/", createInternalAlert);
router.patch("/:id/read", markAlertRead);
router.post("/mark-all-read", markAllAlertsRead);
router.patch("/:id/resolve", resolveAlert);

export default router;
