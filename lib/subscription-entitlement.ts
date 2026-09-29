/**
 * HealPoint - Subscription & Video Consultation Entitlement Engine.
 *
 * Provides pure, deterministic calculation of video consultation quotas,
 * monthly cycle resets, and real consultation eligibility.
 *
 * Supported Plan Tiers:
 *  - FREE:     0 video consultations/mo (In-person booking & basic features)
 *  - GOLD:     4 video consultations/mo
 *  - PLATINUM: 7 video consultations/mo
 *  - PRIME:   10 video consultations/mo
 *
 * Quota Rules:
 *  - Cancelled, failed, unpaid, or invalid appointments NEVER consume quota.
 *  - Only confirmed / completed eligible video consultations within the current
 *    monthly billing cycle consume quota.
 *  - Dynamic plan limits configured in Super Admin override defaults.
 */
import type {
  Appointment,
  Subscription,
  SubscriptionEntitlementCode,
  SubscriptionPlan,
  UserSubscriptionEntitlement,
} from "@/types";

/**
 * Standard monthly video consultation limits by plan key.
 * Used when a plan stored in the DB does not explicitly set `videoConsultationsMonthly`.
 */
export const DEFAULT_PLAN_VIDEO_LIMITS: Record<string, number> = {
  free: 0,
  care_starter: 2,
  care_plus: 4,
  care_pro: 6,
  family_care: 8,
  family_prime: 10,
  annual_care_pro: 6,
  annual_family_prime: 10,
  // Backward compatibility with legacy tier keys
  gold: 4,
  platinum: 7,
  prime: 10,
  basic: 2,
  professional: 4,
  premium: 7,
  enterprise: 10,
};

/** Canonical default plan specifications (1 Free baseline + 5 Monthly + 2 Yearly) */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    _id: "plan_free_default",
    key: "free",
    name: "Free Starter",
    billingInterval: "free",
    price: 0,
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "INR",
    videoConsultationsMonthly: 0,
    familyMembersLimit: 1,
    badge: "Essential Baseline",
    features: [
      "In-person clinic & hospital appointment booking",
      "Digital prescriptions & lab report health wallet",
      "Personal Health Timeline & immunization records",
      "Verified doctor directory & emergency hospital locator",
    ],
    isActive: true,
    trialDays: 0,
    sortOrder: 1,
    subscriberCount: 0,
    description:
      "Free baseline tier for essential in-person clinic visits and digital health records.",
  },
  // 5 MONTHLY PLANS
  {
    _id: "plan_care_starter_default",
    key: "care_starter",
    name: "Care Starter",
    billingInterval: "monthly",
    price: 249,
    monthlyPrice: 249,
    yearlyPrice: 0,
    currency: "INR",
    videoConsultationsMonthly: 2,
    familyMembersLimit: 1,
    badge: "Starter",
    features: [
      "2 Video Consultations every month",
      "All Free baseline features included",
      "Automated medicine & vitals reminders",
      "Digital health wallet & encrypted record storage",
      "1 Patient profile coverage (Self)",
    ],
    isActive: true,
    trialDays: 0,
    sortOrder: 2,
    subscriberCount: 0,
    description:
      "Essential video care with dedicated doctor consultations for single patients.",
  },
  {
    _id: "plan_care_plus_default",
    key: "care_plus",
    name: "Care Plus",
    billingInterval: "monthly",
    price: 499,
    monthlyPrice: 499,
    yearlyPrice: 0,
    currency: "INR",
    videoConsultationsMonthly: 4,
    familyMembersLimit: 2,
    badge: "Popular",
    features: [
      "4 Video Consultations every month",
      "All Care Starter features included",
      "Digital Hospital Pass with QR express check-in",
      "Smart Care Journey & Live OPD queue tracker",
      "Coverage for up to 2 family members",
    ],
    isActive: true,
    trialDays: 7,
    sortOrder: 3,
    subscriberCount: 0,
    description:
      "Enhanced care for couples or individuals needing regular follow-ups and priority queueing.",
  },
  {
    _id: "plan_care_pro_default",
    key: "care_pro",
    name: "Care Pro",
    billingInterval: "monthly",
    price: 799,
    monthlyPrice: 799,
    yearlyPrice: 0,
    currency: "INR",
    videoConsultationsMonthly: 6,
    familyMembersLimit: 4,
    badge: "Best Value",
    features: [
      "6 Video Consultations every month",
      "All Care Plus features included",
      "Specialist doctor referrals & clinical handover",
      "Full Health Data Export & portable medical briefcase",
      "Coverage for up to 4 family members",
    ],
    isActive: true,
    trialDays: 14,
    sortOrder: 4,
    subscriberCount: 0,
    description:
      "Comprehensive health plan for growing families with multi-member specialist access.",
  },
  {
    _id: "plan_family_care_default",
    key: "family_care",
    name: "Family Care",
    billingInterval: "monthly",
    price: 1099,
    monthlyPrice: 1099,
    yearlyPrice: 0,
    currency: "INR",
    videoConsultationsMonthly: 8,
    familyMembersLimit: 6,
    badge: "Family Choice",
    features: [
      "8 Video Consultations every month",
      "All Care Pro features included",
      "Direct follow-up care plan tracking & health alerts",
      "Priority doctor slot booking & scheduling preference",
      "Coverage for up to 6 family members",
    ],
    isActive: true,
    trialDays: 14,
    sortOrder: 5,
    subscriberCount: 0,
    description:
      "Dedicated household healthcare with multi-generation tracking and chronic care assistance.",
  },
  {
    _id: "plan_family_prime_default",
    key: "family_prime",
    name: "Family Prime",
    billingInterval: "monthly",
    price: 1499,
    monthlyPrice: 1499,
    yearlyPrice: 0,
    currency: "INR",
    videoConsultationsMonthly: 10,
    familyMembersLimit: 10,
    badge: "Ultimate",
    features: [
      "10 Video Consultations every month",
      "All Family Care features included",
      "Extended video sessions & emergency consultation coordination",
      "Multi-patient health timeline & vital trend analytics",
      "Full family coverage for up to 10 members",
    ],
    isActive: true,
    trialDays: 14,
    sortOrder: 6,
    subscriberCount: 0,
    description:
      "Ultimate healthcare membership for complete joint families and large households.",
  },
  // 2 YEARLY PLANS
  {
    _id: "plan_annual_care_pro_default",
    key: "annual_care_pro",
    name: "Annual Care Pro",
    billingInterval: "yearly",
    price: 7999,
    monthlyPrice: 0,
    yearlyPrice: 7999,
    referenceMonthlyPlanKey: "care_pro",
    currency: "INR",
    videoConsultationsMonthly: 6,
    familyMembersLimit: 4,
    badge: "Annual Savings",
    features: [
      "72 Video Consultations per year (6/month)",
      "Save ₹1,589 annually vs monthly billing (16.6% off)",
      "Effective cost: just ₹667 / month",
      "Specialist doctor referrals & clinical handover",
      "Full Health Data Export & portable records",
      "Coverage for up to 4 family members",
    ],
    isActive: true,
    trialDays: 14,
    sortOrder: 7,
    subscriberCount: 0,
    description:
      "12-month Care Pro coverage with 72 annual video visits and ₹1,589 guaranteed savings.",
  },
  {
    _id: "plan_annual_family_prime_default",
    key: "annual_family_prime",
    name: "Annual Family Prime",
    billingInterval: "yearly",
    price: 11999,
    monthlyPrice: 0,
    yearlyPrice: 11999,
    referenceMonthlyPlanKey: "family_prime",
    currency: "INR",
    videoConsultationsMonthly: 10,
    familyMembersLimit: 10,
    badge: "Maximum Value",
    features: [
      "120 Video Consultations per year (10/month)",
      "Save ₹5,989 annually vs monthly billing (33.3% off - 4 months free)",
      "Effective cost: just ₹1,000 / month",
      "Priority doctor scheduling & emergency coordination",
      "Vital trend analytics & multi-patient tracking",
      "Full family coverage for up to 10 members",
    ],
    isActive: true,
    trialDays: 14,
    sortOrder: 8,
    subscriberCount: 0,
    description:
      "12-month complete household membership with 120 annual video visits and ₹5,989 guaranteed savings.",
  },
];

/**
 * Returns the effective monthly video consultation limit for a plan.
 */
export function getPlanVideoLimit(
  plan?: Partial<SubscriptionPlan> | null,
): number {
  if (!plan) return 0;
  if (
    typeof plan.videoConsultationsMonthly === "number" &&
    !isNaN(plan.videoConsultationsMonthly)
  ) {
    return Math.max(0, Math.floor(plan.videoConsultationsMonthly));
  }
  const key = String(plan.key || "")
    .trim()
    .toLowerCase();
  return DEFAULT_PLAN_VIDEO_LIMITS[key] ?? 0;
}

/**
 * Derives current monthly billing window (start & end dates).
 */
export function getBillingPeriodWindow(subscription?: Subscription | null): {
  start: Date;
  end: Date;
} {
  const now = new Date();

  // If subscription explicitly carries billing period
  if (subscription?.billingPeriodStart && subscription?.billingPeriodEnd) {
    const s = new Date(subscription.billingPeriodStart);
    const e = new Date(subscription.billingPeriodEnd);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      return { start: s, end: e };
    }
  }

  // If subscription has a valid startDate, calculate current cycle
  if (subscription?.startDate) {
    const subStart = new Date(subscription.startDate);
    if (!isNaN(subStart.getTime())) {
      // Step month by month from start date up to current date
      const cycleStart = new Date(subStart);
      while (cycleStart.getTime() <= now.getTime()) {
        const nextMonth = new Date(cycleStart);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        if (nextMonth.getTime() > now.getTime()) {
          return { start: cycleStart, end: nextMonth };
        }
        cycleStart.setMonth(cycleStart.getMonth() + 1);
      }
    }
  }

  // Default: Calendar month window
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { start, end };
}

/**
 * Parses appointment date into a standard JS Date for timeline window comparisons.
 */
function parseAppointmentDate(appt: Appointment): Date | null {
  const raw =
    appt.slotDate || appt.date || appt.appointmentDate || appt.createdAt;
  if (!raw) return null;

  // Handles DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Determines whether an appointment is a real online video consultation that consumes quota.
 *
 * Rules:
 * - Must be online / video consultation mode.
 * - Must NOT be cancelled.
 * - Must NOT be payment-failed.
 * - Must fall within the given billing period window.
 */
export function isQuotaConsumingAppointment(
  appt: Appointment,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  // 1. Must be online / video consultation
  const isOnline =
    appt.consultationType === "video" || Boolean(appt.meetingUrl);

  if (!isOnline) return false;

  // 2. Cancelled appointments NEVER consume quota
  const status = String(appt.status || "")
    .trim()
    .toLowerCase();
  if (status === "cancel" || status === "cancelled") return false;

  // 3. Failed payment appointments NEVER consume quota
  const paymentStatus = String(appt.paymentStatus || "")
    .trim()
    .toLowerCase();
  if (paymentStatus === "failed") return false;

  // 4. Must fall within the billing cycle
  const apptDate = parseAppointmentDate(appt);
  if (!apptDate) return false;

  return (
    apptDate.getTime() >= windowStart.getTime() &&
    apptDate.getTime() <= windowEnd.getTime()
  );
}

/**
 * Computes live subscription entitlement for a patient.
 */
export function computeSubscriptionEntitlement(options: {
  subscription?: Subscription | null;
  plans?: SubscriptionPlan[];
  appointments?: Appointment[];
}): UserSubscriptionEntitlement {
  const { subscription, plans = [], appointments = [] } = options;

  const isActive =
    Boolean(subscription) &&
    (subscription?.status === "active" || subscription?.status === "trial");

  const planKey = (
    subscription?.planKey ||
    subscription?.planDetails?.key ||
    "free"
  ).toLowerCase();

  // Find the matching plan object, or fall back to default specs
  const allPlans = plans.length > 0 ? plans : DEFAULT_SUBSCRIPTION_PLANS;
  const matchedPlan =
    allPlans.find((p) => p.key.toLowerCase() === planKey) ||
    allPlans.find((p) => p._id === subscription?.planId) ||
    DEFAULT_SUBSCRIPTION_PLANS[0];

  const planName = subscription?.planName || matchedPlan.name || "Free";
  const monthlyQuota = isActive ? getPlanVideoLimit(matchedPlan) : 0;

  // Billing window
  const window = getBillingPeriodWindow(subscription);

  // If subscription carries server-calculated videoConsultationsUsed, prefer it;
  // otherwise calculate deterministically from valid appointments in cycle.
  let usedThisMonth = 0;
  if (
    typeof subscription?.videoConsultationsUsed === "number" &&
    !isNaN(subscription.videoConsultationsUsed)
  ) {
    usedThisMonth = Math.max(0, subscription.videoConsultationsUsed);
  } else {
    usedThisMonth = appointments.filter((appt) =>
      isQuotaConsumingAppointment(appt, window.start, window.end),
    ).length;
  }

  const remainingQuota = Math.max(0, monthlyQuota - usedThisMonth);

  // Determine entitlement code and message
  let code: SubscriptionEntitlementCode;
  let message: string;
  let isEligible = false;

  if (!isActive || monthlyQuota === 0) {
    code = "subscription_required";
    message =
      "A Gold, Platinum, or Prime plan is required to join video consultations.";
    isEligible = false;
  } else if (remainingQuota <= 0) {
    code = "quota_exhausted";
    message = `You have used all ${monthlyQuota} video consultations included in your ${planName} plan for this month. Upgrade your plan to consult right away.`;
    isEligible = false;
  } else {
    code = "consultation_available";
    message = `You have ${remainingQuota} of ${monthlyQuota} video consultations remaining this month.`;
    isEligible = true;
  }

  return {
    hasActiveSubscription: isActive && planKey !== "free",
    planKey,
    planName,
    monthlyQuota,
    usedThisMonth,
    remainingQuota,
    isEligibleForVideoConsultation: isEligible,
    code,
    message,
    billingPeriodStart: window.start.toISOString(),
    billingPeriodEnd: window.end.toISOString(),
    expiryDate: subscription?.expiryDate,
    canUpgrade: planKey !== "prime",
    activePlan: matchedPlan,
  };
}

/**
 * Returns UI badge descriptor for entitlement status.
 */
export function getEntitlementBadge(entitlement: UserSubscriptionEntitlement): {
  label: string;
  variant: "success" | "warning" | "error" | "primary" | "neutral";
} {
  if (!entitlement.hasActiveSubscription) {
    return { label: "Free Plan", variant: "neutral" };
  }
  if (entitlement.remainingQuota > 0) {
    return {
      label: `${entitlement.remainingQuota} Left`,
      variant: "success",
    };
  }
  return { label: "Quota Limit Reached", variant: "warning" };
}

/**
 * Safe percentage calculation for quota progress bars.
 */
export function getQuotaUsagePercent(used: number, total: number): number {
  if (total <= 0) return 0;
  const pct = Math.round((used / total) * 100);
  return Math.min(100, Math.max(0, pct));
}
