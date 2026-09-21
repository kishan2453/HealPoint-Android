/**
 * HealPoint - refetch-on-focus helper.
 *
 * Runs a callback every time the screen gains focus AFTER the initial mount,
 * so lists like "My appointments" show freshly created/cancelled/rescheduled
 * records as soon as the user returns to the screen.
 *
 * The FIRST focus (mount) is intentionally skipped: every screen that uses
 * this helper also performs its own initial data load in a `useEffect` (or via
 * a data hook). Firing the callback on mount caused the SAME API request to be
 * issued twice back-to-back — duplicate requests, wasted bandwidth, and an
 * unnecessary second AbortController timeout racing the first one on Android.
 *
 * The callback is stored in a ref so rapid re-renders never re-subscribe the
 * focus effect (which would re-fire and multiply requests while navigating).
 * An optional `minIntervalMs` throttles refetches so rapidly hopping between
 * screens (Home → Doctor → Back → Home) reuses the just-fetched data instead
 * of hammering the backend on every focus event.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

export function useScreenFocus(onFocus: () => void, minIntervalMs = 0): void {
  const callbackRef = useRef(onFocus);
  callbackRef.current = onFocus;
  const hasFocusedOnce = useRef(false);
  const lastFocusAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      const now = Date.now();
      if (minIntervalMs > 0 && now - lastFocusAt.current < minIntervalMs) return;
      lastFocusAt.current = now;
      callbackRef.current();
    }, [minIntervalMs]),
  );
}