/**
 * HealPoint — Business Continuity & Failover Readiness Service
 *
 * Provides type-safe client APIs for live dependency health maps,
 * failover readiness, continuity modes, recovery queue triage, and disaster runbooks.
 */
import { api } from "./api";
import type {
  ContinuityOverview,
  CriticalDependency,
  RecoveryRunbook,
  RecoveryQueueItem,
  ContinuityMode,
  RecoveryVerificationResult,
} from "@/types";

export interface GetDependenciesResponse {
  success: boolean;
  count: number;
  data: CriticalDependency[];
}

export interface GetRunbooksResponse {
  success: boolean;
  count: number;
  data: RecoveryRunbook[];
}

export interface GetRecoveryQueueParams {
  state?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetRecoveryQueueResponse {
  success: boolean;
  items: RecoveryQueueItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ExecuteRecoveryActionPayload {
  actionType: "RETRY_QUEUE_ITEM" | "MARK_MANUAL_REVIEW" | "DISMISS_RECOVERY_ITEM" | "SET_SERVICE_OVERRIDE";
  targetId?: string;
  payload?: {
    reason?: string;
    serviceKey?: string;
    manualState?: string;
    notes?: string;
  };
}

export interface ExecuteRecoveryActionResponse {
  success: boolean;
  message: string;
  result: Record<string, unknown>;
}

export interface ChangeContinuityModePayload {
  mode: ContinuityMode;
  reason: string;
}

export interface ChangeContinuityModeResponse {
  success: boolean;
  message: string;
  result: {
    previousMode: ContinuityMode;
    newMode: ContinuityMode;
    reason: string;
    changedAt: string;
  };
}

export interface VerifyRecoveryResponse {
  success: boolean;
  message: string;
  data: {
    targetService: string;
    allHealthy: boolean;
    verifiedCount: number;
    results: RecoveryVerificationResult[];
    timestamp: string;
  };
}

export const businessContinuityService = {
  /**
   * Get high-level overview & KPIs
   */
  async getOverview(): Promise<ContinuityOverview> {
    const res = await api.get<{ success: boolean; data: ContinuityOverview }>(
      "/api/v1/business-continuity/overview"
    );
    return res.data;
  },

  /**
   * Get critical dependency map with real health probes & failover state
   */
  async getDependencies(): Promise<CriticalDependency[]> {
    const res = await api.get<GetDependenciesResponse>(
      "/api/v1/business-continuity/dependencies"
    );
    return res.data;
  },

  /**
   * Get 10 production-grade disaster recovery & failover runbooks
   */
  async getRunbooks(params?: { category?: string; serviceKey?: string }): Promise<RecoveryRunbook[]> {
    const query = new URLSearchParams();
    if (params?.category) query.append("category", params.category);
    if (params?.serviceKey) query.append("serviceKey", params.serviceKey);

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const res = await api.get<GetRunbooksResponse>(
      `/api/v1/business-continuity/runbooks${queryString}`
    );
    return res.data;
  },

  /**
   * Query recovery queue items
   */
  async getRecoveryQueue(params?: GetRecoveryQueueParams): Promise<GetRecoveryQueueResponse> {
    const query = new URLSearchParams();
    if (params?.state) query.append("state", params.state);
    if (params?.category) query.append("category", params.category);
    if (params?.search) query.append("search", params.search);
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));

    const queryString = query.toString() ? `?${query.toString()}` : "";
    const res = await api.get<GetRecoveryQueueResponse>(
      `/api/v1/business-continuity/recovery-queue${queryString}`
    );
    return res;
  },

  /**
   * Execute safe recovery action
   */
  async executeRecoveryAction(
    actionType: "RETRY_QUEUE_ITEM" | "MARK_MANUAL_REVIEW" | "DISMISS_RECOVERY_ITEM" | "SET_SERVICE_OVERRIDE",
    targetId?: string,
    payload?: { reason?: string; serviceKey?: string; manualState?: string; notes?: string }
  ): Promise<ExecuteRecoveryActionResponse> {
    return api.post<ExecuteRecoveryActionResponse>(
      "/api/v1/business-continuity/action",
      {
        actionType,
        targetId,
        payload,
      }
    );
  },

  /**
   * Update platform-wide continuity mode
   */
  async changeContinuityMode(payload: ChangeContinuityModePayload): Promise<ChangeContinuityModeResponse> {
    return api.post<ChangeContinuityModeResponse>(
      "/api/v1/business-continuity/mode",
      payload
    );
  },

  /**
   * Run post-recovery verification
   */
  async verifyRecovery(serviceKey?: string): Promise<VerifyRecoveryResponse> {
    return api.post<VerifyRecoveryResponse>(
      "/api/v1/business-continuity/verify",
      { serviceKey }
    );
  },
};

export default businessContinuityService;

