/**
 * HealPoint - Hospital Admin · Notifications.
 * Real notifications for the logged-in admin (/notification/get-all).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as notificationService from '@/services/notifications';
import { useAuth } from '@/hooks/use-auth';
import type { Notification } from '@/types';

export default function AdminNotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await notificationService.getNotifications({ limit: 50 });
      setNotifications(res.notifications || []);
    } catch (err) {
      setError(toErrorMessage(err, `Unable to load notifications.${user ? '' : ' Please login.'}`));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminModuleScreen
      title="Notifications"
      subtitle="Your admin notifications"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No notifications" message="New notifications will appear here." />}
        renderItem={({ item }) => (
          <Card style={[styles.row, !item.isRead && styles.rowUnread]}>
            <View style={styles.rowHeader}>
              <Text style={styles.name} numberOfLines={1}>{item.title || 'Notification'}</Text>
              {item.isRead ? <Badge label="Read" variant="neutral" /> : <Badge label="New" variant="primary" />}
            </View>
            {item.message ? <Text style={styles.message}>{item.message}</Text> : null}
            <Text style={styles.meta}>{formatISODate(item.createdAt)}</Text>
          </Card>
        )}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.sm },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: Palette.primary },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  name: { ...Typography.h4, color: Palette.text, flex: 1 },
  message: { ...Typography.bodySmall, color: Palette.textMuted, lineHeight: 20 },
  meta: { ...Typography.caption, color: Palette.textMuted },
});