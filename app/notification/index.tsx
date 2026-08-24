import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import * as notificationService from '@/services/notifications';
import { toErrorMessage } from '@/services/api';
import type { Notification } from '@/types';

function timeAgo(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await notificationService.getNotifications({ limit: 50 });
      setNotifications(res.notifications || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load notifications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await notificationService.getNotifications({ limit: 50 });
      setNotifications(res.notifications || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load notifications.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    try {
      await notificationService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch {
      // best effort
    }
  };

  const markOne = async (notification: Notification) => {
    if (notification.isRead) return;
    setNotifications((prev) =>
      prev.map((item) => (item._id === notification._id ? { ...item, isRead: true } : item)),
    );
    try {
      await notificationService.updateNotificationRead(notification._id, true);
    } catch {
      setNotifications((prev) =>
        prev.map((item) => (item._id === notification._id ? { ...item, isRead: false } : item)),
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="close" size={24} color={Palette.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        {notifications.some((item) => !item.isRead) ? (
          <Pressable accessibilityRole="button" onPress={markAll} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

{loading ? (
        <Loading label="Loading notifications..." />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications"
          message="Appointment updates, reminders and alerts will appear here."
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => markOne(item)}
              style={({ pressed }) => [
                styles.item,
                !item.isRead && styles.itemUnread,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.dot, !item.isRead && styles.dotUnread]} />
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMessage} numberOfLines={2}>
                  {item.message}
                </Text>
                <Text style={styles.itemTime}>{timeAgo(item.createdAt)}</Text>
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  markAll: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  pressed: {
    opacity: 0.7,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  separator: {
    height: Spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
  },
  itemUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Palette.primary,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
    marginTop: 6,
  },
  dotUnread: {
    backgroundColor: Palette.primary,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  itemMessage: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  itemTime: {
    ...Typography.caption,
    color: Palette.textMuted,
    marginTop: 2,
  },
});