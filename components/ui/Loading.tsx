/**
 * HealPoint - loading indicator with optional label.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, Typography } from '@/constants/theme';

interface LoadingProps {
  label?: string;
  fullScreen?: boolean;
  color?: string;
}

export function Loading({ label, fullScreen = true, color = Palette.primary }: LoadingProps) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color={color} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  fullScreen: {
    flex: 1,
  },
  label: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
});