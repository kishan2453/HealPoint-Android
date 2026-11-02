import mongoose from "mongoose";

const reportConfigSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    reportType: {
      type: String,
      enum: [
        "appointments",
        "revenue_billing",
        "patient_demographics",
        "staff_duty",
        "waitlist_performance",
        "cancellations_noshow",
        "queue_throughput",
      ],
      required: true,
      index: true,
    },
    dateRangePreset: {
      type: String,
      enum: ["today", "last_7_days", "last_30_days", "this_month", "custom"],
      default: "last_7_days",
    },
    customStartDate: { type: Date },
    customEndDate: { type: Date },
    filters: {
      department: { type: String, default: "" },
      doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
      status: { type: String, default: "" },
      paymentStatus: { type: String, default: "" },
    },
    selectedColumns: { type: [String], default: [] },
    exportFormat: {
      type: String,
      enum: ["csv", "json", "pdf"],
      default: "csv",
    },
    createdBy: { type: String, default: "admin" },
    lastGeneratedAt: { type: Date },
    generationCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

reportConfigSchema.index({ hospitalId: 1, reportType: 1 });

export default mongoose.models.ReportConfig ||
  mongoose.model("ReportConfig", reportConfigSchema);
