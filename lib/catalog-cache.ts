/**
 * HealPoint - shared in-memory doctor catalog cache.
 *
 * The public doctor catalog (`GET /doctor/get-all`) is the heaviest response
 * the app downloads (each record carries image payloads, schedules and
 * timelines). Several screens need the SAME data:
 *   - Home (featured / top-rated / specialty chips)
 *   - Doctor search filter options (specialty / location / gender)
 *   - Favorites (filter the catalog down to saved doctors)
 *
 * Without sharing, mounting those screens fires 2-3 identical multi-megabyte
 * downloads back-to-back — the main reason Home felt slow and requests raced
 * each other into timeouts. This tiny TTL cache lets every hook reuse the last
 * good catalog instead of re-downloading it. Real-time data (slots,
 * appointments, availability at booking time) is NEVER cached here.
 */

import type { Doctor } from '@/types';

let cachedDoctors: Doctor[] = [];
let cachedAt = 0;

export function writeDoctorCatalog(doctors: Doctor[]): void {
  cachedDoctors = Array.isArray(doctors) ? doctors : [];
  cachedAt = Date.now();
}

/** Last good catalog, or null when empty / older than `maxAgeMs`. */
export function readDoctorCatalog(maxAgeMs: number): Doctor[] | null {
  if (cachedDoctors.length === 0) return null;
  if (Date.now() - cachedAt > maxAgeMs) return null;
  return cachedDoctors;
}

export function clearDoctorCatalog(): void {
  cachedDoctors = [];
  cachedAt = 0;
}