/**
 * HealPoint — Smart Patient Data Portability & Health Export Service.
 *
 * Provides type-safe client methods for:
 * - Real-time health data summary & category scoping
 * - Export confirmation preview
 * - Asynchronous export job creation and polling
 * - Secure authenticated package downloads
 * - Controlled time-limited external sharing
 * - Instant share revocation
 * - Transparent access disclosure history
 * - Super Admin platform export monitoring
 */
import { api } from "./api";
import { API_URL } from "@/lib/env";
import type {
  HealthExportCategory,
  HealthExportFormat,
  HealthExportStatus,
  HealthExportJob,
  HealthExportShare,
  ExportDataSummaryResponse,
  ExportPreviewResult,
  ExportAccessHistoryResponse,
  SuperAdminExportMonitoringData,
} from "@/types";

export interface PreviewExportPayload {
  familyMemberId?: string;
  categories: HealthExportCategory[];
  dateRange?: {
    type: "all" | "custom";
    from?: string;
    to?: string;
  };
  format?: HealthExportFormat;
}

export interface CreateExportPayload extends PreviewExportPayload {
  forceNew?: boolean;
}

export interface CreateSharePayload {
  recipientType: "doctor" | "hospital" | "external_system" | "family_member";
  recipientName: string;
  recipientId?: string;
  recipientDetail?: string;
  categories?: HealthExportCategory[];
  expiryDays?: number;
  consentId?: string;
  notes?: string;
}

/**
 * Fetch patient health data summary with live record counts per category.
 */
export async function getMyHealthDataSummary(
  familyMemberId?: string,
): Promise<ExportDataSummaryResponse> {
  const query = familyMemberId
    ? `?familyMemberId=${encodeURIComponent(familyMemberId)}`
    : "";
  const res = await api.get<{
    success: boolean;
    data: ExportDataSummaryResponse;
  }>(`/export/summary${query}`, { auth: true });
  if (!res?.success || !res?.data) {
    throw new Error("Failed to load health data summary.");
  }
  return res.data;
}

/**
 * Request an export scope preview before confirming generation.
 */
export async function previewExportRequest(
  payload: PreviewExportPayload,
): Promise<ExportPreviewResult> {
  const res = await api.post<{
    success: boolean;
    preview: ExportPreviewResult;
  }>("/export/preview", payload, { auth: true });
  if (!res?.success || !res?.preview) {
    throw new Error("Failed to compile export preview.");
  }
  return res.preview;
}

/**
 * Create and queue a new health export compilation job.
 */
export async function createExportJob(payload: CreateExportPayload): Promise<{
  success: boolean;
  exportId: string;
  status: HealthExportStatus;
  isReused?: boolean;
  message: string;
}> {
  const res = await api.post<{
    success: boolean;
    exportId: string;
    status: HealthExportStatus;
    isReused?: boolean;
    message: string;
  }>("/export/create", payload, { auth: true });

  if (!res?.success) {
    throw new Error(res?.message || "Failed to create health export job.");
  }
  return res;
}

/**
 * Poll the compilation status of a health export job.
 */
export async function getExportJobStatus(
  exportId: string,
): Promise<HealthExportJob> {
  const res = await api.get<{ success: boolean; data: HealthExportJob }>(
    `/export/${encodeURIComponent(exportId)}/status`,
    { auth: true },
  );
  if (!res?.success || !res?.data) {
    throw new Error("Failed to retrieve export status.");
  }
  return res.data;
}

/**
 * List the patient's past and active export jobs.
 */
export async function listPatientExports(
  page = 1,
  limit = 10,
  status?: string,
): Promise<{
  data: HealthExportJob[];
  pagination: { total: number; page: number; totalPages: number };
}> {
  let query = `?page=${page}&limit=${limit}`;
  if (status && status !== "all") {
    query += `&status=${encodeURIComponent(status)}`;
  }
  const res = await api.get<{
    success: boolean;
    data: HealthExportJob[];
    pagination: { total: number; page: number; totalPages: number };
  }>(`/export/list${query}`, { auth: true });

  if (!res?.success) {
    throw new Error("Failed to list health exports.");
  }
  return {
    data: res.data || [],
    pagination: res.pagination || { total: 0, page: 1, totalPages: 1 },
  };
}

/**
 * Cancel an in-progress or queued export job.
 */
export async function cancelExportJob(
  exportId: string,
): Promise<{ success: boolean; message: string }> {
  const res = await api.post<{ success: boolean; message: string }>(
    `/export/${encodeURIComponent(exportId)}/cancel`,
    {},
    { auth: true },
  );
  if (!res?.success) {
    throw new Error(res?.message || "Failed to cancel export job.");
  }
  return res;
}

/**
 * Build authorized stream download URL.
 */
export function getExportDownloadEndpoint(exportId: string): string {
  return `${API_URL}/export/${encodeURIComponent(exportId)}/download`;
}

/**
 * Create a secure, time-limited share link for an authorized recipient.
 */
export async function createExportShareLink(
  exportId: string,
  payload: CreateSharePayload,
): Promise<{
  success: boolean;
  data: {
    shareId: string;
    maskedTokenPreview: string;
    recipientName: string;
    expiresAt: string;
    status: string;
  };
  message: string;
}> {
  const res = await api.post<{
    success: boolean;
    data: {
      shareId: string;
      maskedTokenPreview: string;
      recipientName: string;
      expiresAt: string;
      status: string;
    };
    message: string;
  }>(`/export/${encodeURIComponent(exportId)}/share`, payload, { auth: true });

  if (!res?.success) {
    throw new Error(res?.message || "Failed to create export share.");
  }
  return res;
}

/**
 * List patient's active and historical shares.
 */
export async function listPatientShares(): Promise<HealthExportShare[]> {
  const res = await api.get<{ success: boolean; data: HealthExportShare[] }>(
    "/export/shares",
    { auth: true },
  );
  if (!res?.success) {
    throw new Error("Failed to load shares list.");
  }
  return res.data || [];
}

/**
 * Revoke an active share link immediately.
 */
export async function revokePatientShare(
  shareId: string,
  reason?: string,
): Promise<{ success: boolean; message: string }> {
  const res = await api.post<{ success: boolean; message: string }>(
    `/export/shares/${encodeURIComponent(shareId)}/revoke`,
    { reason },
    { auth: true },
  );
  if (!res?.success) {
    throw new Error(res?.message || "Failed to revoke share.");
  }
  return res;
}

/**
 * Retrieve transparent audit history of all exports, downloads, and shares.
 */
export async function getExportAccessHistory(): Promise<ExportAccessHistoryResponse> {
  const res = await api.get<{
    success: boolean;
    data: ExportAccessHistoryResponse;
  }>("/export/access-history", { auth: true });
  if (!res?.success || !res?.data) {
    throw new Error("Failed to retrieve access history.");
  }
  return res.data;
}

/**
 * Super Admin: Retrieve platform-wide export telemetry and security status.
 */
export async function getSuperAdminExportMonitoring(): Promise<SuperAdminExportMonitoringData> {
  const res = await api.get<{
    success: boolean;
    data: SuperAdminExportMonitoringData;
  }>("/export/admin/monitoring", { auth: true });
  if (!res?.success || !res?.data) {
    throw new Error("Failed to load export monitoring metrics.");
  }
  return res.data;
}
