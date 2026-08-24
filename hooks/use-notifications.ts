/**
 * HealPoint - notifications hook (real `/notification/get-all` unread count).
 */
import { useCallback, useEffect, useState } from 'react';

import * as notificationService from '@/services/notifications';

export function useNotificationBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await notificationService.getNotifications({ limit: 1 });
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Badge stays silent when the server cannot be reached.
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { unreadCount, refresh: load };
}