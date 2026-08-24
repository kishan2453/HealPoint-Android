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
import * as subscriptionService from '@/services/subscriptions';
import * as userService from '@/services/users';
import type { SubscriptionOverview } from '@/types';

const QUICK_LINKS = [
  { label: 'Hospitals', icon: 'business-outline', href: '/super-admin/hospitals', accent: '#0E9F8E' },
  { label: 'Users', icon: 'people-outline', href: '/super-admin/users', accent: '#2F80ED' },
  { label: 'Doctor Verification', icon: 'shield-checkmark-outline', href: '/super-admin/doctor-verification', accent: '#7B61FF' },
  { label: 'Subscriptions', icon: 'card-outline', href: '/super-admin/subscriptions', accent: '#E89A3C' },
] as const;

export default function SuperAdminDashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<{ totalHospitals: number; totalDoctors: number; totalPatients: number; totalAppointments: number; earnings: number } | null>(null);
  const [overview, setOverview] = useState<SubscriptionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, subscriptionRes] = await Promise.all([
        userService.getPlatformStats(),
        subscriptionService.getSubscriptionOverview(),
      ]);
      setStats(statsRes.stats || null);
      setOverview(subscriptionRes.overview || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const role = canonicalRole(user?.role);

  return (
    <RoleRoute allowedRoles={['super_admin']}>
      <View style={styles.safe}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: '#E89A3C1A' }]}>
            <Ionicons name="planet" size={26} color="#E89A3C" />
          </View>
          <View style={styles.headerTexts}>
            <Text style={styles.title}>Super Admin Dashboard</Text>
            <Text style={styles.subtitle}>
              Signed in as {user?.name || 'admin'} · {role.replace('_', ' ')}
            </Text>
          </View>
          <DrawerToggleButton />
        </View>

        {loading ? (
          <Loading label="Loading platform data..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              <StatCard label="Hospitals" value={stats?.totalHospitals ?? 0} icon="business-outline" accent="#0E9F8E" />
              <StatCard label="Doctors" value={stats?.totalDoctors ?? 0} icon="medkit-outline" accent="#2F80ED" />
              <StatCard label="Patients" value={stats?.totalPatients ?? 0} icon="people-outline" accent="#E89A3C" />
              <StatCard label="Appointments" value={stats?.totalAppointments ?? 0} icon="calendar-outline" accent="#7B61FF" />
              <StatCard label="Active Subscriptions" value={overview?.activeSubscriptions ?? 0} icon="checkmark-done-outline" accent="#2E9E5B" />
              <StatCard label="Trial" value={overview?.trialCount ?? 0} icon="flask-outline" accent="#2F80ED" />
              <StatCard label="Platform Earnings" value={formatINR(stats?.earnings)} icon="wallet-outline" accent="#E89A3C" />
              <StatCard label="Expired" value={overview?.expiredCount ?? 0} icon="time-outline" accent="#D9435B" />
            </View>

            <Text style={styles.sectionTitle}>Quick access</Text>
            <View style={styles.grid}>
              {QUICK_LINKS.map((link) => (
                <Pressable
                  key={link.label}
                  onPress={() => router.push(link.href as never)}
                >
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
  subtitle: { ...Typography.bodySmall, color: Palette.textMuted, textTransform: 'capitalize' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  sectionTitle: { ...Typography.label, color: Palette.text, marginTop: Spacing.xs },
  quickCard: { alignItems: 'flex-start', gap: Spacing.sm, minWidth: 150, flex: 1 },
  quickIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { ...Typography.bodySmall, fontWeight: '600', color: Palette.text },
});