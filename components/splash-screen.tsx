/**
 * HealPoint - branded splash screen shown while the auth session restores.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { HealPointLogo } from '@/components/HealPointLogo';
import { Palette, Spacing } from '@/constants/theme';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <HealPointLogo size={96} />
      <ActivityIndicator size="small" color={Palette.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.background,
    gap: Spacing.xxl,
  },
  spinner: {
    marginTop: Spacing.lg,
  },
});
