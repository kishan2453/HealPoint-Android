/**
 * HealPoint - Super Admin Dashboard.
 *
 * Professional, data-first overview of the whole platform. Every number here
 * comes from a real backend endpoint: /user/get-stats, /user/analytics and
 * /subscription/overview. Nothing is invented: when an API fails the failed
 * section is simply omitted (or the whole screen shows a retry state) so the
 * dashboard never fakes data.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { StatCard } from '@/components/admin/StatCard';
import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { RoleRoute } from '@/components/RoleRoute';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationBadge } from '@/hooks/use-notifications';
import { formatINR } from '@/lib/format';
import { canonicalRole } from '@/lib/roles';
import { toErrorMessage } from '@/services/api';
import * as subscriptionService from '@/services/subscriptions';
import * as userService from '@/services/users';
import type { PlatformAnalytics, PlatformStats, SubscriptionOverview } from '@/types';

const QUICK_LINKS = [
  { label: 'Hospitals', icon: 'business-outline', href: '/super-admin/hospitals', accent: '#0E9F8E' },
  { label: 'Users', icon: 'people-outline', href: '/super-admin/users', accent: '#2F80ED' },
  { label: 'Doctors', icon: 'medkit-outline', href: '/super-admin/doctors', accent: '#7B61FF' },
  { label: 'Hospital Admins', icon: 'person-circle-outline', href: '/super-admin/admins', accent: '#E89A3C' },
  { label: 'Appointments', icon: 'calendar-outline', href: '/super-admin/appointments', accent: '#D9435B' },
  { label: 'Subscriptions', icon: 'card-outline', href: '/super-admin/subscriptions', accent: '#2E9E5B' },
] as const;

export default function SuperAdminDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [statsRes, analyticsRes, overviewRes] = await Promise.all([
        userService.getPlatformStats(),
        userService.getPlatformAnalytics().catch(() => null),
        subscriptionService.getSubscriptionOverview().catch(() => null),
      ]);
      setStats(statsRes.stats || null);
      setAnalytics(analyticsRes?.analytics || null);
      setOverview(overviewRes?.overview || null);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load the dashboard.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function statusCount(status: string): number | undefined {
    return (analytics?.appointmentStatusCounts || []).find((item) => String(item._id).toLowerCase() === status.toLowerCase())?.count;
  }

  const role = canonicalRole(user?.role);
  const activeHospitals = analytics?.activeHospitals;
  const { unreadCount } = useNotificationBadge({ intervalMs: 30000 });
  
  return (
    <RoleRoute allowedRoles={['super_admin']}>
      <View style={styles.safe}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#0E9F8E1F' }]}>
            <Ionicons name="planet" size={26} color="#0E9F8E" />
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.title}>Super Admin Dashboard</Text>
            <Text style={styles.subtitle}>
              {user?.name || 'Admin'} · {role.replace('_', ' ')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications and alerts"
            onPress={() => router.push('/super-admin/notifications' as never)}
            hitSlop={8}
            style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
          >
            <Ionicons name="notifications-outline" size={22} color={Palette.text} />
            {unreadCount > 0 ? (
              <View style={styles.badgeDot}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <DrawerToggleButton />
        </View>

        {loading ? (
          <Loading label="Loading platform data..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          >
            <Card style={styles.summaryRow}>
              <View style={styles.summaryTexts}>
                <Text style={styles.summaryTitle}>Platform overview</Text>
                <Text style={styles.summarySubtitle}>
                  {activeHospitals !== undefined
                    ? `${activeHospitals} of ${stats?.totalHospitals ?? 0} hospitals active`
                    : `${stats?.totalHospitals ?? 0} registered hospitals`}
                </Text>
              </View>
              <View style={styles.summaryAmount}>
                <Text style={styles.summaryAmountLabel}>Platform revenue</Text>
                <Text style={styles.summaryAmountValue}>{formatINR(stats?.earnings)}</Text>
              </View>
            </Card>

            <View style={styles.grid}>
              <StatCard label="Total Hospitals" value={stats?.totalHospitals ?? 0} icon="business-outline" accent="#0E9F8E" hint={activeHospitals !== undefined ? `${activeHospitals} active` : undefined} />
              <StatCard label="Active Hospitals" value={activeHospitals ?? '—'} icon="checkmark-circle-outline" accent="#2E9E5B" />
              <StatCard label="Total Doctors" value={stats?.totalDoctors ?? 0} icon="medkit-outline" accent="#2F80ED" />
              <StatCard label="Total Patients" value={stats?.totalPatients ?? 0} icon="people-outline" accent="#E89A3C" />
              <StatCard label="Total Appointments" value={stats?.totalAppointments ?? 0} icon="calendar-outline" accent="#7B61FF" />
              <StatCard label="Pending Appointments" value={statusCount('pending') ?? '—'} icon="time-outline" accent="#E89A3C" />
              <StatCard label="Completed Appointments" value={statusCount('completed') ?? '—'} icon="checkmark-done-outline" accent="#2E9E5B" />
              <StatCard label="Cancelled Appointments" value={statusCount('cancel') ?? '—'} icon="close-circle-outline" accent="#D9435B" />
              <StatCard label="Total Revenue" value={formatINR(stats?.earnings)} icon="wallet-outline" accent="#2E9E5B" hint="Live platform earnings" />
              <StatCard label="Active Subscriptions" value={overview?.activeSubscriptions ?? '—'} icon="card-outline" accent="#0E9F8E" />
              <StatCard label="Expiring Soon" value={overview?.expiringCount ?? '—'} icon="alarm-outline" accent="#E89A3C" hint={overview?.expiringCount ? `within 30 days` : undefined} />
              <StatCard label="Trial Subscriptions" value={overview?.trialCount ?? '—'} icon="flask-outline" accent="#2F80ED" />
              <StatCard label="Expired Subscriptions" value={overview?.expiredCount ?? '—'} icon="time-outline" accent="#D9435B" />
              <StatCard label="Cancelled Subscriptions" value={overview?.cancelledCount ?? '—'} icon="close-circle-outline" accent="#D9435B" />
            </View>

            <Text style={styles.sectionTitle}>Quick access</Text>
            <View style={styles.grid}>
              {QUICK_LINKS.map((link) => (
                <Pressable key={link.label} onPress={() => router.push(link.href as never)}>
                  <Card style={styles.quickCard}>
                    <View style={[styles.quickIcon, { backgroundColor: `${link.accent}1F` }]}>
                      <Ionicons name={link.icon} size={22} color={link.accent} />
                    </View>
                    <Text style={styles.quickLabel}>{link.label}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </RoleRoute>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  iconCircle: { width: 48, height: 48, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  bellButton: {
    width: 40,
    height:   40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
  },
  badgeDot: {
    position: 'absolute',
    top:  -2,
    right: -2,
    minWidth:  18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: Spacing.xxs,
    backgroundColor: Palette.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Palette.background,
  },
  badgeText: {
    ...Typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: Palette.white,
    fontWeight: '700',
  },
  pressed: { opacity: 0.6 },
  headerTexts: { flex: 1 },
  title: { ...Typography.h2, color: Palette.text },
  subtitle: { ...Typography.bodySmall, color: Palette.textMuted, textTransform: 'capitalize' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, flexWrap: 'wrap' },
  summaryTexts: { flex: 1, gap: 2 },
  summaryTitle: { ...Typography.h4, color: Palette.text },
  summarySubtitle: { ...Typography.bodySmall, color: Palette.textMuted },
  summaryAmount: { alignItems: 'flex-end' },
  summaryAmountLabel: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  summaryAmountValue: { ...Typography.h3, color: Palette.primaryDark },
  sectionTitle: { ...Typography.label, color: Palette.text, marginTop: Spacing.xs },
  quickCard: { alignItems: 'flex-start', gap: Spacing.sm, minWidth: 150, flex: 1 },
  quickIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { ...Typography.bodySmall, fontWeight: '600', color: Palette.text },
});