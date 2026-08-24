/**
 * HealPoint - Terms of Service (inside the patient drawer).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DrawerHeader } from '@/components/drawer/DrawerHeader';
import { Card } from '@/components/ui/Card';
import { Palette, Spacing, Typography } from '@/constants/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Using HealPoint',
    body: 'By using HealPoint you agree to provide accurate information, keep your login secure, and use the platform for legitimate healthcare booking purposes only.',
  },
  {
    title: 'Appointments & payments',
    body: 'Appointment availability is managed by doctors and hospitals. Payments are collected at the time of booking through our secure payment partners and settled to the provider you choose.',
  },
  {
    title: 'Cancellation policy',
    body: 'You can reschedule or cancel appointments from the appointment details screen. Providers may have their own rescheduling policies; please review them before booking.',
  },
  {
    title: 'Medical disclaimer',
    body: 'HealPoint is a scheduling and communication platform. It does not provide medical advice, diagnosis or treatment. Always consult a qualified healthcare professional for medical concerns.',
  },
  {
    title: 'Changes to these terms',
    body: 'We may update these terms from time to time. Continued use of the app after changes are posted means you accept the updated terms.',
  },
];

export default function TermsScreen() {
  return (
    <View style={styles.safe}>
      <DrawerHeader title="Terms" subtitle="Terms of Service" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card padded>
          <Text style={styles.intro}>
            These terms govern your use of the HealPoint mobile application and services.
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
