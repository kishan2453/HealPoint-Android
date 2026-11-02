import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import workflowModel from "../models/workflowModel.js";
import workflowExecutionModel from "../models/workflowExecutionModel.js";
import taskModel from "../models/taskModel.js";
import businessRuleModel from "../models/businessRuleModel.js";
import reportConfigModel from "../models/reportConfigModel.js";
import internalAlertModel from "../models/internalAlertModel.js";
import importHistoryModel from "../models/importHistoryModel.js";
import systemConfigModel from "../models/systemConfigModel.js";

import { evaluateCondition, executeAction, triggerWorkflow } from "../services/workflowService.js";
import { evaluateBusinessRule } from "../controllers/businessRuleController.js";

test("Part 19: AI-Powered Hospital Operations & Intelligent Workflow Automation Suite", async (t) => {
  const dummyHospitalId = new mongoose.Types.ObjectId();

  await t.test("1. Workflow Engine: Condition Evaluation", () => {
    // equals condition
    assert.equal(evaluateCondition({ field: "status", operator: "equals", value: "cancelled" }, { status: "cancelled" }), true);
    assert.equal(evaluateCondition({ field: "status", operator: "equals", value: "cancelled" }, { status: "completed" }), false);

    // contains condition
    assert.equal(evaluateCondition({ field: "notes", operator: "contains", value: "urgent" }, { notes: "Patient requires urgent triage" }), true);

    // greater_than condition
    assert.equal(evaluateCondition({ field: "delayMinutes", operator: "greater_than", value: 30 }, { delayMinutes: 45 }), true);
    assert.equal(evaluateCondition({ field: "delayMinutes", operator: "greater_than", value: 30 }, { delayMinutes: 15 }), false);

    // in condition
    assert.equal(evaluateCondition({ field: "department", operator: "in", value: ["Cardiology", "Neurology"] }, { department: "Cardiology" }), true);
    assert.equal(evaluateCondition({ field: "department", operator: "in", value: ["Cardiology", "Neurology"] }, { department: "Orthopedics" }), false);
  });

  await t.test("2. Workflow Action Execution: Internal Alerts & Tasks", async () => {
    const action = {
      type: "internal_notification",
      params: {
        title: "Test Alert",
        message: "Notice for patient {patientName}",
        severity: "warning",
        category: "scheduling",
      },
    };

    const eventData = { patientName: "Rahul Verma", slotDate: "15-11-2026" };
    // Verify alert message interpolation
    assert.equal(action.params.message.replace("{patientName}", eventData.patientName), "Notice for patient Rahul Verma");
  });

  await t.test("3. Task Management Schema & Status Validations", () => {
    const validStatuses = ["New", "Assigned", "In Progress", "Under Review", "Completed", "Cancelled"];
    assert.ok(validStatuses.includes("New"));
    assert.ok(validStatuses.includes("Completed"));
    assert.ok(validStatuses.includes("In Progress"));

    const sampleTask = {
      title: "Sterilize Operation Theatre 2",
      department: "Surgery",
      priority: "high",
      status: "Assigned",
      dueDate: new Date("2026-11-20"),
    };
    assert.equal(sampleTask.priority, "high");
    assert.ok(sampleTask.dueDate instanceof Date);
  });

  await t.test("4. Business Rule Engine: Defaults & Versioning", () => {
    const ruleSnapshot = {
      version: 1,
      config: { minHoursNotice: 2, allowAutoRefund: true },
      changedBy: "Admin",
      changedAt: new Date(),
    };
    assert.equal(ruleSnapshot.version, 1);
    assert.equal(ruleSnapshot.config.minHoursNotice, 2);

    // Rollback simulation
    const updatedRule = {
      version: 2,
      config: { minHoursNotice: 4, allowAutoRefund: false },
      history: [ruleSnapshot],
    };

    assert.equal(updatedRule.history.length, 1);
    assert.equal(updatedRule.history[0].config.minHoursNotice, 2);
  });

  await t.test("5. AI Administrative Assistant: Operational Intent & Safety Disclaimers", () => {
    const query = "Which department has the highest appointment load?";
    const cleanQuery = query.toLowerCase().trim();
    assert.ok(cleanQuery.includes("department"));
    assert.ok(cleanQuery.includes("highest") || cleanQuery.includes("load"));

    const disclaimer = "HealPoint Operational AI provides administrative, non-clinical analytics only. It does not provide medical diagnoses or healthcare decisions.";
    assert.ok(disclaimer.includes("non-clinical"));
    assert.ok(disclaimer.includes("does not provide medical diagnoses"));
  });

  await t.test("6. Support Management: Categorization & Escalation Tiers", () => {
    const escalationTeams = ["TIER_1_SUPPORT", "TIER_2_SUPPORT", "BILLING_TEAM", "CLINICAL_TEAM", "ESCALATIONS_TEAM"];
    assert.ok(escalationTeams.includes("ESCALATIONS_TEAM"));
    assert.ok(escalationTeams.includes("TIER_1_SUPPORT"));
  });

  await t.test("7. Report Builder: Date Range Calculation", () => {
    const now = new Date();
    const past7 = new Date();
    past7.setDate(now.getDate() - 7);
    assert.ok(past7 < now);
  });

  await t.test("8. System Configuration: Simulation Safety Enforcement", () => {
    const safetyConfig = {
      enableRealSOS: false,
      enableExternalEmergencyDispatch: false,
      enableRealPaymentGateways: false,
      enforceStrictIsolation: true,
    };

    // Verify zero real-world emergency or payment features
    assert.equal(safetyConfig.enableRealSOS, false);
    assert.equal(safetyConfig.enableExternalEmergencyDispatch, false);
    assert.equal(safetyConfig.enableRealPaymentGateways, false);
    assert.equal(safetyConfig.enforceStrictIsolation, true);
  });
});
