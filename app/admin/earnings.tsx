/**
 * HealPoint - Hospital Admin · Earnings.
 * Real revenue figures for this hospital from /hospital-admin/dashboard.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { StatCard } from '@/components/admin/StatCard';
import { Card } from '@/components/ui/Card';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatINR } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';
import type { HospitalAdminDashboardResponse } from '@/types';

export default function AdminEarningsScreen() {
  const [data, setData] = useState<HospitalAdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalAdminDashboard();
      setData(res);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load earnings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.dashboard?.totals;
  const monthly = data?.dashboard?.monthly || [];
  const maxMonthly = Math.max(1, ...monthly.map((item) => Number(item.value) || 0));

  return (
    <AdminModuleScreen title="Earnings" subtitle="Your hospital's revenue" allowedRoles={['admin']} loading={loading} error={error} onRetry={load}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <StatCard label="Revenue" value={formatINR(totals?.revenue)} icon="wallet-outline" accent="#2E9E5B" />
          <StatCard label="Doctors" value={totals?.doctors ?? 0} icon="medkit-outline" accent="#2F80ED" />
          <StatCard label="Patients" value={totals?.patients ?? 0} icon="people-outline" accent="#E89A3C" />
          <StatCard label="Today" value={totals?.today ?? 0} icon="calendar-outline" accent="#7B61FF" />
          <StatCard label="Pending" value={totals?.pending ?? 0} icon="time-outline" accent="#D9435B" />
          <StatCard label="Completed" value={totals?.completed ?? 0} icon="checkmark-done-outline" accent="#0E9F8E" />
        </View>

        <Card padded>
          <Text style={styles.sectionTitle}>Revenue · last 6 months (₹)</Text>
          {monthly.map((item) => (
            <View key={item.label} style={styles.barRow}>
              <Text style={styles.barLabel}>{item.label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(4, Math.round((Number(item.value) / maxMonthly) * 100))}%` }]} />
              </View>
              <Text style={styles.barValue}>{formatINR(item.value)}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  sectionTitle: { ...Typography.label, color: Palette.text, marginBottom: Spacing.md },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  barLabel: { ...Typography.caption, color: Palette.textMuted, width: 44 },
  barTrack: { flex: 1, height: 10, backgroundColor: Palette.background, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, backgroundColor: Palette.primary, borderRadius: 5 },
  barValue: { ...Typography.caption, color: Palette.text, width: 88, textAlign: 'right' },
});