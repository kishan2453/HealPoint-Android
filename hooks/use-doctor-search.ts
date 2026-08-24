/**
 * HealPoint - doctor search hook (real `/doctor/get-all` requests).
 *
 * Imperative by design: a search runs ONLY when `runSearch` is called — from
 * the Search button, Apply filters, hospital chip or retry — never on every
 * keystroke. A request id guards against stale responses so a slow request can
 * never overwrite newer results.
 */
import { useCallback, useRef, useState } from 'react';

import * as doctorService from '@/services/doctors';
import { toErrorMessage } from '@/services/api';
import type { Doctor, GetAllDoctorsParams } from '@/types';

export interface DoctorSearchResult {
  doctors: Doctor[];
  totalCount: number;
  loading: boolean;
  error: string;
  hasSearched: boolean;
  runSearch: (params: GetAllDoctorsParams) => Promise<void>;
}

export function useDoctorSearch(): DoctorSearchResult {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  // Starts true so the results area shows the skeleton immediately on mount,
  // before the initial automatic search request completes.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const requestId = useRef(0);

  const runSearch = useCallback(async (params: GetAllDoctorsParams) => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    setHasSearched(true);
    try {
      const res = await doctorService.getAllDoctors(params);
      if (requestId.current !== id) return;
      setDoctors(res.doctors || []);
      setTotalCount(res.totalCount || 0);
    } catch (err) {
      if (requestId.current !== id) return;
      setDoctors([]);
      setTotalCount(0);
      setError(toErrorMessage(err, 'Unable to search doctors.'));
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, []);

  return { doctors, totalCount, loading, error, hasSearched, runSearch };
}
