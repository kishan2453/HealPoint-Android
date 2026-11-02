import express from "express";
import {
  getWorkflows,
  createWorkflow,
  updateWorkflow,
  toggleWorkflowStatus,
  deleteWorkflow,
  getWorkflowExecutions,
  testWorkflowTrigger,
} from "../controllers/workflowController.js";

const router = express.Router();

router.get("/", getWorkflows);
router.post("/", createWorkflow);
router.put("/:id", updateWorkflow);
router.patch("/:id/toggle", toggleWorkflowStatus);
router.delete("/:id", deleteWorkflow);
router.get("/executions", getWorkflowExecutions);
router.post("/test-trigger", testWorkflowTrigger);

export default router;
