import mongoose from "mongoose";

const rosterSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },
    staffName: { type: String, default: "" },
    staffRole: { type: String, default: "" },
    department: { type: String, default: "General Medicine" },
    shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
    shiftName: { type: String, default: "" },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    startTime: { type: String, default: "08:00 AM" },
    endTime: { type: String, default: "04:00 PM" },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "absent", "swapped"],
      default: "scheduled",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

rosterSchema.index({ hospitalId: 1, staffId: 1, date: 1 });
rosterSchema.index({ hospitalId: 1, date: 1, department: 1 });

export default mongoose.models.Roster || mongoose.model("Roster", rosterSchema);
