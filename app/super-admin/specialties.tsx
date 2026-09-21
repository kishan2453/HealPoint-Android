/**
 * HealPoint - Super Admin · Specialties.
 *
 * Real specialty catalog derived from live doctor data (GET /doctor/get-all
 * platform mode). Every specialty shows the actual doctor count from the
 * database — nothing is invented. Empty states and retry are handled.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchBar } from '@/components/ui/SearchBar';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { toErrorMessage } from '@/services/api';
import { getAllDoctors } from '@/services/doctors';
import type { Doctor } from '@/types';

function specialtyOf(doctor: Doctor): string {
  return (
    doctor.speciality ||
    doctor.specialization ||
    doctor.department ||
    'General'
  ).trim();
}

export default function SuperAdminSpecialtiesScreen() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (asRefresh = false) => {
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getAllDoctors({ platform: true, limit: 500 });
      setDoctors(res.doctors || []);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load specialties.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const specialties = useMemo(() => {
    const counts = new Map<string, number>();
    doctors.forEach((d) => {
      const key = specialtyOf(d);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const term = query.trim().toLowerCase();
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .filter((item) => !term || item.name.toLowerCase().includes(term))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [doctors, query]);

  return (
    <AdminModuleScreen
      title="Specialties"
      subtitle={`${specialties.length} specialty/ies from ${doctors.length} doctor(s)`}
      loading={loading}
      error={error}
      onRetry={load}
    >
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search specialties..." />
      </View>
      <FlatList
        data={specialties}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          !loading ? (
            doctors.length === 0 ? (
              <EmptyState title="No specialties yet" message="Specialties will appear here as doctors are added to the platform." />
            ) : (
              <EmptyState title="No matching specialties" message="Try a different search." />
            )
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <View style={styles.iconCircle}>
              <Ionicons name="ribbon-outline" size={18} color={Palette.primaryDark} />
            </View>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{item.count} doctor{item.count === 1 ? '' : 's'}</Text>
            </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  separator: { height: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '600', flex: 1 },
  countPill: {
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  countText: { ...Typography.caption, color: Palette.primaryDark, fontWeight: '600' },
});
