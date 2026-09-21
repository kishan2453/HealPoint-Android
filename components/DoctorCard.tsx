/**
 * HealPoint - Doctor Card with Real Catalog Data.
 *
 * Displays physician information, verified badge, rating, experience,
 * consultation fee, and a direct "Book Visit" CTA.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FavoriteButton } from "@/components/FavoriteButton";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { formatDoctorName, formatINR } from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import type { Doctor } from "@/types";

interface DoctorCardProps {
  doctor: Doctor;
  index?: number;
}

function hospitalName(doctor: Doctor): string {
  const hospital = doctor.hospitalId;
  const name =
    (hospital && typeof hospital === "object" && "name" in hospital
      ? hospital.name
      : "") ||
    doctor.hospitalName ||
    doctor.clinicInfo?.name;
  return name || "Affiliated Hospital";
}

function specialtyName(doctor: Doctor): string {
  return (
    doctor.speciality ||
    doctor.specialization ||
    doctor.department ||
    "General Physician"
  );
}

function DoctorCardRaw({ doctor, index = 0 }: DoctorCardProps) {
  const router = useRouter();
  const id = String(doctor._id);

  const openProfile = () =>
    router.push({ pathname: "/doctor/[id]", params: { id } });
  const openBooking = () =>
    router.push({ pathname: "/booking/[doctorId]", params: { doctorId: id } });

  const isVerified = doctor.verificationStatus === "Verified";

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View profile of ${formatDoctorName(doctor.name)}`}
        onPress={openProfile}
        style={({ pressed }) => [
          styles.cardPressable,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.topRow}>
          <Image
            source={{ uri: getDoctorImage(doctor, index) }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.heading}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {formatDoctorName(doctor.name)}
              </Text>
              {isVerified ? (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={Palette.primary}
                />
              ) : null}
            </View>
            <Text style={styles.specialty} numberOfLines={1}>
              {specialtyName(doctor)}
            </Text>
            <Text style={styles.hospital} numberOfLines={1}>
              <Ionicons name="business" size={13} color={Palette.textMuted} />{" "}
              {hospitalName(doctor)}
            </Text>
          </View>
          <View style={styles.favButtonWrap}>
            <FavoriteButton doctorId={id} size={22} />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          <View style={styles.statGroup}>
            <View style={styles.stat}>
              <Ionicons name="star" size={15} color={Palette.gold} />
              <Text style={styles.statText}>
                {Number(doctor.rating || 0).toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>({doctor.reviewCount || 0})</Text>
            </View>
            {doctor.experience ? (
              <View style={styles.stat}>
                <Ionicons
                  name="briefcase-outline"
                  size={14}
                  color={Palette.textMuted}
                />
                <Text style={styles.statLabel}>{doctor.experience} yrs</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.rightActionRow}>
            <View style={styles.feeWrap}>
              <Text style={styles.feeLabel}>Fee</Text>
              <Text style={styles.fee}>{formatINR(doctor.fees)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Book visit with ${formatDoctorName(doctor.name)}`}
              onPress={openBooking}
              style={({ pressed }) => [
                styles.bookBtn,
                pressed && styles.pressed,
              ]}
              hitSlop={6}
            >
              <Text style={styles.bookBtnText}>Book Visit</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={Palette.white}
              />
            </Pressable>
          </View>
        </View>

        {doctor.available ? (
          <View style={styles.availableBanner}>
            <View style={styles.availableDot} />
            <Text style={styles.availableText}>Available for appointments</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export const DoctorCard = React.memo(DoctorCardRaw);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.15)",
    overflow: "hidden",
    ...Shadows.card,
  },
  cardPressable: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
  },
  heading: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  name: {
    ...Typography.h4,
    color: Palette.text,
    flexShrink: 1,
  },
  specialty: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  hospital: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  favButtonWrap: {
    padding: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  statGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "700",
  },
  statLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  rightActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  feeWrap: {
    alignItems: "flex-end",
  },
  feeLabel: {
    fontSize: 10,
    color: Palette.textMuted,
    textTransform: "uppercase",
  },
  fee: {
    ...Typography.bodyMedium,
    fontWeight: "800",
    color: Palette.primary,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  bookBtnText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "700",
  },
  availableBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    marginTop: -Spacing.xs,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.success,
  },
  availableText: {
    ...Typography.caption,
    color: Palette.success,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
});
