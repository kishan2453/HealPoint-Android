/** HealPoint - Super Admin Â· Reports (operational summary + export). */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { AnalyticsSkeleton } from '@/components/admin/AnalyticsSkeleton';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge, appointmentStatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { appointmentStatusBreakdown, appointmentSummaryRows, buildAppointmentsCsv, findRangePreset, normalizeStatus } from '@/lib/analytics';
import { formatINR } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import * as subscriptionService from '@/services/subscriptions';
import * as userService from '@/services/users';
import type { Appointment, PlatformAnalytics, PlatformStats, SubscriptionOverview } from '@/types';

export default function SuperAdminReportsScreen() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [statsRes, analyticsRes, overviewRes, apptsRes] = await Promise.all([
        userService.getPlatformStats(),
        userService.getPlatformAnalytics().catch(() => null),
        subscriptionService.getSubscriptionOverview().catch(() => null),
        appointmentService.getAllAdminAppointments({ platform: true, limit: 200 }).catch(() => null),
      ]);
      setStats(statsRes.stats || null);
      setAnalytics(analyticsRes?.analytics || null);
      setOverview(overviewRes?.overview || null);
      setAppointments(apptsRes?.appointments || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load platform reports.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const range = findRangePreset('all');
  const statusBreakdown = useMemo(() => appointmentStatusBreakdown(appointments), [appointments]);
  const summaryRows = useMemo(() => appointmentSummaryRows(appointments), [appointments]);

  const billingRate = overview?.totalSubscriptions
    ? Math.round(((overview.activeCount || 0) / overview.totalSubscriptions) * 100)
    : 0;
const doExport = useCallback(async () => {
    if (appointments.length === 0) {
      setExported('Nothing to export yet.');
      return;
    }
    setExporting(true);
    try {
      const file = buildAppointmentsCsv(appointments, range, Date.now());
      // Share the real CSV text (columns + rows) so the recipient can save it.
      await Share.share({ message: file.content, title: file.filename });
      setExported(`CSV ready: ${file.filename} (${appointments.length} row(s))`);
    } catch (err) {
      setExported(toErrorMessage(err, 'Export failed.'));
    } finally {
      setExporting(false);
    }
  }, [appointments, range]);

  return (
    <AdminModuleScreen
      title="Reports"
      subtitle="Platform operational summary"
      loading={loading}
      error={error}
      onRetry={load}
      loadingComponent={<AnalyticsSkeleton />}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <View style={styles.grid}>
          <StatCard label="Total Patients" value={stats?.totalPatients ?? 'â€”'} icon="people-outline" accent="#E89A3C" />
          <StatCard label="Total Doctors" value={stats?.totalDoctors ?? 'â€”'} icon="medkit-outline" accent="#2F80ED" />
          <StatCard label="Total Hospitals" value={stats?.totalHospitals ?? 'â€”'} icon="business-outline" accent="#0E9F8E" />
          <StatCard label="Total Appointments" value={stats?.totalAppointments ?? appointments.length} icon="calendar-outline" accent="#7B61FF" />
          <StatCard label="Completed" value={(analytics?.appointmentStatusCounts || []).find((s) => normalizeStatus(s._id) === 'completed')?.count ?? 'â€”'} icon="checkmark-done-outline" accent="#2E9E5B" />
          <StatCard label="Cancelled" value={(analytics?.appointmentStatusCounts || []).find((s) => normalizeStatus(s._id) === 'cancel')?.count ?? 'â€”'} icon="close-circle-outline" accent="#D9435B" />
          <StatCard label="Total Users" value={stats?.totalUsers ?? 'â€”'} icon="person-outline" accent="#2E9E5B" />
          <StatCard label="Platform Earnings" value={formatINR(stats?.earnings)} icon="wallet-outline" accent="#2E9E5B" />
        </View>

        <Text style={styles.sectionTitle}>Financial</Text>
        <View style={styles.grid}>
          <StatCard label="Subscription Revenue" value={formatINR(overview?.revenue)} icon="card-outline" accent="#7B61FF" />
          <StatCard label="Paid Subscriptions" value={formatINR(overview?.paidRevenue)} icon="checkmark-circle-outline" accent="#0E9F8E" />
          <StatCard label="Billing Health" value={overview ? `${billingRate}%` : 'â€”'} icon="pulse-outline" accent="#2F80ED" />
          <StatCard label="Active Subscriptions" value={overview?.activeSubscriptions ?? overview?.activeCount ?? 'â€”'} icon="flask-outline" accent="#0E9F8E" />
        </View>

        <Text style={styles.sectionTitle}>Appointment status</Text>
        <Card padded>
          {statusBreakdown.length === 0 ? (
            <EmptyState title="No appointments recorded yet" />
          ) : (
            statusBreakdown.map((item) => (
              <View key={item.status || 'unknown'} style={styles.statusRow}>
                <StatusBadge value={item.status} variant={appointmentStatusBadge(item.status)} />
                <Text style={styles.statusCount}>{item.count}</Text>
              </View>
            ))
          )}
        </Card>

        <Text style={styles.sectionTitle}>Appointments by doctor & hospital</Text>
        <Card padded>
          {summaryRows.length === 0 ? (
            <EmptyState title="No appointments recorded yet" />
          ) : (
            summaryRows.slice(0, 10).map((row, index) => (
              <View key={row.hospital + '|' + row.doctor + '|' + index} style={styles.statusRow}>
                <View style={styles.summaryTexts}>
                  <Text style={styles.summaryMain} numberOfLines={1}>{row.doctor}</Text>
                  <Text style={styles.summarySub} numberOfLines={1}>{row.hospital}</Text>
                </View>
                <Text style={styles.statusCount}>{row.appointments}</Text>
              </View>
            ))
          )}
        </Card>

        <Text style={styles.sectionTitle}>Subscriptions</Text>
        <Card padded>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total subscriptions</Text>
            <Text style={styles.detailValue}>{overview?.totalSubscriptions ?? 'â€”'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Trial</Text>
            <Text style={styles.detailValue}>{overview?.trialCount ?? 'â€”'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expired</Text>
            <Text style={styles.detailValue}>{overview?.expiredCount ?? 'â€”'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Expiring within 30 days</Text>
            <Text style={styles.detailValue}>{overview?.expiringCount ?? 'â€”'}</Text>
          </View>
        </Card>

        <Card padded>
          <Text style={styles.sectionTitle}>Export report</Text>
          <Text style={styles.muted}>Exports the {appointments.length} loaded real appointment record(s) as CSV.</Text>
          <Button
            title={exporting ? 'Preparing...' : 'Export CSV'}
            variant="outline"
            icon="download-outline"
            loading={exporting}

            disabled={appointments.length === 0}
            onPress={doExport}
            style={styles.exportBtn}
          />
          {exported ? <FormMessage type={exported.startsWith('Nothing') || exported.startsWith('Export failed') ? 'error' : 'success'} message={exported} /> : null}
        </Card>
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  sectionTitle: { ...Typography.label, color: Palette.text, marginBottom: Spacing.xs, marginTop: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
    gap: Spacing.md,
  },
  statusCount: { ...Typography.label, color: Palette.text },
  summaryTexts: { flex: 1, gap: 2 },
  summaryMain: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600' },
  summarySub: { ...Typography.caption, color: Palette.textMuted },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  detailLabel: { ...Typography.bodySmall, color: Palette.textMuted },
  detailValue: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  exportBtn: { minHeight: 44, marginTop: Spacing.md },
});
