import mongoose from "mongoose";

const internalAlertSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null, // null for platform-wide alerts
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ["info", "warning", "high", "critical"],
      default: "info",
      index: true,
    },
    category: {
      type: String,
      enum: [
        "scheduling",
        "operations",
        "staff",
        "billing",
        "support",
        "resource",
        "system",
      ],
      default: "operations",
      index: true,
    },
    source: {
      type: String,
      enum: ["workflow_engine", "rule_engine", "manual", "system_monitor"],
      default: "system_monitor",
    },
    relatedEntityType: {
      type: String,
      enum: ["appointment", "doctor", "staff", "resource", "support_ticket", "task", "subscription", "none"],
      default: "none",
    },
    relatedEntityId: { type: String, default: "" },
    isRead: { type: Boolean, default: false, index: true },
    isResolved: { type: Boolean, default: false, index: true },
    assignedTo: { type: String, default: "" },
    resolvedBy: { type: String, default: "" },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

internalAlertSchema.index({ hospitalId: 1, isResolved: 1, severity: 1, createdAt: -1 });

export default mongoose.models.InternalAlert ||
  mongoose.model("InternalAlert", internalAlertSchema);
