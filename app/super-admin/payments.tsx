/**
 * HealPoint - Super Admin · Payments.
 *
 * Real platform payment ledger built from existing backend data:
 *   - appointment payments (paid / refunded) from /appointment/get-all?platform=1
 *   - hospital subscription payments from /subscription
 * Nothing is invented — every row is a real transaction already stored.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge, paymentStatusBadge } from '@/components/admin/StatusBadge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { formatINR, formatISODate } from '@/lib/format';
import { toErrorMessage } from '@/services/api';
import * as appointmentService from '@/services/appointments';
import * as subscriptionService from '@/services/subscriptions';
import type { Appointment, Subscription } from '@/types';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Refunded', value: 'refunded' },
  { label: 'Pending', value: 'pending' },
  { label: 'Failed', value: 'failed' },
];

interface PaymentTxn {
  id: string;
  kind: 'Appointment' | 'Subscription';
  label: string;
  sublabel: string;
  amount: number;
  status: string;
  date?: string;
}

function doctorName(item: Appointment): string {
  if (typeof item.doctorId === 'object' && item.doctorId?.name) return item.doctorId.name;
  return 'Doctor';
}

function hospitalName(item: Appointment): string {
  if (typeof item.hospitalId === 'object' && item.hospitalId?.name) return item.hospitalId.name;
  return item.hospitalName || 'Hospital';
}
export default function SuperAdminPaymentsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [apptsRes, subsRes] = await Promise.all([
        appointmentService.getAllAdminAppointments({ platform: true, limit: 200 }),
        subscriptionService.getSubscriptions({ limit: 500 }).catch(() => ({ subscriptions: [] as Subscription[] })),
      ]);
      setAppointments(apptsRes.appointments || []);
      setSubscriptions(subsRes.subscriptions || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load payment records.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const transactions = useMemo<PaymentTxn[]>(() => {
    const apptTxns: PaymentTxn[] = appointments
      .filter((a) => a.paymentStatus && a.paymentStatus !== 'unknown')
      .map((a) => ({
        id: `appt-${String(a._id)}`,
        kind: 'Appointment' as const,
        label: doctorName(a),
        sublabel: `${hospitalName(a)} · ${a.slotDate || ''} ${a.slotTime || ''}`,
        amount: Number(a.amount || 0),
        status: String(a.paymentStatus),
        date: a.createdAt,
      }));
    const subTxns: PaymentTxn[] = [];
    subscriptions.forEach((sub) => {
      (sub.payments || []).forEach((p) => {
        subTxns.push({
          id: `sub-${String(sub._id)}-${String(p._id || subTxns.length)}`,
          kind: 'Subscription',
          label: sub.hospital?.name || sub.hospitalName || 'Hospital',
          sublabel: `${sub.planName || sub.planKey || 'Plan'} subscription`,
          amount: Number(p.amount || 0),
          status: String(p.paymentStatus || sub.paymentStatus || 'unknown'),
          date: p.paidAt || p.createdAt || sub.updatedAt,
        });
      });
    });
    return [...subTxns, ...apptTxns].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [appointments, subscriptions]);

  const visible = filter === 'all' ? transactions : transactions.filter((t) => t.status === filter);
  const totalValue = transactions.reduce((s, t) => s + t.amount, 0);
  const paidCount = transactions.filter((t) => t.status === 'paid').length;
  const refundTotal = transactions.filter((t) => t.status === 'refunded').reduce((s, t) => s + t.amount, 0);

  return (
    <AdminModuleScreen
      title="Payments"
      subtitle={`${transactions.length} recorded transaction(s)`}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <View style={styles.headerWrap}>
        <View style={styles.grid}>
          <StatCard label="Transaction Value" value={formatINR(totalValue)} icon="wallet-outline" accent="#2E9E5B" />
          <StatCard label="Paid" value={paidCount} icon="checkmark-circle-outline" accent="#0E9F8E" />
          <StatCard label="Refunded Total" value={formatINR(refundTotal)} icon="arrow-undo-outline" accent="#D9435B" />
        </View>
        <FilterChips options={STATUS_FILTERS} selected={filter} onSelect={setFilter} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          !loading ? (
            <EmptyState title="No payment transactions" message="Payments will appear here once bookings and subscriptions are processed." />
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.rowTexts}>
                <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.sublabel} numberOfLines={1}>{item.sublabel}</Text>
              </View>
              <StatusBadge value={item.status} variant={paymentStatusBadge(item.status)} />
            </View>
            <View style={styles.rowBottom}>
              <Text style={styles.kind}>{item.kind}</Text>
              <Text style={styles.amount}>{formatINR(item.amount)}</Text>
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  headerWrap: { gap: Spacing.md, marginBottom: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  separator: { height: Spacing.md },
  row: { gap: Spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTexts: { flex: 1, gap: 2 },
  label: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600' },
  sublabel: { ...Typography.bodySmall, color: Palette.textMuted },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { ...Typography.caption, color: Palette.textMuted },
  amount: { ...Typography.label, color: Palette.primaryDark },
});
