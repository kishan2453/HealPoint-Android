import workflowModel from "../models/workflowModel.js";
import workflowExecutionModel from "../models/workflowExecutionModel.js";
import taskModel from "../models/taskModel.js";
import internalAlertModel from "../models/internalAlertModel.js";

/**
 * HealPoint Workflow Automation Service
 * Evaluates triggers, verifies conditional rules, executes actions, prevents loops and maintains execution history.
 */

// Execution tracking to prevent recursion / infinite loops
const activeExecutionStack = new Set();
const MAX_STACK_DEPTH = 3;

export const evaluateCondition = (condition, data) => {
  if (!condition || !condition.field) return true;
  const fieldValue = data[condition.field];
  const targetValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return String(fieldValue).toLowerCase() === String(targetValue).toLowerCase();
    case "not_equals":
      return String(fieldValue).toLowerCase() !== String(targetValue).toLowerCase();
    case "contains":
      return String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());
    case "greater_than":
      return Number(fieldValue) > Number(targetValue);
    case "less_than":
      return Number(fieldValue) < Number(targetValue);
    case "in":
      if (Array.isArray(targetValue)) {
        return targetValue.map((v) => String(v).toLowerCase()).includes(String(fieldValue).toLowerCase());
      }
      return false;
    default:
      return true;
  }
};

export const executeAction = async (action, eventData, hospitalId) => {
  const { type, params = {} } = action;

  switch (type) {
    case "internal_notification": {
      const title = params.title || `Workflow Notice: ${params.subject || "Operational Update"}`;
      let message = params.message || "An automated workflow condition was met.";
      // Simple variable interpolation
      Object.keys(eventData).forEach((k) => {
        if (typeof eventData[k] === "string" || typeof eventData[k] === "number") {
          message = message.replace(new RegExp(`{${k}}`, "g"), String(eventData[k]));
        }
      });

      const alert = await internalAlertModel.create({
        hospitalId: hospitalId || null,
        title,
        message,
        severity: params.severity || "info",
        category: params.category || "operations",
        source: "workflow_engine",
        relatedEntityType: params.relatedEntityType || "none",
        relatedEntityId: params.relatedEntityId || "",
      });

      return { success: true, alertId: alert._id, message: "Alert created successfully" };
    }

    case "create_task": {
      const title = params.title || `Automated Task: ${params.subject || "Review Event"}`;
      let description = params.description || "Follow up on automated workflow trigger.";
      Object.keys(eventData).forEach((k) => {
        if (typeof eventData[k] === "string" || typeof eventData[k] === "number") {
          description = description.replace(new RegExp(`{${k}}`, "g"), String(eventData[k]));
        }
      });

      const dueDays = Number(params.dueInDays) || 2;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDays);

      const task = await taskModel.create({
        hospitalId: hospitalId || null,
        title,
        description,
        department: params.department || "Operations",
        priority: params.priority || "medium",
        status: "New",
        assignedTo: {
          id: params.assigneeId || "",
          name: params.assigneeName || "Pending Assignment",
          role: params.assigneeRole || "staff",
        },
        assignedBy: {
          id: "system",
          name: "Workflow Engine",
          role: "system",
        },
        dueDate,
        relatedEntityType: params.relatedEntityType || "general",
        relatedEntityId: params.relatedEntityId || "",
      });

      return { success: true, taskId: task._id, message: "Task assigned successfully" };
    }

    case "update_status": {
      return { success: true, message: `Status update recorded for target entity.` };
    }

    case "send_reminder": {
      return { success: true, message: `Simulated internal reminder dispatched for ${params.recipientRole || "staff"}.` };
    }

    case "log_event":
    default: {
      return { success: true, message: `Workflow event logged: ${params.notes || "Executed"}` };
    }
  }
};

/**
 * Triggers all active workflows matching the given trigger name and hospital
 */
export const triggerWorkflow = async (triggerName, eventData = {}, hospitalId = null, idempotencyKey = null) => {
  const stackKey = `${triggerName}-${idempotencyKey || Date.now()}`;
  if (activeExecutionStack.has(stackKey)) {
    return { status: "skipped", reason: "Recursion guard: duplicate trigger event suppressed." };
  }

  if (activeExecutionStack.size >= MAX_STACK_DEPTH) {
    return { status: "skipped", reason: "Max recursion stack depth reached." };
  }

  activeExecutionStack.add(stackKey);
  const startTime = Date.now();

  try {
    const query = {
      trigger: triggerName,
      status: "active",
      $or: [
        { hospitalId: hospitalId || null },
        { hospitalId: null }, // Global workflows
      ],
    };

    const workflows = await workflowModel.find(query);
    if (!workflows || workflows.length === 0) {
      return { status: "no_workflows", count: 0 };
    }

    const executionResults = [];

    for (const wf of workflows) {
      // Evaluate all conditions
      let conditionsPassed = true;
      if (wf.conditions && wf.conditions.length > 0) {
        for (const cond of wf.conditions) {
          if (!evaluateCondition(cond, eventData)) {
            conditionsPassed = false;
            break;
          }
        }
      }

      if (!conditionsPassed) {
        continue;
      }

      const stepsExecuted = [];
      let wfError = "";
      let wfStatus = "success";

      const sortedActions = [...(wf.actions || [])].sort((a, b) => (a.order || 1) - (b.order || 1));

      for (let i = 0; i < sortedActions.length; i++) {
        const action = sortedActions[i];
        try {
          const actionOutput = await executeAction(action, eventData, wf.hospitalId || hospitalId);
          stepsExecuted.push({
            stepIndex: i + 1,
            actionType: action.type,
            status: "success",
            output: actionOutput,
            executedAt: new Date(),
          });
        } catch (err) {
          wfStatus = "failed";
          wfError = err.message || "Action execution failed";
          stepsExecuted.push({
            stepIndex: i + 1,
            actionType: action.type,
            status: "failed",
            error: wfError,
            executedAt: new Date(),
          });
          break; // Stop remaining steps on failure
        }
      }

      const durationMs = Date.now() - startTime;

      // Log execution
      const executionRecord = await workflowExecutionModel.create({
        workflowId: wf._id,
        workflowName: wf.name,
        hospitalId: wf.hospitalId || hospitalId || null,
        trigger: triggerName,
        triggerData: eventData,
        idempotencyKey: idempotencyKey || "",
        status: wfStatus,
        stepsExecuted,
        errorMessage: wfError,
        durationMs,
        executedAt: new Date(),
      });

      // Update workflow execution stats
      await workflowModel.findByIdAndUpdate(wf._id, {
        $inc: { executionCount: 1 },
        $set: { lastExecutedAt: new Date() },
      });

      executionResults.push({
        workflowId: wf._id,
        workflowName: wf.name,
        status: wfStatus,
        executionId: executionRecord._id,
      });
    }

    return {
      status: "completed",
      triggeredCount: executionResults.length,
      results: executionResults,
    };
  } finally {
    activeExecutionStack.delete(stackKey);
  }
};
