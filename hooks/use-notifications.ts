/**
 * HealPoint - notifications hook (real `/notification/get-all` unread count + WebSocket push sync).
 *
 * The badge always reflects the backend's real unread count. It refreshes on
 * mount, screen focus, and instantly whenever a real-time event arrives via Socket.IO.
 * No fake counts: if the server is unreachable the badge stays quiet.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useScreenFocus } from "@/hooks/use-screen-focus";
import * as notificationService from "@/services/notifications";
import { subscribeToNotificationSync } from "@/services/socket";

interface UseNotificationBadgeOptions {
  /** Optional auto-refresh interval in milliseconds (e.g. dashboards). */
  intervalMs?: number;
}

export function useNotificationBadge(options?: UseNotificationBadgeOptions) {
  const [unreadCount, setUnreadCount] = useState(0);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
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

    // Real-time WebSocket sync: any new notification arriving immediately updates badge count
    const unsubscribe = subscribeToNotificationSync(() => {
      setUnreadCount((prev) => prev + 1);
      load();
    });

    return () => {
      if (interval) clearInterval(interval);
      unsubscribe();
    };
  }, [load, options?.intervalMs]);

  // Refetch when the screen regains focus so the badge stays accurate after
  // the user marked notifications read on the notification center.
  useScreenFocus(() => {
    load();
  }, 30_000);

  return { unreadCount, refresh: load };
}
