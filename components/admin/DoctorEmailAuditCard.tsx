/**
 * HealPoint - Super Admin · Doctor email / login consistency audit card.
 *
 * Summarises the REAL doctor catalog email audit (see `lib/doctor-email.ts`):
 *   - valid / invalid / missing / suspicious counts
 *   - duplicate login emails (danger: same email → ambiguous auth)
 *   - the full per-hospital list of doctors with their stored email status
 *
 * Everything shown is computed from the actual returned backend records. This
 * card never edits emails — corrects source data in the backend/DB instead.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import {
  emailStatusLabel,
  type DoctorEmailAudit,
  type DoctorEmailStatus,
} from '@/lib/doctor-email';

type StatusVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

const STATUS_VARIANT: Record<DoctorEmailStatus, StatusVariant> = {
  valid: 'success',
  invalid: 'error',
  missing: 'warning',
  suspicious: 'warning',
};

const STATUS_ICON: Record<DoctorEmailStatus, keyof typeof Ionicons.glyphMap> = {
  valid: 'checkmark-circle-outline',
  invalid: 'close-circle-outline',
  missing: 'help-circle-outline',
  suspicious: 'alert-circle-outline',
};

interface DoctorEmailAuditCardProps {
  audit: DoctorEmailAudit | null;
}

export function DoctorEmailAuditCard({ audit }: DoctorEmailAuditCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!audit || audit.total === 0) {
    return (
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>Doctor email / login consistency</Text>
            <Text style={styles.subtitle}>No doctors loaded yet to audit.</Text>
          </View>
        </View>
      </Card>
    );
  }

  const hasIssues =
    audit.invalid > 0 || audit.missing > 0 || audit.suspicious > 0 || audit.duplicates.length > 0;
return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.headerRow, pressed && styles.pressed]}
      >
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Doctor email / login consistency</Text>
          <Text style={styles.subtitle}>
            {hasIssues
              ? 'Some doctor emails need attention before they are used as login accounts.'
              : 'Every doctor email looks usable as its own login account.'}
          </Text>
        </View>
        <View style={styles.statusBadges}>
          <Badge label={`${audit.valid} valid`} variant="success" />
          {audit.invalid > 0 ? <Badge label={`${audit.invalid} invalid`} variant="error" /> : null}
          {audit.missing > 0 ? <Badge label={`${audit.missing} missing`} variant="warning" /> : null}
          {audit.suspicious > 0 ? <Badge label={`${audit.suspicious} suspicious`} variant="warning" /> : null}
          {audit.duplicates.length > 0 ? <Badge label={`${audit.duplicates.length} duplicate(s)`} variant="error" /> : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Palette.textMuted} />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text style={styles.note}>
            <Ionicons name="information-circle-outline" size={13} color={Palette.textMuted} /> Profile email and login
            email must be the SAME account for every doctor. Invalid/suspicious emails block a reliable login and must be
            corrected in the backend/database source. This card only reports the real stored data.
          </Text>

          {audit.duplicates.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Duplicate login emails</Text>
              {audit.duplicates.map((duplicate) => (
                <View key={duplicate.email} style={styles.duplicateRow}>
                  <Ionicons name="warning" size={16} color={Palette.error} />
                  <View style={styles.duplicateTexts}>
                    <Text style={styles.duplicateEmail}>{duplicate.email}</Text>
                    <Text style={styles.duplicateNames} numberOfLines={2}>
                      {duplicate.doctorNames.join(', ')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Per doctor · {audit.hospitals.length} hospital(s)
            </Text>
            {audit.hospitals.map((hospital) => (
              <View key={hospital.name} style={styles.hospitalBlock}>
                <View style={styles.hospitalHeader}>
                  <Ionicons name="business-outline" size={14} color={Palette.primaryDark} />
                  <Text style={styles.hospitalName} numberOfLines={1}>{hospital.name}</Text>
                </View>
                {hospital.findings.map((finding) => (
                  <View key={finding.doctorId} style={styles.doctorRow}>
                    <Ionicons
                      name={STATUS_ICON[finding.status]}
                      size={16}
                      color={finding.status === 'valid' ? Palette.success : finding.status === 'invalid' ? Palette.error : Palette.warning}
                    />
                    <View style={styles.doctorTexts}>
                      <Text style={styles.doctorName} numberOfLines={1}>
                        {finding.name} · {finding.specialization}
                      </Text>
                      <Text style={styles.doctorEmail} numberOfLines={1}>
                        {finding.email || '— no email —'}
                      </Text>
                      {finding.reason ? <Text style={styles.doctorReason} numberOfLines={2}>{finding.reason}</Text> : null}
                      {finding.duplicatesWith?.length ? (
                        <Text style={styles.doctorReason} numberOfLines={2}>
                          Shared with: {finding.duplicatesWith.join(', ')}
                        </Text>
                      ) : null}
                    </View>
                    <Badge label={emailStatusLabel(finding.status)} variant={STATUS_VARIANT[finding.status]} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Card>
  );
}
const styles = StyleSheet.create({
  card: { gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pressed: { opacity: 0.7 },
  titleWrap: { flex: 1, gap: 2 },
  title: { ...Typography.h4, color: Palette.text },
  subtitle: { ...Typography.bodySmall, color: Palette.textMuted },
  statusBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, flexShrink: 1 },
  body: { gap: Spacing.md },
  note: { ...Typography.caption, color: Palette.textMuted, lineHeight: 18 },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.label, color: Palette.primaryDark, textTransform: 'uppercase', letterSpacing: 0.3 },
  duplicateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  duplicateTexts: { flex: 1, gap: 2 },
  duplicateEmail: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600' },
  duplicateNames: { ...Typography.caption, color: Palette.textMuted },
  hospitalBlock: { gap: Spacing.xs },
  hospitalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  hospitalName: { ...Typography.bodyMedium, color: Palette.text, fontWeight: '700', flex: 1 },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Palette.background,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
  },
  doctorTexts: { flex: 1, gap: 1 },
  doctorName: { ...Typography.bodySmall, color: Palette.text, fontWeight: '600' },
  doctorEmail: { ...Typography.caption, color: Palette.textMuted },
  doctorReason: { ...Typography.caption, color: Palette.warning, opacity: 0.9 },
});