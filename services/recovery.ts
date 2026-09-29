/**
 * HealPoint — Smart Healthcare Service Recovery & Resolution Center API Service.
 *
 * Provides type-safe client APIs for:
 * - Paginated service recovery records with role/hospital isolation
 * - Detailed recovery inspection with root cause, action logs, and timeline
 * - Authorized action execution (reschedule, payment reconcile/refund, consult reconnect, quota restore)
 * - Status transitions and confidential internal notes
 * - Formal recovery resolution & multi-tier synchronization
 * - Authoritative recovery dashboard KPI metrics
 * - Patient-safe sanitized recovery status
 */
import { api } from "./api";
import type {
  ServiceRecovery,
  ServiceRecoveryKpiSummary,
  GetRecoveriesParams,
  ExecuteRecoveryActionPayload,
  ResolveRecoveryPayload,
  ServiceRecoveryPriority,
  ServiceRecoveryStatus,
} from "@/types";

export interface GetRecoveriesResponse {
  success: boolean;
  records: ServiceRecovery[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export interface GetRecoveryDetailsResponse {
  success: boolean;
  recovery: ServiceRecovery;
}

export interface GetRecoveryKpisResponse {
  success: boolean;
  kpis: ServiceRecoveryKpiSummary;
}

export interface CreateRecoveryPayload {
  title: string;
  recoveryType: string;
  priority?: ServiceRecoveryPriority;
  caseId?: string;
  slaId?: string;
  hospitalId?: string;
  patientId?: string;
  doctorId?: string;
  appointmentId?: string;
  paymentId?: string;
  rootCauseCategory?: string;
  rootCauseDescription?: string;
  initialPatientNote?: string;
}

export interface UpdateRecoveryStatusPayload {
  status?: ServiceRecoveryStatus;
  priority?: ServiceRecoveryPriority;
  internalNote?: string;
  patientFriendlyStatus?: string;
  rootCauseCategory?: string;
  rootCauseDescription?: string;
}

/**
 * Fetch paginated service recovery records.
 */
export async function getRecoveryRecords(
  params: GetRecoveriesParams = {},
): Promise<GetRecoveriesResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.status && params.status !== "all")
    query.append("status", params.status);
  if (params.recoveryType && params.recoveryType !== "all")
    query.append("recoveryType", params.recoveryType);
  if (params.priority && params.priority !== "all")
    query.append("priority", params.priority);
  if (params.hospitalId) query.append("hospitalId", params.hospitalId);
  if (params.search) query.append("search", params.search);

  const qs = query.toString();
  const url = `/recovery/records${qs ? `?${qs}` : ""}`;

  return api.get<GetRecoveriesResponse>(url, { auth: true });
}

/**
 * Fetch deep recovery details.
 */
export async function getRecoveryById(id: string): Promise<ServiceRecovery> {
  const res = await api.get<GetRecoveryDetailsResponse>(
    `/recovery/records/${encodeURIComponent(id)}`,
    {
      auth: true,
    },
  );
  if (!res?.success || !res?.recovery) {
    throw new Error("Failed to load service recovery details");
  }
  return res.recovery;
}

/**
 * Create a new service recovery record manually.
 */
export async function createRecovery(
  payload: CreateRecoveryPayload,
): Promise<ServiceRecovery> {
  const res = await api.post<{ success: boolean; recovery: ServiceRecovery }>(
    "/recovery/records",
    payload,
    { auth: true },
  );
  if (!res?.success || !res?.recovery) {
    throw new Error("Failed to create service recovery record");
  }
  return res.recovery;
}

/**
 * Execute an authorized recovery action (reschedule, payment refund/reconcile, video reconnect, quota restore).
 */
export async function executeAction(
  recoveryId: string,
  payload: ExecuteRecoveryActionPayload,
): Promise<ServiceRecovery> {
  const res = await api.post<{ success: boolean; recovery: ServiceRecovery }>(
    `/recovery/records/${encodeURIComponent(recoveryId)}/action`,
    payload,
    { auth: true },
  );
  if (!res?.success || !res?.recovery) {
    throw new Error("Failed to execute recovery action");
  }
  return res.recovery;
}

/**
 * Update recovery record status, priority, or add internal notes.
 */
export async function updateRecovery(
  recoveryId: string,
  payload: UpdateRecoveryStatusPayload,
): Promise<ServiceRecovery> {
  const res = await api.patch<{ success: boolean; recovery: ServiceRecovery }>(
    `/recovery/records/${encodeURIComponent(recoveryId)}/status`,
    payload,
    { auth: true },
  );
  if (!res?.success || !res?.recovery) {
    throw new Error("Failed to update recovery record");
  }
  return res.recovery;
}

/**
 * Formally resolve and close a service recovery record.
 */
export async function resolveAndClose(
  recoveryId: string,
  payload: ResolveRecoveryPayload,
): Promise<ServiceRecovery> {
  const res = await api.post<{ success: boolean; recovery: ServiceRecovery }>(
    `/recovery/records/${encodeURIComponent(recoveryId)}/resolve`,
    payload,
    { auth: true },
  );
  if (!res?.success || !res?.recovery) {
    throw new Error("Failed to resolve and close recovery record");
  }
  return res.recovery;
}

/**
 * Fetch authoritative dashboard KPI metrics.
 */
export async function getRecoveryKpis(
  hospitalId?: string,
): Promise<ServiceRecoveryKpiSummary> {
  const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  const res = await api.get<GetRecoveryKpisResponse>(`/recovery/kpis${qs}`, {
    auth: true,
  });
  if (!res?.success || !res?.kpis) {
    throw new Error("Failed to load recovery KPIs");
  }
  return res.kpis;
}

/**
 * Fetch sanitized, patient-safe recovery status.
 */
export async function getPatientRecoveryStatus(
  params: {
    appointmentId?: string;
    recoveryNumber?: string;
  } = {},
): Promise<any[]> {
  const query = new URLSearchParams();
  if (params.appointmentId) query.append("appointmentId", params.appointmentId);
  if (params.recoveryNumber)
    query.append("recoveryNumber", params.recoveryNumber);

  const qs = query.toString();
  const res = await api.get<{ success: boolean; recoveries: any[] }>(
    `/recovery/patient/status${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
  return res?.recoveries || [];
}
