import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoleRoute } from '@/components/RoleRoute';
import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { StatCard } from '@/components/admin/StatCard';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { ErrorState } from '@/components/ui/ErrorState';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatINR } from '@/lib/format';
import { useAuth } from '@/hooks/use-auth';
import { canonicalRole } from '@/lib/roles';
import { toErrorMessage } from '@/services/api';
import * as adminService from '@/services/admin';

const QUICK_LINKS = [
  { label: 'Doctors', icon: 'medkit-outline', href: '/admin/doctors', accent: '#2F80ED' },
  { label: 'Verification', icon: 'shield-checkmark-outline', href: '/admin/doctor-verification', accent: '#7B61FF' },
  { label: 'Appointments', icon: 'calendar-outline', href: '/admin/appointments', accent: '#0E9F8E' },
  { label: 'Subscription', icon: 'card-outline', href: '/admin/subscription', accent: '#E89A3C' },
] as const;

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof adminService.getHospitalAdminDashboard>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.getHospitalAdminDashboard();
      setDashboard(res);
    } catch (err) {
      setError(toErrorMessage(err, 'Unable to load the dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const role = canonicalRole(user?.role);
  const totals = dashboard?.dashboard?.totals;

  return (
    <RoleRoute allowedRoles={['admin', 'super_admin']}>
      <View style={styles.safe}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#2F80ED1A' }]}>
            <Ionicons name="shield-checkmark" size={26} color="#2F80ED" />
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>
              {dashboard?.hospital?.name || 'Your hospital'} · {role.replace('_', ' ')}
            </Text>
          </View>
          <DrawerToggleButton />
        </View>

        {loading ? (
          <Loading label="Loading hospital data..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              <StatCard label="Doctors" value={totals?.doctors ?? 0} icon="medkit-outline" accent="#2F80ED" />
              <StatCard label="Patients" value={totals?.patients ?? 0} icon="people-outline" accent="#E89A3C" />
              <StatCard label="Today" value={totals?.today ?? 0} icon="calendar-outline" accent="#0E9F8E" />
              <StatCard label="Pending" value={totals?.pending ?? 0} icon="time-outline" accent="#D9435B" />
              <StatCard label="Completed" value={totals?.completed ?? 0} icon="checkmark-done-outline" accent="#2E9E5B" />
              <StatCard label="Revenue" value={formatINR(totals?.revenue)} icon="wallet-outline" accent="#7B61FF" />
            </View>

            <Text style={styles.sectionTitle}>Quick access</Text>
            <View style={styles.grid}>
              {QUICK_LINKS.map((link) => (
                <Pressable key={link.label} onPress={() => router.push(link.href as never)}>
                  <Card style={styles.quickCard}>
                    <View style={[styles.quickIcon, { backgroundColor: `${link.accent}1F` }]}>
                      <Ionicons name={link.icon} size={22} color={link.accent} />
                    </View>
                    <Text style={styles.quickLabel}>{link.label}</Text>
                  </Card>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </RoleRoute>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  iconCircle: { width: 48, height: 48, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  headerTexts: { flex: 1 },
  title: { ...Typography.h2, color: Palette.text },
  subtitle: { ...Typography.bodySmall, color: Palette.textMuted },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  sectionTitle: { ...Typography.label, color: Palette.text, marginTop: Spacing.xs },
  quickCard: { alignItems: 'flex-start', gap: Spacing.sm, minWidth: 150, flex: 1 },
  quickIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { ...Typography.bodySmall, fontWeight: '600', color: Palette.text },
});