/**
 * Doctor catalog API — mirrors routes/doctorRoutes.js on the backend.
 * GET /doctor/get-all is public (optional auth) and GET /doctor/get-details/:id
 * is public as well, so no auth header is required.
 *
 * PAYLOAD NOTE (measured 2026-09-09 against the live backend): the list
 * response embeds each doctor's populated `hospitalId` record INCLUDING its
 * base64 `coverImage`/`logo` (~1.3MB for one isolation-test hospital shared
 * by ~10 doctors). A `limit=120` page is ~14MB and takes ~1.1s on loopback —
 * much longer over real Wi-Fi — while `limit=24` is ~2.6MB / ~0.2s. Screens
 * therefore request only the page size they actually render and share results
 * through the catalog cache (`lib/catalog-cache.ts`) instead of each firing
 * their own 120-record download.
 */
import { readDoctorCatalog, writeDoctorCatalog } from '@/lib/catalog-cache';
import { API_TIMEOUT_MS } from '@/lib/env';
import { isCancelledError, api } from './api';
import type { Doctor, GetAllDoctorsParams } from '@/types';

/** Reuse the shared catalog for 5 minutes — slots/booking stay uncached. */
const CATALOG_TTL_MS = 5 * 60 * 1000;

function toQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export async function getAllDoctors(
  params: GetAllDoctorsParams = {},
  options?: { signal?: AbortSignal | null },
): Promise<{
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
  }>(`/doctor/get-all${query}`, {
    ...(auth ? { auth: true as const } : {}),
    timeout: API_TIMEOUT_MS,
    ...(options?.signal ? { signal: options.signal } : {}),
  });
}

/**
 * Shared-catalog read used by Home + filter options + Favorites.
 *
 * Returns the cached catalog when fresh (no network at all), otherwise fetches
 * exactly ONE small page (`limit`) that every subscriber shares through the
 * API client's in-flight GET dedupe. Callers slice/filter locally — never
 * widen the limit to "get everything".
 */
export async function getSharedDoctorCatalog(
  limit: number,
  options?: { signal?: AbortSignal | null },
): Promise<{ doctors: Doctor[]; totalCount: number }> {
  const cached = readDoctorCatalog(CATALOG_TTL_MS);
  if (cached) {
    return { doctors: cached, totalCount: cached.length };
  }
  try {
    const res = await getAllDoctors({ limit }, options ? { signal: options.signal ?? null } : undefined);
    writeDoctorCatalog(res.doctors || []);
    return { doctors: res.doctors || [], totalCount: res.totalCount || 0 };
  } catch (error) {
    // A caller cancellation (unmount) has no cached fallback to offer and
    // must stay silent — never convert it into a timeout error upstream.
    if (options?.signal?.aborted || isCancelledError(error)) throw error;
    // Offline/slow backend: serve the last good catalog even past TTL rather
    // than showing an empty error screen for data we already have.
    const stale = readDoctorCatalog(Number.POSITIVE_INFINITY);
    if (stale) return { doctors: stale, totalCount: stale.length };
    throw error;
  }
}

export async function getDoctorDetails(id: string): Promise<{ success: boolean; message: string; doctor: Doctor }> {
  return api.get<{ success: boolean; message: string; doctor: Doctor }>(`/doctor/get-details/${id}`, {
    timeout: API_TIMEOUT_MS,
  });
}