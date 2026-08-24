/**
 * HealPoint - "OR" divider used between the primary form action and the
 * third-party (Google) button on the Login / Sign Up screens.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Palette, Spacing, Typography } from '@/constants/theme';

export function OrDivider() {
  return (
    <View style={styles.container} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.line} />
      <Text style={styles.label}>or</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginVertical: Spacing.xl,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Palette.border,
  },
  label: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
