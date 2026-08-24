/**
 * HealPoint - Help & Support (inside the patient drawer).
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DrawerHeader } from '@/components/drawer/DrawerHeader';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';

type SupportOption = {
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
};

const OPTIONS: SupportOption[] = [
  {
    label: 'Call support',
    detail: 'Our care team is available 24×7 for emergencies and urgent queries.',
    icon: 'call-outline',
    href: 'tel:+919810000000',
  },
  {
    label: 'Email us',
    detail: 'Write to us for non-urgent help. We reply within 24 hours.',
    icon: 'mail-outline',
    href: 'mailto:support@healpoint.app',
  },
  {
    label: 'Visit website',
    detail: 'Guides, FAQs and account help on the HealPoint website.',
    icon: 'globe-outline',
    href: 'https://healpoint.app',
  },
];

const FAQS = [
  'How do I book an appointment?',
  'Can I reschedule or cancel a booking?',
  'How does online payment work?',
  'How are my health records kept private?',
];

export default function SupportScreen() {
  return (
    <View style={styles.safe}>
      <DrawerHeader title="Help & Support" subtitle="We are here to help" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {OPTIONS.map((option) => (
          <Card key={option.label} padded style={styles.optionCard}>
            <View style={styles.optionRow}>
              <View style={styles.optionIcon}>
                <Ionicons name={option.icon} size={22} color={Palette.primaryDark} />
              </View>
              <View style={styles.optionTexts}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} />
            </View>
            <View
              style={styles.linkRow}
              onStartShouldSetResponder={() => {
                Linking.openURL(option.href).catch(() => undefined);
                return false;
              }}
            >
              <Text style={styles.linkText}>Open</Text>
            </View>
          </Card>
        ))}

        <Card padded>
          <Text style={styles.sectionTitle}>Frequently asked questions</Text>
          {FAQS.map((faq, index) => (
            <View key={faq} style={[styles.faqRow, index < FAQS.length - 1 && styles.faqBorder]}>
              <Text style={styles.faqText}>{faq}</Text>
              <Ionicons name="chevron-forward" size={16} color={Palette.textMuted} />
            </View>
          ))}
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
  optionCard: {
    gap: Spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTexts: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: '600',
  },
  optionDetail: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  linkRow: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  linkText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: '600',
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  faqBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  faqText: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
  },
});
