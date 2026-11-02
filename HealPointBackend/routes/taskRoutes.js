import express from "express";
import {
  getTasks,
  createTask,
  updateTaskStatus,
  assignTask,
  addTaskComment,
  getTaskWorkloadAnalytics,
} from "../controllers/taskController.js";

const router = express.Router();

router.get("/", getTasks);
router.post("/", createTask);
router.get("/analytics/workload", getTaskWorkloadAnalytics);
router.patch("/:id/status", updateTaskStatus);
router.patch("/:id/assign", assignTask);
router.post("/:id/comments", addTaskComment);

export default router;
