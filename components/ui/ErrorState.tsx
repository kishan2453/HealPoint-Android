/**
 * HealPoint - error state placeholder with retry.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, Typography } from '@/constants/theme';
import { Button } from '@/components/ui/Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this content. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconEmoji}>⚠️</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button title="Try again" variant="outline" onPress={onRetry} />
        </View>
      ) : null}
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
    backgroundColor: '#FDE8E8',
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