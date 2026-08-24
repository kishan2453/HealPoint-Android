/**
 * HealPoint - doctor card with real catalog data. Links to the doctor profile.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FavoriteButton } from '@/components/FavoriteButton';
import { Badge } from '@/components/ui/Badge';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { getDoctorImage } from '@/lib/image';
import { formatINR } from '@/lib/format';
import type { Doctor } from '@/types';

interface DoctorCardProps {
  doctor: Doctor;
  index?: number;
}

function hospitalName(doctor: Doctor): string {
  const hospital = doctor.hospitalId;
  const name =
    (hospital && typeof hospital === 'object' && 'name' in hospital ? hospital.name : '') ||
    doctor.hospitalName ||
    doctor.clinicInfo?.name;
  return name || 'Hospital details pending';
}

function specialtyName(doctor: Doctor): string {
  return doctor.speciality || doctor.specialization || doctor.department || 'General physician';
}

function DoctorCardRaw({ doctor, index = 0 }: DoctorCardProps) {
  const router = useRouter();
  const id = String(doctor._id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View profile of ${doctor.name}`}
      onPress={() => router.push({ pathname: '/doctor/[id]', params: { id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
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
            {specialtyName(doctor)}
          </Text>
          <Text style={styles.hospital} numberOfLines={1}>
            <Ionicons name="business" size={13} color={Palette.textMuted} /> {hospitalName(doctor)}
          </Text>
        </View>
        <FavoriteButton doctorId={id} />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={16} color={Palette.primary} />
          <Text style={styles.metaText}>{doctor.experience || 0}+ yrs</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="star" size={16} color={Palette.gold} />
          <Text style={styles.metaText}>
            {Number(doctor.rating || 0).toFixed(1)} ({doctor.reviewCount || 0})
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.fee}>{formatINR(doctor.fees)}</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        {doctor.available ? <Badge label="Available" variant="success" /> : null}
        {doctor.verificationStatus === 'Verified' ? (
          <Badge label="Verified" variant="primary" />
        ) : null}
        {doctor.consultationTypes?.includes('video') ? <Badge label="Video" variant="neutral" /> : null}
      </View>
    </Pressable>
  );
}

export const DoctorCard = React.memo(DoctorCardRaw);

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
});