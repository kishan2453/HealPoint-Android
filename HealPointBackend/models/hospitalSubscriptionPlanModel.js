import mongoose from "mongoose";

const hospitalSubscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Starter Hospital Plan"
    code: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    }, // "starter", "professional", "enterprise"
    description: { type: String, default: "" },
    monthlyPriceSimulated: { type: Number, default: 4999 },
    yearlyPriceSimulated: { type: Number, default: 49990 },
    currency: { type: String, default: "INR" },
    maxDoctors: { type: Number, default: 10 },
    maxAppointmentsPerMonth: { type: Number, default: 500 },
    features: { type: [String], default: [] },
    hasQueueManagement: { type: Boolean, default: true },
    hasResourceManagement: { type: Boolean, default: true },
    hasStaffRoster: { type: Boolean, default: true },
    hasAdvancedAnalytics: { type: Boolean, default: true },
    badge: { type: String, default: "Popular" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.models.HospitalSubscriptionPlan ||
  mongoose.model("HospitalSubscriptionPlan", hospitalSubscriptionPlanSchema);
