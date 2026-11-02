import mongoose from "mongoose";

const leaveSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff" },
    staffName: { type: String, default: "" },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    leaveType: {
      type: String,
      enum: ["casual", "sick", "emergency", "vacation", "maternity"],
      default: "casual",
    },
    startDate: { type: String, required: true }, // Format: YYYY-MM-DD
    endDate: { type: String, required: true }, // Format: YYYY-MM-DD
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: String, default: "" },
    reviewNotes: { type: String, default: "" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

leaveSchema.index({ hospitalId: 1, status: 1 });
leaveSchema.index({ staffId: 1, startDate: 1 });
leaveSchema.index({ doctorId: 1, startDate: 1 });

export default mongoose.models.Leave || mongoose.model("Leave", leaveSchema);
