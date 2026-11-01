import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, default: "Verified Patient" },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Performance Optimization Compound Indexes
reviewSchema.index({ doctorId: 1, isApproved: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, createdAt: -1 });


export default mongoose.models.Review || mongoose.model("Review", reviewSchema);
