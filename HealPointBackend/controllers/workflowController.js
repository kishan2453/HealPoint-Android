import workflowModel from "../models/workflowModel.js";
import workflowExecutionModel from "../models/workflowExecutionModel.js";
import { triggerWorkflow } from "../services/workflowService.js";

export const getWorkflows = async (req, res) => {
  try {
    const hospitalId = req.query.hospitalId || req.user?.hospitalId;
    const query = {};

    if (hospitalId) {
      query.$or = [{ hospitalId }, { hospitalId: null }];
    }

    const workflows = await workflowModel.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: workflows.length, workflows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createWorkflow = async (req, res) => {
  try {
    const { name, description, trigger, conditions, actions, retryPolicy, hospitalId } = req.body;

    if (!name || !trigger) {
      return res.status(400).json({ success: false, message: "Name and trigger are required." });
    }

    const newWorkflow = await workflowModel.create({
      hospitalId: hospitalId || req.user?.hospitalId || null,
      name,
      description,
      trigger,
      conditions: conditions || [],
      actions: actions || [],
      retryPolicy: retryPolicy || { maxRetries: 3, retryIntervalMinutes: 5 },
      status: "active",
      createdBy: req.user?.name || req.user?.email || "Admin",
    });

    return res.status(201).json({ success: true, workflow: newWorkflow });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const workflow = await workflowModel.findByIdAndUpdate(id, updates, { new: true });
    if (!workflow) {
      return res.status(404).json({ success: false, message: "Workflow not found." });
    }

    return res.status(200).json({ success: true, workflow });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleWorkflowStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = await workflowModel.findById(id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: "Workflow not found." });
    }

    workflow.status = workflow.status === "active" ? "inactive" : "active";
    await workflow.save();

    return res.status(200).json({ success: true, workflow });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const workflow = await workflowModel.findByIdAndDelete(id);
    if (!workflow) {
      return res.status(404).json({ success: false, message: "Workflow not found." });
    }

    return res.status(200).json({ success: true, message: "Workflow deleted successfully." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getWorkflowExecutions = async (req, res) => {
  try {
    const { workflowId, hospitalId, limit = 50 } = req.query;
    const query = {};

    if (workflowId) query.workflowId = workflowId;
    if (hospitalId) query.hospitalId = hospitalId;

    const executions = await workflowExecutionModel
      .find(query)
      .sort({ executedAt: -1 })
      .limit(Number(limit));

    return res.status(200).json({ success: true, count: executions.length, executions });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const testWorkflowTrigger = async (req, res) => {
  try {
    const { trigger, eventData, hospitalId } = req.body;
    if (!trigger) {
      return res.status(400).json({ success: false, message: "Trigger name is required." });
    }

    const result = await triggerWorkflow(
      trigger,
      eventData || { test: true, triggeredBy: req.user?.name || "admin" },
      hospitalId || req.user?.hospitalId || null,
      `manual-test-${Date.now()}`
    );

    return res.status(200).json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
