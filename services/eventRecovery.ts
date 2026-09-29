/**
 * HealPoint — Event Replay & Recovery Service
 *
 * Provides type-safe client APIs for inspecting failed production workflow events,
 * dry-run safety validation, authorized replay, and manual review routing.
 */
import { api } from "./api";
import type {
  EventRecoveryRecord,
  EventRecoveryKpis,
  EventReplayValidationResult,
  EventRecoveryState,
  EventFailureCategory,
} from "@/types";

export interface GetRecoveryEventsParams {
  state?: EventRecoveryState | string;
  failureCategory?: EventFailureCategory | string;
  eventType?: string;
  source?: string;
  hospitalId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetRecoveryEventsResponse {
  success: boolean;
  events: EventRecoveryRecord[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GetRecoveryEventDetailResponse {
  success: boolean;
  recovery: EventRecoveryRecord;
}

export interface GetRecoveryKpisResponse {
  success: boolean;
  kpis: EventRecoveryKpis;
}

export interface ValidateReplayResponse {
  success: boolean;
  validation: EventReplayValidationResult;
}

export interface ExecuteReplayResponse {
  success: boolean;
  result: {
    success: boolean;
    state: EventRecoveryState;
    recovery: EventRecoveryRecord;
    executionResult?: unknown;
    error?: string;
  };
}

/**
 * Fetch operational KPIs for the event recovery console
 */
export async function getEventRecoveryKpis(): Promise<EventRecoveryKpis> {
  const res = await api.get<GetRecoveryKpisResponse>("/event-recovery/kpis", {
    auth: true,
  });
  return res.kpis;
}

/**
 * Fetch paginated failed events with filters
 */
export async function getRecoveryEvents(
  params: GetRecoveryEventsParams = {},
): Promise<GetRecoveryEventsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.state && params.state !== "all")
    query.append("state", params.state);
  if (params.failureCategory && params.failureCategory !== "all")
    query.append("failureCategory", params.failureCategory);
  if (params.eventType && params.eventType !== "all")
    query.append("eventType", params.eventType);
  if (params.source && params.source !== "all")
    query.append("source", params.source);
  if (params.hospitalId) query.append("hospitalId", params.hospitalId);
  if (params.search) query.append("search", params.search);

  const qs = query.toString();
  return api.get<GetRecoveryEventsResponse>(
    `/event-recovery/events${qs ? `?${qs}` : ""}`,
    {
      auth: true,
    },
  );
}

/**
 * Fetch deep event detail including verified current business state
 */
export async function getRecoveryEventById(
  id: string,
): Promise<EventRecoveryRecord> {
  const res = await api.get<GetRecoveryEventDetailResponse>(
    `/event-recovery/events/${encodeURIComponent(id)}`,
    { auth: true },
  );
  return res.recovery;
}

/**
 * Perform dry-run replay safety validation without executing side effects
 */
export async function validateEventReplay(
  id: string,
): Promise<EventReplayValidationResult> {
  const res = await api.post<ValidateReplayResponse>(
    `/event-recovery/events/${encodeURIComponent(id)}/validate`,
    {},
    { auth: true },
  );
  return res.validation;
}

/**
 * Safely execute event replay or resolve state with mandatory reason
 */
export async function executeEventReplay(
  id: string,
  payload: { reason: string; actionType?: string },
): Promise<ExecuteReplayResponse["result"]> {
  const res = await api.post<ExecuteReplayResponse>(
    `/event-recovery/events/${encodeURIComponent(id)}/replay`,
    payload,
    { auth: true },
  );
  return res.result;
}

/**
 * Route event to manual review with operator notes
 */
export async function markEventManualReview(
  id: string,
  payload: { notes?: string; reason?: string },
): Promise<EventRecoveryRecord> {
  const res = await api.post<{
    success: boolean;
    recovery: EventRecoveryRecord;
  }>(
    `/event-recovery/events/${encodeURIComponent(id)}/manual-review`,
    payload,
    { auth: true },
  );
  return res.recovery;
}

/**
 * Link event failure to System Incident
 */
export async function linkEventIncidentCase(
  id: string,
  payload: { title?: string; severity?: string; description?: string },
): Promise<{ recovery: EventRecoveryRecord; incident: unknown }> {
  const res = await api.post<{
    success: boolean;
    result: { recovery: EventRecoveryRecord; incident: unknown };
  }>(`/event-recovery/events/${encodeURIComponent(id)}/link-case`, payload, {
    auth: true,
  });
  return res.result;
}

/**
 * Trigger synchronization of failed executions into recovery store
 */
export async function syncFailedExecutions(): Promise<void> {
  await api.post("/event-recovery/sync", {}, { auth: true });
}
