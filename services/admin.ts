/**
 * Hospital Admin API — mirrors routes/hospital-admin/* and the hospital-scoped
 * doctor routes on the backend. Every endpoint is scoped to the logged-in
 * Hospital Admin's OWN hospitalId server-side; a Hospital Admin can never read
 * or write doctors belonging to another hospital.
 */
import { api } from './api';
import type { Doctor, Hospital, HospitalAdminDashboardResponse } from '@/types';

export async function getHospitalAdminDashboard(): Promise<HospitalAdminDashboardResponse> {
  return api.get<HospitalAdminDashboardResponse>('/hospital-admin/dashboard', { auth: true });
}

export async function updateHospitalProfile(
  payload: Record<string, unknown>,
): Promise<{ success: boolean; message: string; hospital: Hospital['_id'] }> {
  return api.patch<{ success: boolean; message: string; hospital: Hospital['_id'] }>('/hospital-admin/profile', payload, { auth: true });
}

export interface HospitalDoctorsParams {
  search?: string;
  department?: string;
  status?: string;
  verificationStatus?: string;
}

export async function getHospitalDoctors(
  params: HospitalDoctorsParams = {},
): Promise<{ success: boolean; data: Doctor[] }> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.department) query.set('department', params.department);
  if (params.status) query.set('status', params.status);
  if (params.verificationStatus) query.set('verificationStatus', params.verificationStatus);
  const qs = query.toString();
  return api.get<{ success: boolean; data: Doctor[] }>(`/hospital-admin/doctors${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function getHospitalDoctorDetails(
  doctorId: string,
): Promise<{ success: boolean; data: Doctor }> {
  return api.get<{ success: boolean; data: Doctor }>(`/hospital-admin/doctors/${doctorId}`, { auth: true });
}

export async function updateHospitalDoctor(
  doctorId: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; message: string }> {
  return api.put<{ success: boolean; message: string }>(`/hospital-admin/doctors/${doctorId}`, payload, { auth: true });
}

export async function toggleHospitalDoctorActive(
  doctorId: string,
  isActive: boolean,
): Promise<{ success: boolean; message: string }> {
  return api.put<{ success: boolean; message: string }>(`/hospital-admin/doctors/${doctorId}/status`, { isActive }, { auth: true });
}

/**
 * Approve/reject a doctor's verification. The backend scopes this to the
 * admin's own hospital (`doctorController.updateDoctorVerificationStatus` skips
 * the hospital gate only for Super Admin).
 */
export async function updateDoctorVerificationStatus(
  doctorId: string,
  payload: { status: string; note?: string; requestedDocuments?: string[] },
): Promise<{ success: boolean; message: string }> {
  return api.patch<{ success: boolean; message: string }>(`/doctor/update-verification-status/${doctorId}`, payload, { auth: true });
}

export async function toggleDoctorAvailability(
  doctorId: string,
  availableStatus: boolean,
): Promise<{ success: boolean; message: string }> {
  return api.patch<{ success: boolean; message: string }>(`/doctor/update-status/${doctorId}`, { availableStatus }, { auth: true });
}