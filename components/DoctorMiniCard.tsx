/**
 * HealPoint - compact doctor card for the Home "Top rated doctors" carousel.
 * Whole card opens the profile; the fee/CTA area jumps straight to booking.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDoctorName, formatINR } from "@/lib/format";
import { doctorHospitalName, doctorSpecialty } from "@/lib/doctor";
import { getDoctorImage } from "@/lib/image";
import type { Doctor } from "@/types";

interface DoctorMiniCardProps {
  doctor: Doctor;
  index?: number;
}

export const MINI_CARD_WIDTH = 320;

function DoctorMiniCardRaw({ doctor, index = 0 }: DoctorMiniCardProps) {
  const router = useRouter();
  const id = String(doctor._id);
  const openProfile = () =>
    router.push({ pathname: "/doctor/[id]", params: { id } });
  const openBooking = () =>
    router.push({ pathname: "/booking/[doctorId]", params: { doctorId: id } });
  const rating = Number(doctor.rating || 0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View profile of ${formatDoctorName(doctor.name)}`}
      onPress={openProfile}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: getDoctorImage(doctor, index) }}
        style={styles.avatar}
        contentFit="cover"
        transition={200}
      />

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {formatDoctorName(doctor.name)}
        </Text>
        <Text style={styles.specialty} numberOfLines={1}>
          {doctorSpecialty(doctor)}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="star" size={12} color={Palette.gold} />
            <Text style={styles.statText}>
              {rating.toFixed(1)} ({doctor.reviewCount || 0})
            </Text>
          </View>
          <View style={styles.dot} />
          <View style={styles.stat}>
            <Ionicons name="school-outline" size={12} color={Palette.primary} />
            <Text style={styles.statText}>{doctor.experience || 0}+ yrs</Text>
          </View>
        </View>
        <Text style={styles.hospital} numberOfLines={1}>
          <Ionicons
            name="business-outline"
            size={12}
            color={Palette.textMuted}
          />{" "}
          {doctorHospitalName(doctor)}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Book appointment with ${formatDoctorName(doctor.name)}`}
        onPress={openBooking}
        style={({ pressed }) => [
          styles.bookCta,
          pressed && styles.bookCtaPressed,
        ]}
      >
        <Text style={styles.bookFee}>{formatINR(doctor.fees)}</Text>
        <Text style={styles.bookLabel}>Book</Text>
        <Ionicons name="arrow-forward" size={13} color={Palette.white} />
      </Pressable>
    </Pressable>
  );
}

export const DoctorMiniCard = React.memo(DoctorMiniCardRaw);
const styles = StyleSheet.create({
  card: {
    width: MINI_CARD_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    ...Shadows.card,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    ...Typography.label,
    color: Palette.text,
  },
  specialty: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Palette.border,
  },
  hospital: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  bookCta: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 2,
    minWidth: 74,
  },
  bookCtaPressed: {
    opacity: 0.85,
  },
  bookFee: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "700",
  },
  bookLabel: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "600",
  },
});
