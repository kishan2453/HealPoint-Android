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

export async function getAdminList(): Promise<{ success: boolean; admins: PlatformUser[] }> {
  return api.get<{ success: boolean; admins: PlatformUser[] }>('/user/admin/admins', { auth: true });
}

export async function getUserDetails(
  id: string,
): Promise<{ success: boolean; message: string; user: PlatformUser }> {
  return api.get<{ success: boolean; message: string; user: PlatformUser }>(`/user/get-user/${id}`, { auth: true });
}