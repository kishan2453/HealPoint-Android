/**
 * System Observability & Reliability API Service.
 * Connects to backend /settings and /settings/observability endpoints.
 */
import { api } from "./api";
import type {
  ApiTelemetrySummary,
  ErrorsResponse,
  IncidentsResponse,
  SystemHealthResponse,
  SystemIncident,
} from "@/types";

export interface GetIncidentsParams {
  status?: "all" | "active" | "resolved";
  service?: string;
  severity?: string;
  page?: number;
  limit?: number;
}

export interface GetErrorsParams {
  service?: string;
  errorCategory?: string;
  statusCode?: string | number;
  correlationId?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch comprehensive real-time system health and 12-subsystem status.
 */
export async function getSystemHealth(): Promise<SystemHealthResponse> {
  return api.get<SystemHealthResponse>("/settings/system-health", {
    auth: true,
  });
}

/**
 * Fetch real-time API telemetry metrics.
 */
export async function getApiTelemetry(): Promise<{
  success: boolean;
  telemetry: ApiTelemetrySummary;
}> {
  return api.get<{ success: boolean; telemetry: ApiTelemetrySummary }>(
    "/settings/observability/telemetry",
    {
      auth: true,
    },
  );
}

/**
 * Fetch paginated operational incidents.
 */
export async function getSystemIncidents(
  params: GetIncidentsParams = {},
): Promise<IncidentsResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (params.service && params.service !== "all")
    query.set("service", params.service);
  if (params.severity && params.severity !== "all")
    query.set("severity", params.severity);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return api.get<IncidentsResponse>(
    `/settings/observability/incidents${qs ? `?${qs}` : ""}`,
    {
      auth: true,
    },
  );
}

/**
 * Acknowledge an active operational incident.
 */
export async function acknowledgeIncident(
  id: string,
): Promise<{ success: boolean; incident: SystemIncident }> {
  return api.patch<{ success: boolean; incident: SystemIncident }>(
    `/settings/observability/incidents/${id}/acknowledge`,
    {},
    { auth: true },
  );
}

/**
 * Resolve an operational incident with administrator notes.
 */
export async function resolveIncident(
  id: string,
  notes: string,
): Promise<{ success: boolean; incident: SystemIncident }> {
  return api.patch<{ success: boolean; incident: SystemIncident }>(
    `/settings/observability/incidents/${id}/resolve`,
    { resolutionNotes: notes },
    { auth: true },
  );
}

/**
 * Fetch paginated operational error log records.
 */
export async function getSystemErrors(
  params: GetErrorsParams = {},
): Promise<ErrorsResponse> {
  const query = new URLSearchParams();
  if (params.service && params.service !== "all")
    query.set("service", params.service);
  if (params.errorCategory && params.errorCategory !== "all")
    query.set("errorCategory", params.errorCategory);
  if (params.statusCode && params.statusCode !== "all")
    query.set("statusCode", String(params.statusCode));
  if (params.correlationId?.trim())
    query.set("correlationId", params.correlationId.trim());
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return api.get<ErrorsResponse>(
    `/settings/observability/errors${qs ? `?${qs}` : ""}`,
    {
      auth: true,
    },
  );
}
