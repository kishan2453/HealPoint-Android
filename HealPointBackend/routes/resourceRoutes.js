import express from "express";
import {
  getResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  assignResource,
  releaseResource,
  getResourceAnalytics,
  getGlobalResourceOverview,
} from "../controllers/resourceController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/analytics", authenticate, getResourceAnalytics);
router.get("/global-overview", authenticate, getGlobalResourceOverview);
router.get("/", authenticate, getResources);
router.get("/:id", authenticate, getResourceById);
router.post("/", authenticate, createResource);
router.put("/:id", authenticate, updateResource);
router.delete("/:id", authenticate, deleteResource);
router.post("/:id/assign", authenticate, assignResource);
router.post("/:id/release", authenticate, releaseResource);

export default router;
