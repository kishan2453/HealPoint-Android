/**
 * HealPoint - Doctor profile module (doctor app).
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RoleGuard } from '@/components/RoleGuard';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { getUserImage } from '@/lib/image';

type Action = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

export default function DoctorProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const actions: Action[] = [
    { label: 'Edit profile', icon: 'create-outline', href: '/profile/edit' },
    { label: 'Change password', icon: 'lock-closed-outline', href: '/profile/change-password' },
    { label: 'Notifications', icon: 'notifications-outline', href: '/notification' },
    { label: 'Settings', icon: 'settings-outline', href: '/settings' },
  ];

  return (
    <RoleGuard allowedRoles={['doctor']}>
      <Screen>
        <AppHeader title="Profile" showBack />
        <Card padded style={styles.headerCard}>
          <View style={styles.avatarWrap}>
            {user?.image ? (
              <Image
                source={{ uri: getUserImage(user.image) }}
                style={styles.avatar}
                contentFit="cover"
                transition={150}
              />
            ) : null}
            <Text style={styles.avatarFallback}>{(user?.name || 'D').slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name || 'Doctor'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.roleText}>Doctor</Text>
          </View>
        </Card>

        <Card padded style={styles.actionsCard}>
          {actions.map((action, index) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={() => router.push(action.href as never)}
              style={({ pressed }) => [
                styles.actionRow,
                index < actions.length - 1 && styles.actionBorder,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={action.icon} size={18} color={Palette.primary} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
            </Pressable>
          ))}
        </Card>
      </Screen>
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    alignItems: 'center',
    gap: 4,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  avatar: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    ...Typography.h2,
    color: Palette.primaryDark,
  },
  name: {
    ...Typography.h3,
    color: Palette.text,
    textAlign: 'center',
  },
  email: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    textAlign: 'center',
  },
  rolePill: {
    marginTop: Spacing.xs,
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  roleText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsCard: {
    paddingVertical: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  actionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  pressed: {
    opacity: 0.7,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
    flex: 1,
    fontWeight: '600',
  },
});
