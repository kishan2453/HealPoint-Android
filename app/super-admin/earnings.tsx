/**
 * HealPoint - Super Admin · Earnings & Refunds.
 * Real platform figures from /user/get-stats + the platform appointment list.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { StatCard } from '@/components/admin/StatCard';
import { paymentStatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatINR } from '@/lib/format';
import * as appointmentService from '@/services/appointments';
import * as userService from '@/services/users';
import type { Appointment, PlatformStats } from '@/types';

export default function SuperAdminEarningsScreen() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, apptsRes] = await Promise.all([
        userService.getPlatformStats(),
        appointmentService.getAllAdminAppointments({ platform: true, limit: 200 }),
      ]);
      setStats(statsRes.stats || null);
      setAppointments(apptsRes.appointments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load earnings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const paid = appointments.filter((item) => item.paymentStatus === 'paid');
  const refunded = appointments.filter((item) => item.paymentStatus === 'refunded');
  const refundTotal = refunded.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <AdminModuleScreen title="Earnings & Refunds" loading={loading} error={error} onRetry={load}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          <StatCard label="Platform Earnings" value={formatINR(stats?.earnings ?? stats?.earnings)} icon="wallet-outline" accent="#2E9E5B" />
          <StatCard label="Paid Bookings" value={paid.length} icon="checkmark-circle-outline" accent="#0E9F8E" />
          <StatCard label="Refunds" value={formatINR(refundTotal)} icon="arrow-undo-outline" accent="#D9435B" />
          <StatCard label="Total Appointments" value={stats?.totalAppointments ?? appointments.length} icon="calendar-outline" accent="#2F80ED" />
        </View>

        <Text style={styles.sectionTitle}>Recent refunds</Text>
        {refunded.length === 0 ? (
          <Card padded>
            <Text style={styles.muted}>No refunds recorded yet.</Text>
          </Card>
        ) : (
          refunded.slice(0, 10).map((item) => (
            <Card key={String(item._id)} style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.rowTitles}>
                  <Text style={styles.name} numberOfLines={1}>
                    {typeof item.doctorId === 'object' && item.doctorId?.name ? item.doctorId.name : 'Doctor'} · {item.slotDate || ''}
                  </Text>
                  <Text style={styles.muted}>{item.hospitalName || 'Hospital'}</Text>
                </View>
                <Badge label={String(item.paymentStatus)} variant={paymentStatusBadge(item.paymentStatus)} />
              </View>
              <Text style={styles.meta}>Refunded {formatINR(item.amount)}</Text>
            </Card>
          ))
        )}
        <Text style={styles.sectionTitle}>Paid bookings</Text>
        {paid.length === 0 ? (
          <EmptyState title="No paid bookings yet" />
        ) : (
          paid.slice(0, 15).map((item) => (
            <Card key={String(item._id)} style={styles.row}>
              <View style={styles.rowHeader}>
                <View style={styles.rowTitles}>
                  <Text style={styles.name} numberOfLines={1}>
                    {typeof item.doctorId === 'object' && item.doctorId?.name ? item.doctorId.name : 'Doctor'} · {item.hospitalName || ''}
                  </Text>
                  <Text style={styles.muted}>{item.slotDate} {item.slotTime}</Text>
                </View>
                <Text style={styles.amount}>{formatINR(item.amount)}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Palette.text, marginTop: Spacing.sm },
  row: { gap: Spacing.xs },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  meta: { ...Typography.caption, color: Palette.textMuted },
  amount: { ...Typography.label, color: Palette.primaryDark },
});