/**
 * HealPoint - header for screens nested inside the patient drawer navigator.
 * Shows the hamburger (opens the drawer) plus the screen title.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DrawerToggleButton } from '@/components/DrawerToggleButton';
import { Palette, Spacing, Typography } from '@/constants/theme';

interface DrawerHeaderProps {
  title: string;
  subtitle?: string;
}

export function DrawerHeader({ title, subtitle }: DrawerHeaderProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.row}>
        <DrawerToggleButton />
        <View style={styles.texts}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: Palette.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.h3,
    color: Palette.text,
  },
  subtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
});
