/**
 * Doctor catalog API — mirrors routes/doctorRoutes.js on the backend.
 * GET /doctor/get-all is public (optional auth) and GET /doctor/get-details/:id
 * is public as well, so no auth header is required.
 */
import { api } from './api';
import type { Doctor, GetAllDoctorsParams } from '@/types';

function toQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export async function getAllDoctors(params: GetAllDoctorsParams = {}): Promise<{
  success: boolean;
  totalCount: number;
  doctors: Doctor[];
  verificationCounts?: { _id: string; count: number }[];
  privacyRestricted?: boolean;
}> {
  const query = toQueryString(params as Record<string, unknown>);
  // Platform (Super Admin) mode needs the auth header so the backend can
  // authorize the expanded doctor list + verification counts.
  const auth = Boolean(params.platform);
  return api.get<{
    success: boolean;
    totalCount: number;
    doctors: Doctor[];
    verificationCounts?: { _id: string; count: number }[];
    privacyRestricted?: boolean;
  }>(`/doctor/get-all${query}`, auth ? { auth: true } : undefined);
}

export async function getDoctorDetails(id: string): Promise<{ success: boolean; message: string; doctor: Doctor }> {
  return api.get<{ success: boolean; message: string; doctor: Doctor }>(`/doctor/get-details/${id}`);
}