import express from "express";
import { authenticate } from "../middlewares/authMiddlewares.js";
import {
  createTicket,
  getTickets,
  getTicketById,
  postMessage,
  assignTicket,
  updateStatus,
  escalateTicket,
  linkRecovery,
  resolveTicket,
  getServiceDeskKpis,
} from "../controllers/supportController.js";

const router = express.Router();

// Service Desk routes matching services/support.ts
router.post("/ticket", authenticate, createTicket);
router.get("/tickets", authenticate, getTickets);
router.get("/ticket/:id", authenticate, getTicketById);
router.post("/ticket/:id/message", authenticate, postMessage);
router.post("/ticket/:id/assign", authenticate, assignTicket);
router.post("/ticket/:id/status", authenticate, updateStatus);
router.post("/ticket/:id/escalate", authenticate, escalateTicket);
router.post("/ticket/:id/link-recovery", authenticate, linkRecovery);
router.post("/ticket/:id/resolve", authenticate, resolveTicket);
router.get("/kpis", authenticate, getServiceDeskKpis);
router.get("/kpi", authenticate, getServiceDeskKpis);

export default router;

