/**
 * HealPoint - Super Admin · Settings hub.
 * Central access to the platform configuration screens. Existing modules
 * (System Settings, Audit Logs, Specialties, Reports, Payments) stay reachable
 * here so nothing is lost from the cleaned-up sidebar.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminModuleScreen } from '@/components/admin/AdminModuleScreen';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';

interface SettingsLink {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: Href;
  accent: string;
}

const LINKS: SettingsLink[] = [
  {
    label: 'System Settings',
    description: 'Platform branding, consultation & verification policies, notification defaults.',
    icon: 'settings-outline',
    href: '/super-admin/system-settings',
    accent: '#5A6C7B',
  },
  {
    label: 'Audit Logs',
    description: 'Platform activity and security audit trail.',
    icon: 'list-outline',
    href: '/super-admin/audit-logs',
    accent: '#2F80ED',
  },
  {
    label: 'Specialties',
    description: 'Manage the doctor specialty catalog shown across the platform.',
    icon: 'ribbon-outline',
    href: '/super-admin/specialties',
    accent: '#E89A3C',
  },
  {
    label: 'Reports',
    description: 'Platform reports and data summaries.',
    icon: 'bar-chart-outline',
    href: '/super-admin/reports',
    accent: '#7B61FF',
  },
  {
    label: 'Payments',
    description: 'Platform payment records and Razorpay transactions.',
    icon: 'card-outline',
    href: '/super-admin/payments',
    accent: '#2E9E5B',
  },
  {
    label: 'Patients',
    description: 'Patient accounts directory (read-only platform view).',
    icon: 'people-outline',
    href: '/super-admin/patients',
    accent: '#0E9F8E',
  },
];

export default function SuperAdminSettingsScreen() {
  const router = useRouter();

  return (
    <AdminModuleScreen title="Settings" subtitle="Platform configuration">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {LINKS.map((link) => (
          <Pressable key={link.label} onPress={() => router.push(link.href)}>
            <Card style={styles.linkCard}>
              <View style={[styles.iconCircle, { backgroundColor: `${link.accent}1F` }]}>
                <Ionicons name={link.icon} size={22} color={link.accent} />
              </View>
              <View style={styles.linkTexts}>
                <Text style={styles.linkLabel}>{link.label}</Text>
                <Text style={styles.linkDescription}>{link.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </AdminModuleScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.md },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconCircle: { width: 46, height: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  linkTexts: { flex: 1, gap: 2 },
  linkLabel: { ...Typography.bodyMedium, color: Palette.text },
  linkDescription: { ...Typography.caption, color: Palette.textMuted, lineHeight: 16 },
});