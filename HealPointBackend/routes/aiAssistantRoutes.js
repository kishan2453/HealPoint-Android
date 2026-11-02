import express from "express";
import { askAdminAssistant } from "../controllers/aiAssistantController.js";

const router = express.Router();

router.post("/query", askAdminAssistant);

export default router;
