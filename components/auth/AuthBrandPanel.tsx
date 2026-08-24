/**
 * HealPoint - desktop brand panel for the authentication shell.
 *
 * Rendered only on wide (>= 1024px) layouts inside the two-column auth screen.
 * Provides the premium left-hand column: the HealPoint lockup, a lightweight
 * healthcare visual built purely from Views + icons (no image assets, nothing
 * that can break scaling), and the core value props — so the desktop Login
 * feels like a production healthcare product instead of a stretched mobile UI.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { HealPointLogo } from '@/components/HealPointLogo';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

const FEATURES = [
  { icon: 'calendar-outline', label: 'Book appointments in seconds' },
  { icon: 'shield-checkmark-outline', label: 'Trusted, verified providers' },
  { icon: 'document-text-outline', label: 'Prescriptions & records in one place' },
] as const;

export function AuthBrandPanel() {
  return (
    <View style={styles.panel}>
      <View style={styles.brandRow}>
        <HealPointLogo size={40} badge />
        <Text style={styles.brand}>
          Heal<Text style={styles.brandAccent}>Point</Text>
        </Text>
      </View>

      <View style={styles.visual}>
        <View style={[styles.circle, styles.circlePrimary]} />
        <View style={[styles.circle, styles.circleAccent]} />
        <View style={[styles.chip, styles.chipTop]}>
          <Ionicons name="heart" size={16} color={Palette.primary} />
          <Text style={styles.chipLabel}>Health first</Text>
        </View>
        <View style={[styles.chip, styles.chipLeft]}>
          <Ionicons name="calendar" size={16} color={Palette.accent} />
          <Text style={styles.chipLabel}>Appointments</Text>
        </View>
        <View style={[styles.chip, styles.chipRight]}>
          <Ionicons name="shield-checkmark" size={16} color={Palette.info} />
          <Text style={styles.chipLabel}>Private & secure</Text>
        </View>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Your health,</Text>
        <Text style={styles.title}>one place.</Text>
        <Text style={styles.tagline}>
          Book appointments, manage prescriptions and stay on top of your care — wherever you are.
        </Text>
      </View>

      <View style={styles.features}>
        {FEATURES.map((feature) => (
          <View key={feature.label} style={styles.feature}>
            <View style={styles.featureIcon}>
              <Ionicons name={feature.icon} size={15} color={Palette.primaryDark} />
            </View>
            <Text style={styles.featureLabel}>{feature.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.xxxl,
    paddingRight: Spacing.huge,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  brand: {
    ...Typography.h3,
    color: Palette.text,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: Palette.primaryDark,
  },
  visual: {
    width: '100%',
    maxWidth: 420,
    height: 220,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(14, 159, 142, 0.06)',
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
  },
  circlePrimary: {
    width: 230,
    height: 230,
    top: -70,
    right: -60,
    backgroundColor: 'rgba(14, 159, 142, 0.14)',
  },
  circleAccent: {
    width: 170,
    height: 170,
    bottom: -80,
    left: -50,
    backgroundColor: 'rgba(34, 167, 160, 0.10)',
  },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.card,
  },
  chipTop: {
    top: Spacing.lg,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -64 }],
  },
  chipLeft: {
    bottom: Spacing.lg,
    left: Spacing.lg,
  },
  chipRight: {
    bottom: Spacing.lg,
    right: Spacing.lg,
  },
  chipLabel: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: '600',
  },
  copy: {
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    color: Palette.text,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  tagline: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    maxWidth: 400,
    lineHeight: 23,
  },
  features: {
    gap: Spacing.md,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '500',
  },
});
