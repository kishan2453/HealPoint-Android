/**
 * HealPoint — Smart Patient Doctor Discovery & Comparison.
 *
 * Side-by-side factual healthcare comparison of up to 3 accredited physicians.
 * Compares credentials, hospital affiliation, consultation modes, live availability,
 * and fees using ONLY real HealPoint data.
 *
 * Strictly neutral: No AI diagnosis, no "best doctor" claims, no winner rankings.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useDoctorComparison } from "@/hooks/use-doctor-comparison";
import { useUserLocation } from "@/hooks/use-user-location";
import { formatDoctorName, formatINR, toDDMMYYYY } from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import { getDoctorDetails } from "@/services/doctors";
import { getPatientSubscriptionEntitlement } from "@/services/subscriptions";
import type { Doctor } from "@/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMN_WIDTH = Math.min(Math.max((SCREEN_WIDTH - 48) / 2, 220), 280);

interface DoctorComparisonData {
  doctor: Doctor;
  availabilityToday: string;
  hasSlotsToday: boolean;
  distance: string | null;
}

export default function DoctorCompareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ids?: string }>();
  const { calculateDistanceTo } = useUserLocation();
  const {
    selectedDoctors: contextDoctors,
    selectedIds: contextIds,
    removeDoctor,
    clearComparison,
  } = useDoctorComparison();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [comparisonList, setComparisonList] = useState<DoctorComparisonData[]>([]);

  // Target doctor IDs from route query or context
  const targetIds = useMemo(() => {
    if (params.ids && typeof params.ids === "string") {
      const parsed = params.ids
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parsed.length > 0) return parsed.slice(0, 3);
    }
    return contextIds.slice(0, 3);
  }, [params.ids, contextIds]);

  const loadData = useCallback(async () => {
    if (targetIds.length === 0) {
      setComparisonList([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const todayStr = toDDMMYYYY(new Date());

      // Fetch doctor details and slot availability concurrently
      const results = await Promise.all(
        targetIds.map(async (docId) => {
          try {
            // Find in context first for immediate responsive rendering
            let doc = contextDoctors.find((d) => String(d._id) === docId);
            if (!doc) {
              const res = await getDoctorDetails(docId);
              doc = res.doctor;
            }

            // Real slot availability check
            let availabilityToday = "Checking...";
            let hasSlotsToday = false;
            try {
              const slotsRes = await appointmentService.getAvailableSlots(docId, todayStr);
              const slotsCount = slotsRes.availableSlots?.length || 0;
              if (slotsCount > 0) {
                availabilityToday = `Available Today (${slotsCount} slots)`;
                hasSlotsToday = true;
              } else if (doc.available) {
                availabilityToday = "Next available tomorrow";
              } else {
                availabilityToday = "Unavailable today";
              }
            } catch {
              availabilityToday = doc.available ? "Open for booking" : "Contact clinic";
            }

            // Real distance if hospital coordinates exist
            let distance: string | null = null;
            const hosp = doc.hospitalId;
            if (hosp && typeof hosp === "object") {
              const lat = hosp.location?.lat;
              const lng = hosp.location?.lng;
              if (lat != null && lng != null) {
                distance = calculateDistanceTo(Number(lat), Number(lng));
              }
            }

            return {
              doctor: doc,
              availabilityToday,
              hasSlotsToday,
              distance,
            };
          } catch {
            return null;
          }
        }),
      );

      const valid = results.filter((r): r is DoctorComparisonData => r !== null);
      setComparisonList(valid);
    } catch (err) {
      setError(toErrorMessage(err, "Unable to load doctor comparison data."));
    } finally {
      setLoading(false);
    }
  }, [targetIds, contextDoctors, calculateDistanceTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRemove = (doctorId: string) => {
    removeDoctor(doctorId);
    setComparisonList((prev) => prev.filter((item) => String(item.doctor._id) !== doctorId));
  };

  const handleBookVisit = (doctor: Doctor) => {
    router.push({
      pathname: "/booking/[doctorId]",
      params: { doctorId: String(doctor._id), type: "clinic" },
    });
  };

  const handleOnlineConsultation = async (doctor: Doctor) => {
    try {
      const ent = await getPatientSubscriptionEntitlement();
      if (!ent.isEligibleForVideoConsultation) {
        Alert.alert(
          "Subscription Required",
          "Please subscribe to an eligible plan to access video consultations.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "View Plans",
              onPress: () => {
                router.push({
                  pathname: "/(drawer)/subscription",
                  params: { notice: ent.code || "subscription_required" },
                });
              },
            },
          ],
        );
        return;
      }
      router.push({
        pathname: "/booking/[doctorId]",
        params: { doctorId: String(doctor._id), type: "video" },
      });
    } catch {
      Alert.alert(
        "Subscription Required",
        "Please subscribe to an eligible plan to access video consultations.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "View Plans",
            onPress: () => {
              router.push("/(drawer)/subscription");
            },
          },
        ],
      );
    }
  };

  const handleViewProfile = (doctor: Doctor) => {
    router.push({
      pathname: "/doctor/[id]",
      params: { id: String(doctor._id) },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Comparing Doctors</Text>
        </View>
        <Loading label="Preparing side-by-side doctor comparison..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Doctor Comparison</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.centerContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Palette.primary}
            />
          }
        >
          <ErrorState message={error} onRetry={loadData} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (comparisonList.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={Palette.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Doctor Comparison</Text>
        </View>
        <ScrollView contentContainerStyle={styles.centerContent}>
          <EmptyState
            title="No doctors selected"
            message="Select up to 3 doctors from the directory to compare credentials, fees, and live availability side-by-side."
            action={
              <Button
                title="Browse Doctors"
                onPress={() => router.push("/(drawer)/doctors")}
              />
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={22} color={Palette.text} />
        </Pressable>

        <View style={styles.headerTextWrap}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Doctor Comparison</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{comparisonList.length}/3</Text>
            </View>
          </View>
          <Text style={styles.headerSub}>Factual healthcare comparison</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear comparison"
          onPress={clearComparison}
          style={({ pressed }) => [styles.clearHeaderBtn, pressed && styles.pressed]}
        >
          <Text style={styles.clearHeaderText}>Clear</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.mainScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
          />
        }
      >
        {/* Horizontal Comparison Matrix */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tableScroll}
        >
          {comparisonList.map(({ doctor, availabilityToday, hasSlotsToday, distance }, index) => {
            const isVerified = doctor.verificationStatus === "Verified";
            const hospital = doctor.hospitalId;
            const hospName =
              (hospital && typeof hospital === "object" && "name" in hospital
                ? hospital.name
                : "") ||
              doctor.hospitalName ||
              doctor.clinicInfo?.name ||
              "Affiliated Clinic";
            const hospCity =
              (hospital && typeof hospital === "object" && hospital.location?.city
                ? hospital.location.city
                : "") ||
              doctor.address ||
              "";

            return (
              <View key={String(doctor._id)} style={styles.doctorColumn}>
                {/* 1. Profile Header Card */}
                <View style={styles.profileCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${formatDoctorName(doctor.name)} from comparison`}
                    onPress={() => handleRemove(String(doctor._id))}
                    style={styles.columnRemoveBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={16} color={Palette.textMuted} />
                  </Pressable>

                  <View style={styles.avatarWrap}>
                    <Image
                      source={{ uri: getDoctorImage(doctor, index) }}
                      style={styles.avatar}
                      contentFit="cover"
                      transition={200}
                    />
                    {isVerified ? (
                      <View style={styles.verifiedDot}>
                        <Ionicons name="checkmark" size={10} color={Palette.white} />
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.doctorName} numberOfLines={2}>
                    {formatDoctorName(doctor.name)}
                  </Text>
                  {doctor.degree ? (
                    <Text style={styles.doctorDegree} numberOfLines={1}>
                      {doctor.degree}
                    </Text>
                  ) : null}
                </View>

                {/* 2. Specialization & Department */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Specialization</Text>
                  <Text style={styles.sectionValue} numberOfLines={2}>
                    {doctor.speciality || doctor.specialization || "General Physician"}
                  </Text>
                  {doctor.department ? (
                    <Text style={styles.sectionSubValue} numberOfLines={1}>
                      Dept: {doctor.department}
                    </Text>
                  ) : null}
                </View>

                {/* 3. Facility & Location */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Hospital / Clinic</Text>
                  <Text style={styles.sectionValue} numberOfLines={2}>
                    {hospName}
                  </Text>
                  {hospCity ? (
                    <Text style={styles.sectionSubValue} numberOfLines={1}>
                      <Ionicons name="location-outline" size={11} color={Palette.textMuted} />{" "}
                      {hospCity}
                    </Text>
                  ) : null}
                  {distance ? (
                    <View style={styles.distanceBadge}>
                      <Ionicons name="navigate-outline" size={10} color={Palette.primaryDark} />
                      <Text style={styles.distanceText}>{distance}</Text>
                    </View>
                  ) : null}
                </View>

                {/* 4. Experience */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Clinical Experience</Text>
                  <Text style={styles.sectionValue}>
                    {doctor.experience ? `${doctor.experience} Years` : "Not specified"}
                  </Text>
                </View>

                {/* 5. Ratings & Patient Reviews */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Patient Rating</Text>
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color={Palette.gold} />
                    <Text style={styles.ratingValue}>
                      {Number(doctor.rating || 0).toFixed(1)}
                    </Text>
                    <Text style={styles.reviewCount}>
                      ({doctor.reviewCount || 0} reviews)
                    </Text>
                  </View>
                </View>

                {/* 6. Consultation Modes */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Consultation Modes</Text>
                  <View style={styles.pillRow}>
                    <View style={styles.modePill}>
                      <Ionicons name="medical-outline" size={12} color={Palette.primaryDark} />
                      <Text style={styles.modePillText}>In-Clinic</Text>
                    </View>
                    <View style={styles.modePill}>
                      <Ionicons name="videocam-outline" size={12} color="#6366F1" />
                      <Text style={[styles.modePillText, { color: "#4F46E5" }]}>
                        Online Video
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 7. Consultation Fees */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Consultation Fee</Text>
                  <Text style={styles.feeHighlight}>
                    {doctor.fees ? formatINR(doctor.fees) : "Contact hospital"}
                  </Text>
                  <Text style={styles.feeNote}>Official hospital fee</Text>
                </View>

                {/* 8. Live Availability */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionLabel}>Current Availability</Text>
                  <View
                    style={[
                      styles.availBadge,
                      hasSlotsToday ? styles.availBadgeActive : styles.availBadgeMuted,
                    ]}
                  >
                    <View
                      style={[
                        styles.availDot,
                        hasSlotsToday ? styles.availDotActive : styles.availDotMuted,
                      ]}
                    />
                    <Text
                      style={[
                        styles.availText,
                        hasSlotsToday ? styles.availTextActive : styles.availTextMuted,
                      ]}
                      numberOfLines={2}
                    >
                      {availabilityToday}
                    </Text>
                  </View>
                </View>

                {/* 9. Action Buttons */}
                <View style={styles.actionColumn}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Book in-person visit with ${formatDoctorName(doctor.name)}`}
                    onPress={() => handleBookVisit(doctor)}
                    style={({ pressed }) => [styles.bookVisitBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="calendar" size={14} color={Palette.white} />
                    <Text style={styles.bookVisitBtnText}>Book Visit</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Consult online with ${formatDoctorName(doctor.name)}`}
                    onPress={() => handleOnlineConsultation(doctor)}
                    style={({ pressed }) => [styles.videoBtn, pressed && styles.pressed]}
                  >
                    <Ionicons name="videocam" size={14} color={Palette.primaryDark} />
                    <Text style={styles.videoBtnText}>Video Consult</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View full profile of ${formatDoctorName(doctor.name)}`}
                    onPress={() => handleViewProfile(doctor)}
                    style={({ pressed }) => [styles.profileBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.profileBtnText}>View Profile</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}

          {/* Add Doctor Slot (if less than 3) */}
          {comparisonList.length < 3 ? (
            <View style={styles.addDoctorColumn}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add another doctor to compare"
                onPress={() => router.push("/(drawer)/doctors")}
                style={({ pressed }) => [styles.addDoctorCard, pressed && styles.pressed]}
              >
                <View style={styles.addIconCircle}>
                  <Ionicons name="add" size={24} color={Palette.primary} />
                </View>
                <Text style={styles.addDoctorTitle}>Add Doctor</Text>
                <Text style={styles.addDoctorSub}>
                  Compare up to {3 - comparisonList.length} more physician
                  {3 - comparisonList.length > 1 ? "s" : ""}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    gap: Spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Palette.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  countBadge: {
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  countText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
    fontSize: 11,
  },
  headerSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  clearHeaderBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  clearHeaderText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.error,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: Spacing.lg,
  },
  mainScroll: {
    paddingVertical: Spacing.md,
  },
  tableScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  doctorColumn: {
    width: COLUMN_WIDTH,
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  profileCard: {
    alignItems: "center",
    position: "relative",
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  columnRemoveBtn: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  avatarWrap: {
    position: "relative",
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: Spacing.xs,
  },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
    backgroundColor: Palette.border,
  },
  verifiedDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Palette.white,
  },
  doctorName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
    textAlign: "center",
  },
  doctorDegree: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    marginTop: 2,
  },
  sectionBlock: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionValue: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  sectionSubValue: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  distanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Palette.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  distanceText: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  reviewCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 2,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Palette.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  modePillText: {
    fontSize: 10,
    fontWeight: "600",
    color: Palette.text,
  },
  feeHighlight: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  feeNote: {
    fontSize: 9,
    color: Palette.textMuted,
  },
  availBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.md,
    marginTop: 2,
  },
  availBadgeActive: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  availBadgeMuted: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  availDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  availDotActive: {
    backgroundColor: Palette.success,
  },
  availDotMuted: {
    backgroundColor: Palette.textMuted,
  },
  availText: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  availTextActive: {
    color: Palette.success,
  },
  availTextMuted: {
    color: Palette.textMuted,
  },
  actionColumn: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  bookVisitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingVertical: 9,
  },
  bookVisitBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.white,
  },
  videoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.pill,
    paddingVertical: 8,
  },
  videoBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  profileBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  profileBtnText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  addDoctorColumn: {
    width: COLUMN_WIDTH,
    justifyContent: "center",
  },
  addDoctorCard: {
    height: "100%",
    minHeight: 400,
    borderWidth: 2,
    borderColor: "rgba(14, 159, 142, 0.35)",
    borderStyle: "dashed",
    borderRadius: Radius.xl,
    backgroundColor: "rgba(14, 159, 142, 0.03)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  addIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  addDoctorTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  addDoctorSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
