/**
 * HealPoint - hospital card with real catalog data. Links to the hospital profile.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HospitalImage } from '@/components/HospitalImage';
import { Badge } from '@/components/ui/Badge';
import { Palette, Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import type { Hospital } from '@/types';

interface HospitalCardProps {
  hospital: Hospital;
}

function hospitalAddress(hospital: Hospital): string {
  const loc = hospital.location;
  return [loc?.address, loc?.city, loc?.state].filter(Boolean).join(', ') || 'Address pending';
}

function HospitalCardRaw({ hospital }: HospitalCardProps) {
  const router = useRouter();
  const id = String(hospital._id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View profile of ${hospital.name}`}
      onPress={() => router.push({ pathname: '/hospital/[id]', params: { id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.coverWrap}>
        <HospitalImage
          hospital={hospital}
          style={styles.cover}
          contentFit="cover"
          accessibilityLabel={`${hospital.name} photo`}
        />
        <View style={styles.ratingPill}>
          <Ionicons name="star" size={14} color={Palette.gold} />
          <Text style={styles.ratingText}>{Number(hospital.rating || 0).toFixed(1)}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {hospital.name}
        </Text>
        <Text style={styles.address} numberOfLines={2}>
          <Ionicons name="location-outline" size={13} color={Palette.textMuted} /> {hospitalAddress(hospital)}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={15} color={Palette.primary} />
            <Text style={styles.metaText}>{hospital.doctorCount || 0} doctors</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="medkit-outline" size={15} color={Palette.primary} />
            <Text style={styles.metaText}>{hospital.departments?.length || 0} departments</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          {hospital.emergencyFacility ? <Badge label="Emergency" variant="error" /> : null}
          {hospital.icu ? <Badge label="ICU" variant="warning" /> : null}
          {Number(hospital.beds) > 0 ? <Badge label={`${hospital.beds} beds`} variant="neutral" /> : null}
        </View>

        <View style={styles.viewRow}>
          <View style={styles.viewIconWrap}>
            <Ionicons name="business" size={16} color={Palette.primaryDark} />
          </View>
          <Text style={styles.viewLabel}>View Hospital</Text>
          <Ionicons name="chevron-forward" size={18} color={Palette.primaryDark} />
        </View>
      </View>
    </Pressable>
  );
}

export const HospitalCard = React.memo(HospitalCardRaw);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  pressed: {
    opacity: 0.9,
  },
  coverWrap: {
    height: 130,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  ratingPill: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  ratingText: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: '700',
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  name: {
    ...Typography.h4,
    color: Palette.text,
  },
  address: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
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
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  viewIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewLabel: {
    ...Typography.label,
    color: Palette.primaryDark,
    flex: 1,
  },
});
