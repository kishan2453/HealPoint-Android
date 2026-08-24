/**
 * HealPoint - reusable role dashboard scaffold.
 *
 * Shown until the backend role-scoped endpoints are live. Provides the module
 * header, the current user's canonical role and an honest "awaiting backend"
 * list of the planned sub-modules — it never fabricates data or leaves a blank
 * screen. Once the endpoints exist these screens are filled in with real data.
 */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { canonicalRole, type CanonicalRole } from '@/lib/roles';

interface RoleDashboardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  modules: string[];
}

export function RoleDashboard({ title, icon, accent, modules }: RoleDashboardProps) {
  const router = useRouter();
  const { user, signOut, isLoading } = useAuth();
  const role: CanonicalRole = canonicalRole(user?.role);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: `${accent}1A` }]}>
          <Ionicons name={icon} size={26} color={accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            Signed in as {user?.name || 'user'} · {role.replace('_', ' ')}
          </Text>
        </View>
        <DrawerToggleButton />
      </View>

      {isLoading ? (
        <ActivityIndicator color={accent} style={styles.spinner} />
      ) : (
        <>
          <Card padded>
            <View style={styles.moduleHeader}>
              <Text style={styles.moduleTitle}>Module is ready</Text>
              <Text style={styles.moduleStatus}>Awaiting backend</Text>
            </View>
            {modules.map((label) => (
              <View key={label} style={styles.moduleRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={Palette.success} />
                <Text style={styles.moduleRowText}>{label}</Text>
              </View>
            ))}
          </Card>

          <EmptyState
            title={`The ${title} is waiting on its backend endpoints`}
            message="Role-based APIs are being wired up on the server. This dashboard will populate with live data once they ship. The patient app continues to work normally."
          />

          <Button
            title="Logout"
            variant="outline"
            onPress={async () => {
              await signOut();
              // ProtectedRoute/RoleRoute redirect to /welcome automatically once
              // the auth state clears.
              router.replace('/welcome');
            }}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  spinner: {
    marginTop: Spacing.xxl,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  moduleTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  moduleStatus: {
    ...Typography.caption,
    color: Palette.warning,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  moduleRowText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
});
