/**
 * HealPoint - compact stat card for admin dashboards.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
  hint?: string;
}

export function StatCard({ label, value, icon, accent = Palette.primary, hint }: StatCardProps) {
  return (
    <Card style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: `${accent}1F` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    gap: Spacing.xs,
    minWidth: 150,
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  value: {
    ...Typography.h3,
    color: Palette.text,
  },
  label: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  hint: {
    ...Typography.caption,
    color: Palette.textMuted,
    opacity: 0.8,
  },
});