import express from "express";
import {
  getAdvancedSupportDashboard,
  assignSupportTicket,
  escalateSupportTicket,
  addInternalNote,
  reopenSupportTicket,
} from "../controllers/advancedSupportController.js";

const router = express.Router();

router.get("/dashboard", getAdvancedSupportDashboard);
router.patch("/:id/assign", assignSupportTicket);
router.patch("/:id/escalate", escalateSupportTicket);
router.post("/:id/internal-notes", addInternalNote);
router.patch("/:id/reopen", reopenSupportTicket);

export default router;
