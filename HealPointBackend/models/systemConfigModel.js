import mongoose from "mongoose";

const configAuditSchema = new mongoose.Schema(
  {
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
    previousValues: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: { type: String, default: "" },
  },
  { _id: false }
);

const systemConfigSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "platform",
        "appointment_policies",
        "simulation_safety",
        "portals",
        "workflows",
        "subscriptions",
      ],
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    values: { type: mongoose.Schema.Types.Mixed, required: true },
    isLocked: { type: Boolean, default: false }, // safety locks for simulation policies
    auditTrail: { type: [configAuditSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.SystemConfig ||
  mongoose.model("SystemConfig", systemConfigSchema);
