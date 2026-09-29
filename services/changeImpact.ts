/**
 * HealPoint — Change Impact & Dependency Service
 *
 * Provides type-safe client APIs for evaluating dependency impact,
 * previewing changes, submitting controlled change requests, and safe application.
 */
import { api } from "./api";
import type {
  ChangeRequest,
  ChangeImpactReport,
  ChangeGovernanceKpis,
  CandidateTargets,
  ChangeType,
  ChangeTargetType,
  ChangeStatus,
  DependencyCountLevel,
} from "@/types";

export interface GetChangeRequestsParams {
  status?: ChangeStatus | string;
  changeType?: ChangeType | string;
  targetType?: ChangeTargetType | string;
  dependencyCountLevel?: DependencyCountLevel | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetChangeRequestsResponse {
  success: boolean;
  requests: ChangeRequest[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export interface GetChangeRequestDetailResponse {
  success: boolean;
  request: ChangeRequest;
}

export interface GetChangeGovernanceKpisResponse {
  success: boolean;
  kpis: ChangeGovernanceKpis;
}

export interface GetTargetCandidatesResponse {
  success: boolean;
  targets: CandidateTargets;
}

export interface PreviewChangeImpactPayload {
  changeType: ChangeType;
  targetType: ChangeTargetType;
  targetId: string;
  proposedState: Record<string, unknown>;
  hospitalId?: string | null;
}

export interface PreviewChangeImpactResponse {
  success: boolean;
  report: ChangeImpactReport;
}

export interface CreateChangeRequestPayload {
  changeType: ChangeType;
  targetType: ChangeTargetType;
  targetId: string;
  proposedState: Record<string, unknown>;
  reason: string;
  scope?: "global" | "hospital";
  hospitalId?: string | null;
}

export interface CreateChangeRequestResponse {
  success: boolean;
  message: string;
  request: ChangeRequest;
}

export interface ApplyChangeRequestPayload {
  overrideReason?: string;
}

export interface ApplyChangeRequestResponse {
  success: boolean;
  message: string;
  request: ChangeRequest;
}

export interface RejectChangeRequestPayload {
  reason: string;
}

export interface RejectChangeRequestResponse {
  success: boolean;
  message: string;
  request: ChangeRequest;
}

/**
 * Fetch operational KPIs for the change governance console
 */
export async function getChangeGovernanceKpis(): Promise<ChangeGovernanceKpis> {
  const res = await api.get<GetChangeGovernanceKpisResponse>(
    "/change-governance/kpis",
    { auth: true },
  );
  return res.kpis;
}

/**
 * Fetch candidate target entities for dropdown selectors
 */
export async function getTargetCandidates(): Promise<CandidateTargets> {
  const res = await api.get<GetTargetCandidatesResponse>(
    "/change-governance/targets",
    { auth: true },
  );
  return res.targets;
}

/**
 * Fetch change requests with optional filters and pagination
 */
export async function getChangeRequests(
  params: GetChangeRequestsParams = {},
): Promise<GetChangeRequestsResponse> {
  const queryParts: string[] = [];
  if (params.status && params.status !== "all") {
    queryParts.push(`status=${encodeURIComponent(params.status)}`);
  }
  if (params.changeType && params.changeType !== "all") {
    queryParts.push(`changeType=${encodeURIComponent(params.changeType)}`);
  }
  if (params.targetType && params.targetType !== "all") {
    queryParts.push(`targetType=${encodeURIComponent(params.targetType)}`);
  }
  if (params.dependencyCountLevel && params.dependencyCountLevel !== "all") {
    queryParts.push(
      `dependencyCountLevel=${encodeURIComponent(params.dependencyCountLevel)}`,
    );
  }
  if (params.search) {
    queryParts.push(`search=${encodeURIComponent(params.search)}`);
  }
  if (params.page) {
    queryParts.push(`page=${encodeURIComponent(params.page)}`);
  }
  if (params.limit) {
    queryParts.push(`limit=${encodeURIComponent(params.limit)}`);
  }

  const queryString = queryParts.length ? `?${queryParts.join("&")}` : "";
  return api.get<GetChangeRequestsResponse>(
    `/change-governance/requests${queryString}`,
    { auth: true },
  );
}

/**
 * Fetch full details of a single change request
 */
export async function getChangeRequestDetail(
  changeId: string,
): Promise<ChangeRequest> {
  const res = await api.get<GetChangeRequestDetailResponse>(
    `/change-governance/requests/${changeId}`,
    { auth: true },
  );
  return res.request;
}

/**
 * Strictly dry-run impact evaluation before creating or committing changes
 */
export async function previewChangeImpact(
  payload: PreviewChangeImpactPayload,
): Promise<ChangeImpactReport> {
  const res = await api.post<PreviewChangeImpactResponse>(
    "/change-governance/preview",
    payload,
    { auth: true },
  );
  return res.report;
}

/**
 * Create a new controlled change request
 */
export async function createChangeRequest(
  payload: CreateChangeRequestPayload,
): Promise<ChangeRequest> {
  const res = await api.post<CreateChangeRequestResponse>(
    "/change-governance/requests",
    payload,
    { auth: true },
  );
  return res.request;
}

/**
 * Apply an approved change request with stale preview and validation check enforcement
 */
export async function applyChangeRequest(
  changeId: string,
  payload: ApplyChangeRequestPayload = {},
): Promise<ChangeRequest> {
  const res = await api.post<ApplyChangeRequestResponse>(
    `/change-governance/requests/${changeId}/apply`,
    payload,
    { auth: true },
  );
  return res.request;
}

/**
 * Reject a change request
 */
export async function rejectChangeRequest(
  changeId: string,
  payload: RejectChangeRequestPayload,
): Promise<ChangeRequest> {
  const res = await api.post<RejectChangeRequestResponse>(
    `/change-governance/requests/${changeId}/reject`,
    payload,
    { auth: true },
  );
  return res.request;
}
