/**
 * Subscription API — mirrors routes/subscriptionRoutes.js on the backend.
 * All endpoints require a Bearer token. Hospital Admins are only allowed to
 * read their OWN hospital subscription (server-enforced) while Super Admin
 * endpoints manage the full platform.
 */
import { api } from "./api";
import type {
  Subscription,
  SubscriptionDetailResponse,
  SubscriptionListResponse,
  SubscriptionListSort,
  SubscriptionOverview,
  SubscriptionPlansResponse,
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
  };
  billingCycle?: string;
  subscription?: Subscription;
}

export interface VerifySubscriptionPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  planId?: string;
  planKey?: string;
  billingCycle?: string;
}

export async function createSubscriptionOrder(payload: {
  planId?: string;
  planKey?: string;
  billingCycle?: string;
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
