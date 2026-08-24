/**
 * HealPoint - rich doctor card for the Home "Available doctors" carousel.
 *
 * Shows every field a patient needs before booking: photo, name, specialty,
 * hospital, location, experience, rating, consultation fee, real availability
 * and next available slot. Availability is only ever shown when the backend
 * says so (see lib/doctor.ts) — we never fake a status or a slot.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FavoriteButton } from '@/components/FavoriteButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { formatINR, formatDDMMYYYY } from '@/lib/format';
import {
  doctorHospitalName,
  doctorLocationText,
  doctorSpecialty,
  isDoctorAvailable,
  nextAvailableSlot,
} from '@/lib/doctor';
import { getDoctorImage } from '@/lib/image';
import type { Doctor } from '@/types';

interface DoctorFeatureCardProps {
  doctor: Doctor;
  index?: number;
}

export const FEATURE_CARD_WIDTH = 276;

function DoctorFeatureCardRaw({ doctor, index = 0 }: DoctorFeatureCardProps) {
  const router = useRouter();
  const id = String(doctor._id);
  const openProfile = () => router.push({ pathname: '/doctor/[id]', params: { id } });
  const openBooking = () => router.push({ pathname: '/booking/[doctorId]', params: { doctorId: id } });

  const location = doctorLocationText(doctor);
  const available = isDoctorAvailable(doctor);
  const next = nextAvailableSlot(doctor);
  const rating = Number(doctor.rating || 0);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View profile of ${doctor.name}`}
        onPress={openProfile}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
      >
        <View style={styles.topRow}>
          <Image
            source={{ uri: getDoctorImage(doctor, index) }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.heading}>
            <Text style={styles.name} numberOfLines={1}>
              {doctor.name}
            </Text>
            <Text style={styles.specialty} numberOfLines={1}>
              {doctorSpecialty(doctor)}
            </Text>
          </View>
          <FavoriteButton doctorId={id} size={20} />
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="business-outline" size={14} color={Palette.textMuted} />
          <Text style={styles.infoText} numberOfLines={1}>
            {doctorHospitalName(doctor)}
          </Text>
        </View>
        {location ? (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color={Palette.textMuted} />
            <Text style={styles.infoText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={14} color={Palette.gold} />
            <Text style={styles.metaText}>
              {rating.toFixed(1)} ({doctor.reviewCount || 0})
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="school-outline" size={14} color={Palette.primary} />
            <Text style={styles.metaText}>{doctor.experience || 0}+ yrs</Text>
          </View>
        </View>

        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>Consultation</Text>
          <Text style={styles.fee}>{formatINR(doctor.fees)}</Text>
        </View>

        <View style={styles.availabilityRow}>
          {available ? (
            <Badge
              label={
                doctor.available === true || doctor.onlineStatus === 'online'
                  ? 'Available now'
                  : 'Available'
              }
              variant="success"
            />
          ) : doctor.timeSlots?.length ? (
            <Badge label="No upcoming slots" variant="neutral" />
          ) : null}
          {doctor.consultationTypes?.includes('video') ? <Badge label="Video" variant="primary" /> : null}
        </View>

        <View style={styles.nextRow}>
          <Ionicons name="calendar-outline" size={14} color={Palette.primaryDark} />
          <Text style={styles.nextText} numberOfLines={1}>
            {next ? `Next: ${formatDDMMYYYY(next.date)} • ${next.time}` : 'Check live slots at booking'}
          </Text>
        </View>
      </Pressable>

      <View style={styles.footer}>
        <Button
          title="Book Appointment"
          onPress={openBooking}
          fullWidth
          style={styles.bookButton}
        />
      </View>
    </View>
  );
}

export const DoctorFeatureCard = React.memo(DoctorFeatureCardRaw);
const styles = StyleSheet.create({
  card: {
    width: FEATURE_CARD_WIDTH,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  pressed: {
    opacity: 0.92,
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  heading: {
    flex: 1,
    gap: 1,
  },
  name: {
    ...Typography.label,
    color: Palette.text,
  },
  specialty: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoText: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginVertical: Spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: '600',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  fee: {
    ...Typography.label,
    color: Palette.text,
  },
  availabilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  nextText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    flex: 1,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
    paddingTop: Spacing.md,
  },
  bookButton: {
    minHeight: 44,
  },
});