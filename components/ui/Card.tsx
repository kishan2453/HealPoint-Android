/**
 * HealPoint - reusable card surface.
 */
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { Palette, Radius, Shadows } from '@/constants/theme';

interface CardProps extends ViewProps {
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ padded = true, elevated = true, style, children, ...props }: CardProps) {
  return (
    <View style={[styles.card, padded && styles.padded, elevated && styles.elevated, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  padded: {
    padding: 16,
  },
  elevated: Shadows.card,
});