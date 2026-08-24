import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { Palette, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

type Row = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  onPress: () => void;
};

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const rows: Row[] = [
    {
      key: 'edit',
      label: 'Edit profile',
      icon: 'create-outline',
      tint: Palette.primary,
      onPress: () => router.replace('/profile/edit'),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: 'notifications-outline',
      tint: '#2F80ED',
      onPress: () => router.replace('/notification'),
    },
    {
      key: 'password',
      label: 'Change password',
      icon: 'lock-closed-outline',
      tint: '#E89A3C',
      onPress: () => router.replace('/profile/change-password'),
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: 'log-out-outline',
      tint: Palette.error,
      onPress: () => {
        signOut();
      },
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={Palette.text} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
        </View>

        <Card padded style={styles.menuCard}>
          {rows.map((row, index) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              onPress={row.onPress}
              style={({ pressed }) => [
                styles.menuRow,
                index < rows.length - 1 && styles.menuRowBorder,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.menuIcon, { backgroundColor: `${row.tint}1A` }]}>
                <Ionicons name={row.icon} size={20} color={row.tint} />
              </View>
              <Text style={styles.menuLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
            </Pressable>
          ))}
        </Card>

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>HealPoint</Text>
          <Text style={styles.aboutBody}>Version 1.0.0</Text>
          <Text style={styles.aboutBody}>Your trusted partner for booking doctor appointments.</Text>
        </View>
      </ScrollView>
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  pressed: {
    opacity: 0.6,
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
  about: {
    marginTop: Spacing.xxxl,
    alignItems: 'center',
    gap: 2,
  },
  aboutTitle: {
    ...Typography.label,
    color: Palette.primaryDark,
  },
  aboutBody: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: 'center',
  },
});