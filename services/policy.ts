/**
 * HealPoint — Smart Healthcare Policy & Rules Engine Service.
 *
 * Provides type-safe client APIs for:
 * - Listing policies with category/scope filtering
 * - Fetching policy details and recent versions
 * - Modifying policy conditions with change justification
 * - Rollback to past version snapshots
 * - Interactive Policy Simulation
 * - Real-time policy evaluation checks
 */
import { api } from "./api";
import type {
  PolicyRule,
  PolicyVersionHistory,
  PolicyDecision,
  PolicySimulationRequest,
  PolicySimulationResult,
} from "@/types";

/**
 * Lists all active policy rules.
 */
export async function listPolicies(params?: {
  category?: string;
  scope?: string;
  search?: string;
}): Promise<PolicyRule[]> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== "all") {
    query.append("category", params.category);
  }
  if (params?.scope) query.append("scope", params.scope);
  if (params?.search) query.append("search", params.search);

  const qs = query.toString();
  const url = `/policies${qs ? `?${qs}` : ""}`;

  const res = await api.get<{
    success: boolean;
    count: number;
    policies: PolicyRule[];
  }>(url, { auth: true });

  return res?.policies || [];
}

/**
 * Retrieves details and recent history of a specific policy rule.
 */
export async function getPolicyDetails(
  key: string,
  hospitalId?: string,
): Promise<{
  policy: PolicyRule;
  recentHistory: PolicyVersionHistory[];
}> {
  const query = hospitalId ? `?hospitalId=${hospitalId}` : "";
  const res = await api.get<{
    success: boolean;
    policy: PolicyRule;
    recentHistory: PolicyVersionHistory[];
  }>(`/policies/${key}${query}`, { auth: true });

  if (!res?.success || !res.policy) {
    throw new Error(`Failed to load policy '${key}'`);
  }

  return {
    policy: res.policy,
    recentHistory: res.recentHistory || [],
  };
}

/**
 * Updates a policy's configuration and records an audited version increment.
 */
export async function updatePolicy(
  key: string,
  data: {
    title?: string;
    description?: string;
    isEnabled?: boolean;
    conditions: Record<string, any>;
    reason: string;
  },
): Promise<{
  success: boolean;
  message: string;
  policy: PolicyRule;
}> {
  const res = await api.put<{
    success: boolean;
    message: string;
    policy: PolicyRule;
  }>(`/policies/${key}`, data, { auth: true });

  return res;
}

/**
 * Reverts a policy rule to a previous historical version snapshot.
 */
export async function rollbackPolicy(
  key: string,
  targetVersion: number,
  reason: string,
): Promise<{
  success: boolean;
  message: string;
  policy: PolicyRule;
}> {
  const res = await api.post<{
    success: boolean;
    message: string;
    policy: PolicyRule;
  }>(`/policies/${key}/rollback`, { targetVersion, reason }, { auth: true });

  return res;
}

/**
 * Runs an interactive simulation of hypothetical parameters without side-effects.
 */
export async function simulatePolicy(
  request: PolicySimulationRequest,
): Promise<PolicyDecision> {
  const res = await api.post<PolicySimulationResult>(
    "/policies/simulate",
    request,
    { auth: true },
  );

  if (!res?.success || !res?.simulation) {
    throw new Error("Policy simulation failed to complete");
  }

  return res.simulation;
}

/**
 * Retrieves the full chronological version ledger for a policy.
 */
export async function getPolicyHistory(
  key: string,
): Promise<PolicyVersionHistory[]> {
  const res = await api.get<{
    success: boolean;
    count: number;
    history: PolicyVersionHistory[];
  }>(`/policies/${key}/history`, { auth: true });

  return res?.history || [];
}

/**
 * Runtime decision evaluation for permission checking.
 */
export async function evaluateDecision(payload: {
  action:
    | "can_book"
    | "can_cancel"
    | "can_reschedule"
    | "can_video"
    | "can_checkin";
  appointmentId?: string;
  slotDate?: string;
  slotTime?: string;
  consultationType?: string;
}): Promise<PolicyDecision> {
  const res = await api.post<{
    success: boolean;
    decision: PolicyDecision;
  }>("/policies/evaluate", payload, { auth: true });

  if (!res?.success || !res?.decision) {
    throw new Error("Decision evaluation failed");
  }

  return res.decision;
}
