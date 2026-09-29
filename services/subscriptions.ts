/**
 * Subscription API — mirrors routes/subscriptionRoutes.js on the backend.
 * All endpoints require a Bearer token. Hospital Admins are only allowed to
 * read their OWN hospital subscription (server-enforced) while Super Admin
 * endpoints manage the full platform.
 */
import { api } from "./api";
import {
  computeSubscriptionEntitlement,
  DEFAULT_SUBSCRIPTION_PLANS,
} from "@/lib/subscription-entitlement";
import type {
  Subscription,
  SubscriptionDetailResponse,
  SubscriptionEntitlementResponse,
  SubscriptionListResponse,
  SubscriptionListSort,
  SubscriptionOverview,
  SubscriptionPlansResponse,
  SubscriptionReceipt,
  SubscriptionReconciliationIssue,
  SubscriptionReconciliationOverview,
  SubscriptionAnalyticsResponse,
  UserAppointmentsResponse,
  UserSubscriptionEntitlement,
  FeatureCatalogItem,
  PlanFeatureMatrixItem,
  PlanValidationResponse,
  EntitlementOverride,
  SubscriptionInvoice,
  SubscriptionTaxConfig,
  BillingOverview,
  InvoiceListResponse,
  SubscriptionPromotion,
  PromotionValidationResponse,
  PromotionAnalyticsOverview,
  PromotionListResponse,
  PromotionRedemptionsResponse,
} from "@/types";

export async function getSubscriptionOverview(): Promise<{
  success: boolean;
  overview: SubscriptionOverview;
}> {
  return api.get<{ success: boolean; overview: SubscriptionOverview }>(
    "/subscription/overview",
    { auth: true },
  );
}

export async function getSubscriptions(
  params: {
    search?: string;
    plan?: string;
    status?: string;
    sort?: SubscriptionListSort;
    page?: number;
    limit?: number;
  } = {},
): Promise<SubscriptionListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.plan && params.plan !== "all") query.set("plan", params.plan);
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (params.sort) query.set("sort", params.sort);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<SubscriptionListResponse>(
    "/subscription" + (qs ? "?" + qs : ""),
    { auth: true },
  );
}

export async function getSubscriptionDetails(
  id: string,
): Promise<SubscriptionDetailResponse> {
  return api.get<SubscriptionDetailResponse>("/subscription/" + id, {
    auth: true,
  });
}

export async function getMySubscription(): Promise<SubscriptionDetailResponse> {
  return api.get<SubscriptionDetailResponse>("/subscription/my", {
    auth: true,
  });
}

export async function getPlans(): Promise<SubscriptionPlansResponse> {
  return api.get<SubscriptionPlansResponse>("/subscription/plans", {
    auth: true,
  });
}

export async function createPlan(payload: {
  key: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  videoConsultationsMonthly?: number;
  isActive?: boolean;
  trialDays?: number;
  sortOrder?: number;
  imageUrl?: string;
  description?: string;
}): Promise<{
  success: boolean;
  message: string;
  plan: Subscription["planDetails"];
}> {
  return api.post<{
    success: boolean;
    message: string;
    plan: Subscription["planDetails"];
  }>("/subscription/plans", payload, { auth: true });
}

export async function updatePlan(
  planId: string,
  payload: Partial<{
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    features: string[];
    videoConsultationsMonthly: number;
    trialDays: number;
    sortOrder: number;
    imageUrl?: string;
    description?: string;
  }>,
): Promise<{
  success: boolean;
  message: string;
  plan: Subscription["planDetails"];
}> {
  return api.patch<{
    success: boolean;
    message: string;
    plan: Subscription["planDetails"];
  }>("/subscription/plans/" + planId, payload, { auth: true });
}

export async function togglePlan(
  planId: string,
  isActive: boolean,
): Promise<{
  success: boolean;
  message: string;
  plan: Subscription["planDetails"];
}> {
  return api.patch<{
    success: boolean;
    message: string;
    plan: Subscription["planDetails"];
  }>("/subscription/plans/" + planId + "/status", { isActive }, { auth: true });
}

// ---- Super Admin actions (backend enforces SUPER_ADMIN role) ----------------
export async function changeSubscriptionPlan(
  id: string,
  payload: {
    planId: string;
    planKey?: string;
    billingCycle?: string;
    amount?: number;
    expiryDate?: string;
    note?: string;
  },
): Promise<SubscriptionDetailResponse> {
  return api.patch<SubscriptionDetailResponse>(
    "/subscription/" + id + "/change-plan",
    payload,
    { auth: true },
  );
}

export async function activateSubscription(
  id: string,
  note?: string,
): Promise<SubscriptionDetailResponse> {
  return api.patch<SubscriptionDetailResponse>(
    "/subscription/" + id + "/activate",
    { note },
    { auth: true },
  );
}

export async function suspendSubscription(
  id: string,
  note?: string,
): Promise<SubscriptionDetailResponse> {
  return api.patch<SubscriptionDetailResponse>(
    "/subscription/" + id + "/suspend",
    { note },
    { auth: true },
  );
}

export async function cancelSubscription(
  id: string,
  note?: string,
): Promise<SubscriptionDetailResponse> {
  return api.patch<SubscriptionDetailResponse>(
    "/subscription/" + id + "/cancel",
    { note },
    { auth: true },
  );
}

export async function renewSubscription(
  id: string,
  payload: { expiryDate?: string; note?: string } = {},
): Promise<SubscriptionDetailResponse> {
  return api.patch<SubscriptionDetailResponse>(
    "/subscription/" + id + "/renew",
    payload,
    { auth: true },
  );
}

export async function extendSubscription(
  id: string,
  payload: { days?: number; months?: number; note?: string },
): Promise<SubscriptionDetailResponse> {
  return api.patch<SubscriptionDetailResponse>(
    "/subscription/" + id + "/extend",
    payload,
    { auth: true },
  );
}

export async function updateSubscriptionPaymentStatus(
  id: string,
  payload: {
    paymentStatus: string;
    amount?: number;
    razorpayPaymentId?: string;
    note?: string;
  },
): Promise<SubscriptionDetailResponse> {
  return api.patch<SubscriptionDetailResponse>(
    "/subscription/" + id + "/payment-status",
    payload,
    { auth: true },
  );
}

export interface CreateSubscriptionOrderResponse {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  isFree?: boolean;
  message?: string;
  plan?: {
    _id: string;
    key: string;
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    price?: number;
    discountAmount?: number;
    finalPrice?: number;
  };
  billingCycle?: string;
  subscription?: Subscription;
  promotion?: {
    code: string;
    name: string;
    discountType: string;
    discountValue: number;
    discountAmount: number;
  } | null;
}

export interface VerifySubscriptionPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  planId?: string;
  planKey?: string;
  billingCycle?: string;
  promoCode?: string;
  promoId?: string;
  discountAmount?: number;
}

export async function createSubscriptionOrder(payload: {
  planId?: string;
  planKey?: string;
  billingCycle?: string;
  amount?: number;
  promoCode?: string;
  couponCode?: string;
}): Promise<CreateSubscriptionOrderResponse> {
  return api.post<CreateSubscriptionOrderResponse>(
    "/subscription/create-order",
    payload,
    { auth: true },
  );
}

export async function verifySubscriptionPayment(
  payload: VerifySubscriptionPaymentPayload,
): Promise<SubscriptionDetailResponse> {
  return api.post<SubscriptionDetailResponse>(
    "/subscription/verify-payment",
    payload,
    { auth: true },
  );
}

/**
 * Retrieves the current patient's subscription entitlement, video consultation quota,
 * and eligibility. First checks server endpoint `/subscription/entitlement`, then
 * gracefully falls back to deterministic entitlement calculation from the user's
 * real subscription status, configured plans, and confirmed appointments.
 */
export async function getPatientSubscriptionEntitlement(): Promise<UserSubscriptionEntitlement> {
  try {
    const res = await api.get<SubscriptionEntitlementResponse>(
      "/subscription/entitlement",
      { auth: true },
    );
    if (res && res.success && res.entitlement) {
      return res.entitlement;
    }
  } catch {
    // Graceful fallback to server-synced entitlement calculation
  }

  try {
    const [subRes, plansRes, apptsRes] = await Promise.all([
      getMySubscription().catch(() => null),
      getPlans().catch(() => null),
      api
        .get<UserAppointmentsResponse>(
          "/appointment/get-user-appointments/me",
          {
            auth: true,
          },
        )
        .catch(() => null),
    ]);

    const subscription = subRes?.subscription || null;
    const plans =
      plansRes?.plans && plansRes.plans.length > 0
        ? plansRes.plans
        : DEFAULT_SUBSCRIPTION_PLANS;
    const appointments = apptsRes?.appoinmtent || [];

    return computeSubscriptionEntitlement({
      subscription,
      plans,
      appointments,
    });
  } catch {
    return computeSubscriptionEntitlement({
      subscription: null,
      plans: DEFAULT_SUBSCRIPTION_PLANS,
      appointments: [],
    });
  }
}

/**
 * Retrieves the official tamper-proof digital receipt for a verified payment.
 */
export async function getSubscriptionReceipt(
  paymentId: string,
): Promise<{ success: boolean; receipt: SubscriptionReceipt }> {
  return api.get<{ success: boolean; receipt: SubscriptionReceipt }>(
    `/subscription/receipt/${paymentId}`,
    { auth: true },
  );
}

/**
 * Schedules a downgrade to a lower plan tier, preserving current access until billing cycle conclusion.
 */
export async function schedulePlanDowngrade(
  targetPlanKey: string,
): Promise<{ success: boolean; message: string; subscription: Subscription }> {
  return api.post<{
    success: boolean;
    message: string;
    subscription: Subscription;
  }>("/subscription/downgrade", { targetPlanKey }, { auth: true });
}

/**
 * Fetches the Super Admin Revenue Protection & Reconciliation Overview with detected mismatches.
 */
export async function getReconciliationOverview(
  filters: { status?: string; severity?: string; type?: string } = {},
): Promise<{
  success: boolean;
  overview: SubscriptionReconciliationOverview;
  issues: SubscriptionReconciliationIssue[];
}> {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.severity) query.set("severity", filters.severity);
  if (filters.type) query.set("type", filters.type);
  const qs = query.toString();
  return api.get<{
    success: boolean;
    overview: SubscriptionReconciliationOverview;
    issues: SubscriptionReconciliationIssue[];
  }>("/subscription/reconciliation/overview" + (qs ? "?" + qs : ""), {
    auth: true,
  });
}

/**
 * Triggers an on-demand reconciliation scan across all subscriptions and payments.
 */
export async function runReconciliationScan(): Promise<{
  success: boolean;
  message: string;
  scanResults: {
    totalSubscriptionsScanned: number;
    totalIssuesFound: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    autoRepairEligibleCount: number;
    issues: SubscriptionReconciliationIssue[];
  };
}> {
  return api.post<{
    success: boolean;
    message: string;
    scanResults: any;
  }>("/subscription/reconciliation/scan", {}, { auth: true });
}

/**
 * Executes a deterministic safe auto-repair on an eligible reconciliation issue.
 */
export async function executeSafeAutoRepair(issueId: string): Promise<{
  success: boolean;
  message: string;
  issue: SubscriptionReconciliationIssue;
  repairAction: string;
  repairNote: string;
}> {
  return api.post<{
    success: boolean;
    message: string;
    issue: SubscriptionReconciliationIssue;
    repairAction: string;
    repairNote: string;
  }>("/subscription/reconciliation/auto-repair", { issueId }, { auth: true });
}

/**
 * Manually resolves a high-risk reconciliation discrepancy with Super Admin authorization.
 */
export async function resolveReconciliationIssue(
  issueId: string,
  action: string,
  notes?: string,
): Promise<{
  success: boolean;
  message: string;
  issue: SubscriptionReconciliationIssue;
}> {
  return api.post<{
    success: boolean;
    message: string;
    issue: SubscriptionReconciliationIssue;
  }>(
    `/subscription/reconciliation/resolve/${issueId}`,
    { action, notes },
    {
      auth: true,
    },
  );
}

/**
 * Super Admin: Retrieves real-time subscription analytics, conversion, and cohort intelligence.
 */
export async function getSubscriptionAnalytics(params?: {
  timeframe?: string;
  startDate?: string;
  endDate?: string;
  planKey?: string;
  billingCycle?: string;
  refresh?: boolean;
}): Promise<SubscriptionAnalyticsResponse> {
  const query = new URLSearchParams();
  if (params?.timeframe) query.set("timeframe", params.timeframe);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  if (params?.planKey) query.set("planKey", params.planKey);
  if (params?.billingCycle) query.set("billingCycle", params.billingCycle);
  if (params?.refresh) query.set("refresh", "true");

  const qs = query.toString();
  return api.get<SubscriptionAnalyticsResponse>(
    "/subscription/analytics" + (qs ? "?" + qs : ""),
    { auth: true },
  );
}

/**
 * Super Admin: Exports subscription analytics and cohort intelligence as CSV.
 */
export async function exportSubscriptionAnalyticsCSV(params?: {
  timeframe?: string;
  startDate?: string;
  endDate?: string;
  planKey?: string;
  billingCycle?: string;
}): Promise<string> {
  const query = new URLSearchParams();
  if (params?.timeframe) query.set("timeframe", params.timeframe);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  if (params?.planKey) query.set("planKey", params.planKey);
  if (params?.billingCycle) query.set("billingCycle", params.billingCycle);

  const qs = query.toString();
  return api.get<string>(
    "/subscription/analytics/export" + (qs ? "?" + qs : ""),
    { auth: true },
  );
}

/**
 * Retrieves the platform's controlled feature catalog.
 */
export async function getFeatureCatalog(): Promise<{
  success: boolean;
  catalog: FeatureCatalogItem[];
  total: number;
}> {
  return api.get<{
    success: boolean;
    catalog: FeatureCatalogItem[];
    total: number;
  }>("/subscription/entitlements/catalog", { auth: true });
}

/**
 * Retrieves the full plan-by-feature entitlement matrix across all active plans.
 */
export async function getPlanFeatureMatrix(): Promise<{
  success: boolean;
  matrix: PlanFeatureMatrixItem[];
  totalPlans: number;
}> {
  return api.get<{
    success: boolean;
    matrix: PlanFeatureMatrixItem[];
    totalPlans: number;
  }>("/subscription/entitlements/matrix", { auth: true });
}

/**
 * Super Admin: Validates a proposed plan configuration against platform rules.
 */
export async function validatePlanEntitlements(
  planData: any,
): Promise<PlanValidationResponse> {
  return api.post<PlanValidationResponse>(
    "/subscription/entitlements/validate",
    planData,
    { auth: true },
  );
}

/**
 * Super Admin: Grants an explicit, audited manual entitlement override.
 */
export async function createEntitlementOverride(payload: {
  userId: string;
  featureKey: string;
  overrideValue: any;
  reason: string;
  validUntil?: string | null;
}): Promise<{
  success: boolean;
  message: string;
  override: EntitlementOverride;
}> {
  return api.post<{
    success: boolean;
    message: string;
    override: EntitlementOverride;
  }>("/subscription/entitlements/override", payload, { auth: true });
}

/**
 * Super Admin: Revokes an active manual entitlement override.
 */
export async function revokeEntitlementOverride(
  overrideId: string,
  payload: { userId: string; reason?: string },
): Promise<{ success: boolean; message: string }> {
  return api.delete<{ success: boolean; message: string }>(
    `/subscription/entitlements/override/${overrideId}`,
    { auth: true, body: payload },
  );
}

// ---------------------------------------------------------------------------
// Smart Subscription Billing, Invoices & Tax API Clients
// ---------------------------------------------------------------------------

/**
 * Retrieves the authenticated patient's subscription invoices.
 */
export async function getMySubscriptionInvoices(params?: {
  page?: number;
  limit?: number;
}): Promise<InvoiceListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<InvoiceListResponse>(
    `/subscription/invoices/my${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Retrieves a single subscription invoice by its document ID.
 */
export async function getSubscriptionInvoiceById(
  invoiceId: string,
): Promise<{ success: boolean; invoice: SubscriptionInvoice }> {
  return api.get<{ success: boolean; invoice: SubscriptionInvoice }>(
    `/subscription/invoices/${invoiceId}`,
    { auth: true },
  );
}

/**
 * Super Admin: Retrieves platform billing overview & KPI metrics.
 */
export async function getAdminBillingOverview(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ success: boolean } & BillingOverview> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const qs = query.toString();
  return api.get<{ success: boolean } & BillingOverview>(
    `/subscription/admin/billing/overview${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Super Admin: Retrieves paginated platform invoice directory with filters.
 */
export async function getAdminInvoices(params?: {
  search?: string;
  status?: string;
  billingCycle?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<InvoiceListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.billingCycle) query.set("billingCycle", params.billingCycle);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<InvoiceListResponse>(
    `/subscription/admin/billing/invoices${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Super Admin: Fetches active platform tax rules.
 */
export async function getSubscriptionTaxConfig(): Promise<{
  success: boolean;
  taxConfig: SubscriptionTaxConfig;
}> {
  return api.get<{ success: boolean; taxConfig: SubscriptionTaxConfig }>(
    "/subscription/admin/billing/tax-config",
    { auth: true },
  );
}

/**
 * Super Admin: Updates platform tax rules with versioning.
 */
export async function updateSubscriptionTaxConfig(
  payload: Partial<SubscriptionTaxConfig> & { reason?: string },
): Promise<{
  success: boolean;
  message: string;
  taxConfig: SubscriptionTaxConfig;
}> {
  return api.post<{
    success: boolean;
    message: string;
    taxConfig: SubscriptionTaxConfig;
  }>("/subscription/admin/billing/tax-config", payload, { auth: true });
}

/**
 * Super Admin: Scans subscriptions and reconciles billing invoices.
 */
export async function reconcileSubscriptionBilling(): Promise<{
  success: boolean;
  totalVerifiedPaymentsChecked: number;
  invoicesBackfilled: number;
  discrepanciesFound: number;
  discrepancies: Array<{
    paymentId: string;
    subscriptionId: string;
    error: string;
  }>;
  status: string;
}> {
  return api.post<{
    success: boolean;
    totalVerifiedPaymentsChecked: number;
    invoicesBackfilled: number;
    discrepanciesFound: number;
    discrepancies: Array<{
      paymentId: string;
      subscriptionId: string;
      error: string;
    }>;
    status: string;
  }>("/subscription/admin/billing/reconcile", {}, { auth: true });
}

// ---------------------------------------------------------------------------
// Smart Subscription Offers, Coupons & Promotion Engine
// ---------------------------------------------------------------------------

/**
 * Validates a coupon code during checkout preview.
 */
export async function validateSubscriptionCoupon(payload: {
  code: string;
  planKey?: string;
  planId?: string;
  billingCycle?: string;
}): Promise<PromotionValidationResponse> {
  return api.post<PromotionValidationResponse>(
    "/subscription/promotions/validate",
    payload,
    { auth: true },
  );
}

/**
 * Super Admin: Lists promotion codes with filters and pagination.
 */
export async function getAdminPromotions(params?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PromotionListResponse> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<PromotionListResponse>(
    `/subscription/admin/promotions${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Super Admin: Creates a new subscription promotion coupon.
 */
export async function createAdminPromotion(
  data: Partial<SubscriptionPromotion>,
): Promise<{
  success: boolean;
  message: string;
  promotion: SubscriptionPromotion;
}> {
  return api.post<{
    success: boolean;
    message: string;
    promotion: SubscriptionPromotion;
  }>("/subscription/admin/promotions", data, { auth: true });
}

/**
 * Super Admin: Updates an existing subscription promotion.
 */
export async function updateAdminPromotion(
  id: string,
  data: Partial<SubscriptionPromotion>,
): Promise<{
  success: boolean;
  message: string;
  promotion: SubscriptionPromotion;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    promotion: SubscriptionPromotion;
  }>("/subscription/admin/promotions/" + id, data, { auth: true });
}

/**
 * Super Admin: Toggles the active status of a promotion.
 */
export async function toggleAdminPromotionStatus(
  id: string,
  isActive: boolean,
): Promise<{
  success: boolean;
  message: string;
  promotion: SubscriptionPromotion;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    promotion: SubscriptionPromotion;
  }>(
    "/subscription/admin/promotions/" + id + "/status",
    { isActive },
    { auth: true },
  );
}

/**
 * Super Admin: Fetches performance and revenue analytics for promotions.
 */
export async function getAdminPromotionAnalytics(params?: {
  timeframe?: string;
}): Promise<PromotionAnalyticsOverview> {
  const query = new URLSearchParams();
  if (params?.timeframe) query.set("timeframe", params.timeframe);
  const qs = query.toString();
  return api.get<PromotionAnalyticsOverview>(
    `/subscription/admin/promotions/analytics${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Super Admin: Fetches redemption ledger for a specific promotion.
 */
export async function getAdminPromotionRedemptions(
  id: string,
  page = 1,
  limit = 50,
): Promise<PromotionRedemptionsResponse> {
  const query = new URLSearchParams();
  if (page) query.set("page", String(page));
  if (limit) query.set("limit", String(limit));
  const qs = query.toString();
  return api.get<PromotionRedemptionsResponse>(
    `/subscription/admin/promotions/${id}/redemptions${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}
