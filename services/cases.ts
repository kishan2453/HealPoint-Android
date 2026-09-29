/**
 * HealPoint — Smart Healthcare Case & Incident Management API Service.
 *
 * Provides type-safe client APIs for:
 * - Paginated case listing with category, severity, status, SLA, and search filtering
 * - Case details inspection with relational entities and SLA countdown
 * - Authoritative status transitions
 * - Assignment to administrative team members
 * - Escalation triggers with priority elevation
 * - Resolution with root cause analysis and corrective action capture
 * - Internal staff discussion ledger
 * - Real-time operational KPI metrics
 */
import { api } from "./api";
import type {
  HealthcareCase,
  HealthcareCaseKpiSummary,
  HealthcareCaseStatus,
  GetCasesParams,
  CreateCasePayload,
  ResolveCasePayload,
  HealthcareCaseInternalNote,
} from "@/types";

export interface GetCasesResponse {
  success: boolean;
  cases: HealthcareCase[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export interface GetCaseDetailsResponse {
  success: boolean;
  case: HealthcareCase;
}

export interface GetCaseKpisResponse {
  success: boolean;
  kpis: HealthcareCaseKpiSummary;
}

/**
 * Fetch paginated healthcare cases with comprehensive filtering.
 */
export async function getCases(
  params: GetCasesParams = {},
): Promise<GetCasesResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.status && params.status !== "all")
    query.append("status", params.status);
  if (params.category && params.category !== "all")
    query.append("category", params.category);
  if (params.severity && params.severity !== "all")
    query.append("severity", params.severity);
  if (params.hospitalId) query.append("hospitalId", params.hospitalId);
  if (params.search) query.append("search", params.search);
  if (params.sla) query.append("sla", params.sla);

  const qs = query.toString();
  const url = `/cases${qs ? `?${qs}` : ""}`;

  return api.get<GetCasesResponse>(url, { auth: true });
}

/**
 * Fetch single case by ID or Case Number.
 */
export async function getCaseById(id: string): Promise<HealthcareCase> {
  const res = await api.get<GetCaseDetailsResponse>(
    `/cases/${encodeURIComponent(id)}`,
    {
      auth: true,
    },
  );
  if (!res?.success || !res?.case) {
    throw new Error("Failed to load case details");
  }
  return res.case;
}

/**
 * Fetch case KPI summary metrics.
 */
export async function getCaseKpis(
  hospitalId?: string,
): Promise<HealthcareCaseKpiSummary> {
  const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  const res = await api.get<GetCaseKpisResponse>(`/cases/kpis${qs}`, {
    auth: true,
  });
  if (!res?.success || !res?.kpis) {
    throw new Error("Failed to load case KPIs");
  }
  return res.kpis;
}

/**
 * Register a new healthcare case.
 */
export async function createCase(payload: CreateCasePayload): Promise<{
  success: boolean;
  case: HealthcareCase;
  deduplicated?: boolean;
}> {
  return api.post<{
    success: boolean;
    case: HealthcareCase;
    deduplicated?: boolean;
  }>("/cases", payload, { auth: true });
}

/**
 * Transition case status in the authoritative state machine.
 */
export async function updateCaseStatus(
  id: string,
  status: HealthcareCaseStatus,
  note?: string,
): Promise<HealthcareCase> {
  const res = await api.patch<{ success: boolean; case: HealthcareCase }>(
    `/cases/${encodeURIComponent(id)}/status`,
    { status, note },
    { auth: true },
  );
  if (!res?.success || !res?.case) {
    throw new Error("Failed to update case status");
  }
  return res.case;
}

/**
 * Assign case to staff / administrator.
 */
export async function assignCase(
  id: string,
  assignedToUserId: string,
  note?: string,
): Promise<HealthcareCase> {
  const res = await api.patch<{ success: boolean; case: HealthcareCase }>(
    `/cases/${encodeURIComponent(id)}/assign`,
    { assignedToUserId, note },
    { auth: true },
  );
  if (!res?.success || !res?.case) {
    throw new Error("Failed to assign case");
  }
  return res.case;
}

/**
 * Escalate case priority and alert team.
 */
export async function escalateCase(
  id: string,
  reason: string,
): Promise<HealthcareCase> {
  const res = await api.post<{ success: boolean; case: HealthcareCase }>(
    `/cases/${encodeURIComponent(id)}/escalate`,
    { reason },
    { auth: true },
  );
  if (!res?.success || !res?.case) {
    throw new Error("Failed to escalate case");
  }
  return res.case;
}

/**
 * Mark case as resolved with root cause and corrective action.
 */
export async function resolveCase(
  id: string,
  payload: ResolveCasePayload,
): Promise<HealthcareCase> {
  const res = await api.post<{ success: boolean; case: HealthcareCase }>(
    `/cases/${encodeURIComponent(id)}/resolve`,
    payload,
    { auth: true },
  );
  if (!res?.success || !res?.case) {
    throw new Error("Failed to resolve case");
  }
  return res.case;
}

/**
 * Add an internal staff note to the case.
 */
export async function addCaseNote(
  id: string,
  note: string,
  isConfidential = false,
): Promise<{ note: HealthcareCaseInternalNote; case: HealthcareCase }> {
  const res = await api.post<{
    success: boolean;
    note: HealthcareCaseInternalNote;
    case: HealthcareCase;
  }>(
    `/cases/${encodeURIComponent(id)}/notes`,
    { note, isConfidential },
    { auth: true },
  );
  if (!res?.success) {
    throw new Error("Failed to add internal note");
  }
  return { note: res.note, case: res.case };
}
