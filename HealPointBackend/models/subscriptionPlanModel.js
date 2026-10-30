import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, required: true, trim: true },
    monthlyPrice: { type: Number, min: 0, default: 0 },
    yearlyPrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "INR" },
    billingInterval: {
      type: String,
      default: "monthly",
    },
    price: { type: Number, min: 0, default: 0 },
    familyMembersLimit: { type: Number, min: 1, default: 1 },
    badge: { type: String, trim: true, default: "" },
    videoConsultationsMonthly: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true, default: "" },
    imageUrl: { type: String, trim: true, default: "" },
    subscriberCount: { type: Number, default: 0 },
    features: { type: [String], default: [] },
    featureDetails: [
      {
        code: { type: String, trim: true },
        label: { type: String, trim: true },
        included: { type: Boolean, default: true },
        detail: { type: String, trim: true, default: "" },
      },
    ],
    isActive: { type: Boolean, default: true },
    trialDays: { type: Number, min: 0, default: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "subscriptionplans" }
);

export default mongoose.models.SubscriptionPlan ||
  mongoose.model("SubscriptionPlan", subscriptionPlanSchema, "subscriptionplans");
