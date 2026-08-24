/**
 * HealPoint - online consultation doctor card.
 *
 * Built for the "Consult Online" experience with real backend online-doctor
 * data. Two primary CTAs: [Consult Now] and [Schedule] — both route into the
 * existing verified booking + Razorpay flow.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { formatINR } from '@/lib/format';
import { getDoctorImage } from '@/lib/image';
import type { OnlineDoctor } from '@/types';

interface OnlineDoctorCardProps {
  doctor: OnlineDoctor;
  index?: number;
}

function specialtyName(doctor: OnlineDoctor): string {
  return doctor.speciality || doctor.specialization || doctor.department || 'General physician';
}

function hospitalName(doctor: OnlineDoctor): string {
  const hospital = doctor.hospital;
  return hospital?.name || doctor.hospitalName || 'Hospital details pending';
}

function OnlineDoctorCardRaw({ doctor, index = 0 }: OnlineDoctorCardProps) {
  const router = useRouter();
  const id = String(doctor._id);
  const online = doctor.onlineConsultationEnabled === true;
  const instant = doctor.instantConsultationEnabled === true;
  const slot = doctor.nextAvailableSlot;
  const verified = doctor.verificationStatus === 'Verified';

  const goBooking = (mode: 'instant' | 'scheduled') => {
    router.push({
      pathname: '/booking/[doctorId]',
      params: { doctorId: id, type: 'video', mode },
    });
  };

  return (
    <View style={styles.card}>
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
            {specialtyName(doctor)}
          </Text>
          <Text style={styles.hospital} numberOfLines={1}>
            <Ionicons name="business" size={13} color={Palette.textMuted} /> {hospitalName(doctor)}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="briefcase-outline" size={15} color={Palette.primary} />
          <Text style={styles.metaText}>{doctor.experience || 0}+ yrs</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="star" size={15} color={Palette.gold} />
          <Text style={styles.metaText}>
            {Number(doctor.rating || 0).toFixed(1)} ({doctor.reviewCount || 0})
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.fee}>{formatINR(doctor.fees)}</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        {online ? (
          <Badge label="Online" variant="success" />
        ) : (
          <Badge label="Offline" variant="neutral" />
        )}
        {instant ? <Badge label="Consult now available" variant="primary" /> : null}
        {verified ? <Badge label="Verified" variant="primary" /> : null}
      </View>

      {slot ? (
        <View style={styles.nextSlot}>
          <Ionicons name="time-outline" size={15} color={Palette.primaryDark} />
          <Text style={styles.nextSlotText}>
            Next available {slot.weekday} · {slot.time}
          </Text>
        </View>
      ) : (
        <View style={styles.nextSlot}>
          <Ionicons name="time-outline" size={15} color={Palette.warning} />
          <Text style={styles.nextSlotText}>No upcoming slots found right now</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Consult now with ${doctor.name}`}
          onPress={() => goBooking('instant')}
          style={({ pressed }) => [styles.ctaPrimary, pressed && styles.pressed]}
        >
          <Ionicons name="videocam" size={18} color={Palette.white} />
          <Text style={styles.ctaPrimaryText}>Consult Now</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Schedule consultation with ${doctor.name}`}
          onPress={() => goBooking('scheduled')}
          style={({ pressed }) => [styles.ctaSecondary, pressed && styles.pressed]}
        >
          <Ionicons name="calendar-outline" size={18} color={Palette.primary} />
          <Text style={styles.ctaSecondaryText}>Schedule</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const OnlineDoctorCard = React.memo(OnlineDoctorCardRaw);
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
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  heading: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...Typography.h4,
    color: Palette.text,
  },
  specialty: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: '600',
  },
  hospital: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  fee: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  nextSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  nextSlotText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  ctaPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
    elevation: 3,
  },
  ctaPrimaryText: {
    ...Typography.button,
    color: Palette.white,
  },
  ctaSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.primary,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  ctaSecondaryText: {
    ...Typography.button,
    color: Palette.primary,
  },
});