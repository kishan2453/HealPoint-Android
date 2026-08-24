/**
 * HealPoint - doctors data hook (real `/doctor/get-all` catalog).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import * as doctorService from '@/services/doctors';
import type { Doctor, GetAllDoctorsParams } from '@/types';

export function useDoctors(params: GetAllDoctorsParams = {}) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const paramsKey = useMemo(() => JSON.stringify(params), [params]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await doctorService.getAllDoctors(params);
      setDoctors(res.doctors || []);
      setTotalCount(res.totalCount || 0);
    } catch (err) {
      setDoctors([]);
      setError(err instanceof Error ? err.message : 'Unable to load doctors.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { doctors, totalCount, loading, error, refetch: load };
}