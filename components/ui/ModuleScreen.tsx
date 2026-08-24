/**
 * HealPoint - module landing scaffold for role-scoped management screens.
 *
 * Renders a consistent header, an honest status indicator and the module's
 * planned capabilities. It never fabricates data — screens that have a real
 * backend render their live content through `children`.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';

interface ModuleScreenProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  description: string;
  features: string[];
  status?: string;
  children?: React.ReactNode;
}

export function ModuleScreen({
  title,
  icon,
  accent,
  description,
  features,
  status = 'Awaiting backend endpoints',
  children,
}: ModuleScreenProps) {
  return (
    <Screen>
      <AppHeader title={title} showBack />
      <View style={styles.heroRow}>
        <View style={[styles.iconCircle, { backgroundColor: `${accent}1A` }]}>
          <Ionicons name={icon} size={26} color={accent} />
        </View>
        <View style={styles.heroTexts}>
          <Text style={styles.heroTitle}>{title}</Text>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: accent }]} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>
      </View>

      <Card padded>
        <Text style={styles.description}>{description}</Text>
        <View style={styles.featureList}>
          {features.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <Ionicons name="checkmark-circle-outline" size={17} color={Palette.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </Card>

      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTexts: {
    flex: 1,
    gap: Spacing.xs,
  },
  heroTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  description: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  featureList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
  },
});
