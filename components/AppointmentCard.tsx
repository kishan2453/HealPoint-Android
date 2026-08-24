/**
 * HealPoint - appointment card showing real appointment data.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { formatDDMMYYYY, formatINR } from '@/lib/format';
import type { Appointment, AppointmentStatus } from '@/types';

const STATUS_BADGE: Record<AppointmentStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: 'Pending', variant: 'warning' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  completed: { label: 'Completed', variant: 'primary' },
  cancel: { label: 'Cancelled', variant: 'error' },
  rescheduled: { label: 'Rescheduled', variant: 'neutral' },
  missed: { label: 'Missed', variant: 'error' },
};

function doctorName(appointment: Appointment): string {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === 'object' && 'name' in doctor) return doctor.name || 'Doctor';
  return 'Doctor';
}

function AppointmentCardRaw({ appointment }: { appointment: Appointment }) {
  const router = useRouter();
  const status = appointment.status as AppointmentStatus;
  const badge = STATUS_BADGE[status] || { label: status, variant: 'neutral' as BadgeVariant };

  const open = () =>
    router.push({ pathname: '/appointment/[id]', params: { id: appointment._id } });

  const notice = paymentNotice(appointment);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="calendar" size={22} color={Palette.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.doctor} numberOfLines={1}>
            {doctorName(appointment)}
          </Text>
          <Text style={styles.hospital} numberOfLines={1}>
            {appointment.hospitalName || 'Hospital'}
          </Text>
          <View style={styles.dateRow}>
            <Ionicons name="time-outline" size={14} color={Palette.textMuted} />
            <Text style={styles.dateText}>
              {formatDDMMYYYY(appointment.slotDate)} · {appointment.slotTime}
            </Text>
          </View>
        </View>
        <Badge label={badge.label} variant={badge.variant} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.fee}>{formatINR(appointment.amount)}</Text>
        {appointment.consultationType ? (
          <Text style={styles.type}>{appointment.consultationType === 'video' ? 'Video consultation' : 'Clinic visit'}</Text>
        ) : null}
      </View>
      {notice ? (
        <View style={styles.paymentNotice}>
          <Badge label={notice.label} variant={notice.variant} />
          <Text style={styles.paymentNoticeText}>{notice.text}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function paymentNotice(appointment: Appointment): { label: string; variant: BadgeVariant; text: string } | null {
  const paymentStatus = (appointment.paymentStatus || '').trim().toLowerCase();
  if (appointment.payment === true || paymentStatus === 'success' || paymentStatus === 'paid') return null;
  if (appointment.paymentMethod === 'online' || paymentStatus === 'pending' || paymentStatus === 'failed') {
    if (paymentStatus === 'failed') {
      return { label: 'Payment failed', variant: 'error', text: 'Pay online to confirm your slot.' };
    }
    if (paymentStatus === 'cancelled') {
      return { label: 'Payment cancelled', variant: 'neutral', text: 'Pay online to confirm your slot.' };
    }
    return { label: 'Pay online', variant: 'warning', text: 'Your slot is held — complete payment to confirm.' };
  }
  return null;
}

export const AppointmentCard = React.memo(AppointmentCardRaw);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.card,
  },
  pressed: {
    opacity: 0.9,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Palette.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  doctor: {
    ...Typography.label,
    color: Palette.text,
  },
  hospital: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dateText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fee: {
    ...Typography.label,
    color: Palette.text,
  },
  type: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  paymentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  paymentNoticeText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    flex: 1,
  },
});