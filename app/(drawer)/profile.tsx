import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { getUserImage } from '@/lib/image';
import { formatDDMMYYYY } from '@/lib/format';

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, refreshProfile } = useAuth();
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  const items: MenuItem[] = [
    {
      key: 'edit',
      label: 'Edit profile',
      icon: 'create-outline',
      tint: Palette.primary,
      onPress: () => router.push('/profile/edit'),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: 'settings-outline',
      tint: '#2F80ED',
      onPress: () => router.push('/settings'),
    },
    {
      key: 'password',
      label: 'Change password',
      icon: 'lock-closed-outline',
      tint: '#E89A3C',
      onPress: () => router.push('/profile/change-password'),
    },
  ];

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
      setLogoutVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.primary} />}
      >
        <View style={styles.headerRow}>
          <DrawerToggleButton />
          <Text style={styles.title}>Profile</Text>
        </View>

        <Card style={styles.headerCard}>
          <Image source={{ uri: getUserImage(user?.image) }} style={styles.avatar} contentFit="cover" transition={200} />
          <Text style={styles.name}>{user?.name || 'Patient'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>
          {user?.role ? <Text style={styles.caption}>{user.role}</Text> : null}
        </Card>

        {user?.phone || user?.dob || user?.gender || user?.address ? (
          <Card padded>
            <Text style={styles.sectionTitle}>Personal information</Text>
            {user.phone ? (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={18} color={Palette.primary} />
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{user.phone}</Text>
              </View>
            ) : null}
            {user.dob ? (
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={18} color={Palette.primary} />
                <Text style={styles.infoLabel}>Date of birth</Text>
                <Text style={styles.infoValue}>{formatDDMMYYYY(user.dob)}</Text>
              </View>
            ) : null}
            {user.gender ? (
              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={18} color={Palette.primary} />
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={styles.infoValue}>{user.gender}</Text>
              </View>
            ) : null}
            {user.address ? (
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color={Palette.primary} />
                <Text style={styles.infoLabel}>Address</Text>
                <Text style={styles.infoValue}>{user.address}</Text>
              </View>
            ) : null}
          </Card>
        ) : (
          <Card padded>
            <Text style={styles.bodyText}>
              Complete your profile (phone, date of birth, address) to make booking smoother.
            </Text>
          </Card>
        )}

<Card padded style={styles.menuCard}>
          {items.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              onPress={item.onPress}
              style={({ pressed }) => [
                styles.menuRow,
                index < items.length - 1 && styles.menuRowBorder,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${item.tint}1A` }]}>
                <Ionicons name={item.icon} size={20} color={item.tint} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
            </Pressable>
          ))}
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={() => setLogoutVisible(true)}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
        >
          <Ionicons name="log-out-outline" size={20} color={Palette.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>

      <ConfirmDialog
        visible={logoutVisible}
        title="Log out?"
        message="You will need to login again to manage your appointments."
        confirmLabel="Logout"
        cancelLabel="Cancel"
        tone="danger"
        loading={loggingOut}
        onConfirm={confirmLogout}
        onCancel={() => setLogoutVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
  },
  headerCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 4,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Palette.primaryLight,
    marginBottom: Spacing.sm,
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
  caption: {
    ...Typography.caption,
    color: Palette.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  infoLabel: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    width: 120,
  },
  infoValue: {
    ...Typography.bodyMedium,
    color: Palette.text,
    flex: 1,
    fontWeight: '500',
  },
  bodyText: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
  },
  menuCard: {
    paddingVertical: Spacing.xs,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  pressed: {
    opacity: 0.7,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
    flex: 1,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.error,
    paddingVertical: Spacing.md,
  },
  logoutText: {
    ...Typography.label,
    color: Palette.error,
  },
});