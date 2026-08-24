/**
 * HealPoint - Super Admin · Appointments.
 * Real platform appointment list from GET /appointment/get-all?platform=1.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatusBadge, appointmentStatusBadge, paymentStatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Palette, Spacing, Typography } from '@/constants/theme';
import * as appointmentService from '@/services/appointments';
import type { Appointment } from '@/types';
import { formatINR } from '@/lib/format';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancel' },
  { label: 'Missed', value: 'missed' },
];

function appointmentDoctorName(item: Appointment): string {
  const doctor = item.doctorId;
  if (typeof doctor === 'string') return 'Doctor';
  return doctor?.name || 'Unknown doctor';
}

function appointmentHospital(item: Appointment): string {
  const hospital = item.hospitalId;
  if (typeof hospital === 'string') return '—';
  return hospital?.name || item.hospitalName || '—';
}

export default function SuperAdminAppointmentsScreen() {
  const [filter, setFilter] = useState('all');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await appointmentService.getAllAdminAppointments({ platform: true, limit: 100 });
      setAppointments(res.appointments || []);
      setTotal(res.totalCount || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = filter === 'all' ? appointments : appointments.filter((item) => item.status === filter);

  return (
    <AdminModuleScreen
      title="Appointments"
      subtitle={`${total} appointment(s) on the platform`}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <FilterChips options={STATUS_FILTERS} selected={filter} onSelect={setFilter} />
      <FlatList
        data={visible}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No appointments" message="Bookings will appear here in real time." />
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowTitles}>
                <Text style={styles.name} numberOfLines={1}>
                  {appointmentDoctorName(item)}
                </Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {appointmentHospital(item)} · {item.slotDate || 'date unknown'} {item.slotTime || ''}
                </Text>
              </View>
              <StatusBadge value={item.status} variant={appointmentStatusBadge(item.status)} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>Amount {formatINR(item.amount)}</Text>
              <Badge label={String(item.paymentStatus || 'unknown')} variant={paymentStatusBadge(item.paymentStatus)} />
            </View>
          </Card>
        )}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { ...Typography.caption, color: Palette.textMuted },
});