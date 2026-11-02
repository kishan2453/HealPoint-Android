import mongoose from "mongoose";

const ruleHistorySchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    changedBy: { type: String, default: "admin" },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, default: "" },
  },
  { _id: false }
);

const businessRuleSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null, // null means global default rule
      index: true,
    },
    category: {
      type: String,
      enum: [
        "cancellation_policy",
        "rescheduling_policy",
        "booking_limits",
        "doctor_availability",
        "queue_rules",
        "staff_scheduling",
        "internal_notifications",
      ],
      required: true,
      index: true,
    },
    ruleCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true, index: true },
    priority: { type: Number, default: 10 },
    version: { type: Number, default: 1 },
    history: { type: [ruleHistorySchema], default: [] },
    lastEvaluatedAt: { type: Date },
  },
  { timestamps: true }
);

businessRuleSchema.index({ hospitalId: 1, ruleCode: 1 }, { unique: true });

export default mongoose.models.BusinessRule ||
  mongoose.model("BusinessRule", businessRuleSchema);
