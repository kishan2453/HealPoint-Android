/**
 * Platform users / stats API — mirrors the Super Admin endpoints on the backend.
 * `/user/get-stats` and `/user/analytics` return platform-wide figures for the
 * Super Admin; `/user/admin/users` returns the full sanitised user list.
 */
import { api } from './api';
import type { PlatformAnalytics, PlatformStats, PlatformUser, PlatformUsersResponse } from '@/types';

export async function getPlatformStats(): Promise<{ success: boolean; stats: PlatformStats }> {
  return api.get<{ success: boolean; stats: PlatformStats }>('/user/get-stats', { auth: true });
}

export async function getPlatformAnalytics(): Promise<{ success: boolean; analytics: PlatformAnalytics }> {
  return api.get<{ success: boolean; analytics: PlatformAnalytics }>('/user/analytics', { auth: true });
}

export interface PlatformUsersParams {
  search?: string;
  role?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}

export async function getPlatformUsers(
  params: PlatformUsersParams = {},
): Promise<PlatformUsersResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.isActive) query.set('isActive', params.isActive);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return api.get<PlatformUsersResponse>(`/user/admin/users${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function getAdminList(
  params: { search?: string; isActive?: string } = {},
): Promise<{ success: boolean; message: string; totalCount: number; admins: PlatformUser[] }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.isActive) query.set('isActive', params.isActive);
  const qs = query.toString();
  return api.get<{ success: boolean; message: string; totalCount: number; admins: PlatformUser[] }>(
    `/user/admin/admins${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
}

/** Super Admin toggles a Hospital Admin's active/suspended status. */
export async function updateHospitalAdminStatus(
  id: string,
  isActive: boolean,
): Promise<{ success: boolean; message: string; admin: PlatformUser }> {
  return api.patch<{ success: boolean; message: string; admin: PlatformUser }>(
    `/user/admin/admins/${id}/status`,
    { isActive },
    { auth: true },
  );
}

/** Super Admin toggles a patient account's active/suspended status (sanitized; no password/hash in response). */
export async function updatePatientStatus(
  id: string,
  isActive: boolean,
): Promise<{ success: boolean; message: string; user: PlatformUser }> {
  return api.patch<{ success: boolean; message: string; user: PlatformUser }>(
    `/user/admin/users/${id}/status`,
    { isActive },
    { auth: true },
  );
}

export interface AuditLogEntry {
  id: string;
  adminName?: string;
  adminEmail?: string;
  adminRole?: string;
  adminImage?: string;
  type?: string;
  title?: string;
  message?: string;
  createdAt?: string;
  ip?: string;
  browser?: string;
  device?: string;
}

/** Super Admin only — real platform security/audit trail across admin accounts. */
export async function getAuditLogs(
  params: { limit?: number } = {},
): Promise<{ success: boolean; totalCount: number; logs: AuditLogEntry[] }> {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return api.get<{ success: boolean; totalCount: number; logs: AuditLogEntry[] }>(
    `/user/admin/audit-logs${qs ? `?${qs}` : ''}`,
    { auth: true },
  );
}

/**
 * Super Admin resets a Hospital Admin's password. The backend hashes the new
 * password with bcrypt before persisting and the response never contains the
 * password or any hash. The old password stops working immediately.
 */
export async function resetHospitalAdminPassword(
  id: string,
  password: string,
): Promise<{ success: boolean; message: string }> {
  return api.patch<{ success: boolean; message: string }>(
    `/user/admin/admins/${id}/reset-password`,
    { password },
    { auth: true },
  );
}

export async function getUserDetails(
  id: string,
): Promise<{ success: boolean; message: string; user: PlatformUser }> {
  return api.get<{ success: boolean; message: string; user: PlatformUser }>(`/user/get-user/${id}`, { auth: true });
}