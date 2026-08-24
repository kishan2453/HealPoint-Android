/**
 * HealPoint - Hospital Admin · Doctor Verification.
 * Real doctors belonging ONLY to this hospital (server scopes by hospitalId).
 * Approve / reject updates the doctor's verification status.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { FilterChips } from '@/components/admin/FilterChips';
import { StatusBadge, verificationStatusBadge } from '@/components/admin/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';
import type { Doctor } from '@/types';

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Verified', value: 'Verified' },
  { label: 'Rejected', value: 'Rejected' },
];

export default function AdminDoctorVerificationScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<{ doctor: Doctor; status: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalDoctors({
        search: query.trim() || undefined,
        verificationStatus: filter,
      });
      setDoctors(res.data || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load doctors.'));
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      await adminService.updateDoctorVerificationStatus(pendingAction.doctor._id, {
        status: pendingAction.status,
        note: pendingAction.status === 'Verified' ? 'Approved by Hospital Admin' : 'Rejected by Hospital Admin',
      });
      setPendingAction(null);
      load();
    } catch (err) {
      setError(toErrorMessage(err, 'Verification update failed.'));
      setPendingAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminModuleScreen
      title="Doctor Verification"
      subtitle="Only your hospital's doctors"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={(text) => { setQuery(text); load(); }} placeholder="Search doctors..." />
      </View>
      <FilterChips options={STATUS_FILTERS} selected={filter} onSelect={(value) => { setFilter(value); load(); }} />
      <FlatList
        data={doctors}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No doctors found" message="Try a different filter or search." />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowTitles}>
                <Text style={styles.name} numberOfLines={1}>{item.name || 'Doctor'}</Text>
                <Text style={styles.muted} numberOfLines={1}>{item.speciality || item.department || 'General'}</Text>
              </View>
              <StatusBadge value={item.verificationStatus} variant={verificationStatusBadge(item.verificationStatus)} />
            </View>
            <View style={styles.actions}>
              <Button title="Approve" variant="secondary" fullWidth={false} style={styles.actionButton} onPress={() => setPendingAction({ doctor: item, status: 'Verified' })} />
              <Button title="Reject" variant="danger" fullWidth={false} style={styles.actionButton} onPress={() => setPendingAction({ doctor: item, status: 'Rejected' })} />
            </View>
          </Card>
        )}
      />
      <ConfirmDialog
        visible={Boolean(pendingAction)}
        title={`${pendingAction?.status === 'Verified' ? 'Approve' : 'Reject'} doctor?`}
        message={`${pendingAction?.doctor.name || 'This doctor'} will be ${pendingAction?.status === 'Verified' ? 'verified on the platform' : 'rejected'}.`}
        confirmLabel={pendingAction?.status === 'Verified' ? 'Approve' : 'Reject'}
        tone={pendingAction?.status === 'Verified' ? 'primary' : 'danger'}
        loading={actionLoading}
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.md },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  actions: { flexDirection: 'row', gap: Spacing.md },
  actionButton: { flex: 1, minHeight: 44 },
});