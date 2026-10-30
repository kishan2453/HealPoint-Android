import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    timestamp: { type: Date, default: Date.now },
    action: { type: String, default: "" },
    category: { type: String, default: "general" },
    severity: { type: String, default: "info" },
    actor: {
      role: { type: String, default: "" },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    resourceType: { type: String, default: "" },
    resourceId: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, default: "success" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    client: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      browser: { type: String, default: "" },
      device: { type: String, default: "" },
    },
  },
  { timestamps: true, collection: "auditlogs" }
);

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", auditLogSchema, "auditlogs");
