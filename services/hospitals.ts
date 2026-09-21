/**
 * Hospital catalog API — mirrors routes/hospitalRoutes.js on the backend.
 * The patient-facing catalog is served by the public endpoints
 * `/hospital/public/get-all` and `/hospital/public/get-details/:id`.
 * The Super Admin portal uses the authenticated platform endpoints
 * `/hospital/get-all` and `/hospital/get-details/:id` (which include
 * inactive hospitals), plus the Super Admin lifecycle endpoints.
 */
import { API_TIMEOUT_MS } from "@/lib/env";
import { api } from "./api";
import type { Hospital } from "@/types";

export async function getPublicHospitals(options?: {
  signal?: AbortSignal | null;
}): Promise<{ success: boolean; totalCount: number; hospitals: Hospital[] }> {
  return api.get<{
    success: boolean;
    totalCount: number;
    hospitals: Hospital[];
  }>("/hospital/public/get-all", {
    timeout: API_TIMEOUT_MS,
    ...(options?.signal ? { signal: options.signal } : {}),
  });
}

/**
 * Filtered hospital directory returning only verified emergency-ready hospitals.
 */
export async function getEmergencyHospitals(options?: {
  signal?: AbortSignal | null;
}): Promise<{ success: boolean; totalCount: number; hospitals: Hospital[] }> {
  return api.get<{
    success: boolean;
    totalCount: number;
    hospitals: Hospital[];
  }>("/hospital/public/get-all?emergency=true", {
    timeout: API_TIMEOUT_MS,
    ...(options?.signal ? { signal: options.signal } : {}),
  });
}

export async function getPublicHospitalDetails(
  idOrSlug: string,
): Promise<{ success: boolean; message: string; hospital: Hospital }> {
  return api.get<{ success: boolean; message: string; hospital: Hospital }>(
    `/hospital/public/get-details/${idOrSlug}`,
  );
}

/**
 * Super Admin platform hospital directory. Includes active AND inactive
 * hospitals plus real doctor/patient/appointment counts and subscription
 * fields — sanitised server-side (no secrets).
 */
export async function getAdminHospitals(): Promise<{
  success: boolean;
  totalCount: number;
  hospitals: Hospital[];
}> {
  return api.get<{
    success: boolean;
    totalCount: number;
    hospitals: Hospital[];
  }>("/hospital/get-all", {
    auth: true,
  });
}

/** Super Admin platform hospital details (works for inactive hospitals too). */
export async function getAdminHospitalDetails(
  idOrSlug: string,
): Promise<{ success: boolean; message: string; hospital: Hospital }> {
  return api.get<{ success: boolean; message: string; hospital: Hospital }>(
    `/hospital/get-details/${idOrSlug}`,
    { auth: true },
  );
}

export interface UpdateHospitalPayload {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mapsUrl?: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  about?: string;
  departments?: string[];
  services?: string[];
}

/** Super Admin only — persist hospital edits (backend enforces the role). */
export async function updateHospital(
  id: string,
  payload: UpdateHospitalPayload,
): Promise<{ success: boolean; message: string; hospital: Hospital }> {
  return api.patch<{ success: boolean; message: string; hospital: Hospital }>(
    `/hospital/${id}`,
    payload,
    {
      auth: true,
    },
  );
}

/** Super Admin only — activate/suspend a hospital. */
export async function setHospitalActive(
  id: string,
  isActive: boolean,
): Promise<{ success: boolean; message: string; hospital: Hospital }> {
  return api.patch<{ success: boolean; message: string; hospital: Hospital }>(
    `/hospital/${id}/status`,
    { isActive },
    { auth: true },
  );
}

export interface CreateHospitalWithAdminPayload {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mapsUrl?: string;
  phone: string;
  email: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

/** Super Admin only — create a hospital together with its first Hospital Admin. */
export async function createHospitalWithAdmin(
  payload: CreateHospitalWithAdminPayload,
): Promise<{ success: boolean; message: string; hospital: Hospital }> {
  return api.post<{ success: boolean; message: string; hospital: Hospital }>(
    "/hospital/create-with-admin",
    payload,
    { auth: true },
  );
}
