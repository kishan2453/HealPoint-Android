/**
 * HealPoint - doctors data hook (real `/doctor/get-all` catalog).
 *
 * Shares the in-memory catalog (`getSharedDoctorCatalog`) with Home and the
 * search filter options, so mounting several screens together downloads the
 * heavy list ONCE. Supports caller cancellation: unmounting aborts the fetch
 * and is silently ignored (never shown as a timeout).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isCancelledError } from '@/services/api';
import * as doctorService from '@/services/doctors';
import type { Doctor, GetAllDoctorsParams } from '@/types';

/** Small page every catalog consumer shares (see services/doctors.ts payload note). */
export const SHARED_CATALOG_LIMIT = 30;

export function useDoctors(params: GetAllDoctorsParams = {}) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const paramsKey = useMemo(() => JSON.stringify(params), [params]);
  // Aborts the in-flight request when params change / the screen unmounts so
  // a stale multi-MB download can never overwrite fresh results.
  const abortRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++requestSeq.current;
    // Small shared pages (limit <= SHARED_CATALOG_LIMIT, no other filters) go
    // through the shared TTL catalog so Home + filter options + Favorites
    // download the heavy list ONCE. Anything else (real searches) keeps its
    // own params and still benefits from the API GET dedupe.
    const parsed: GetAllDoctorsParams = JSON.parse(paramsKey) as GetAllDoctorsParams;
    const useSharedCatalog =
      Object.keys(parsed).length <= 1 &&
      (parsed.limit === undefined || parsed.limit <= SHARED_CATALOG_LIMIT);
    setLoading(true);
    setError('');
    try {
      if (useSharedCatalog) {
        const res = await doctorService.getSharedDoctorCatalog(parsed.limit ?? SHARED_CATALOG_LIMIT, {
          signal: controller.signal,
        });
        if (requestSeq.current !== seq || controller.signal.aborted) return;
        const list = res.doctors || [];
        setDoctors(list);
        // totalCount from the server counts the whole collection; for the
        // small shared page report what we actually hold so "View all N"
        // copy never over-promises beyond the downloaded page.
        setTotalCount(Math.max(res.totalCount || 0, list.length));
      } else {
        const res = await doctorService.getAllDoctors(parsed, { signal: controller.signal });
        if (requestSeq.current !== seq || controller.signal.aborted) return;
        setDoctors(res.doctors || []);
        setTotalCount(res.totalCount || 0);
      }
    } catch (err) {
      if (requestSeq.current !== seq || controller.signal.aborted || isCancelledError(err)) return;
      setDoctors([]);
      setError(err instanceof Error ? err.message : 'Unable to load doctors.');
    } finally {
      if (requestSeq.current === seq && !controller.signal.aborted) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  return { doctors, totalCount, loading, error, refetch: load };
}