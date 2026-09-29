/**
 * Smart Healthcare Interoperability & Secure Data Exchange Service.
 * Connects to /api/v1/interoperability endpoints.
 */
import { api } from "./api";
import type {
  ExternalHealthcareSystem,
  InteroperabilityExchange,
  InteroperabilityMapping,
  InteroperabilityStats,
  PatientExchangeHistoryItem,
} from "@/types";

export interface SystemsResponse {
  success: boolean;
  systems: ExternalHealthcareSystem[];
  count: number;
}

export interface RegisterSystemPayload {
  systemKey: string;
  name: string;
  systemType: string;
  organization: string;
  environment?: string;
  integrationVersion?: string;
  authType?: string;
  endpointUrl?: string;
  healthCheckUrl?: string;
  rawCredential?: string;
  supportedResources?: string[];
  supportedDirections?: string;
  isGlobal?: boolean;
  notes?: string;
}

export interface ExchangesResponse {
  success: boolean;
  exchanges: InteroperabilityExchange[];
  total: number;
  page: number;
  pages: number;
}

export interface FailedExchangesResponse {
  success: boolean;
  failedExchanges: InteroperabilityExchange[];
  count: number;
}

export interface MappingsResponse {
  success: boolean;
  mappings: InteroperabilityMapping[];
}

export interface StatsResponse {
  success: boolean;
  stats: InteroperabilityStats;
}

export interface PatientHistoryResponse {
  success: boolean;
  exchangeHistory: PatientExchangeHistoryItem[];
}

// ---------------------------------------------------------------------------
// SUPER ADMIN ENDPOINTS
// ---------------------------------------------------------------------------

export async function getSystemRegistry(
  params: {
    systemType?: string;
    connectionStatus?: string;
    environment?: string;
  } = {},
): Promise<SystemsResponse> {
  const query = new URLSearchParams();
  if (params.systemType && params.systemType !== "All")
    query.set("systemType", params.systemType);
  if (params.connectionStatus && params.connectionStatus !== "All")
    query.set("connectionStatus", params.connectionStatus);
  if (params.environment && params.environment !== "All")
    query.set("environment", params.environment);
  const qs = query.toString();

  return api.get<SystemsResponse>(
    `/interoperability/systems${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

export async function registerExternalSystem(
  payload: RegisterSystemPayload,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    "/interoperability/systems",
    payload,
    { auth: true },
  );
}

export async function updateExternalSystem(
  id: string,
  payload: {
    connectionStatus?: string;
    name?: string;
    endpointUrl?: string;
    healthCheckUrl?: string;
    rawCredential?: string;
    notes?: string;
  },
): Promise<{
  success: boolean;
  message: string;
  system: ExternalHealthcareSystem;
}> {
  return api.patch<{
    success: boolean;
    message: string;
    system: ExternalHealthcareSystem;
  }>(`/interoperability/systems/${id}`, payload, { auth: true });
}

export async function pingExternalSystem(id: string): Promise<{
  success: boolean;
  healthResult: {
    status: "healthy" | "unhealthy" | "unreachable" | "pending";
    latencyMs: number;
    statusCode?: number;
    message: string;
  };
}> {
  return api.post(`/interoperability/systems/${id}/ping`, {}, { auth: true });
}

export async function getMappings(): Promise<MappingsResponse> {
  return api.get<MappingsResponse>("/interoperability/mappings", {
    auth: true,
  });
}

export async function getAllExchanges(
  params: {
    status?: string;
    direction?: string;
    resourceType?: string;
    systemKey?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<ExchangesResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "All")
    query.set("status", params.status);
  if (params.direction && params.direction !== "All")
    query.set("direction", params.direction);
  if (params.resourceType && params.resourceType !== "All")
    query.set("resourceType", params.resourceType);
  if (params.systemKey && params.systemKey !== "All")
    query.set("systemKey", params.systemKey);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return api.get<ExchangesResponse>(
    `/interoperability/exchanges${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

export async function getFailedExchanges(): Promise<FailedExchangesResponse> {
  return api.get<FailedExchangesResponse>(
    "/interoperability/exchanges/failed",
    { auth: true },
  );
}

export async function retryExchange(
  exchangeId: string,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `/interoperability/exchanges/${exchangeId}/retry`,
    {},
    { auth: true },
  );
}

export async function getInteroperabilityStats(): Promise<StatsResponse> {
  return api.get<StatsResponse>("/interoperability/stats", { auth: true });
}

// ---------------------------------------------------------------------------
// HOSPITAL ADMIN ENDPOINTS
// ---------------------------------------------------------------------------

export async function getHospitalExchanges(
  params: {
    status?: string;
    direction?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<ExchangesResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "All")
    query.set("status", params.status);
  if (params.direction && params.direction !== "All")
    query.set("direction", params.direction);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return api.get<ExchangesResponse>(
    `/interoperability/hospital/exchanges${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

export async function exportHospitalPackage(payload: {
  externalSystemId: string;
  patientId: string;
  familyMemberId?: string;
  dataScope: string[];
}): Promise<{
  success: boolean;
  exchangeId: string;
  message?: string;
  payloadPreview?: {
    patientName: string;
    recordsCount: number;
    exchangedAt: string;
  };
}> {
  return api.post("/interoperability/hospital/export", payload, { auth: true });
}

// ---------------------------------------------------------------------------
// PATIENT ENDPOINTS
// ---------------------------------------------------------------------------

export async function getPatientExchangeHistory(): Promise<PatientHistoryResponse> {
  return api.get<PatientHistoryResponse>("/interoperability/patient/history", {
    auth: true,
  });
}
