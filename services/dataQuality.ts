/**
 * HealPoint — Smart Healthcare Data Quality & Integrity Service.
 *
 * Provides type-safe client APIs for:
 * - Factual integrity overview metrics & severity tallies
 * - Issue listing with filtering (severity, category, issueType, status, search)
 * - Detailed issue inspection (with candidate comparison and evidence)
 * - Issue status transitions (under review, ignore with reason, reopen)
 * - Background scan triggering (full & targeted)
 * - Live scan progress & historical scans ledger
 * - Safe deterministic automated resolution with verified backup protection
 */
import { api } from "./api";
import type {
  DataQualityFilterParams,
  DataQualityIssue,
  DataQualityOverviewData,
  DataIntegrityScan,
} from "@/types";

/**
 * Retrieves the platform data integrity overview with factual counts.
 */
export async function getIntegrityOverview(): Promise<DataQualityOverviewData> {
  const res = await api.get<{
    success: boolean;
    data: DataQualityOverviewData;
  }>("/data-integrity/overview", { auth: true });

  if (!res?.success || !res?.data) {
    throw new Error("Failed to load integrity overview");
  }
  return res.data;
}

/**
 * Lists data quality issues with search, filter, and pagination support.
 */
export async function listIssues(params?: DataQualityFilterParams): Promise<{
  issues: DataQualityIssue[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const query = new URLSearchParams();
  if (params?.severity) query.append("severity", params.severity);
  if (params?.category) query.append("category", params.category);
  if (params?.issueType) query.append("issueType", params.issueType);
  if (params?.status) query.append("status", params.status);
  if (params?.search) query.append("search", params.search);
  if (params?.page) query.append("page", String(params.page));
  if (params?.limit) query.append("limit", String(params.limit));

  const qs = query.toString();
  const url = `/data-integrity/issues${qs ? `?${qs}` : ""}`;

  const res = await api.get<{
    success: boolean;
    data: {
      issues: DataQualityIssue[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  }>(url, { auth: true });

  if (!res?.success || !res?.data) {
    throw new Error("Failed to load data quality issues");
  }
  return res.data;
}

/**
 * Retrieves full details and evidence payload of a single issue.
 */
export async function getIssueDetail(
  issueId: string,
): Promise<DataQualityIssue> {
  const res = await api.get<{
    success: boolean;
    data: DataQualityIssue;
  }>(`/data-integrity/issues/${encodeURIComponent(issueId)}`, { auth: true });

  if (!res?.success || !res?.data) {
    throw new Error(`Failed to load details for issue ${issueId}`);
  }
  return res.data;
}

/**
 * Updates issue lifecycle state (under_review, ignored with reason, reopened).
 */
export async function updateIssueStatus(
  issueId: string,
  status: "open" | "under_review" | "ignored" | "reopened",
  reason?: string,
  notes?: string,
): Promise<DataQualityIssue> {
  const res = await api.patch<{
    success: boolean;
    data: DataQualityIssue;
    message: string;
  }>(
    `/data-integrity/issues/${encodeURIComponent(issueId)}/status`,
    {
      status,
      reason,
      notes,
    },
    { auth: true },
  );

  if (!res?.success || !res?.data) {
    throw new Error(res?.message || "Failed to update issue status");
  }
  return res.data;
}

/**
 * Triggers a background integrity scan.
 */
export async function triggerScan(
  scanType: "full" | "targeted" = "full",
  targetCategory = "all",
): Promise<{ success: boolean; message: string; status: string }> {
  const res = await api.post<{
    success: boolean;
    message: string;
    status: string;
  }>(
    "/data-integrity/scan",
    {
      scanType,
      targetCategory,
    },
    { auth: true },
  );

  if (!res?.success) {
    throw new Error(res?.message || "Failed to trigger integrity scan");
  }
  return res;
}

/**
 * Checks live scan status.
 */
export async function getScanStatus(
  scanId = "current",
): Promise<DataIntegrityScan> {
  const res = await api.get<{
    success: boolean;
    data: DataIntegrityScan;
  }>(`/data-integrity/scans/status/${encodeURIComponent(scanId)}`, {
    auth: true,
  });

  if (!res?.success || !res?.data) {
    throw new Error("Failed to load scan status");
  }
  return res.data;
}

/**
 * Lists past scan jobs ledger.
 */
export async function listScanHistory(
  page = 1,
  limit = 15,
): Promise<{
  scans: DataIntegrityScan[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const res = await api.get<{
    success: boolean;
    data: {
      scans: DataIntegrityScan[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    };
  }>(`/data-integrity/scans?page=${page}&limit=${limit}`, { auth: true });

  if (!res?.success || !res?.data) {
    throw new Error("Failed to load scan history");
  }
  return res.data;
}

/**
 * Executes deterministic automated safe repair with verified backup pre-flight.
 */
export async function resolveIssueSafe(
  issueId: string,
  reason = "Admin manual safe repair",
): Promise<{ success: boolean; message: string; data: unknown }> {
  const res = await api.post<{
    success: boolean;
    message: string;
    data: unknown;
  }>(
    `/data-integrity/issues/${encodeURIComponent(issueId)}/safe-resolve`,
    {
      reason,
    },
    { auth: true },
  );

  if (!res?.success) {
    throw new Error(res?.message || "Failed to safely resolve issue");
  }
  return res;
}
