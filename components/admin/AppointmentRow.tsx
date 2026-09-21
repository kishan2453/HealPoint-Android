/**
 * HealPoint - Super Admin appointment row (card layout).
 * Shows REAL backend data only: reference, patient, doctor, hospital,
 * department, slot date/time, status and payment state. Missing backend
 * fields fall back to honest "Not available" labels — never invented.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  appointmentPayment,
  appointmentDepartment,
  appointmentDoctorName,
  appointmentDoctorSpecialty,
  appointmentHospitalName,
  appointmentPatientName,
  appointmentReference,
} from '@/lib/appointments';
import { formatDDMMYYYY, formatINR } from '@/lib/format';
import { appointmentStatusBadge, appointmentPaymentBadge, StatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import type { Appointment } from '@/types';

interface AppointmentRowProps {
  appointment: Appointment;
  onPress?: () => void;
}

function consultationTypeLabel(type?: string): string {
  if (type === 'video') return 'Video';
  if (type === 'clinic') return 'Clinic';
  return '';
}

export function AppointmentRow({ appointment, onPress }: AppointmentRowProps) {
  const payment = appointmentPayment(appointment);
  const department = appointmentDepartment(appointment);
  const specialty = appointmentDoctorSpecialty(appointment);
  const typeLabel = consultationTypeLabel(appointment.consultationType);

  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <Card style={styles.card}>
        {/* ---- Header: reference + status ---- */}
        <View style={styles.header}>
          <View style={styles.headerTexts}>
            <Text style={styles.reference} numberOfLines={1}>
              {appointmentReference(appointment)}
            </Text>
            <Text style={styles.doctorName} numberOfLines={1}>
              {appointmentDoctorName(appointment)}
            </Text>
          </View>
          <StatusBadge value={appointment.status} variant={appointmentStatusBadge(appointment.status)} />
        </View>

        {/* ---- Patient ---- */}
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={15} color={Palette.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {appointmentPatientName(appointment)}
          </Text>
        </View>

        {/* ---- Specialty / department ---- */}
        {specialty ? (
          <View style={styles.metaRow}>
            <Ionicons name="medkit-outline" size={15} color={Palette.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {specialty}
              {department && department !== specialty ? ` · ${department}` : ''}
            </Text>
          </View>
        ) : department ? (
          <View style={styles.metaRow}>
            <Ionicons name="layers-outline" size={15} color={Palette.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {department}
            </Text>
          </View>
        ) : null}

        {/* ---- Hospital ---- */}
        <View style={styles.metaRow}>
          <Ionicons name="business-outline" size={15} color={Palette.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {appointmentHospitalName(appointment)}
          </Text>
        </View>

        {/* ---- Date & time ---- */}
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={15} color={Palette.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {formatDDMMYYYY(appointment.slotDate) || 'Date not available'}
            {appointment.slotTime ? ` · ${appointment.slotTime}` : ''}
          </Text>
        </View>

        {/* ---- Payment + type chips ---- */}
        <View style={styles.badgeRow}>
          <Badge label={payment.label} variant={appointmentPaymentBadge(payment.status)} />
          {typeLabel ? <Badge label={typeLabel} variant="primary" /> : null}
          {Number(appointment.amount) > 0 ? (
            <Text style={styles.amount}>{formatINR(appointment.amount)}</Text>
          ) : null}
        </View>

        {onPress ? (
          <View style={styles.actionRow}>
            <View style={styles.actionIcon}>
              <Ionicons name="eye-outline" size={16} color={Palette.primaryDark} />
            </View>
            <Text style={styles.actionLabel}>View Details</Text>
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
  headerTexts: { flex: 1, gap: 2 },
  reference: { ...Typography.caption, color: Palette.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  doctorName: { ...Typography.h4, color: Palette.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText: { ...Typography.bodySmall, color: Palette.textMuted, flexShrink: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  amount: { ...Typography.label, color: Palette.text, marginLeft: 'auto' },
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