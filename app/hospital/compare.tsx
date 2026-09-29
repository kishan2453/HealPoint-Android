/**
 * HealPoint - Smart Hospital Comparison Screen
 * Allows patients to compare up to 3 real, active accredited hospitals
 * side-by-side with live infrastructure metrics, real reviews, and department doctor rosters.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HospitalImage } from "@/components/HospitalImage";
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
import { useHospitalComparison } from "@/hooks/use-hospital-comparison";
import { formatDoctorName, formatINR } from "@/lib/format";
import { getDoctorImage } from "@/lib/image";
import { toErrorMessage } from "@/services/api";
import { compareHospitals } from "@/services/hospitals";
import { getPatientSubscriptionEntitlement } from "@/services/subscriptions";
import type { Doctor, Hospital } from "@/types";

type CompareTab = "overview" | "departments";

const SCREEN_WIDTH = Dimensions.get("window").width;

export default function HospitalCompareScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ids?: string }>();
  const {
    selectedHospitals: contextHospitals,
    selectedIds: contextIds,
    removeHospital,
    clearComparison,
  } = useHospitalComparison();

  const [activeTab, setActiveTab] = useState<CompareTab>("overview");
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [checkingSubscription, setCheckingSubscription] = useState(false);

  // Extract target IDs from route query param or comparison context
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
      setHospitals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await compareHospitals(targetIds);
      if (res && res.hospitals) {
        setHospitals(res.hospitals);
      } else {
        setHospitals([]);
      }
    } catch (err) {
      setError(
        toErrorMessage(
          err,
          "Failed to load comparison data. Please verify your connection.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [targetIds]);

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

  // Compute union of departments across the loaded hospitals
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    hospitals.forEach((h) => {
      (h.departments || []).forEach((dept) => {
        if (dept && dept.trim().length > 1) {
          set.add(dept.trim());
        }
      });
      (h.doctors || []).forEach((d) => {
        const docDept = d.department || d.speciality;
        if (docDept && docDept.trim().length > 1) {
          set.add(docDept.trim());
        }
      });
    });
    return Array.from(set).sort();
  }, [hospitals]);

  // Set default selected department once departments are available
  useEffect(() => {
    if (availableDepartments.length > 0 && !selectedDepartment) {
      setSelectedDepartment(availableDepartments[0]);
    }
  }, [availableDepartments, selectedDepartment]);

  const handleRemove = (hospitalId: string) => {
    removeHospital(hospitalId);
    setHospitals((prev) => prev.filter((h) => String(h._id) !== hospitalId));
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear Comparison",
      "Are you sure you want to remove all hospitals from comparison?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            clearComparison();
            setHospitals([]);
            router.back();
          },
        },
      ],
    );
  };

  const handleBookClinicVisit = (doc: Doctor, hospital: Hospital) => {
    router.push({
      pathname: "/booking/[doctorId]",
      params: {
        doctorId: String(doc._id),
        appointmentType: "clinic",
        hospitalId: String(hospital._id),
      },
    });
  };

  const handleVideoConsult = async (doc: Doctor, hospital: Hospital) => {
    setCheckingSubscription(true);
    try {
      const ent = await getPatientSubscriptionEntitlement();
      if (!ent.isEligibleForVideoConsultation) {
        Alert.alert(
          "Premium Plan Required",
          ent.message ||
            "Video consultations are exclusive to Gold, Platinum, or Prime plan subscribers. Upgrade today for verified online doctor consultations.",
          [
            { text: "Not Now", style: "cancel" },
            {
              text: "View Plans",
              onPress: () =>
                router.push({
                  pathname: "/(drawer)/subscription",
                  params: { notice: "video_plan_required" },
                }),
            },
          ],
        );
        return;
      }
      router.push({
        pathname: "/booking/[doctorId]",
        params: {
          doctorId: String(doc._id),
          appointmentType: "video",
          hospitalId: String(hospital._id),
        },
      });
    } catch {
      Alert.alert(
        "Verification Failed",
        "Could not verify subscription quota. Please check your network.",
      );
    } finally {
      setCheckingSubscription(false);
    }
  };

  // Compute column width for side-by-side matrices
  const count = hospitals.length;
  const colWidth =
    count === 1
      ? SCREEN_WIDTH - Spacing.lg * 2
      : count === 2
        ? (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2
        : 220; // 3 hospitals scroll horizontally

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Loading label="Loading hospital comparison..." />
      </SafeAreaView>
    );
  }

  if (error && hospitals.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <ErrorState message={error} onRetry={loadData} />
      </SafeAreaView>
    );
  }

  if (hospitals.length < 2) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={Palette.text} />
          </Pressable>
          <Text style={styles.topBarTitle}>Hospital Comparison</Text>
          <View style={{ width: 38 }} />
        </View>

        <EmptyState
          title="Select At Least 2 Hospitals"
          message="To compare accreditation, medical infrastructure, available doctors, and real patient reviews side-by-side, add at least 2 hospitals (up to 3)."
          action={
            <Button
              title="Browse Accredited Hospitals"
              variant="primary"
              onPress={() => router.push("/(drawer)/hospitals")}
            />
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* ---------------- Top App Bar ---------------- */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={Palette.text} />
        </Pressable>

        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Hospital Comparison</Text>
          <Text style={styles.topBarSubtitle}>
            Comparing {hospitals.length} accredited facilities
          </Text>
        </View>

        <View style={styles.topBarActions}>
          {hospitals.length < 3 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add another hospital to compare"
              onPress={() => router.push("/(drawer)/hospitals")}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.pressed,
              ]}
              hitSlop={8}
            >
              <Ionicons name="add" size={20} color={Palette.primary} />
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear comparison"
            onPress={handleClearAll}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={Palette.error} />
          </Pressable>
        </View>
      </View>

      {/* ---------------- Tab Switcher ---------------- */}
      <View style={styles.tabBar}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "overview" }}
          onPress={() => setActiveTab("overview")}
          style={[
            styles.tabItem,
            activeTab === "overview" && styles.tabItemActive,
          ]}
        >
          <Ionicons
            name="business-outline"
            size={16}
            color={
              activeTab === "overview" ? Palette.primary : Palette.textMuted
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "overview" && styles.tabTextActive,
            ]}
          >
            Overview & Facilities
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "departments" }}
          onPress={() => setActiveTab("departments")}
          style={[
            styles.tabItem,
            activeTab === "departments" && styles.tabItemActive,
          ]}
        >
          <Ionicons
            name="medkit-outline"
            size={16}
            color={
              activeTab === "departments" ? Palette.primary : Palette.textMuted
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "departments" && styles.tabTextActive,
            ]}
          >
            Departments & Doctors
          </Text>
        </Pressable>
      </View>

      {/* ---------------- Content Area ---------------- */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- Sticky/Top Hospital Header Cards ---------------- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={count > 2}
          contentContainerStyle={styles.headerCardsRow}
        >
          {hospitals.map((h) => {
            const hId = String(h._id);
            return (
              <View key={hId} style={[styles.headerCard, { width: colWidth }]}>
                {/* Remove button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${h.name} from comparison`}
                  onPress={() => handleRemove(hId)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.headerCardRemove,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="close" size={14} color={Palette.text} />
                </Pressable>

                {/* Hospital Image */}
                <View style={styles.headerCardImgWrap}>
                  <HospitalImage
                    hospital={h}
                    style={styles.headerCardImg}
                    contentFit="cover"
                  />
                </View>

                {/* Info */}
                <Text style={styles.headerCardName} numberOfLines={2}>
                  {h.name}
                </Text>

                <View style={styles.headerCardLocRow}>
                  <Ionicons
                    name="location-outline"
                    size={12}
                    color={Palette.textMuted}
                  />
                  <Text style={styles.headerCardLoc} numberOfLines={1}>
                    {h.location?.city || "Gujarat, India"}
                  </Text>
                </View>

                {/* Rating */}
                <View style={styles.headerCardRatingRow}>
                  <Ionicons name="star" size={13} color={Palette.gold} />
                  <Text style={styles.headerCardRatingText}>
                    {Number(h.rating || 0).toFixed(1)}
                  </Text>
                  {Number(h.reviewCount || 0) > 0 ? (
                    <Text style={styles.headerCardReviewCount}>
                      ({h.reviewCount})
                    </Text>
                  ) : null}
                </View>

                {/* Profile Link */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View full profile of ${h.name}`}
                  onPress={() =>
                    router.push({
                      pathname: "/hospital/[id]",
                      params: { id: hId },
                    })
                  }
                  style={({ pressed }) => [
                    styles.headerCardLink,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.headerCardLinkText}>View Profile</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color={Palette.primary}
                  />
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        {/* ---------------- TAB 1: OVERVIEW & INFRASTRUCTURE ---------------- */}
        {activeTab === "overview" ? (
          <View style={styles.matrixContainer}>
            {/* Row: Consultation Fee */}
            <MatrixRow
              icon="cash-outline"
              title="Average Consultation Fee"
              subtitle="Standard OPD doctor fee"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) => (
                <Text style={styles.feeHighlight}>
                  {h.consultationFee && Number(h.consultationFee) > 0
                    ? formatINR(h.consultationFee)
                    : "₹400 - ₹800"}
                </Text>
              )}
            />

            {/* Row: Doctors Strength & Live Availability */}
            <MatrixRow
              icon="people-outline"
              title="Doctors & Availability"
              subtitle="Enriched medical staff"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) => {
                const total =
                  h.doctorCount || (h.doctors ? h.doctors.length : 0);
                const avail = h.availableDoctorCount || 0;
                return (
                  <View style={styles.cellStack}>
                    <Text style={styles.matrixPrimaryVal}>
                      {total} Doctor{total !== 1 ? "s" : ""}
                    </Text>
                    {avail > 0 ? (
                      <Badge
                        label={`${avail} Available Now`}
                        variant="success"
                      />
                    ) : (
                      <Badge label="Scheduled Only" variant="neutral" />
                    )}
                  </View>
                );
              }}
            />

            {/* Row: Video OPD Availability */}
            <MatrixRow
              icon="videocam-outline"
              title="Online Video OPD"
              subtitle="Google Meet consultation"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) =>
                h.onlineConsultationAvailable ? (
                  <Badge label="Google Meet Available" variant="success" />
                ) : (
                  <Badge label="In-Person Only" variant="neutral" />
                )
              }
            />

            {/* Row: 24/7 Emergency & ICU */}
            <MatrixRow
              icon="pulse-outline"
              title="Emergency & ICU Care"
              subtitle="Trauma & critical care"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) => (
                <View style={styles.cellStack}>
                  {h.emergencyFacility ? (
                    <Badge label="24/7 Emergency" variant="error" />
                  ) : (
                    <Badge label="OPD Timings" variant="neutral" />
                  )}
                  {h.icu ? <Badge label="ICU Unit" variant="warning" /> : null}
                </View>
              )}
            />

            {/* Row: Bed Capacity */}
            <MatrixRow
              icon="bed-outline"
              title="Inpatient Bed Capacity"
              subtitle="Total & ICU bed strength"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) => (
                <View style={styles.cellStack}>
                  <Text style={styles.matrixPrimaryVal}>
                    {h.beds ? `${h.beds} General Beds` : "Beds info on call"}
                  </Text>
                  {h.icuBeds ? (
                    <Text style={styles.matrixSecondaryVal}>
                      {h.icuBeds} Critical ICU Beds
                    </Text>
                  ) : null}
                </View>
              )}
            />

            {/* Row: OPD Timings */}
            <MatrixRow
              icon="time-outline"
              title="OPD Working Hours"
              subtitle="Outpatient department"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) => (
                <Text style={styles.matrixPrimaryVal}>
                  {h.opdTimings || "09:00 AM - 08:00 PM"}
                </Text>
              )}
            />

            {/* Row: Key Services & Facilities */}
            <MatrixRow
              icon="medkit-outline"
              title="Services & Specialties"
              subtitle="Accredited diagnostic & clinical"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) => {
                const services = h.services || [
                  "Pharmacy",
                  "Pathology Lab",
                  "Radiology",
                  "Ambulance",
                ];
                return (
                  <View style={styles.tagGrid}>
                    {services.slice(0, 4).map((s, idx) => (
                      <View key={idx} style={styles.miniTag}>
                        <Text style={styles.miniTagText}>{s}</Text>
                      </View>
                    ))}
                    {services.length > 4 ? (
                      <Text style={styles.moreTagsText}>
                        +{services.length - 4} more
                      </Text>
                    ) : null}
                  </View>
                );
              }}
            />

            {/* Row: Verified Patient Reviews */}
            <MatrixRow
              icon="chatbox-ellipses-outline"
              title="Verified Patient Feedback"
              subtitle="Real approved reviews"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) => {
                const firstReview =
                  h.reviews && h.reviews.length > 0 ? h.reviews[0] : null;
                if (!firstReview) {
                  return (
                    <Text style={styles.matrixMutedVal}>
                      No patient reviews yet.
                    </Text>
                  );
                }
                return (
                  <View style={styles.reviewCell}>
                    <View style={styles.reviewRatingPill}>
                      <Ionicons name="star" size={11} color={Palette.gold} />
                      <Text style={styles.reviewRatingText}>
                        {Number(firstReview.rating || 5).toFixed(1)}
                      </Text>
                    </View>
                    <Text style={styles.reviewComment} numberOfLines={3}>
                      &ldquo;{firstReview.comment}&rdquo;
                    </Text>
                    <Text style={styles.reviewAuthor} numberOfLines={1}>
                      —{" "}
                      {firstReview.patientName || firstReview.name || "Patient"}
                    </Text>
                  </View>
                );
              }}
            />

            {/* Row: Facility Photos / Gallery */}
            <MatrixRow
              icon="images-outline"
              title="Facility Gallery"
              subtitle="Real clinic & ward photos"
              hospitals={hospitals}
              colWidth={colWidth}
              renderValue={(h) => {
                const gallery = h.galleryImages || [];
                if (gallery.length === 0) {
                  return (
                    <Text style={styles.matrixMutedVal}>
                      Photo gallery available in hospital profile.
                    </Text>
                  );
                }
                return (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.galleryPreviewRow}
                  >
                    {gallery.slice(0, 3).map((item, idx) => (
                      <Image
                        key={idx}
                        source={{ uri: item.src }}
                        style={styles.galleryThumb}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                );
              }}
            />
          </View>
        ) : null}

        {/* ---------------- TAB 2: DEPARTMENTS & DOCTORS ---------------- */}
        {activeTab === "departments" ? (
          <View style={styles.departmentsContainer}>
            {/* Department Quick Filter Pills */}
            <View style={styles.deptFilterSection}>
              <Text style={styles.deptFilterTitle}>
                Select Department to Compare
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.deptPillsRow}
              >
                {availableDepartments.map((dept) => {
                  const isSelected = selectedDepartment === dept;
                  return (
                    <Pressable
                      key={dept}
                      accessibilityRole="button"
                      accessibilityLabel={`Filter by ${dept}`}
                      onPress={() => setSelectedDepartment(dept)}
                      style={({ pressed }) => [
                        styles.deptPill,
                        isSelected && styles.deptPillActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="medical-outline"
                        size={14}
                        color={isSelected ? Palette.white : Palette.primaryDark}
                      />
                      <Text
                        style={[
                          styles.deptPillText,
                          isSelected && styles.deptPillTextActive,
                        ]}
                      >
                        {dept}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Department Doctors Matrix */}
            <View style={styles.deptRosterHeader}>
              <Ionicons name="medkit" size={18} color={Palette.primary} />
              <Text style={styles.deptRosterTitle}>
                Doctors in {selectedDepartment || "Department"}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={count > 2}
              contentContainerStyle={styles.deptDoctorsRow}
            >
              {hospitals.map((h) => {
                const hId = String(h._id);
                const matchingDoctors = (h.doctors || []).filter((doc) => {
                  const d1 = (doc.department || "").toLowerCase();
                  const d2 = (doc.speciality || "").toLowerCase();
                  const target = (selectedDepartment || "").toLowerCase();
                  return (
                    d1 === target ||
                    d2 === target ||
                    d1.includes(target) ||
                    d2.includes(target)
                  );
                });

                return (
                  <View
                    key={hId}
                    style={[styles.deptHospitalCol, { width: colWidth }]}
                  >
                    <View style={styles.deptColHeader}>
                      <Text
                        style={styles.deptColHospitalName}
                        numberOfLines={1}
                      >
                        {h.name}
                      </Text>
                      <Badge
                        label={`${matchingDoctors.length} Doctor${matchingDoctors.length !== 1 ? "s" : ""}`}
                        variant={
                          matchingDoctors.length > 0 ? "primary" : "neutral"
                        }
                      />
                    </View>

                    {matchingDoctors.length === 0 ? (
                      <View style={styles.deptEmptyDoctorCard}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={24}
                          color={Palette.textMuted}
                        />
                        <Text style={styles.deptEmptyDoctorText}>
                          No listed doctors currently in this department.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            router.push({
                              pathname: "/hospital/[id]",
                              params: { id: hId },
                            })
                          }
                          style={styles.deptEmptyLink}
                        >
                          <Text style={styles.deptEmptyLinkText}>
                            View All Doctors ({h.doctorCount || 0})
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.doctorCardsList}>
                        {matchingDoctors.map((doc) => {
                          const docId = String(doc._id);
                          const isDocAvailable = doc.available !== false;

                          return (
                            <Card key={docId} style={styles.doctorCompareCard}>
                              {/* Doctor Head */}
                              <View style={styles.docHeaderRow}>
                                <Image
                                  source={{ uri: getDoctorImage(doc) }}
                                  style={styles.docAvatar}
                                  resizeMode="cover"
                                />
                                <View style={styles.docInfoCol}>
                                  <Text
                                    style={styles.docName}
                                    numberOfLines={1}
                                  >
                                    {formatDoctorName(doc.name)}
                                  </Text>
                                  <Text
                                    style={styles.docDegree}
                                    numberOfLines={1}
                                  >
                                    {doc.degree || doc.qualification || "MBBS"}
                                  </Text>
                                  {Number(doc.experience || 0) > 0 ? (
                                    <Text style={styles.docExp}>
                                      {doc.experience} years experience
                                    </Text>
                                  ) : null}
                                </View>
                              </View>

                              {/* Fee & Status */}
                              <View style={styles.docMetaRow}>
                                <View>
                                  <Text style={styles.docFeeLabel}>Fee</Text>
                                  <Text style={styles.docFeeVal}>
                                    {formatINR(doc.fees || 500)}
                                  </Text>
                                </View>
                                <Badge
                                  label={
                                    isDocAvailable
                                      ? "Available"
                                      : "Slot Scheduled"
                                  }
                                  variant={
                                    isDocAvailable ? "success" : "neutral"
                                  }
                                />
                              </View>

                              {/* Booking Action Buttons */}
                              <View style={styles.docActionCol}>
                                {/* Normal Clinic Appointment (Free / Unrestricted) */}
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Book in-person clinic visit with Dr. ${doc.name}`}
                                  onPress={() => handleBookClinicVisit(doc, h)}
                                  style={({ pressed }) => [
                                    styles.clinicBookBtn,
                                    pressed && styles.pressed,
                                  ]}
                                >
                                  <Ionicons
                                    name="calendar-outline"
                                    size={14}
                                    color={Palette.primaryDark}
                                  />
                                  <Text style={styles.clinicBookBtnText}>
                                    Book Clinic Visit
                                  </Text>
                                </Pressable>

                                {/* Video Consultation (Subscription Gated) */}
                                {h.onlineConsultationAvailable ? (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Start video consultation with Dr. ${doc.name}`}
                                    onPress={() => handleVideoConsult(doc, h)}
                                    disabled={checkingSubscription}
                                    style={({ pressed }) => [
                                      styles.videoBookBtn,
                                      pressed && styles.pressed,
                                    ]}
                                  >
                                    <Ionicons
                                      name="videocam"
                                      size={14}
                                      color={Palette.white}
                                    />
                                    <Text style={styles.videoBookBtnText}>
                                      Video Consult
                                    </Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            </Card>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Matrix Row Component
// ---------------------------------------------------------------------------
interface MatrixRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  hospitals: Hospital[];
  colWidth: number;
  renderValue: (h: Hospital) => React.ReactNode;
}

function MatrixRow({
  icon,
  title,
  subtitle,
  hospitals,
  colWidth,
  renderValue,
}: MatrixRowProps) {
  return (
    <Card padded style={styles.matrixRowCard}>
      <View style={styles.matrixRowHeader}>
        <View style={styles.matrixRowIconWrap}>
          <Ionicons name={icon} size={16} color={Palette.primary} />
        </View>
        <View style={styles.matrixRowTitleWrap}>
          <Text style={styles.matrixRowTitle}>{title}</Text>
          {subtitle ? (
            <Text style={styles.matrixRowSubtitle}>{subtitle}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={hospitals.length > 2}
        contentContainerStyle={styles.matrixValuesRow}
      >
        {hospitals.map((h) => (
          <View
            key={String(h._id)}
            style={[styles.matrixCell, { width: colWidth }]}
          >
            {renderValue(h)}
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
  },
  topBarCenter: {
    flex: 1,
    alignItems: "center",
  },
  topBarTitle: {
    ...Typography.h4,
    color: Palette.text,
    textAlign: "center",
  },
  topBarSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Palette.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingHorizontal: Spacing.md,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: {
    borderBottomColor: Palette.primary,
  },
  tabText: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  scrollContent: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  headerCardsRow: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    flexDirection: "row",
  },
  headerCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Palette.primaryLight,
    gap: Spacing.xs,
    ...Shadows.card,
  },
  headerCardRemove: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    zIndex: 5,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.pill,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Palette.border,
  },
  headerCardImgWrap: {
    height: 80,
    borderRadius: Radius.md,
    overflow: "hidden",
    backgroundColor: Palette.border,
  },
  headerCardImg: {
    width: "100%",
    height: "100%",
  },
  headerCardName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    minHeight: 38,
  },
  headerCardLocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerCardLoc: {
    ...Typography.caption,
    color: Palette.textMuted,
    flex: 1,
  },
  headerCardRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  headerCardRatingText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  headerCardReviewCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  headerCardLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: Palette.primaryLight,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    marginTop: 4,
  },
  headerCardLinkText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  matrixContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  matrixRowCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  matrixRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.xs,
  },
  matrixRowIconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  matrixRowTitleWrap: {
    flex: 1,
  },
  matrixRowTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  matrixRowSubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  matrixValuesRow: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingTop: Spacing.xs,
  },
  matrixCell: {
    justifyContent: "center",
  },
  cellStack: {
    gap: 4,
    alignItems: "flex-start",
  },
  feeHighlight: {
    ...Typography.h4,
    color: Palette.primaryDark,
    fontWeight: "800",
  },
  matrixPrimaryVal: {
    ...Typography.bodySmall,
    fontWeight: "600",
    color: Palette.text,
  },
  matrixSecondaryVal: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  matrixMutedVal: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  miniTag: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  miniTagText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.text,
  },
  moreTagsText: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.textMuted,
    alignSelf: "center",
  },
  reviewCell: {
    backgroundColor: Palette.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: 4,
  },
  reviewRatingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reviewRatingText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
    fontSize: 11,
  },
  reviewComment: {
    ...Typography.caption,
    color: Palette.text,
    fontStyle: "italic",
    lineHeight: 16,
  },
  reviewAuthor: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
    fontSize: 11,
  },
  galleryPreviewRow: {
    flexDirection: "row",
    gap: 6,
  },
  galleryThumb: {
    width: 60,
    height: 48,
    borderRadius: Radius.sm,
  },
  departmentsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  deptFilterSection: {
    gap: Spacing.xs,
  },
  deptFilterTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  deptPillsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  deptPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  deptPillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  deptPillText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primaryDark,
  },
  deptPillTextActive: {
    color: Palette.white,
  },
  deptRosterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: Spacing.xs,
  },
  deptRosterTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  deptDoctorsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  deptHospitalCol: {
    gap: Spacing.sm,
  },
  deptColHeader: {
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deptColHospitalName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
    marginRight: Spacing.xs,
  },
  deptEmptyDoctorCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  deptEmptyDoctorText: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  deptEmptyLink: {
    marginTop: 4,
  },
  deptEmptyLinkText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primary,
  },
  doctorCardsList: {
    gap: Spacing.sm,
  },
  doctorCompareCard: {
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.xs,
    backgroundColor: Palette.surface,
    ...Shadows.card,
  },
  docHeaderRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    alignItems: "center",
  },
  docAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
  },
  docInfoCol: {
    flex: 1,
    gap: 1,
  },
  docName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  docDegree: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  docExp: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  docMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.surfaceAlt,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  docFeeLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Palette.textMuted,
  },
  docFeeVal: {
    ...Typography.caption,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  docActionCol: {
    gap: 4,
    marginTop: 4,
  },
  clinicBookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: Palette.primaryLight,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  clinicBookBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  videoBookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: Palette.primary,
    paddingVertical: 7,
    borderRadius: Radius.sm,
  },
  videoBookBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.white,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});
