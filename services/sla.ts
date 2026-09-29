/**
 * HealPoint — Smart Patient Service SLA & Escalation Center API Service.
 *
 * Provides type-safe client APIs for:
 * - Paginated SLA records with status, serviceType, severity, and hospital filtering
 * - Detailed SLA inspection with timing metrics, escalation history, and linked case
 * - SLA dashboard KPI metrics
 * - Configured SLA policies retrieval and Super Admin policy management
 * - Manual SLA escalation trigger
 * - Patient-safe SLA progress status
 */
import { api } from "./api";
import type {
  PatientServiceSla,
  PatientServiceSlaKpiSummary,
  ServiceSlaPolicy,
  GetSlaRecordsParams,
  PatientSafeSlaStatus,
} from "@/types";

export interface GetSlaRecordsResponse {
  success: boolean;
  records: PatientServiceSla[];
  totalCount: number;
  page: number;
  totalPages: number;
}

export interface GetSlaDetailsResponse {
  success: boolean;
  sla: PatientServiceSla;
}

export interface GetSlaKpisResponse {
  success: boolean;
  kpis: PatientServiceSlaKpiSummary;
}

export interface GetSlaPoliciesResponse {
  success: boolean;
  policies: ServiceSlaPolicy[];
}

/**
 * Fetch paginated operational SLA records.
 */
export async function getSlaRecords(
  params: GetSlaRecordsParams = {},
): Promise<GetSlaRecordsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.status && params.status !== "all")
    query.append("status", params.status);
  if (params.serviceType && params.serviceType !== "all")
    query.append("serviceType", params.serviceType);
  if (params.severity && params.severity !== "all")
    query.append("severity", params.severity);
  if (params.hospitalId) query.append("hospitalId", params.hospitalId);
  if (params.search) query.append("search", params.search);

  const qs = query.toString();
  const url = `/sla/records${qs ? `?${qs}` : ""}`;

  return api.get<GetSlaRecordsResponse>(url, { auth: true });
}

/**
 * Fetch single SLA record details.
 */
export async function getSlaById(id: string): Promise<PatientServiceSla> {
  const res = await api.get<GetSlaDetailsResponse>(
    `/sla/records/${encodeURIComponent(id)}`,
    {
      auth: true,
    },
  );
  if (!res?.success || !res?.sla) {
    throw new Error("Failed to load SLA details");
  }
  return res.sla;
}

/**
 * Fetch authoritative dashboard KPI metrics.
 */
export async function getSlaKpis(
  hospitalId?: string,
): Promise<PatientServiceSlaKpiSummary> {
  const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  const res = await api.get<GetSlaKpisResponse>(`/sla/kpis${qs}`, {
    auth: true,
  });
  if (!res?.success || !res?.kpis) {
    throw new Error("Failed to load SLA KPIs");
  }
  return res.kpis;
}

/**
 * Fetch active SLA policies.
 */
export async function getSlaPolicies(
  hospitalId?: string,
): Promise<ServiceSlaPolicy[]> {
  const qs = hospitalId ? `?hospitalId=${encodeURIComponent(hospitalId)}` : "";
  const res = await api.get<GetSlaPoliciesResponse>(`/sla/policies${qs}`, {
    auth: true,
  });
  if (!res?.success || !res?.policies) {
    throw new Error("Failed to load SLA policies");
  }
  return res.policies;
}

/**
 * Create or update an SLA policy (Super Admin only).
 */
export async function createOrUpdatePolicy(
  payload: Partial<ServiceSlaPolicy>,
): Promise<ServiceSlaPolicy> {
  const res = await api.post<{ success: boolean; policy: ServiceSlaPolicy }>(
    "/sla/policies",
    payload,
    { auth: true },
  );
  if (!res?.success || !res?.policy) {
    throw new Error("Failed to save SLA policy");
  }
  return res.policy;
}

/**
 * Manually escalate an SLA record.
 */
export async function manualEscalateSla(
  id: string,
  reason: string,
): Promise<PatientServiceSla> {
  const res = await api.post<{ success: boolean; sla: PatientServiceSla }>(
    `/sla/records/${encodeURIComponent(id)}/escalate`,
    { reason },
    { auth: true },
  );
  if (!res?.success || !res?.sla) {
    throw new Error("Failed to escalate SLA");
  }
  return res.sla;
}

/**
 * Fetch patient-safe service progress status for an appointment.
 */
export async function getPatientAppointmentSla(
  appointmentId: string,
): Promise<PatientSafeSlaStatus> {
  const res = await api.get<{ success: boolean; data: PatientSafeSlaStatus }>(
    `/sla/patient/appointment/${encodeURIComponent(appointmentId)}`,
    { auth: true },
  );
  if (!res?.success || !res?.data) {
    throw new Error("Failed to load patient service status");
  }
  return res.data;
}
