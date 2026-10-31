import express from "express";
import { authenticate } from "../middlewares/authMiddlewares.js";
import {
  getPatientMedicationReminders,
  createMedicationReminder,
  recordMedicationAction,
  updateReminderPreferences,
  deleteMedicationReminder,
  getRefillAndFollowUps,
} from "../controllers/medicationReminderController.js";

const router = express.Router();

router.get("/", authenticate, getPatientMedicationReminders);
router.post("/", authenticate, createMedicationReminder);
router.patch("/:reminderId/action", authenticate, recordMedicationAction);
router.put("/:reminderId/preferences", authenticate, updateReminderPreferences);
router.delete("/:reminderId", authenticate, deleteMedicationReminder);
router.get("/refills", authenticate, getRefillAndFollowUps);

export default router;
