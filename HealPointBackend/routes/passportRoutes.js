import express from "express";
import {
  getMyPassport,
  getCareEpisode,
  generateQR,
  verifyQR,
  getShares,
  createShare,
  revokeShare,
  getAccessLog,
  patchSettings,
} from "../controllers/carePassportController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/episode/:appointmentId", authenticate, getCareEpisode);
router.get("/qr", authenticate, generateQR);
router.post("/verify", authenticate, verifyQR);
router.get("/shares", authenticate, getShares);
router.post("/share", authenticate, createShare);
router.delete("/share/:shareId", authenticate, revokeShare);
router.get("/access-log", authenticate, getAccessLog);
router.patch("/settings", authenticate, patchSettings);
router.get("/", authenticate, getMyPassport);

export default router;

