/**
 * HealPoint - small status/priority badge.
 */
import React from 'react';
import { StyleSheet, Text, StyleProp, TextStyle } from 'react-native';

import { Palette, Radius, Spacing, Typography } from '@/constants/theme';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

export type { BadgeVariant };

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<TextStyle>;
}

const palette: Record<BadgeVariant, { bg: string; text: string }> = {
  primary: { bg: Palette.primaryLight, text: Palette.primaryDark },
  success: { bg: '#E2F5E9', text: '#1F7A44' },
  warning: { bg: '#FDF0DC', text: '#9A6410' },
  error: { bg: '#FDE8E8', text: '#B3264A' },
  neutral: { bg: '#EEF2F1', text: Palette.textMuted },
};

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const colors = palette[variant];
  return (
    <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.text }, style]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...Typography.caption,
    fontWeight: '600',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
});