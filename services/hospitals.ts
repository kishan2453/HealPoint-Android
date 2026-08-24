/**
 * Hospital catalog API — mirrors routes/hospitalRoutes.js on the backend.
 * The patient-facing catalog is served by the public endpoints
 * `/hospital/public/get-all` and `/hospital/public/get-details/:id`.
 */
import { api } from './api';
import type { Hospital } from '@/types';

export async function getPublicHospitals(): Promise<{ success: boolean; totalCount: number; hospitals: Hospital[] }> {
  return api.get<{ success: boolean; totalCount: number; hospitals: Hospital[] }>('/hospital/public/get-all');
}

export async function getPublicHospitalDetails(
  idOrSlug: string,
): Promise<{ success: boolean; message: string; hospital: Hospital }> {
  return api.get<{ success: boolean; message: string; hospital: Hospital }>(
    `/hospital/public/get-details/${idOrSlug}`,
  );
}