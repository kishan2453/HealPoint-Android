import mongoose from "mongoose";

const conditionSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "contains", "greater_than", "less_than", "in"],
      default: "equals",
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "internal_notification",
        "create_task",
        "update_status",
        "send_reminder",
        "log_event",
      ],
      required: true,
    },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    order: { type: Number, default: 1 },
  },
  { _id: false }
);

const workflowSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null, // null represents platform-wide workflows
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    trigger: {
      type: String,
      enum: [
        "appointment_booked",
        "appointment_cancelled",
        "doctor_approved",
        "support_ticket_created",
        "leave_approved",
        "subscription_expiry_warning",
        "task_overdue",
        "resource_maintenance_due",
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "draft"],
      default: "active",
      index: true,
    },
    conditions: { type: [conditionSchema], default: [] },
    actions: { type: [actionSchema], default: [] },
    retryPolicy: {
      maxRetries: { type: Number, default: 3 },
      retryIntervalMinutes: { type: Number, default: 5 },
    },
    executionCount: { type: Number, default: 0 },
    lastExecutedAt: { type: Date },
    createdBy: { type: String, default: "system" },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workflowSchema.index({ hospitalId: 1, trigger: 1, status: 1 });

export default mongoose.models.Workflow || mongoose.model("Workflow", workflowSchema);
