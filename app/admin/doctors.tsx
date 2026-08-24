/**
 * HealPoint - Admin · Doctors (only this hospital's doctors).
 * Data comes from /hospital-admin/doctors which is scoped to the logged-in
 * Hospital Admin's own hospital on the server.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { StatusBadge, verificationStatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';
import type { Doctor } from '@/types';

export default function AdminDoctorsScreen() {
  const [query, setQuery] = useState('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalDoctors({ search: query.trim() || undefined });
      setDoctors(res.data || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load doctors.'));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdminModuleScreen
      title="Doctors"
      subtitle="Your hospital's doctors"
      allowedRoles={['admin']}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={(text) => { setQuery(text); load(); }} placeholder="Search doctors..." />
      </View>
      <FlatList
        data={doctors}
        keyExtractor={(item) => String(item._id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No doctors found" message="Doctors you add will appear here." />}
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.rowHeader}>
              <View style={styles.rowTitles}>
                <Text style={styles.name} numberOfLines={1}>{item.name || 'Doctor'}</Text>
                <Text style={styles.muted} numberOfLines={1}>{item.speciality || item.department || 'General'}</Text>
              </View>
              <View style={styles.badges}>
                {item.isActive === false ? <Badge label="Inactive" variant="neutral" /> : item.available !== false ? <Badge label="Available" variant="success" /> : <Badge label="Unavailable" variant="warning" />}
                <StatusBadge value={item.verificationStatus} variant={verificationStatusBadge(item.verificationStatus)} />
              </View>
            </View>
          </Card>
        )}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  row: { gap: Spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowTitles: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  muted: { ...Typography.bodySmall, color: Palette.textMuted },
  badges: { gap: Spacing.xs, alignItems: 'flex-end' },
});
