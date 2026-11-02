import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    patientName: { type: String, required: true },
    patientPhone: { type: String, default: "" },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    doctorName: { type: String, default: "" },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    hospitalName: { type: String, default: "" },
    department: { type: String, default: "General Medicine" },
    preferredDate: { type: String, required: true }, // Format: YYYY-MM-DD or DD_MM_YYYY
    preferredTimeSlot: { type: String, default: "any" }, // "morning", "afternoon", "evening", or specific slot
    status: {
      type: String,
      enum: ["active", "notified", "booked", "expired", "cancelled"],
      default: "active",
    },
    notifiedSlot: { type: String, default: "" },
    notifiedAt: { type: Date },
    notificationExpiresAt: { type: Date },
    priority: { type: Number, default: 1 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

waitlistSchema.index({ doctorId: 1, preferredDate: 1, status: 1 });
waitlistSchema.index({ userId: 1, status: 1 });
waitlistSchema.index({ hospitalId: 1, preferredDate: 1 });

export default mongoose.models.Waitlist || mongoose.model("Waitlist", waitlistSchema);
