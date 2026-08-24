/**
 * HealPoint - Privacy Policy (inside the patient drawer).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DrawerHeader } from '@/components/drawer/DrawerHeader';
import { Card } from '@/components/ui/Card';
import { Palette, Spacing, Typography } from '@/constants/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Information we collect',
    body: 'HealPoint collects the information you provide when creating an account, booking appointments and using our services — including your name, contact details, and the health information you choose to share with your doctors.',
  },
  {
    title: 'How we use your information',
    body: 'Your information is used to manage appointments, process payments, coordinate your care with the doctors and hospitals you choose, and improve our services. We never sell your personal or health data.',
  },
  {
    title: 'Sharing with providers',
    body: 'Only the doctor and hospital you book with receive the details needed for your care. Health records are shared solely for treatment and coordination purposes.',
  },
  {
    title: 'Data security',
    body: 'We use industry-standard encryption and access controls to protect your data. Sessions are secured with authentication, and payments are processed through PCI-compliant payment partners.',
  },
  {
    title: 'Your choices',
    body: 'You can access, update or delete your account information at any time through your profile. Contact support@healpoint.app for help with data access requests.',
  },
];

export default function PrivacyScreen() {
  return (
    <View style={styles.safe}>
      <DrawerHeader title="Privacy" subtitle="How HealPoint protects you" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padded>
          <Text style={styles.intro}>
            Your privacy matters. This policy explains what we collect, why we collect it and how we keep
            it safe.
          </Text>
        </Card>
        {SECTIONS.map((section) => (
          <Card key={section.title} padded>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </Card>
        ))}
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
  intro: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  sectionTitle: {
    ...Typography.label,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  body: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
});
