/**
 * HealPoint - hospitals data hook (real `/hospital/public/get-all` catalog).
 */
import { useCallback, useEffect, useState } from 'react';

import * as hospitalService from '@/services/hospitals';
import type { Hospital } from '@/types';

export function useHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await hospitalService.getPublicHospitals();
      setHospitals(res.hospitals || []);
    } catch (err) {
      setHospitals([]);
      setError(err instanceof Error ? err.message : 'Unable to load hospitals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { hospitals, loading, error, refetch: load };
}