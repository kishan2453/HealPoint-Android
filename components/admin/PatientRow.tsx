/**
 * HealPoint - Hospital Admin patient row (card layout).
 * Shows REAL, hospital-scoped data returned by GET /hospital-admin/patients:
 * name, contact, appointment counts, last and upcoming appointment. Missing
 * backend fields fall back to honest "Not available" labels.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { appointmentStatusBadge, StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatDDMMYYYY } from '@/lib/format';
import type { HospitalAdminPatient } from '@/services/admin';

interface PatientRowProps {
  patient: HospitalAdminPatient;
  onPress?: () => void;
}

export function patientInitials(name?: string): string {
  return (name || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function PatientRow({ patient, onPress }: PatientRowProps) {
  const hasUpcoming = Boolean(patient.upcomingAppointment?.slotDate);
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <Card style={styles.card}>
        <View style={styles.header}>
          {patient.image ? (
            <Image source={{ uri: patient.image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{patientInitials(patient.name)}</Text>
            </View>
          )}
          <View style={styles.headerTexts}>
            <Text style={styles.name} numberOfLines={1}>
              {patient.name || 'Not available'}
            </Text>
            <Text style={styles.contact} numberOfLines={1}>
              {patient.phone || patient.email || 'Contact not available'}
            </Text>
          </View>
          <Badge
            label={patient.isActive === false ? 'Inactive' : 'Active'}
            variant={patient.isActive === false ? 'neutral' : 'success'}
          />
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{patient.appointmentCount}</Text>
            <Text style={styles.statLabel}>Appointments</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{patient.completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{patient.cancelledCount}</Text>
            <Text style={styles.statLabel}>Cancelled</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={15} color={Palette.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            Last:{' '}
            {patient.lastAppointment?.slotDate
              ? `${formatDDMMYYYY(patient.lastAppointment.slotDate)}${patient.lastAppointment.slotTime ? ` · ${patient.lastAppointment.slotTime}` : ''}`
              : 'No visits yet'}
          </Text>
        </View>
        {hasUpcoming ? (
          <View style={styles.upcomingRow}>
            <Ionicons name="calendar" size={15} color={Palette.primaryDark} />
            <Text style={styles.upcomingText} numberOfLines={1}>
              Upcoming:{' '}
              {formatDDMMYYYY(patient.upcomingAppointment?.slotDate)} · {patient.upcomingAppointment?.slotTime || '—'}
            </Text>
            <StatusBadge
              value={patient.upcomingAppointment?.status}
              variant={appointmentStatusBadge(patient.upcomingAppointment?.status)}
            />
          </View>
        ) : null}

        {onPress ? (
          <View style={styles.actionRow}>
            <View style={styles.actionIcon}>
              <Ionicons name="eye-outline" size={16} color={Palette.primaryDark} />
            </View>
            <Text style={styles.actionLabel}>View patient</Text>
            <Ionicons name="chevron-forward" size={16} color={Palette.primaryDark} />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...Typography.h4, color: Palette.primaryDark, fontWeight: '700' },
  headerTexts: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  contact: { ...Typography.caption, color: Palette.textMuted },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { ...Typography.label, color: Palette.text, fontWeight: '700' },
  statLabel: { ...Typography.caption, color: Palette.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText: { ...Typography.bodySmall, color: Palette.textMuted, flexShrink: 1 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  upcomingText: { ...Typography.bodySmall, color: Palette.primaryDark, fontWeight: '500', flexShrink: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...Typography.label, color: Palette.primaryDark, flex: 1 },
});