/**
 * HealPoint - empty state placeholder.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, Typography } from '@/constants/theme';

interface EmptyStateProps {
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconEmoji}>🩺</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    ...Typography.h4,
    color: Palette.text,
    textAlign: 'center',
  },
  message: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.md,
    width: '100%',
  },
});