/**
 * HealPoint - filter options hook.
 *
 * Fetches the real doctor catalog once and derives the specialty / location /
 * gender options the filter sheet offers. Options always come from backend
 * data — never a hardcoded list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { deriveDoctorFilterOptions, type DoctorFilterOptions } from '@/lib/doctor-search';
import * as doctorService from '@/services/doctors';
import type { Doctor } from '@/types';

export function useDoctorFilterOptions() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const options = useMemo<DoctorFilterOptions>(() => deriveDoctorFilterOptions(doctors), [doctors]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await doctorService.getAllDoctors({ limit: 200 });
      setDoctors(res.doctors || []);
    } catch (err) {
      setDoctors([]);
      setError(err instanceof Error ? err.message : 'Unable to load filter options.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { options, loading, error, refetch: load };
}
