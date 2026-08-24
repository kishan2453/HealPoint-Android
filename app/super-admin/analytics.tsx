/**
 * HealPoint - Super Admin · Platform Analytics.
 * Live platform totals from /user/get-stats + /user/analytics.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { StatCard } from '@/components/admin/StatCard';
import { Card } from '@/components/ui/Card';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatISODate } from '@/lib/format';
import * as consultationService from '@/services/consultations';
import * as userService from '@/services/users';
import type { PlatformAnalytics, PlatformStats, SuperAdminConsultationStats } from '@/types';

export default function PlatformAnalyticsScreen() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [consultationStats, setConsultationStats] = useState<SuperAdminConsultationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [statsRes, analyticsRes, consultRes] = await Promise.all([
        userService.getPlatformStats(),
        userService.getPlatformAnalytics(),
        consultationService.getSuperAdminConsultationStats().catch(() => null),
      ]);
      setStats(statsRes.stats || null);
      setAnalytics(analyticsRes.analytics || null);
      setConsultationStats(consultRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load platform analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminModuleScreen
      title="Platform Analytics"
      subtitle="Platform-wide performance"
      loading={loading}
      error={error}
      onRetry={() => load()}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          <StatCard label="Hospitals" value={stats?.totalHospitals ?? analytics?.totalHospitals ?? 0} icon="business-outline" accent="#0E9F8E" />
          <StatCard label="Doctors" value={stats?.totalDoctors ?? analytics?.totalDoctors ?? 0} icon="medkit-outline" accent="#2F80ED" />
          <StatCard label="Patients" value={stats?.totalPatients ?? analytics?.totalPatients ?? 0} icon="people-outline" accent="#E89A3C" />
          <StatCard label="Appointments" value={stats?.totalAppointments ?? analytics?.totalAppointments ?? 0} icon="calendar-outline" accent="#7B61FF" />
          <StatCard label="Missed" value={stats?.missedAppointments ?? 0} icon="alert-circle-outline" accent="#D9435B" />
          <StatCard label="Total Users" value={stats?.totalUsers ?? 0} icon="person-outline" accent="#2E9E5B" />
        </View>

        {consultationStats ? (
          <>
            <Text style={styles.sectionTitle}>Online consultations</Text>
            <View style={styles.grid}>
              <StatCard label="Online consultations" value={consultationStats.stats?.total ?? 0} icon="videocam-outline" accent="#0E9F8E" />
              <StatCard label="Upcoming" value={consultationStats.stats?.upcoming ?? 0} icon="calendar-outline" accent="#E89A3C" />
              <StatCard label="Completed" value={consultationStats.stats?.completed ?? 0} icon="checkmark-circle-outline" accent="#2E9E5B" />
              <StatCard label="Cancelled" value={consultationStats.stats?.cancelled ?? 0} icon="close-circle-outline" accent="#D9435B" />
              <StatCard label="Active online doctors" value={consultationStats.stats?.activeOnlineDoctors ?? 0} icon="pulse-outline" accent="#2F80ED" />
              <StatCard
                label="Consultation revenue"
                value={`₹${(consultationStats.stats?.consultationRevenue ?? 0).toLocaleString('en-IN')}`}
                icon="cash-outline"
                accent="#7B61FF"
              />
            </View>
          </>
        ) : null}

        <Card padded>
          <Text style={styles.sectionTitle}>Appointment status breakdown</Text>
          <View style={styles.chipRow}>
            {(analytics?.appointmentStatusCounts || []).map((item) => (
              <View key={item._id || 'unknown'} style={styles.chip}>
                <Text style={styles.chipLabel}>
                  {String(item._id || 'unknown').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
                <Text style={styles.chipValue}>{item.count}</Text>
              </View>
            ))}
            {!analytics?.appointmentStatusCounts?.length ? (
              <Text style={styles.muted}>No appointments recorded yet.</Text>
            ) : null}
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Platform health</Text>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Active hospitals</Text>
            <Text style={styles.healthValue}>{analytics?.activeHospitals ?? 0} / {analytics?.totalHospitals ?? 0}</Text>
          </View>
          <View style={styles.healthRow}>
            <Text style={styles.healthLabel}>Platform earnings</Text>
            <Text style={styles.healthValue}>
              ₹{(stats?.earnings ?? 0).toLocaleString('en-IN')}
            </Text>
          </View>
          <Text style={styles.updatedAt}>Updated {formatISODate(new Date())}</Text>
        </Card>
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  sectionTitle: { ...Typography.label, color: Palette.text, marginBottom: Spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.background,
    borderRadius: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  chipValue: { ...Typography.label, color: Palette.primaryDark },
  emptyText: { ...Typography.bodySmall, color: Palette.textMuted },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  healthLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  healthValue: { ...Typography.label, color: Palette.text },
  updatedAt: { ...Typography.caption, color: Palette.textMuted, marginTop: Spacing.md },
});