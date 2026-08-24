/**
 * HealPoint - Hospital Admin · Doctor Availability.
 * Toggle doctor availability for this hospital only. Scoped server-side; action
 * is only available to Hospital Admin accounts (Super Admin blocked by API).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { StatusBadge, verificationStatusBadge } from '@/components/admin/StatusBadge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';
import type { Doctor } from '@/types';

export default function AdminDoctorAvailabilityScreen() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalDoctors();
      setDoctors(res.data || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load doctors.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (doctor: Doctor, next: boolean) => {
    setTogglingId(String(doctor._id));
    try {
      await adminService.toggleDoctorAvailability(String(doctor._id), next);
      setDoctors((prev) => prev.map((item) => (String(item._id) === String(doctor._id) ? { ...item, available: next } : item)));
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to update availability.'));
    } finally {
      setTogglingId('');
    }
  };

  return (
    <AdminModuleScreen
      title="Doctor Availability"
      subtitle="Manage when your doctors accept bookings"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <FlatList
        data={doctors}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No doctors yet" message="Add doctors to manage their availability." />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowTitles}>
                <Text style={styles.name} numberOfLines={1}>{item.name || 'Doctor'}</Text>
                <Text style={styles.muted} numberOfLines={1}>{item.speciality || item.department || 'General'}</Text>
              </View>
              <Switch
                value={item.available !== false}
                onValueChange={(value) => toggle(item, value)}
                disabled={togglingId === String(item._id)}
                trackColor={{ false: Palette.border, true: Palette.primary }}
                thumbColor={Palette.white}
              />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{item.available !== false ? 'Available for bookings' : 'Not accepting bookings'}</Text>
              <StatusBadge value={item.verificationStatus} variant={verificationStatusBadge(item.verificationStatus)} />
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