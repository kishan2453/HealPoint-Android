import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    name: { type: String, required: true, trim: true }, // e.g. "Morning General", "Night ICU"
    startTime: { type: String, required: true, trim: true }, // e.g. "08:00 AM"
    endTime: { type: String, required: true, trim: true }, // e.g. "04:00 PM"
    department: { type: String, default: "General Medicine" },
    colorCode: { type: String, default: "#2563EB" },
    maxStaff: { type: Number, default: 10 },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

shiftSchema.index({ hospitalId: 1, department: 1 });

export default mongoose.models.Shift || mongoose.model("Shift", shiftSchema);
