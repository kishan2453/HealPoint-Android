import mongoose from "mongoose";

const hospitalSubscriptionSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      unique: true,
    },
    hospitalName: { type: String, default: "" },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "HospitalSubscriptionPlan" },
    planCode: { type: String, default: "starter" },
    planName: { type: String, default: "Starter Hospital Plan" },
    status: {
      type: String,
      enum: ["active", "trial", "past_due", "cancelled"],
      default: "active",
    },
    billingCycle: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    startDate: { type: Date, default: Date.now },
    expiryDate: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year default
    },
    simulatedFee: { type: Number, default: 4999 },
    limits: {
      maxDoctors: { type: Number, default: 10 },
      maxAppointmentsPerMonth: { type: Number, default: 500 },
      allowedFeatures: {
        type: [String],
        default: ["queue", "resources", "roster", "analytics"],
      },
    },
    renewalNoticeSent: { type: Boolean, default: false },
    autoRenew: { type: Boolean, default: true },
    notes: { type: String, default: "Fictional platform management subscription" },
  },
  { timestamps: true }
);

hospitalSubscriptionSchema.index({ hospitalId: 1, status: 1 });

export default mongoose.models.HospitalSubscription ||
  mongoose.model("HospitalSubscription", hospitalSubscriptionSchema);
