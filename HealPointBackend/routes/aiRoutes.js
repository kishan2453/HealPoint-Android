import express from "express";
import { chatWithAi } from "../controllers/aiController.js";
import { optionalAuth } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/chat", optionalAuth, chatWithAi);

export default router;
