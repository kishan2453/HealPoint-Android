/**
 * HealPoint - Super Admin · Notifications & System Alerts Center.
 *
 * A professional, role-guarded notification center that reads the SAME real
 * notification collection as every other HealPoint portal (`GET
 * /notification/get-all`, `PATCH /notification/read/:id`,
 * `PATCH /notification/mark-all`, `DELETE /notification/delete/:id`). The
 * platform events are targeted at the Super Admin role by the backend. There
 * is no separate notification dataset and nothing here is mocked.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FilterChips } from '@/components/admin/FilterChips';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useNotificationBadge } from '@/hooks/use-notifications';
import { useScreenFocus } from '@/hooks/use-screen-focus';
import { formatISODate } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as notificationService from '@/services/notifications';
import type { Notification } from '@/types';

type StatusFilter = 'all' | 'unread' | 'read';
type Category =
  | 'Appointment'
  | 'Doctor'
  | 'Hospital'
  | 'Patient'
  | 'Payment'
  | 'Subscription'
  | 'System'
  | 'All';

const CATEGORIES: { key: Category; types: string[] }[] = [
  { key: 'All', types: [] },
  {
    key: 'Appointment',
    types: [
      'appointment_new',
      'appointment_booked',
      'appointment_rescheduled',
      'appointment_cancelled',
      'appointment_completed',
      'appointment_missed',
      'appointment_reminder',
      'appointment_accepted',
      'appointment_rejected',
    ],
  },
  {
    key: 'Doctor',
    types: ['doctor_added', 'doctor_updated', 'doctor_verified', 'doctor_rejected', 'doctor_deleted'],
  },
  { key: 'Hospital', types: ['hospital_registered'] },
  { key: 'Patient', types: ['patient_registered'] },
  { key: 'Payment', types: ['payment_success', 'payment_failed'] },
  { key: 'Subscription', types: ['subscription_paid', 'subscription_failed'] },
  {
    key: 'System',
    types: [
      'review_submitted',
      'review_received',
      'review_reported',
      'message_received',
      'admin_action',
      'verification_status_updated',
    ],
  },
];

/** Safe in-app routes a Super Admin notification `link` may open. */
const SAFE_ROUTES = new Set([
  '/super-admin/hospitals',
  '/super-admin/doctors',
  '/super-admin/doctor-verification',
  '/super-admin/users',
  '/super-admin/patients',
  '/super-admin/admins',
  '/super-admin/appointments',
  '/super-admin/subscriptions',
  '/super-admin/messages',
  '/super-admin/reviews',
  '/super-admin/analytics',
  '/super-admin/notifications',
  '/super-admin/audit-logs',
]);

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
];

function categoryOf(type?: string): Category {
  const key = (type || '').trim().toLowerCase();
  if (key.startsWith('appointment_')) return 'Appointment';
  if (
    key === 'doctor_added' ||
    key === 'doctor_updated' ||
    key === 'doctor_verified' ||
    key === 'doctor_rejected' ||
    key === 'doctor_deleted'
  )
    return 'Doctor';
  if (key === 'hospital_registered') return 'Hospital';
  if (key === 'patient_registered') return 'Patient';
  if (key.startsWith('payment_')) return 'Payment';
  if (key.startsWith('subscription_')) return 'Subscription';
  return 'System';
}

function visual(notification: Notification): { icon: keyof typeof Ionicons.glyphMap; tint: string } {
  const category = categoryOf(notification.type);
  switch (category) {
    case 'Appointment':
      return { icon: 'calendar-outline', tint: Palette.primary };
    case 'Doctor':
      return { icon: 'medkit-outline', tint: '#2F80ED' };
    case 'Hospital':
      return { icon: 'business-outline', tint: '#0E9F8E' };
    case 'Patient':
      return { icon: 'person-outline', tint: '#E89A3C' };
    case 'Payment':
      return { icon: 'card-outline', tint: Palette.success };
    case 'Subscription':
      return { icon: 'sparkles-outline', tint: '#7B61FF' };
    default:
      return { icon: 'notifications-outline', tint: Palette.textMuted };
  }
}

function priorityBadge(priority?: string) {
  if (priority === 'high') return <Badge label="High priority" variant="error" />;
  if (priority === 'low') return <Badge label="Low" variant="neutral" />;
  return <Badge label="Normal" variant="primary" />;
}

function timeLabel(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatISODate(value);
}
export default function SuperAdminNotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<Category>('All');
  const [search, setSearch] = useState('');
  const [pendingAction, setPendingAction] = useState<'markAll' | 'delete' | ''>('');
  const [actionError, setActionError] = useState('');
  const [detailTarget, setDetailTarget] = useState<Notification | null>(null);
  const hasLoaded = useRef(false);

  const { refresh: refreshBadge } = useNotificationBadge();

  const load = useCallback(
    async (asRefresh = false) => {
      if (asRefresh) setRefreshing(true);
      else if (!hasLoaded.current) setLoading(true);
      setRefreshError('');
      try {
        const res = await notificationService.getNotifications({ limit: 100 });
        const list = [...(res.notifications || [])].sort((a, b) => {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db - da;
        });
        hasLoaded.current = true;
        setNotifications(list);
        setError('');
        setActionError('');
        refreshBadge();
      } catch (err) {
        if (!hasLoaded.current) {
          setNotifications([]);
          setError(toErrorMessage(err, 'Unable to load notifications.'));
        } else {
          setRefreshError('Could not refresh notifications. Pull down to try again.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [refreshBadge],
  );

  useEffect(() => {
    load();
  }, [load]);

  useScreenFocus(() => {
    load(true);
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notifications.filter((item) => {
      if (status === 'unread' && item.isRead) return false;
      if (status === 'read' && !item.isRead) return false;
      if (category !== 'All' && categoryOf(item.type) !== category) return false;
      if (q) {
        const haystack = `${item.title} ${item.message} ${item.actorName || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, status, category, search]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const highPriorityUnread = notifications.filter((item) => !item.isRead && item.priority === 'high').length;
  const paymentIssues = notifications.filter((item) =>
    item.type === 'subscription_failed' || item.type === 'payment_failed',
  ).length;
  const safeTarget = useCallback(
    (notification: Notification): string | null => {
      const raw = (notification.link || '' ).trim();
      const target = raw.split('?')[0];
      if (SAFE_ROUTES.has(target)) return target;
      // Allow id-parametrized detail routes that exist (hospital / subscription details).
      if (/^\/super-admin\/(hospital|subscription)\/[a-f\d]{24}$/i.test(target)) return target;
      return null;
    },
    [],
  );

  const markOne = async (notification: Notification, unread: boolean) => {
    if (notification.isRead === unread) return;
    const previous = notification.isRead;
    setNotifications((prev) =>
      prev.map((item) => (item._id === notification._id ? { ...item, isRead: unread } : item)),
    );
    setRefreshError('');
    try {
      await notificationService.updateNotificationRead(notification._id, unread);
      refreshBadge();
    } catch {
      setNotifications((prev) =>
        prev.map((item) => (item._id === notification._id ? { ...item, isRead: previous } : item)),
      );
      setRefreshError('Could not update the notification. Please try again.');
    }
  };

  const openNotification = (notification: Notification) => {
    // Tapping a notification marks it read (authenticates the persisted state
    // through the backend) and opens a safe related screen when one exists. If
    // there is no safe route, show the detail modal instead of a dead link.


    if (!notification.isRead) markOne(notification, true);
    const target = safeTarget(notification);
    if (target) {
      router.push(target as never);
      return;
    }
    setDetailTarget(notification);
  };

  const markAll = async () => {
    if (pendingAction) return;
    setPendingAction('markAll');
    setActionError('');
    const hadUnread = unreadCount > 0;
    const updated = notifications.map((item) => ({ ...item,isRead: true }));
    setNotifications(updated);
    try {
      await notificationService.markAllNotificationsRead();
      refreshBadge();
    } catch (err) {
      if (hadUnread) load(true);
      setActionError(toErrorMessage(err, 'Could not mark all as read.'));
    } finally {
      setPendingAction('');
    }
  };

  const confirmDelete = async () => {
    if (!detailTarget || pendingAction) return;
    setPendingAction('delete');
    setActionError('');
    const targetId = detailTarget._id;
    const remaining = notifications.filter((item) => item._id !== targetId);
    setNotifications(remaining);
    try {
      await notificationService.deleteNotification(targetId);
      refreshBadge();
      setDetailTarget(null);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not delete the notification.'));
      load(true);
    } finally {
      setPendingAction('');
    }
  };
const renderRow = useCallback(
    ({ item }: { item: Notification }) => {
      const unread = !item.isRead;
      const v = visual(item);
      const target = safeTarget(item);
      return (
        <Card style={[styles.row, unread && styles.rowUnread]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${unread ? 'Unread' : 'Read'} notification: ${item.title}`}
            onPress={() => openNotification(item)}
            style={({ pressed }) => [styles.rowPressable, pressed && styles.pressed]}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${v.tint}1F` }]}>
              <Ionicons name={v.icon} size={20} color={v.tint} />
            </View>
            <View style={styles.rowTexts}>
              <View style={styles.rowTitleRow}>
                <Text numberOfLines={2} style={[styles.rowTitle, unread && styles.rowTitleUnread]}>
                  {item.title}
                </Text>
                {unread ? <View style={styles.unreadDot} /> : null}
              </View>
              <Text numberOfLines={2} style={styles.rowMessage}>{item.message}</Text>
              <View style={styles.rowMeta}>
                <Text style={styles.rowTime}>{timeLabel(item.createdAt)}</Text>
                <Text style={styles.rowCategory}>{categoryOf(item.type)}</Text>
                {target ? (
                  <View style={styles.rowOpen}>
                    <Ionicons name="open-outline" size={13} color={Palette.primary} />
                    <Text style={styles.rowOpenText}>Open</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
          </Pressable>
        </Card>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notifications],
  );

  const emptyMessage =
    status !== 'all' || category !== 'All' || search
      ? 'No notifications match the current filters.'
      : 'No platform notifications yet. Events like new registrations, appointments and payments will appear here automatically.';

  return (
    <AdminModuleScreen
      title="Notifications & Alerts"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      loading={loading}
      error={error}
      onRetry={() => load(true)}
      loadingComponent={
        <View style={styles.skeletonList}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonIcon} />
              <View style={styles.skeletonLines}>
                <View style={styles.skeletonLineWide} />
                <View style={styles.skeletonLineMid} />
                <View style={styles.skeletonLineShort} />
              </View>
            </View>
          ))}
        </View>
      }
    >
<View style={styles.alertStrip}>
        {unreadCount > 0 ? (
          <View style={styles.alertPill}>
            <View style={[styles.alertDot, { backgroundColor: Palette.primary }]} />
            <Text style={styles.alertLabel}>{unreadCount} unread</Text>
          </View>
        ) : null}
        {highPriorityUnread > 0 ? (
          <View style={styles.alertPill}>
            <View style={[styles.alertDot, { backgroundColor: Palette.error }]} />
            <Text style={styles.alertLabel}>{highPriorityUnread} high-priority</Text>
          </View>
        ) : null}
        {paymentIssues > 0 ? (
          <View style={styles.alertPill}>
            <View style={[styles.alertDot, { backgroundColor: Palette.warning }]} />
            <Text style={styles.alertLabel}>
              {paymentIssues} payment issue{paymentIssues > 1 ? 's' : ''}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.controls}>
        <FilterChips options={STATUS_FILTERS} selected={status} onSelect={(v) => setStatus(v as StatusFilter)} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat.key;
            return (
              <Pressable
                key={cat.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setCategory(cat.key)}
                style={({ pressed }) => [styles.catChip, active && styles.catChipActive, pressed && styles.pressed]}
              >
                <Text style={[styles.catLabel, active && styles.catLabelActive]}>{cat.key}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.searchWrap}>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search notifications..." />
        </View>
      </View>

      {refreshError ? (
        <View style={styles.inlineError}>
          <Ionicons name="alert-circle-outline" size={16} color={Palette.warning} />
          <Text style={styles.inlineErrorText}>{refreshError}</Text>
        </View>
      ) : null}

      {actionError ? (
        <View style={styles.inlineError}>
          <Ionicons name="alert-circle-outline" size={16} color={Palette.error} />
          <Text style={[styles.inlineErrorText, { color: Palette.error }]}>{actionError}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <Text style={styles.resultCount}>
          {filtered.length}of {notifications.length}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark all as read"
          disabled={pendingAction === 'markAll' || unreadCount === 0}
          onPress={markAll}
          style={({ pressed }) => [styles.markAllBtn, pressed && styles.pressed]}
        >
          {pendingAction === 'markAll' ? (
            <ActivityIndicator size="small" color={Palette.primary} />
          ) : (
            <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllDisabled]}>
              Mark all read
            </Text>
          )}
        </Pressable>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-off-outline" size={32} color={Palette.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Nothing here</Text>
          <Text style={styles.emptyMessage}>{emptyMessage}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Palette.primary} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          initialNumToRender={12}
          windowSize={7}
          renderItem={renderRow}
        />
      )}
{/* Detail modal */}
      <Modal
        visible={Boolean(detailTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailTarget(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailTarget(null)} accessibilityLabel="Dismiss">
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            {detailTarget ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalIconWrap}>
                    <Ionicons
                      name={visual(detailTarget).icon}
                      size={24}
                      color={visual(detailTarget).tint}
                    />
                  </View>
                  <View style={styles.modalTitles}>
                    <Text style={styles.modalTitle}>{detailTarget.title}</Text>
                    <Text style={styles.modalSubtitle}>
                      {categoryOf(detailTarget.type)} · {timeLabel(detailTarget.createdAt)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close details"
                    onPress={() => setDetailTarget(null)}
                    hitSlop={8}
                    style={styles.modalClose}
                  >
                    <Ionicons name="close" size={20} color={Palette.textMuted} />
                  </Pressable>
                </View>

                <View style={styles.modalMetaRow}>
                  {priorityBadge(detailTarget.priority)}
                  {detailTarget.isRead ? (
                    <Badge label="Read" variant="neutral" />
                  ) : (
                    <Badge label="Unread" variant="primary" />
                  )}
                </View>

                <Text style={styles.modalMessage}>{detailTarget.message}</Text>

                <View style={styles.modalEntity}>
                  <Ionicons name="file-tray-outline" size={15} color={Palette.textMuted} />
                  <Text numberOfLines={1} style={styles.modalEntityText}>
                    {detailTarget.refModel || 'notification'} · {detailTarget.refId || detailTarget._id}
                  </Text>
                </View>
                <Text style={styles.modalDate}>Received {formatISODate(detailTarget.createdAt)}</Text>

                {safeTarget(detailTarget) ? (
                  <Button
                    title="Open related screen"
                    variant="outline"
                    onPress={() => {
                      const target = safeTarget(detailTarget)!;
                      setDetailTarget(null);
                      router.push(target as never);
                    }}
                  />
                ) : null}

                <View style={styles.modalActions}>
                  {detailTarget.isRead ? (
                    <Button
                      title="Mark as unread"
                      variant="secondary"
                      style={styles.modalActionBtn}
                      onPress={() => markOne(detailTarget, false)}
                    />
                  ) : (
                    <Button
                      title="Mark as read"
                      variant="secondary"
                      style={styles.modalActionBtn}
                      onPress={() => markOne(detailTarget, true)}
                    />
                  )}
                  <Button
                    title="Delete"
                    variant="danger"
                    style={styles.modalActionBtn}
                    onPress={confirmDelete}
                    loading={pendingAction === 'delete'}
                  />
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AdminModuleScreen>
  );
}
const styles = StyleSheet.create({
  alertStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  alertDot: {
    width:  8,
    height: 8,
    borderRadius: 4,
  },
  alertLabel: {
    ...Typography.caption,
    fontWeight: '600',
    color: Palette.text,
  },
  controls: { gap: Spacing.xs },
  catRow: { gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  catChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
  },
  catChipActive: { backgroundColor: Palette.primaryLight, borderColor: Palette.primary },
  catLabel: { ...Typography.caption, fontWeight: '600', color: Palette.textMuted },
  catLabelActive: { color: Palette.primaryDark },
  searchWrap: { paddingHorizontal: Spacing.lg },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FDF0DC',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  inlineErrorText: { ...Typography.caption, color: '#9A6410', flex: 1 },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  resultCount: { ...Typography.caption, color: Palette.textMuted },
  markAllBtn: { minHeight:  36, paddingHorizontal: Spacing.sm, justifyContent: 'center' },
  markAllText: { ...Typography.label, color: Palette.primary },
  markAllDisabled: { color: Palette.textMuted, opacity: 0.6 },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.sm },
  separator: { height: Spacing.sm },
  row: { padding: 0 },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: Palette.primary },
  rowPressable: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, padding: Spacing.lg },
  rowTexts: { flex:  1, gap: Spacing.xs },
  rowTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowTitle: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600', flex: 1 },
  rowTitleUnread: { fontWeight: '700', color: Palette.primaryDark },
  unreadDot: { width:  9, height: 9, borderRadius: 5, backgroundColor: Palette.error, marginTop: 5 },
  rowMessage: { ...Typography.bodySmall, color: Palette.textMuted, lineHeight:  20 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  rowTime: { ...Typography.caption, color: Palette.textMuted },
  rowCategory: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  rowOpen: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rowOpenText: { ...Typography.caption, color: Palette.primary, fontWeight: '600' },
  iconCircle: { width:  38, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', borderWidth:1, borderColor: Palette.border },
  emptyTitle: { ...Typography.h4, color: Palette.text },
  emptyMessage: { ...Typography.bodySmall, color: Palette.textMuted, textAlign: 'center', maxWidth: 320 },
  skeletonList: { padding: Spacing.lg, gap: Spacing.md },
  skeletonCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth:1,
    borderColor: Palette.border,
  },
  skeletonIcon: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Palette.primaryLight },
  skeletonLines: { flex: 1, gap: Spacing.sm },
  skeletonLineWide: { height: 14, borderRadius: 4, backgroundColor: Palette.divider, width: '85%' },
  skeletonLineMid: { height: 12, borderRadius: 4, backgroundColor: Palette.divider, width: '60%' },
  skeletonLineShort: { height: 12, borderRadius: 4, backgroundColor: Palette.divider, width: '40%' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  modalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitles: { flex: 1, gap: 2 },
  modalTitle: { ...Typography.h4, color: Palette.text },
  modalSubtitle: { ...Typography.caption, color: Palette.textMuted },
  modalClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalMetaRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  modalMessage: { ...Typography.bodyMedium, color: Palette.text, lineHeight: 24 },
  modalEntity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  modalEntityText: { ...Typography.caption, color: Palette.textMuted, flex: 1 },
  modalDate: { ...Typography.caption, color: Palette.textMuted },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  modalActionBtn: { flex: 1 },
});