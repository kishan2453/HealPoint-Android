/**
 * HealPoint - Healthcare Privacy & Data Protection Policy.
 *
 * Outlines our strict clinical privacy safeguards, patient data ownership,
 * Protected Health Information (PHI) encryption, doctor-patient confidentiality,
 * and Google OAuth security standards.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import { DrawerHeader } from "@/components/drawer/DrawerHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";

interface PolicySection {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  body: string;
}

const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "ownership",
    icon: "person-outline",
    title: "Patient Data Ownership & Rights",
    subtitle: "You are the sole owner of your healthcare data",
    body: "At HealPoint, you retain full ownership of all personal and clinical data. You have the fundamental right to inspect, correct, update, or request permanent erasure of your account, medical consultation history, and profile records at any time.",
  },
  {
    id: "confidentiality",
    icon: "shield-checkmark-outline",
    title: "Doctor-Patient Confidentiality (PHI)",
    subtitle: "Strictly scoped to your chosen care providers",
    body: "Your Protected Health Information (PHI)—including clinical diagnosis, prescribed medications, diagnostic reports, and medical consultations—is strictly confidential. It is accessible only by you and the specific verified doctor and hospital facility with whom you confirm an appointment.",
  },
  {
    id: "encryption",
    icon: "lock-closed-outline",
    title: "End-to-End Encryption & Device Security",
    subtitle: "Hardware-level keychain encryption",
    body: "All transmissions between HealPoint apps and servers utilize high-grade TLS 1.3 encryption. Mobile authentication sessions are protected on this device using native hardware security modules (iOS Keychain and Android Keystore via SecureStore). Raw session secrets and tokens are never written to unencrypted storage.",
  },
  {
    id: "oauth",
    icon: "logo-google",
    title: "Google OAuth & Identity Privacy",
    subtitle: "Server-verified authorization code flow",
    body: "When you sign in with Google, HealPoint never requests, receives, or stores your Google password. We exchange a single-use authorization code server-side and verify cryptographic RS256 signatures directly with Google certificates to authenticate your patient identity safely.",
  },
  {
    id: "zero-monetization",
    icon: "ban-outline",
    title: "No Data Monetization or Third-Party Brokers",
    subtitle: "Your health records are never sold or rented",
    body: "We do not sell, rent, or trade patient personal information, medical profiles, or consultation logs to data brokers, insurers, or advertising platforms. Data is utilized exclusively for scheduling clinical care, processing transparent payments via Razorpay, and coordinating telehealth sessions.",
  },
  {
    id: "audit-trails",
    icon: "document-text-outline",
    title: "Security Audit Trails & Integrity",
    subtitle: "Continuous monitoring against unauthorized access",
    body: "For patient safety, HealPoint logs critical security events (profile modifications, authentication successes, and password changes). These records ensure transparency and allow our clinical security team to safeguard against credential abuse and unauthorized account access.",
  },
];

export default function PrivacyScreen() {
  return (
    <View style={styles.safe}>
      <DrawerHeader
        title="Privacy & Data Safety"
        subtitle="Healthcare-grade confidentiality standards"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Compliance Hero Banner */}
        <Card style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <Ionicons
              name="shield-checkmark"
              size={24}
              color={Palette.primary}
            />
          </View>
          <View style={styles.heroTexts}>
            <View style={styles.heroBadgeRow}>
              <Badge label="Clinical Grade Privacy" variant="success" />
              <Badge label="TLS 1.3 Encrypted" variant="primary" />
            </View>
            <Text style={styles.heroTitle}>Your Health Data is Safe</Text>
            <Text style={styles.heroDesc}>
              HealPoint adheres to modern healthcare data standards (HIPAA &
              DISHA compliance principles). Your clinical consultations,
              prescriptions, and identity remain completely private.
            </Text>
          </View>
        </Card>

        {/* Policy Sections */}
        {POLICY_SECTIONS.map((section) => (
          <Card key={section.id} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Ionicons
                  name={section.icon}
                  size={20}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.sectionHeaderTexts}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
            </View>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </Card>
        ))}

        {/* Data Protection Officer Contact */}
        <Card style={styles.contactCard}>
          <View style={styles.contactHeader}>
            <Ionicons name="mail-outline" size={20} color={Palette.primary} />
            <Text style={styles.contactTitle}>
              Data Privacy & Access Inquiries
            </Text>
          </View>
          <Text style={styles.contactDesc}>
            To exercise your data privacy rights, request a copy of your
            records, or permanently delete your patient account, contact our
            Data Protection Officer:
          </Text>
          <Text
            style={styles.contactEmail}
            onPress={() =>
              Linking.openURL("mailto:privacy@healpoint.app").catch(
                () => undefined,
              )
            }
          >
            privacy@healpoint.app
          </Text>
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
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },
  heroCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: "rgba(14, 159, 142, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.22)",
    gap: Spacing.sm,
    ...Shadows.card,
  },
  heroIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTexts: {
    gap: 4,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  heroTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  heroDesc: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  sectionCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderTexts: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    ...Typography.label,
    fontSize: 15,
    color: Palette.text,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Palette.primary,
    fontWeight: "500",
  },
  sectionBody: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 21,
    marginTop: 2,
  },
  contactCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.xs,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  contactTitle: {
    ...Typography.label,
    color: Palette.text,
  },
  contactDesc: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  contactEmail: {
    ...Typography.bodySmall,
    color: Palette.primary,
    fontWeight: "700",
    marginTop: 4,
  },
});
