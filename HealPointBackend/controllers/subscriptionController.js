import mongoose from "mongoose";
import subscriptionModel from "../models/subscriptionModel.js";
import subscriptionPlanModel from "../models/subscriptionPlanModel.js";
import userModel from "../models/userModel.js";
import { createRazorpayOrder, verifyPaymentSignature } from "../services/razorpayService.js";

export const DEFAULT_PLANS = [
  {
    key: "free",
    name: "Free Starter",
    monthlyPrice: 0,
    yearlyPrice: 0,
    price: 0,
    videoConsultationsQuota: 0,
    videoConsultationsMonthly: 0,
    familyMembersLimit: 1,
    badge: "Essential Baseline",
    isActive: true,
    sortOrder: 1,
    description: "Standard in-clinic appointment booking with zero subscription fees.",
    features: [
      "In-person clinic & hospital appointment booking",
      "Digital prescriptions & lab report health wallet",
      "Personal Health Timeline & immunization records",
      "Verified doctor directory & emergency hospital locator",
    ],
  },
  {
    key: "care_starter",
    name: "Care Starter",
    monthlyPrice: 249,
    yearlyPrice: 2490,
    price: 249,
    videoConsultationsQuota: 2,
    videoConsultationsMonthly: 2,
    familyMembersLimit: 1,
    badge: "Starter",
    isActive: true,
    sortOrder: 2,
    description: "2 video consultations every month for single patient.",
    features: [
      "2 Video Consultations every month",
      "All Free baseline features included",
      "Automated medicine & vitals reminders",
      "Digital health wallet & encrypted record storage",
      "1 Patient profile coverage (Self)",
    ],
  },
  {
    key: "care_plus",
    name: "Care Plus",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    price: 499,
    videoConsultationsQuota: 4,
    videoConsultationsMonthly: 4,
    familyMembersLimit: 2,
    badge: "Popular",
    isActive: true,
    sortOrder: 3,
    description: "4 video consultations every month + coverage for up to 2 family members.",
    features: [
      "4 Video Consultations every month",
      "All Care Starter features included",
      "Digital Hospital Pass with QR express check-in",
      "Smart Care Journey & Live OPD queue tracker",
      "Coverage for up to 2 family members",
    ],
  },
  {
    key: "care_pro",
    name: "Care Pro",
    monthlyPrice: 799,
    yearlyPrice: 7990,
    price: 799,
    videoConsultationsQuota: 6,
    videoConsultationsMonthly: 6,
    familyMembersLimit: 4,
    badge: "Best Value",
    isActive: true,
    sortOrder: 4,
    description: "6 video consultations every month + coverage for up to 4 family members.",
    features: [
      "6 Video Consultations every month",
      "All Care Plus features included",
      "Specialist doctor referrals & clinical handover",
      "Full Health Data Export & portable medical briefcase",
      "Coverage for up to 4 family members",
    ],
  },
  {
    key: "family_care",
    name: "Family Care",
    monthlyPrice: 1099,
    yearlyPrice: 10990,
    price: 1099,
    videoConsultationsQuota: 8,
    videoConsultationsMonthly: 8,
    familyMembersLimit: 6,
    badge: "Family Favorite",
    isActive: true,
    sortOrder: 5,
    description: "8 video consultations every month + coverage for up to 6 family members.",
    features: [
      "8 Video Consultations every month",
      "All Care Pro features included",
      "Up to 6 family members with sub-profiles",
      "Priority OPD queue check-in",
      "Dedicated Care Concierge",
    ],
  },
  {
    key: "family_prime",
    name: "Family Prime",
    monthlyPrice: 1499,
    yearlyPrice: 14990,
    price: 1499,
    videoConsultationsQuota: 10,
    videoConsultationsMonthly: 10,
    familyMembersLimit: 10,
    badge: "VIP Care",
    isActive: true,
    sortOrder: 6,
    description: "10 video consultations every month + coverage for up to 10 family members.",
    features: [
      "10 Video Consultations every month",
      "Up to 10 family members coverage",
      "Instant Emergency Care Concierge",
      "Highest priority appointment booking",
      "Dedicated doctor video hotline",
    ],
  },
  {
    key: "annual_care_pro",
    name: "Annual Care Pro",
    monthlyPrice: 0,
    yearlyPrice: 7999,
    price: 7999,
    videoConsultationsQuota: 72,
    videoConsultationsMonthly: 6,
    familyMembersLimit: 4,
    badge: "Save 16%",
    isActive: true,
    sortOrder: 7,
    description: "Annual plan: 72 video visits/year (6/mo) + coverage for up to 4 members.",
    features: [
      "72 Video Consultations every year (6/mo)",
      "Coverage for up to 4 family members",
      "Save ₹1,589 compared to monthly billing",
      "Priority doctor consultation booking",
    ],
  },
  {
    key: "annual_family_prime",
    name: "Annual Family Prime",
    monthlyPrice: 0,
    yearlyPrice: 11999,
    price: 11999,
    videoConsultationsQuota: 120,
    videoConsultationsMonthly: 10,
    familyMembersLimit: 10,
    badge: "Best Value (Save 33%)",
    isActive: true,
    sortOrder: 8,
    description: "Annual plan: 120 video visits/year (10/mo) + coverage for up to 10 members.",
    features: [
      "120 Video Consultations every year (10/mo)",
      "Coverage for up to 10 family members",
      "Save ₹5,989 (4 months free)",
      "Dedicated 24/7 emergency concierge",
    ],
  },
  // Legacy Aliases
  {
    key: "gold",
    name: "Gold Health",
    monthlyPrice: 249,
    yearlyPrice: 2490,
    price: 249,
    videoConsultationsQuota: 4,
    videoConsultationsMonthly: 4,
    familyMembersLimit: 2,
    badge: "Popular",
    isActive: true,
    sortOrder: 9,
    description: "4 video consultations every month + dedicated care hotline.",
    features: [
      "4 Video Consultations every month",
      "Dedicated Care Hotline",
      "Full Digital Health Wallet & record storage",
      "Appointment reminders & priority support",
    ],
  },
  {
    key: "platinum",
    name: "Platinum Wellness",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    price: 499,
    videoConsultationsQuota: 7,
    videoConsultationsMonthly: 7,
    familyMembersLimit: 4,
    badge: "Best Value",
    isActive: true,
    sortOrder: 10,
    description: "7 video consultations every month + free family member additions.",
    features: [
      "7 Video Consultations every month",
      "Add up to 4 family members",
      "Priority OPD queue check-in",
      "Dedicated Care Hotline & reports sync",
    ],
  },
  {
    key: "prime",
    name: "Prime Complete",
    monthlyPrice: 999,
    yearlyPrice: 9990,
    price: 999,
    videoConsultationsQuota: 10,
    videoConsultationsMonthly: 10,
    familyMembersLimit: 10,
    badge: "VIP Care",
    isActive: true,
    sortOrder: 11,
    description: "10 video consultations every month + priority hospital check-in.",
    features: [
      "10 Video Consultations every month",
      "Up to 10 family members coverage",
      "Instant Emergency Care Concierge",
      "Highest priority appointment booking",
    ],
  },
];

/**
 * Resolves a plan by ID, key, slug or fallback to default plans.
 */
export const resolvePlan = async (identifier) => {
  if (!identifier) return null;
  const strId = String(identifier).trim();

  // 1. Try finding in MongoDB by ObjectId
  if (mongoose.Types.ObjectId.isValid(strId)) {
    const doc = await subscriptionPlanModel.findById(strId).lean();
    if (doc) return doc;
  }

  // 2. Try finding in MongoDB by key
  const byKey = await subscriptionPlanModel
    .findOne({ key: strId.toLowerCase() })
    .lean();
  if (byKey) return byKey;

  // 3. Try finding in DEFAULT_PLANS
  const byDefaultKey = DEFAULT_PLANS.find(
    (p) => p.key.toLowerCase() === strId.toLowerCase()
  );
  if (byDefaultKey) return byDefaultKey;

  // 4. Try matching by slug / clean name
  const cleanId = strId.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const byFuzzy = DEFAULT_PLANS.find(
    (p) =>
      p.key.toLowerCase() === cleanId ||
      p.name.toLowerCase().replace(/[^a-z0-9]/g, "_") === cleanId
  );
  if (byFuzzy) return byFuzzy;

  return null;
};

export const getSubscriptionPlans = async (req, res) => {
  try {
    const dbPlans = await subscriptionPlanModel
      .find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    if (dbPlans && dbPlans.length > 0) {
      return res.status(200).json({ success: true, count: dbPlans.length, plans: dbPlans });
    }

    return res.status(200).json({ success: true, count: DEFAULT_PLANS.length, plans: DEFAULT_PLANS });
  } catch (error) {
    return res.status(200).json({ success: true, count: DEFAULT_PLANS.length, plans: DEFAULT_PLANS });
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    const sub = await subscriptionModel
      .findOne({ userId: req.user.id, status: "active" })
      .sort({ createdAt: -1 });

    const isExpired = sub?.endDate ? new Date(sub.endDate) < new Date() : false;

    const currentMembership = sub && !isExpired
      ? {
          planKey: sub.planKey,
          planName: sub.planName,
          status: sub.status,
          videoQuotaTotal: sub.videoConsultationsQuota,
          videoQuotaUsed: sub.videoConsultationsUsed,
          remainingQuota: Math.max(0, sub.videoConsultationsQuota - sub.videoConsultationsUsed),
          expiresAt: sub.endDate,
          billingCycle: sub.billingCycle || "monthly",
          price: sub.price,
        }
      : {
          planKey: "free",
          planName: "Free Starter",
          status: "active",
          videoQuotaTotal: 0,
          videoQuotaUsed: 0,
          remainingQuota: 0,
          expiresAt: null,
          billingCycle: "free",
          price: 0,
        };

    const isEligible = Boolean(
      currentMembership.planKey !== "free" &&
      currentMembership.remainingQuota > 0 &&
      !isExpired
    );

    const entitlement = {
      planKey: currentMembership.planKey,
      planName: currentMembership.planName,
      status: currentMembership.status,
      hasActiveSubscription: currentMembership.planKey !== "free" && !isExpired,
      isEligibleForVideoConsultation: isEligible,
      videoQuotaTotal: currentMembership.videoQuotaTotal,
      videoQuotaUsed: currentMembership.videoQuotaUsed,
      remainingQuota: currentMembership.remainingQuota,
      expiresAt: currentMembership.expiresAt,
      code: !isEligible
        ? (currentMembership.planKey === "free" ? "subscription_required" : "quota_exhausted")
        : "eligible",
      message: isEligible
        ? `${currentMembership.planName} active (${currentMembership.remainingQuota} video consultations remaining)`
        : "Subscription Required – Please subscribe to continue with video consultation.",
    };

    res.status(200).json({
      success: true,
      currentMembership,
      subscription: sub,
      entitlement,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPatientEntitlement = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    const sub = await subscriptionModel
      .findOne({ userId: req.user.id, status: "active" })
      .sort({ createdAt: -1 });

    const isExpired = sub?.endDate ? new Date(sub.endDate) < new Date() : false;

    let planKey = "free";
    let planName = "Free Starter";
    let status = "active";
    let quotaTotal = 0;
    let quotaUsed = 0;
    let expiresAt = null;

    if (sub && !isExpired) {
      planKey = sub.planKey;
      planName = sub.planName;
      status = sub.status;
      quotaTotal = sub.videoConsultationsQuota || 0;
      quotaUsed = sub.videoConsultationsUsed || 0;
      expiresAt = sub.endDate;
    } else if (user?.currentSubscription?.status === "active" && user?.currentSubscription?.planKey !== "free") {
      const userSubExpires = user.currentSubscription.expiresAt ? new Date(user.currentSubscription.expiresAt) : null;
      if (!userSubExpires || userSubExpires >= new Date()) {
        planKey = user.currentSubscription.planKey;
        planName = user.currentSubscription.planName;
        status = "active";
        quotaTotal = user.currentSubscription.videoQuotaTotal || 0;
        quotaUsed = user.currentSubscription.videoQuotaUsed || 0;
        expiresAt = user.currentSubscription.expiresAt;
      }
    }

    const remainingQuota = Math.max(0, quotaTotal - quotaUsed);
    const hasActiveSubscription = planKey !== "free" && !isExpired;
    const isEligible = hasActiveSubscription && remainingQuota > 0;

    const entitlement = {
      planKey,
      planName,
      status,
      hasActiveSubscription,
      isEligibleForVideoConsultation: isEligible,
      videoQuotaTotal: quotaTotal,
      videoQuotaUsed: quotaUsed,
      remainingQuota,
      expiresAt,
      code: isEligible
        ? "eligible"
        : (!hasActiveSubscription ? "subscription_required" : "quota_exhausted"),
      message: isEligible
        ? `${planName} active (${remainingQuota} consultations remaining)`
        : "Subscription Required – Please subscribe to continue with video consultation.",
    };

    res.status(200).json({ success: true, entitlement });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSubscriptionOrder = async (req, res) => {
  try {
    const planIdentifier = req.body.planKey || req.body.planId;
    const billingCycle = req.body.billingCycle || "monthly";

    if (!planIdentifier) {
      return res.status(400).json({ success: false, message: "Subscription plan identifier is required" });
    }

    const plan = await resolvePlan(planIdentifier);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: `Invalid plan "${planIdentifier}". Please select an available plan.`,
      });
    }

    const isYearly = billingCycle === "yearly" || plan.billingInterval === "yearly";
    let amount = isYearly
      ? (plan.yearlyPrice || plan.price || 0)
      : (plan.monthlyPrice || plan.price || 0);

    if (amount <= 0 && plan.key === "free") {
      return res.status(200).json({
        success: true,
        isFree: true,
        message: "Free starter plan active.",
        planKey: "free",
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_Spw1C33b1zf044";

    const order = await createRazorpayOrder({
      amount,
      receipt: `sub_${plan.key}_${Date.now()}`.slice(0, 40),
      notes: {
        planKey: plan.key,
        planName: plan.name,
        userId: String(req.user.id),
        billingCycle: isYearly ? "yearly" : "monthly",
      },
    });

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount, // in paise
      keyId,
      currency: "INR",
      planKey: plan.key,
      planName: plan.name,
      billingCycle: isYearly ? "yearly" : "monthly",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifySubscriptionPayment = async (req, res) => {
  try {
    const orderId =
      req.body.razorpayOrderId ||
      req.body.razorpay_order_id ||
      req.body.orderId;
    const paymentId =
      req.body.razorpayPaymentId ||
      req.body.razorpay_payment_id ||
      req.body.paymentId;
    const signature =
      req.body.razorpaySignature ||
      req.body.razorpay_signature ||
      req.body.signature;
    const planIdentifier = req.body.planKey || req.body.planId;
    const billingCycle = req.body.billingCycle || "monthly";

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed: missing payment signature parameters",
      });
    }

    // 1. Verify Razorpay cryptographic signature
    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Subscription payment signature verification failed",
      });
    }

    // 2. Prevent replay attacks / duplicate activations
    const existingPayment = await subscriptionModel.findOne({ razorpayPaymentId: paymentId });
    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: "Subscription already active for this payment",
        subscription: existingPayment,
      });
    }

    // 3. Resolve plan details & quotas
    const plan = await resolvePlan(planIdentifier);
    const isYearly = billingCycle === "yearly" || plan?.billingInterval === "yearly";

    let quota = plan?.videoConsultationsMonthly || plan?.videoConsultationsQuota || 4;
    if (isYearly && plan?.yearlyPrice && !plan?.videoConsultationsMonthly) {
      quota = quota * 12;
    }

    const price = isYearly
      ? (plan?.yearlyPrice || plan?.price || 0)
      : (plan?.monthlyPrice || plan?.price || 0);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (isYearly ? 365 : 30));

    // 4. Create or update verified active subscription record (respects unique userId index)
    const sub = await subscriptionModel.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          userId: req.user.id,
          planKey: plan?.key || "care_plus",
          planName: plan?.name || "Care Plus",
          price,
          billingCycle: isYearly ? "yearly" : "monthly",
          status: "active",
          videoConsultationsQuota: quota,
          videoConsultationsUsed: 0,
          startDate,
          endDate,
          paymentStatus: "paid",
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
        },
      },
      { upsert: true, new: true }
    );

    // 5. Sync into user model
    await userModel.findByIdAndUpdate(req.user.id, {
      currentSubscription: {
        planKey: plan?.key || "care_plus",
        planName: plan?.name || "Care Plus",
        status: "active",
        videoQuotaTotal: quota,
        videoQuotaUsed: 0,
        expiresAt: endDate,
      },
    });

    res.status(200).json({
      success: true,
      message: `Subscription to ${plan?.name || "Plan"} activated successfully!`,
      subscription: sub,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubscriptionOverview = async (req, res) => {
  try {
    const totalSubscriptions = await subscriptionModel.countDocuments();
    const activeSubscriptions = await subscriptionModel.countDocuments({ status: "active" });
    const plans = await subscriptionPlanModel.find().lean();
    res.status(200).json({ success: true, totalSubscriptions, activeSubscriptions, plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const subscriptions = await subscriptionModel
      .find()
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: subscriptions.length, subscriptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSubscriptionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid subscription ID" });
    }
    const subscription = await subscriptionModel
      .findById(id)
      .populate("userId", "name email phone");
    if (!subscription) return res.status(404).json({ success: false, message: "Subscription not found" });
    res.status(200).json({ success: true, subscription });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
