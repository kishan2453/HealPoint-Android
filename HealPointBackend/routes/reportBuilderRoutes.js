import express from "express";
import {
  generateReport,
  getSavedReportConfigs,
  saveReportConfig,
} from "../controllers/reportBuilderController.js";

const router = express.Router();

router.post("/generate", generateReport);
router.get("/configs", getSavedReportConfigs);
router.post("/configs", saveReportConfig);

export default router;
