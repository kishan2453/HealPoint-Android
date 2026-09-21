/**
 * HealPoint - filter options hook.
 *
 * Derives the specialty / location / gender options from the SAME shared
 * small-page catalog Home uses (`getSharedDoctorCatalog`, 5-min TTL) instead
 * of firing its own `limit=200` (~10MB+) download. Options always come from
 * backend data — never a hardcoded list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { deriveDoctorFilterOptions, type DoctorFilterOptions } from '@/lib/doctor-search';
import * as doctorService from '@/services/doctors';
import { SHARED_CATALOG_LIMIT } from '@/hooks/use-doctors';
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
      const res = await doctorService.getSharedDoctorCatalog(SHARED_CATALOG_LIMIT);
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
