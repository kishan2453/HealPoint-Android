/**
 * HealPoint — Production Readiness & Release Governance Service
 *
 * Provides type-safe client APIs for live production readiness evaluation,
 * release candidate snapshots, approvals, deployments, and post-release verifications.
 */
import { api } from "./api";
import type {
  ReleaseCandidate,
  ReleaseGate,
  ReleaseGovernanceKpis,
  LiveReadinessReport,
  ReleaseStatus,
} from "@/types";

export interface GetReleaseCandidatesParams {
  status?: ReleaseStatus | string;
  targetEnvironment?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetReleaseCandidatesResponse {
  success: boolean;
  candidates: ReleaseCandidate[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export interface GetReleaseCandidateDetailResponse {
  success: boolean;
  candidate: ReleaseCandidate;
}

export interface GetReleaseGovernanceKpisResponse {
  success: boolean;
  kpis: ReleaseGovernanceKpis;
}

export interface GetLiveReadinessReportResponse {
  success: boolean;
  report: LiveReadinessReport;
}

export interface CreateReleaseCandidatePayload {
  version: string;
  targetEnvironment?: "production" | "staging" | "preview";
  approvalNotes?: string;
}

export interface CreateReleaseCandidateResponse {
  success: boolean;
  message: string;
  candidate: ReleaseCandidate;
}

export interface ApproveReleaseCandidatePayload {
  approvalNotes?: string;
}

export interface ApproveReleaseCandidateResponse {
  success: boolean;
  message: string;
  candidate: ReleaseCandidate;
}

export interface RejectReleaseCandidatePayload {
  rejectionReason: string;
}

export interface RejectReleaseCandidateResponse {
  success: boolean;
  message: string;
  candidate: ReleaseCandidate;
}

export interface DeployReleaseCandidateResponse {
  success: boolean;
  message: string;
  candidate: ReleaseCandidate;
}

export interface VerifyPostDeploymentResponse {
  success: boolean;
  message: string;
  candidate: ReleaseCandidate;
}

/**
 * Fetch operational KPIs for the release governance console
 */
export async function getReleaseGovernanceKpis(): Promise<ReleaseGovernanceKpis> {
  const res = await api.get<GetReleaseGovernanceKpisResponse>(
    "/release-governance/kpis",
    { auth: true },
  );
  return res.kpis;
}

/**
 * Run live, real-time readiness probes across all 16 readiness areas
 */
export async function getLiveReadinessReport(): Promise<LiveReadinessReport> {
  const res = await api.get<GetLiveReadinessReportResponse>(
    "/release-governance/live-readiness",
    { auth: true },
  );
  return res.report;
}

/**
 * Fetch release candidates with optional filters and pagination
 */
export async function getReleaseCandidates(
  params: GetReleaseCandidatesParams = {},
): Promise<GetReleaseCandidatesResponse> {
  const queryParts: string[] = [];
  if (params.status && params.status !== "all") {
    queryParts.push(`status=${encodeURIComponent(params.status)}`);
  }
  if (params.targetEnvironment && params.targetEnvironment !== "all") {
    queryParts.push(
      `targetEnvironment=${encodeURIComponent(params.targetEnvironment)}`,
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
  return api.get<GetReleaseCandidatesResponse>(
    `/release-governance/candidates${queryString}`,
    { auth: true },
  );
}

/**
 * Fetch full details of a single release candidate snapshot
 */
export async function getReleaseCandidateDetail(
  releaseId: string,
): Promise<ReleaseCandidate> {
  const res = await api.get<GetReleaseCandidateDetailResponse>(
    `/release-governance/candidates/${releaseId}`,
    { auth: true },
  );
  return res.candidate;
}

/**
 * Freeze and create a point-in-time release candidate snapshot
 */
export async function createReleaseCandidate(
  payload: CreateReleaseCandidatePayload,
): Promise<ReleaseCandidate> {
  const res = await api.post<CreateReleaseCandidateResponse>(
    "/release-governance/candidates",
    payload,
    { auth: true },
  );
  return res.candidate;
}

/**
 * Approve a release candidate for production deployment
 */
export async function approveReleaseCandidate(
  releaseId: string,
  payload: ApproveReleaseCandidatePayload = {},
): Promise<ReleaseCandidate> {
  const res = await api.post<ApproveReleaseCandidateResponse>(
    `/release-governance/candidates/${releaseId}/approve`,
    payload,
    { auth: true },
  );
  return res.candidate;
}

/**
 * Reject a release candidate with a mandatory justification reason
 */
export async function rejectReleaseCandidate(
  releaseId: string,
  payload: RejectReleaseCandidatePayload,
): Promise<ReleaseCandidate> {
  const res = await api.post<RejectReleaseCandidateResponse>(
    `/release-governance/candidates/${releaseId}/reject`,
    payload,
    { auth: true },
  );
  return res.candidate;
}

/**
 * Mark release candidate as deployed to the target environment
 */
export async function deployReleaseCandidate(
  releaseId: string,
): Promise<ReleaseCandidate> {
  const res = await api.post<DeployReleaseCandidateResponse>(
    `/release-governance/candidates/${releaseId}/deploy`,
    {},
    { auth: true },
  );
  return res.candidate;
}

/**
 * Run post-deployment live verification checks against release snapshot
 */
export async function verifyPostDeployment(
  releaseId: string,
): Promise<ReleaseCandidate> {
  const res = await api.post<VerifyPostDeploymentResponse>(
    `/release-governance/candidates/${releaseId}/verify-post-deploy`,
    {},
    { auth: true },
  );
  return res.candidate;
}
