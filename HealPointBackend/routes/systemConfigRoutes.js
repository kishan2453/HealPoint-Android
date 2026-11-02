import express from "express";
import {
  getSystemConfigs,
  updateSystemConfig,
} from "../controllers/systemConfigController.js";

const router = express.Router();

router.get("/", getSystemConfigs);
router.put("/:configKey", updateSystemConfig);

export default router;
