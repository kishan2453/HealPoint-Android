/**
 * HealPoint - Admin · Settings.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

function SettingsRow({ icon, label, onPress, destructive }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[styles.iconBox, destructive && { backgroundColor: Palette.error + '14' }]}>
        <Ionicons name={icon} size={20} color={destructive ? Palette.error : Palette.primary} />
      </View>
      <Text style={[styles.rowLabel, destructive && { color: Palette.error }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Palette.textMuted} />
    </Pressable>
  );
}

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  return (
    <AdminModuleScreen title="Settings" subtitle="System & Security Preferences" allowedRoles={['admin', 'super_admin']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <SettingsRow icon="business-outline" label="Hospital Profile" onPress={() => router.push('/admin/hospital-profile')} />
          <View style={styles.divider} />
          <SettingsRow icon="lock-closed-outline" label="Security & Password" onPress={() => router.push('/admin/security')} />
          <View style={styles.divider} />
          <SettingsRow icon="notifications-outline" label="Push Notifications" onPress={() => {}} />
        </Card>

        <Card style={styles.card}>
          <SettingsRow icon="headset-outline" label="Help & Support" onPress={() => router.push('/admin/support')} />
          <View style={styles.divider} />
          <SettingsRow icon="log-out-outline" label="Logout securely" destructive onPress={signOut} />
        </Card>
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm, backgroundColor: Palette.surface },
  rowPressed: { backgroundColor: Palette.background },
  iconBox: { width: 36, height: 36, borderRadius: Radius.md, backgroundColor: Palette.primary + '14', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, ...Typography.body, color: Palette.text, fontWeight: '500' },
  divider: { height: 1, backgroundColor: Palette.border, marginLeft: 60 },
});