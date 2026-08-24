/**
 * HealPoint - section header with optional trailing action.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Palette, Spacing, Typography } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titles}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={Palette.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h4,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionLabel: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});