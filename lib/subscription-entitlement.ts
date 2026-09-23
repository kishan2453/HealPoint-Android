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
  gold: 4,
  platinum: 7,
  prime: 10,
  // Backward compatibility with legacy tier keys
  basic: 2,
  professional: 4,
  premium: 7,
  enterprise: 10,
};

/** Canonical default plan specifications */
export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    _id: "plan_free_default",
    key: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "INR",
    videoConsultationsMonthly: 0,
    features: [
      "In-person clinic & hospital appointment booking",
      "Digital prescriptions & medical reports access",
      "Personal Health Timeline & record storage",
      "Hospital & Doctor directory search",
      "Verified reviews & ratings",
    ],
    isActive: true,
    trialDays: 0,
    sortOrder: 1,
    subscriberCount: 0,
    description: "Essential healthcare tools for individuals and families.",
  },
  {
    _id: "plan_gold_default",
    key: "gold",
    name: "Gold",
    monthlyPrice: 499,
    yearlyPrice: 4999,
    currency: "INR",
    videoConsultationsMonthly: 4,
    features: [
      "4 Video Consultations every month",
      "All Free plan features included",
      "Priority doctor slot booking",
      "Digital Hospital Pass with QR Check-In",
      "Smart Care Journey & Live waiting room",
    ],
    isActive: true,
    trialDays: 7,
    sortOrder: 2,
    subscriberCount: 0,
    description: "Ideal for regular check-ups and active doctor consultations.",
  },
  {
    _id: "plan_platinum_default",
    key: "platinum",
    name: "Platinum",
    monthlyPrice: 899,
    yearlyPrice: 8999,
    currency: "INR",
    videoConsultationsMonthly: 7,
    features: [
      "7 Video Consultations every month",
      "All Gold plan features included",
      "Family member health profile management",
      "Direct follow-up advice & care plan tracking",
      "Extended Google Meet video sessions",
    ],
    isActive: true,
    trialDays: 14,
    sortOrder: 3,
    subscriberCount: 0,
    description:
      "Comprehensive care for individuals with ongoing health needs.",
  },
  {
    _id: "plan_prime_default",
    key: "prime",
    name: "Prime",
    monthlyPrice: 1299,
    yearlyPrice: 12999,
    currency: "INR",
    videoConsultationsMonthly: 10,
    features: [
      "10 Video Consultations every month",
      "All Platinum plan features included",
      "VIP priority concierge scheduling",
      "Full family coverage & multi-patient tracking",
      "Unlimited care plan & vital trend analytics",
    ],
    isActive: true,
    trialDays: 14,
    sortOrder: 4,
    subscriberCount: 0,
    description: "Ultimate healthcare membership for complete family wellness.",
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
