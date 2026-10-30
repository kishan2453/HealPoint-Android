import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    planKey: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      default: "free",
    },
    planName: { type: String, required: true },
    price: { type: Number, default: 0 },
    billingCycle: { type: String, enum: ["monthly", "yearly", "none"], default: "monthly" },
    status: {
      type: String,
      enum: ["trial", "active", "expired", "cancelled", "suspended", "past_due", "superseded"],
      default: "active",
    },
    videoConsultationsQuota: { type: Number, default: 0 },
    videoConsultationsUsed: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    paymentStatus: { type: String, enum: ["paid", "pending", "failed", "refunded", "n/a"], default: "paid" },
    razorpayOrderId: { type: String, default: "" },
    razorpayPaymentId: { type: String, default: "" },
    razorpaySignature: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema);
