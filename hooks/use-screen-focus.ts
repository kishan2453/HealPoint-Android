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
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

export function useScreenFocus(onFocus: () => void): void {
  const hasFocusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      onFocus();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
}