/**
 * Backup, Disaster Recovery & Data Integrity API Service.
 * Connects to backend /backup endpoints.
 */
import { api } from "./api";
import type {
  BackupDetailResponse,
  BackupListResponse,
  BackupOverviewResponse,
  BackupRecord,
  BackupType,
  DataIntegrityResponse,
  RecoveryChecklistResponse,
  RecoveryPreviewResponse,
} from "@/types";

export interface GetBackupsParams {
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch disaster recovery overview and latest backup metrics.
 */
export async function getBackupOverview(): Promise<BackupOverviewResponse> {
  return api.get<BackupOverviewResponse>("/backup/overview", {
    auth: true,
  });
}

/**
 * Fetch paginated list of backup archives.
 */
export async function getBackupsList(
  params: GetBackupsParams = {},
): Promise<BackupListResponse> {
  const query = new URLSearchParams();
  if (params.type && params.type !== "all") query.set("type", params.type);
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return api.get<BackupListResponse>(`/backup${qs ? `?${qs}` : ""}`, {
    auth: true,
  });
}

/**
 * Fetch single backup archive record.
 */
export async function getBackupDetails(
  id: string,
): Promise<BackupDetailResponse> {
  return api.get<BackupDetailResponse>(`/backup/${id}`, {
    auth: true,
  });
}

/**
 * Trigger an on-demand database or documents storage backup.
 */
export async function triggerBackup(
  type: BackupType = "database_full",
): Promise<{ success: boolean; message: string; backup: BackupRecord }> {
  return api.post<{ success: boolean; message: string; backup: BackupRecord }>(
    "/backup",
    { type },
    { auth: true },
  );
}

/**
 * Trigger cryptographic and archive stream verification.
 */
export async function verifyBackup(id: string): Promise<{
  success: boolean;
  message: string;
  verification: {
    backupId: string;
    checkedAt: string;
    sizeVerified: boolean;
    checksumMatches: boolean;
    archiveIntegrity: boolean;
    error: string | null;
  };
}> {
  return api.post(`/backup/${id}/verify`, {}, { auth: true });
}

/**
 * Execute safe recovery preview and non-destructive dry-run.
 */
export async function runRecoveryPreview(
  id: string,
): Promise<RecoveryPreviewResponse> {
  return api.post<RecoveryPreviewResponse>(
    `/backup/${id}/recovery-preview`,
    {},
    { auth: true },
  );
}

/**
 * Fetch latest data integrity report.
 */
export async function getIntegrityReport(): Promise<DataIntegrityResponse> {
  return api.get<DataIntegrityResponse>("/backup/integrity/report", {
    auth: true,
  });
}

/**
 * Trigger live comprehensive cross-collection data integrity scan.
 */
export async function runIntegrityScan(): Promise<DataIntegrityResponse> {
  return api.post<DataIntegrityResponse>(
    "/backup/integrity/scan",
    {},
    { auth: true },
  );
}

/**
 * Fetch 12-point operational recovery checklist.
 */
export async function getRecoveryChecklist(): Promise<RecoveryChecklistResponse> {
  return api.get<RecoveryChecklistResponse>("/backup/checklist", {
    auth: true,
  });
}
