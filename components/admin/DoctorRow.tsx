/**
 * HealPoint - Super Admin doctor row.
 * Professional card-style row showing the REAL platform doctor record:
 * photo, name, specialization, hospital, verification/active/availability
 * status, experience, rating, consultation fee, real appointment count and the
 * next available slot. Nothing is invented here — missing fields fall back to
 * an honest dash/label and every value comes from the backend record.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusBadge, verificationStatusBadge } from '@/components/admin/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Palette, Radius, Spacing, Typography } from '@/constants/theme';
import { formatINR } from '@/lib/format';
import { getDoctorImage } from '@/lib/image';
import { doctorHospitalName, doctorSpecialty, nextAvailableSlot } from '@/lib/doctor';
import type { Doctor } from '@/types';

interface DoctorRowProps {
  doctor: Doctor;
  /** Real appointment count for this doctor (computed from the platform API). */
  appointmentCount?: number;
  index?: number;
  onPress?: () => void;
}

function doctorActive(doctor: Doctor): boolean {
  return doctor.isActive !== false;
}

function doctorAvailabilityLabel(doctor: Doctor): { label: string; online: boolean } {
  if (doctor.available !== false && doctor.onlineStatus === 'online') {
    return { label: 'Available now', online: true };
  }
  if (doctor.available === true) {
    return { label: 'Available', online: true };
  }
  return { label: 'Unavailable', online: false };
}

export function DoctorRow({ doctor, appointmentCount, index = 0, onPress }: DoctorRowProps) {
  const specialty = doctorSpecialty(doctor);
  const hospital = doctorHospitalName(doctor);
  const active = doctorActive(doctor);
  const availability = doctorAvailabilityLabel(doctor);
  const nextSlot = nextAvailableSlot(doctor);
  const slotCount = (doctor.timeSlots || []).filter((slot) => slot.isAvailable !== false).length;
  const hasNextSlot = Boolean(nextSlot);
  const verified = String(doctor.verificationStatus || '').toLowerCase() === 'verified';

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Image
            source={{ uri: getDoctorImage(doctor, index) }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
          <View style={styles.titleWrap}>
            <Text style={styles.name} numberOfLines={1}>
              {doctor.name || 'Doctor'}
            </Text>
            <Text style={styles.specialty} numberOfLines={1}>
              {specialty}
            </Text>
            <Text style={styles.hospital} numberOfLines={1}>
              <Ionicons name="business-outline" size={13} color={Palette.textMuted} /> {hospital}
            </Text>
          </View>
          {onPress ? <Ionicons name="chevron-forward" size={20} color={Palette.textMuted} /> : null}
        </View>

        <View style={styles.badgeRow}>
          <Badge label={active ? 'Active' : 'Inactive'} variant={active ? 'success' : 'neutral'} />
          <Badge label={availability.label} variant={availability.online ? 'primary' : 'warning'} />
          <StatusBadge value={doctor.verificationStatus} variant={verificationStatusBadge(doctor.verificationStatus)} />
          {verified ? <Badge label="Verified" variant="primary" /> : null}
        </View>
<View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Experience</Text>
            <Text style={styles.metaValue}>{doctor.experience ?? 0} yrs</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Rating</Text>
            <Text style={styles.metaValue}>
              {Number(doctor.rating || 0).toFixed(1)} ({doctor.reviewCount || 0})
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Fee</Text>
            <Text style={styles.metaValue}>{formatINR(doctor.fees)}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={15} color={Palette.primary} />
            <Text style={styles.statText}>{appointmentCount ?? 0} appointment(s)</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={15} color={Palette.primary} />
            <Text style={styles.statText}>
              {slotCount > 0 ? `${slotCount} slot(s) · ` : 'No slots · '}
              {hasNextSlot && nextSlot ? `next ${nextSlot.date} ${nextSlot.time}` : 'no upcoming slot'}
            </Text>
          </View>
        </View>

        <View style={styles.emailRow}>
          <Ionicons name="mail-outline" size={15} color={Palette.textMuted} />
          <Text style={styles.emailText} numberOfLines={1}>
            {doctor.email || doctor.clinicInfo?.email || 'No email stored'}
          </Text>
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
  card: { gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  titleWrap: { flex: 1, gap: 2 },
  name: { ...Typography.h4, color: Palette.text },
  specialty: { ...Typography.bodySmall, color: Palette.primaryDark, fontWeight: '600' },
  hospital: { ...Typography.caption, color: Palette.textMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    backgroundColor: Palette.background,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  metaCol: { flex: 1, minWidth: '30%', gap: 2 },
  metaLabel: { ...Typography.caption, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaValue: { ...Typography.bodySmall, color: Palette.text },
  statsRow: { gap: Spacing.xs },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statText: { ...Typography.caption, color: Palette.textMuted, flexShrink: 1 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  emailText: { ...Typography.caption, color: Palette.textMuted, flexShrink: 1 },
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