/**
 * HealPoint - notifications hook (real `/notification/get-all` unread count).
 *
 * The badge always reflects the backend's real unread count. It refreshes on
 * every screen focus and — for frequently-visible surfaces such as the Super
 * Admin dashboard — on an optional lightweight polling interval. No fake
 * counts anywhere: when the server is unreachable the badge simply stays
 * quiet instead of inventing a number.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useScreenFocus } from '@/hooks/use-screen-focus';
import * as notificationService from '@/services/notifications';

interface UseNotificationBadgeOptions {
  /** Optional auto-refresh interval in milliseconds (e.g. dashboards). */
  intervalMs?: number;
}

export function useNotificationBadge(options?: UseNotificationBadgeOptions) {
  const [unreadCount, setUnreadCount] = useState(0);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    // The badge fires on mount + every focus + every Home render path — skip
    // while a previous badge read is still in flight instead of stacking
    // duplicate requests behind a slow backend.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await notificationService.getNotifications({ limit: 1 });
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Badge stays silent when the server cannot be reached.
      setUnreadCount(0);
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = options?.intervalMs
      ? setInterval(() => {
          load();
        }, options.intervalMs)
      : undefined;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [load, options?.intervalMs]);

  // Refetch when the screen regains focus so the badge stays accurate after
  // the user marked notifications read on the notification center. Throttled
  // to 30s — focus-hopping must not re-fire a badge request every time.
  useScreenFocus(() => {
    load();
  }, 30_000);

  return { unreadCount, refresh: load };
}