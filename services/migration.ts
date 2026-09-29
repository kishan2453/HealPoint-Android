/**
 * Smart Data Migration & Environment Management API Service.
 * Connects to backend /environment endpoints.
 */
import { api } from "./api";
import type {
  DatabaseCollectionsResponse,
  DataMigrationRecord,
  EnvironmentOverviewResponse,
  MigrationHistoryResponse,
  MigrationPreviewResponse,
  RegisteredMigrationsResponse,
} from "@/types";

export interface GetMigrationHistoryParams {
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch environment overview, versions, configuration health, and mismatch warnings.
 */
export async function getEnvironmentOverview(): Promise<EnvironmentOverviewResponse> {
  return api.get<EnvironmentOverviewResponse>("/environment/overview", {
    auth: true,
  });
}

/**
 * Fetch registered versioned migrations with current status.
 */
export async function getRegisteredMigrations(): Promise<RegisteredMigrationsResponse> {
  return api.get<RegisteredMigrationsResponse>("/environment/migrations", {
    auth: true,
  });
}

/**
 * Fetch chronological migration history.
 */
export async function getMigrationHistory(
  params: GetMigrationHistoryParams = {},
): Promise<MigrationHistoryResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (params.category && params.category !== "all")
    query.set("category", params.category);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return api.get<MigrationHistoryResponse>(
    `/environment/migrations/history${qs ? `?${qs}` : ""}`,
    { auth: true },
  );
}

/**
 * Preview migration before execution.
 */
export async function previewMigration(
  version: string,
): Promise<MigrationPreviewResponse> {
  return api.get<MigrationPreviewResponse>(
    `/environment/migrations/${version}/preview`,
    { auth: true },
  );
}

/**
 * Execute registered versioned migration.
 */
export async function executeMigration(version: string): Promise<{
  success: boolean;
  message: string;
  migration: DataMigrationRecord;
  summary: string;
}> {
  return api.post(
    `/environment/migrations/${version}/execute`,
    {},
    { auth: true },
  );
}

/**
 * Get live database collections and index status.
 */
export async function getDatabaseCollections(): Promise<DatabaseCollectionsResponse> {
  return api.get<DatabaseCollectionsResponse>("/environment/collections", {
    auth: true,
  });
}
