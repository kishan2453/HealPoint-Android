/**
 * HealPoint - hospitals data hook (real `/hospital/public/get-all` catalog).
 *
 * Supports caller cancellation: unmounting aborts the fetch and is silently
 * ignored (never shown as a timeout), so rapid navigation cannot pile up
 * timed-out requests behind the new screen.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { isCancelledError } from '@/services/api';
import * as hospitalService from '@/services/hospitals';
import type { Hospital } from '@/types';

export function useHospitals() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const seq = ++requestSeq.current;
    setLoading(true);
    setError('');
    try {
      const res = await hospitalService.getPublicHospitals({ signal: controller.signal });
      if (requestSeq.current !== seq || controller.signal.aborted) return;
      setHospitals(res.hospitals || []);
    } catch (err) {
      if (requestSeq.current !== seq || controller.signal.aborted || isCancelledError(err)) return;
      setHospitals([]);
      setError(err instanceof Error ? err.message : 'Unable to load hospitals.');
    } finally {
      if (requestSeq.current === seq && !controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      abortRef.current?.abort();
    };
  }, [load]);

  return { hospitals, loading, error, refetch: load };
}