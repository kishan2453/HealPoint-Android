/**
 * HealPoint - landing layout for patient modules (Health Records, Reports, ...)
 * that will populate from backend endpoints. Always navigable, never blank.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DrawerHeader } from '@/components/drawer/DrawerHeader';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';

interface PatientModuleLandingProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  description: string;
  features: string[];
}

export function PatientModuleLanding({ title, icon, accent, description, features }: PatientModuleLandingProps) {
  return (
    <View style={styles.safe}>
      <DrawerHeader title={title} subtitle="HealPoint patient module" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroRow}>
          <View style={[styles.iconCircle, { backgroundColor: `${accent}1A` }]}>
            <Ionicons name={icon} size={30} color={accent} />
          </View>
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroCaption}>Connected to your HealPoint account</Text>
          </View>
        </View>

        <Card padded>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.featureList}>
            {features.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={Palette.success} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTexts: {
    flex: 1,
    gap: 2,
  },
  heroTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  heroCaption: {
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
