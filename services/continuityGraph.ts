/**
 * HealPoint — Smart Healthcare Continuity Graph Service
 *
 * Type-safe API client for retrieving server-authorized healthcare continuity
 * graph relationships, encounter sub-graphs, and AI relational facts.
 */
import { api } from "./api";
import type {
  ContinuityAiContextResponse,
  ContinuityCategory,
  ContinuityGraphResponse,
  ContinuityGraphStats,
  ContinuityNextAction,
  ContinuityTimeframe,
} from "@/types";

export interface GetContinuityGraphOptions {
  familyMemberId?: string | null;
  timeframe?: ContinuityTimeframe;
  category?: ContinuityCategory;
  appointmentId?: string | null;
  limit?: number;
}

/**
 * Fetch the server-authorized continuity graph for the authenticated user.
 */
export async function getContinuityGraph(
  options: GetContinuityGraphOptions = {},
): Promise<ContinuityGraphResponse> {
  const query = new URLSearchParams();

  if (options.familyMemberId && options.familyMemberId !== "all") {
    query.set("familyMemberId", options.familyMemberId);
  }
  if (options.timeframe && options.timeframe !== "ALL") {
    query.set("timeframe", options.timeframe);
  }
  if (options.category && options.category !== "all") {
    query.set("category", options.category);
  }
  if (options.appointmentId) {
    query.set("appointmentId", options.appointmentId);
  }
  if (options.limit) {
    query.set("limit", String(options.limit));
  }

  const qs = query.toString();
  return api.get<ContinuityGraphResponse>(
    `/continuity-graph${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Fetch encounter-specific sub-graph around an appointment.
 */
export async function getEncounterGraph(
  appointmentId: string,
): Promise<ContinuityGraphResponse> {
  return api.get<ContinuityGraphResponse>(
    `/continuity-graph/encounter/${encodeURIComponent(appointmentId)}`,
    { auth: true },
  );
}

/**
 * Fetch factual relationship statements synthesized from the graph for the AI assistant.
 */
export async function getContinuityAiContext(): Promise<ContinuityAiContextResponse> {
  return api.get<ContinuityAiContextResponse>("/continuity-graph/ai-context", {
    auth: true,
  });
}

/**
 * Fetch summary continuity stats.
 */
export async function getContinuityStats(): Promise<{
  success: boolean;
  stats: ContinuityGraphStats;
  focus: {
    focusNodeId: string | null;
    nextAction: ContinuityNextAction | null;
  };
}> {
  return api.get<{
    success: boolean;
    stats: ContinuityGraphStats;
    focus: {
      focusNodeId: string | null;
      nextAction: ContinuityNextAction | null;
    };
  }>("/continuity-graph/stats", { auth: true });
}
