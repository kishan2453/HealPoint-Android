/**
 * HealPoint — Workflow Automation Service
 *
 * Provides type-safe client APIs for managing automation rules, querying execution traces,
 * manual retries, dry-run event simulations, and system metrics.
 */

import { api } from "./api";
import type {
  WorkflowAutomationRule,
  WorkflowAutomationExecution,
  WorkflowAutomationStats,
  WorkflowSimulationResult,
  WorkflowAutomationCategory,
  WorkflowExecutionStatus,
  WorkflowErrorType,
} from "@/types";

export interface GetAutomationRulesParams {
  category?: WorkflowAutomationCategory | string;
  scope?: "global" | "hospital" | string;
  isEnabled?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetAutomationRulesResponse {
  success: boolean;
  rules: WorkflowAutomationRule[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GetAutomationRuleResponse {
  success: boolean;
  rule: WorkflowAutomationRule;
}

export interface GetAutomationExecutionsParams {
  status?: WorkflowExecutionStatus | string;
  ruleId?: string;
  eventType?: string;
  errorType?: WorkflowErrorType | string;
  isDryRun?: boolean;
  page?: number;
  limit?: number;
}

export interface GetAutomationExecutionsResponse {
  success: boolean;
  executions: WorkflowAutomationExecution[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GetAutomationExecutionResponse {
  success: boolean;
  execution: WorkflowAutomationExecution;
}

export interface GetAutomationMetricsResponse {
  success: boolean;
  metrics: WorkflowAutomationStats;
}

export interface SimulateAutomationResponse {
  success: boolean;
  simulation: WorkflowSimulationResult;
}

export interface RetryExecutionResponse {
  success: boolean;
  message: string;
  execution: WorkflowAutomationExecution;
}

/**
 * Fetch overview KPIs for the automation dashboard
 */
export async function getAutomationMetrics(): Promise<WorkflowAutomationStats> {
  const res = await api.get<GetAutomationMetricsResponse>(
    "/automation/metrics",
    {
      auth: true,
    },
  );
  return res.metrics;
}

/**
 * Fetch paginated list of workflow automation rules
 */
export async function getAutomationRules(
  params: GetAutomationRulesParams = {},
): Promise<GetAutomationRulesResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.category && params.category !== "all")
    query.append("category", params.category);
  if (params.scope && params.scope !== "all")
    query.append("scope", params.scope);
  if (params.isEnabled !== undefined)
    query.append("isEnabled", String(params.isEnabled));
  if (params.search) query.append("search", params.search);

  const qs = query.toString();
  return api.get<GetAutomationRulesResponse>(
    `/automation/rules${qs ? `?${qs}` : ""}`,
    {
      auth: true,
    },
  );
}

/**
 * Fetch single rule details
 */
export async function getAutomationRuleById(
  id: string,
): Promise<WorkflowAutomationRule> {
  const res = await api.get<GetAutomationRuleResponse>(
    `/automation/rules/${encodeURIComponent(id)}`,
    { auth: true },
  );
  return res.rule;
}

/**
 * Quick toggle enable/disable of an automation rule
 */
export async function toggleAutomationRule(
  id: string,
): Promise<{ isEnabled: boolean; rule: WorkflowAutomationRule }> {
  return api.patch<{
    isEnabled: boolean;
    rule: WorkflowAutomationRule;
    success: boolean;
  }>(`/automation/rules/${encodeURIComponent(id)}/toggle`, {}, { auth: true });
}

/**
 * Fetch paginated execution audit history
 */
export async function getAutomationExecutions(
  params: GetAutomationExecutionsParams = {},
): Promise<GetAutomationExecutionsResponse> {
  const query = new URLSearchParams();
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.status && params.status !== "all")
    query.append("status", params.status);
  if (params.ruleId) query.append("ruleId", params.ruleId);
  if (params.eventType) query.append("eventType", params.eventType);
  if (params.errorType && params.errorType !== "all")
    query.append("errorType", params.errorType);
  if (params.isDryRun !== undefined)
    query.append("isDryRun", String(params.isDryRun));

  const qs = query.toString();
  return api.get<GetAutomationExecutionsResponse>(
    `/automation/executions${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Fetch single execution trace detail
 */
export async function getAutomationExecutionById(
  id: string,
): Promise<WorkflowAutomationExecution> {
  const res = await api.get<GetAutomationExecutionResponse>(
    `/automation/executions/${encodeURIComponent(id)}`,
    { auth: true },
  );
  return res.execution;
}

/**
 * Manually retry a failed or dead-letter execution
 */
export async function retryAutomationExecution(
  executionId: string,
): Promise<WorkflowAutomationExecution> {
  const res = await api.post<RetryExecutionResponse>(
    `/automation/executions/${encodeURIComponent(executionId)}/retry`,
    {},
    { auth: true },
  );
  return res.execution;
}

/**
 * Run a dry-run event simulation through the rules engine
 */
export async function simulateAutomationEvent(payload: {
  eventType: string;
  entityType?: string;
  entityId?: string;
  hospitalId?: string | null;
  patientId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<WorkflowSimulationResult> {
  const res = await api.post<SimulateAutomationResponse>(
    "/automation/simulate",
    payload,
    {
      auth: true,
    },
  );
  return res.simulation;
}
