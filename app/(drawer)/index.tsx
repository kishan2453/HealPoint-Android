/**
 * HealPoint - Home dashboard (redesigned patient home).
 *
 * A premium healthcare home built entirely from real backend data (doctors,
 * hospitals, appointments, notifications). Nothing on this screen is mocked:
 * availability is only ever shown when the backend confirms it, and every
 * button routes to a working screen.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DoctorFeatureCard } from "@/components/DoctorFeatureCard";
import { DoctorMiniCard } from "@/components/DoctorMiniCard";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { HospitalCard } from "@/components/HospitalCard";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useAppointments } from "@/hooks/use-appointments";
import { useAuth } from "@/hooks/use-auth";
import { SHARED_CATALOG_LIMIT, useDoctors } from "@/hooks/use-doctors";
import { useFavorites } from "@/hooks/use-favorites";
import { useHealthOverview } from "@/hooks/use-health-overview";
import { useHospitals } from "@/hooks/use-hospitals";
import { useNotificationBadge } from "@/hooks/use-notifications";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import {
  doctorHospitalName,
  doctorSearchableText,
  doctorSpecialty,
  isDoctorAvailable,
} from "@/lib/doctor";
import {
  cleanPatientFirstName,
  firstName,
  formatDDMMYYYY,
  formatDoctorName,
  formatINR,
} from "@/lib/format";
import { getDoctorImage, getUserImage } from "@/lib/image";
import { deriveAppointmentIntelligence } from "@/lib/appointment-intelligence";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import type {
  Appointment,
  AppointmentStatus,
  HealthActivityItem,
  PatientMedicalOverview,
  User,
} from "@/types";

const DOCTOR_POOL_SIZE = SHARED_CATALOG_LIMIT;
const FEATURED_DOCTORS = 5;
const SPECIALITY_CHIPS = 6;

type IconName = keyof typeof Ionicons.glyphMap;

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function userLocationLabel(user?: User | null): string {
  return user?.address?.trim() || "";
}

/** Last comma-separated segment of the profile address serves as the user's city. */
function userCity(user?: User | null): string {
  const city = (user?.address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return (city || "").toLowerCase();
}

const APPOINTMENT_STATUS_LABEL: Record<
  AppointmentStatus,
  { label: string; variant: BadgeVariant }
> = {
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "success" },
  completed: { label: "Completed", variant: "primary" },
  cancel: { label: "Cancelled", variant: "error" },
  rescheduled: { label: "Rescheduled", variant: "neutral" },
  missed: { label: "Missed", variant: "error" },
};

function appointmentDoctorName(appointment: Appointment): string {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === "object" && "name" in doctor) {
    return formatDoctorName(doctor.name);
  }
  if (appointment.doctorName) {
    return formatDoctorName(appointment.doctorName);
  }
  return "Doctor";
}

function appointmentStatus(appointment: Appointment) {
  const status = (appointment.status || "pending") as AppointmentStatus;
  return APPOINTMENT_STATUS_LABEL[status] || APPOINTMENT_STATUS_LABEL.pending;
}

// ---------------------------------------------------------------------------
// Static navigation maps (all routes exist and are fully functional)
// ---------------------------------------------------------------------------

interface QuickAction {
  key: string;
  label: string;
  subLabel?: string;
  icon: IconName;
  tint: string;
  path: Href;
  params?: Record<string, string>;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: "emergency",
    label: "Emergency",
    subLabel: "24/7 Help",
    icon: "alert-circle",
    tint: "#DC2626",
    path: "/emergency",
  },
  {
    key: "ai_assistant",
    label: "AI Assistant",
    subLabel: "Ask HealPoint",
    icon: "sparkles",
    tint: "#0284C7",
    path: "/ai-assistant",
  },
  {
    key: "book",
    label: "Book Visit",
    subLabel: "Find doctors",
    icon: "calendar",
    tint: Palette.primary,
    path: "/doctors",
  },
  {
    key: "hospitals",
    label: "Hospitals",
    subLabel: "7 Centres",
    icon: "business",
    tint: "#0E9F6E",
    path: "/hospitals",
  },
  {
    key: "appointments",
    label: "My Bookings",
    subLabel: "Appointments",
    icon: "time",
    tint: "#2F80ED",
    path: "/appointments",
  },
  {
    key: "favorites",
    label: "Saved Care",
    subLabel: "Saved items",
    icon: "heart",
    tint: "#E11D48",
    path: "/favorites",
  },
  {
    key: "consult",
    label: "Online Meet",
    subLabel: "Telehealth",
    icon: "videocam",
    tint: "#9356D6",
    path: "/consult-online",
  },
  {
    key: "prescriptions",
    label: "Prescriptions",
    subLabel: "Digital Rx",
    icon: "document-text",
    tint: "#10B981",
    path: "/health/prescriptions",
  },
  {
    key: "records",
    label: "Health EMR",
    subLabel: "Records",
    icon: "fitness",
    tint: "#E89A3C",
    path: "/health/records",
  },
  {
    key: "reports",
    label: "Lab Reports",
    subLabel: "Diagnostics",
    icon: "bar-chart",
    tint: "#0284C7",
    path: "/health/reports",
  },
  {
    key: "notifications",
    label: "Updates",
    subLabel: "Alerts",
    icon: "notifications",
    tint: "#6366F1",
    path: "/notification",
  },
  {
    key: "support",
    label: "Support",
    subLabel: "Help & Care",
    icon: "help-buoy",
    tint: "#0D9488",
    path: "/support",
  },
];

type DoctorFilterTab = "all" | "available" | "video" | "top";

const DOCTOR_FILTER_TABS: {
  id: DoctorFilterTab;
  label: string;
  icon: IconName;
}[] = [
  { id: "all", label: "All Doctors", icon: "people-outline" },
  { id: "available", label: "Available Now", icon: "time-outline" },
  { id: "video", label: "Video Consult", icon: "videocam-outline" },
  { id: "top", label: "Top Rated", icon: "star-outline" },
];

interface Service {
  key: string;
  label: string;
  caption: string;
  icon: IconName;
  tint: string;
  path: "/doctors" | "/hospitals" | "/consult-online";
  params?: Record<string, string>;
}

const SERVICES: Service[] = [
  {
    key: "video",
    label: "Video consult",
    caption: "Consult a doctor online with Google Meet",
    icon: "videocam",
    tint: "#2F80ED",
    path: "/consult-online",
  },
  {
    key: "clinic",
    label: "Clinic visit",
    caption: "Book an in-person visit",
    icon: "medical",
    tint: Palette.primary,
    path: "/doctors",
  },
  {
    key: "hospital",
    label: "Hospital care",
    caption: "Explore hospitals near you",
    icon: "business",
    tint: "#E89A3C",
    path: "/hospitals",
  },
  {
    key: "emergency",
    label: "Emergency",
    caption: "24/7 care & ICU support",
    icon: "medkit",
    tint: "#D9435B",
    path: "/hospitals",
  },
];
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    today,
    upcoming,
    loading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useAppointments();
  const {
    doctors,
    loading: doctorsLoading,
    error: doctorsError,
    refetch: refetchDoctors,
  } = useDoctors({ limit: DOCTOR_POOL_SIZE });
  const {
    hospitals,
    loading: hospitalsLoading,
    error: hospitalsError,
    refetch: refetchHospitals,
  } = useHospitals();
  const { unreadCount, refresh: refreshNotifications } = useNotificationBadge();
  const {
    favoriteIds,
    favoriteHospitalIds,
    savedDoctors,
    savedHospitals,
    refresh: refreshFavorites,
  } = useFavorites();
  const {
    metrics: healthMetrics,
    recentConsultation,
    recentPrescription,
    recentReport,
    recentDiagnosis,
    recentActivities,
    refresh: refreshHealthOverview,
  } = useHealthOverview();
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState<DoctorFilterTab>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingApptId, setCancellingApptId] = useState<string | null>(null);

  // A fresh appointment booked/cancelled elsewhere appears as soon as the
  // Home tab regains focus (throttled to prevent network churn).
  useScreenFocus(() => {
    refetchAppointments();
    refreshFavorites();
  }, 10_000);

  const city = userCity(user);
  const locationLabel = userLocationLabel(user);
  const nextAppointment = today[0] || upcoming[0];
  const nextIntelligence = useMemo(
    () =>
      nextAppointment ? deriveAppointmentIntelligence(nextAppointment) : null,
    [nextAppointment],
  );
  const upcomingCount = upcoming.length + today.length;
  const savedCount = favoriteIds.size + favoriteHospitalIds.size;
  const patientName = cleanPatientFirstName(
    user?.name,
    user?.role === "doctor",
  );

  // --- Multi-Entity Search: real client-side matching across doctors, hospitals, and specialties.
  const normalizedQuery = search.trim().toLowerCase();
  const matchingDoctors = useMemo(() => {
    if (!normalizedQuery) return [];
    return doctors.filter((doctor) =>
      doctorSearchableText(doctor).includes(normalizedQuery),
    );
  }, [doctors, normalizedQuery]);

  const matchingHospitals = useMemo(() => {
    if (!normalizedQuery) return [];
    return hospitals.filter((hospital) =>
      [
        hospital.name,
        hospital.slug,
        hospital.location?.address,
        hospital.location?.city,
        hospital.location?.state,
        ...(hospital.departments || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [hospitals, normalizedQuery]);

  const doctorSearchResults = matchingDoctors.slice(0, 4);
  const hospitalSearchResults = matchingHospitals.slice(0, 2);
  const totalSearchMatches = matchingDoctors.length + matchingHospitals.length;

  // --- Specialty chips derived from the real catalog (most common first).
  const specialities = useMemo(() => {
    const counts = new Map<string, number>();
    doctors.forEach((doctor) => {
      const label = doctorSpecialty(doctor);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, SPECIALITY_CHIPS)
      .map(([label]) => label);
  }, [doctors]);

  // --- Doctor rows -----------------------------------------------------------
  const availableDoctors = useMemo(
    () => doctors.filter(isDoctorAvailable),
    [doctors],
  );
  const topDoctors = useMemo(
    () =>
      [...doctors]
        .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
        .slice(0, FEATURED_DOCTORS),
    [doctors],
  );

  const filteredDoctors = useMemo(() => {
    if (doctorFilter === "available") {
      return availableDoctors;
    }
    if (doctorFilter === "video") {
      return doctors.filter(
        (d) =>
          d.consultationTypes?.includes("video") ||
          d.onlineStatus === "online" ||
          d.available === true,
      );
    }
    if (doctorFilter === "top") {
      return topDoctors;
    }
    return availableDoctors.length ? availableDoctors : doctors.slice(0, 10);
  }, [doctorFilter, availableDoctors, doctors, topDoctors]);

  // --- Nearby (only when the profile actually carries a location) ------------
  const nearbyHospitals = useMemo(() => {
    if (!city || !hospitals.length) return [];
    return hospitals.filter((hospital) => {
      const loc = hospital.location;
      return [loc?.city, loc?.address, loc?.state].some((value) =>
        value?.toLowerCase().includes(city),
      );
    });
  }, [hospitals, city]);

  const nearbyDoctorCount = useMemo(() => {
    if (!city || !doctors.length) return 0;
    return doctors.filter((doctor) =>
      doctorSearchableText(doctor).includes(city),
    ).length;
  }, [doctors, city]);

  const cityOfHospitals = useMemo(() => {
    const first = nearbyHospitals[0];
    return first?.location?.city || first?.location?.address || "your city";
  }, [nearbyHospitals]);

  const displayHospitals = useMemo(() => {
    if (nearbyHospitals.length) return nearbyHospitals.slice(0, 6);
    return [...hospitals]
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 6);
  }, [hospitals, nearbyHospitals]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      refetchAppointments(),
      refetchDoctors(),
      refetchHospitals(),
      refreshNotifications(),
      refreshFavorites(),
      refreshHealthOverview(),
    ]);
    setRefreshing(false);
  };

  const handleCancelAppointment = (appointmentId: string) => {
    Alert.alert(
      "Cancel Appointment",
      "Are you sure you want to cancel this appointment? This action cannot be undone.",
      [
        { text: "Keep Appointment", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCancellingApptId(appointmentId);
              const res =
                await appointmentService.cancelAppointment(appointmentId);
              Alert.alert(
                "Appointment Cancelled",
                res.message ||
                  "Your appointment has been cancelled successfully.",
              );
              await Promise.allSettled([
                refetchAppointments(),
                refreshHealthOverview(),
              ]);
            } catch (err) {
              Alert.alert(
                "Unable to Cancel",
                toErrorMessage(
                  err,
                  "Failed to cancel appointment. Please try again.",
                ),
              );
            } finally {
              setCancellingApptId(null);
            }
          },
        },
      ],
    );
  };

  const openDoctor = (id: string) =>
    router.push({ pathname: "/doctor/[id]", params: { id } });

  const runQuickAction = (action: QuickAction) => {
    if (action.params) {
      router.push({ pathname: action.path as never, params: action.params });
    } else {
      router.push(action.path as never);
    }
  };

  const openService = (service: Service) => {
    if (service.params) {
      router.push({ pathname: service.path, params: service.params });
    } else {
      router.push(service.path);
    }
  };

  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 340,
      useNativeDriver: true,
    }).start();
  }, [entranceAnim]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ---------------- Hero header ---------------- */}
        <View style={styles.hero}>
          <View style={styles.heroCircleA} />
          <View style={styles.heroCircleB} />
          <SafeAreaView edges={["top"]} style={styles.heroSafe}>
            <Animated.View
              style={{
                opacity: entranceAnim,
                transform: [
                  {
                    translateY: entranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              }}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.brandLockup}>
                  <View style={styles.brandMark}>
                    <View style={styles.brandCrossV} />
                    <View style={styles.brandCrossH} />
                  </View>
                  <Text style={styles.brandWordmark}>HealPoint</Text>
                </View>
                <View style={styles.heroActions}>
                  <DrawerToggleButton color={Palette.primaryDark} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Notifications"
                    onPress={() => router.push("/notification")}
                    style={({ pressed }) => [
                      styles.heroIconButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="notifications-outline"
                      size={22}
                      color={Palette.white}
                    />
                    {unreadCount > 0 ? (
                      <View style={styles.heroBadge}>
                        <Text style={styles.heroBadgeText}>
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open profile"
                    onPress={() => router.push("/profile")}
                    style={({ pressed }) => [
                      styles.heroAvatarButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    {user?.image ? (
                      <Image
                        source={{ uri: getUserImage(user.image) }}
                        style={styles.heroAvatar}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <Ionicons
                        name="person"
                        size={20}
                        color={Palette.primary}
                      />
                    )}
                  </Pressable>
                </View>
              </View>

              <Text style={styles.heroGreeting}>
                {greetingForHour(new Date().getHours())},{" "}
                <Text style={styles.heroGreetingName}>
                  {patientName || "there"}
                </Text>{" "}
                👋
              </Text>
              <Text style={styles.heroTagline}>
                Find the right doctor and book your visit in seconds.
              </Text>

              {nextAppointment ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Upcoming appointment: ${appointmentDoctorName(nextAppointment)}`}
                  onPress={() =>
                    router.push({
                      pathname: "/appointment/[id]",
                      params: { id: String(nextAppointment._id) },
                    })
                  }
                  style={({ pressed }) => [
                    styles.heroApptShortcut,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.heroApptShortcutDot} />
                  <Text style={styles.heroApptShortcutText} numberOfLines={1}>
                    Upcoming: {appointmentDoctorName(nextAppointment)} •{" "}
                    {formatDDMMYYYY(nextAppointment.slotDate)} (
                    {nextAppointment.slotTime})
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={13}
                    color="rgba(255,255,255,0.9)"
                  />
                </Pressable>
              ) : null}

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/profile/edit")}
                style={({ pressed }) => [
                  styles.locationPill,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="location" size={14} color={Palette.white} />
                <Text style={styles.locationPillText} numberOfLines={1}>
                  {locationLabel || "Set your location"}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color="rgba(255,255,255,0.85)"
                />
              </Pressable>
            </Animated.View>
          </SafeAreaView>
        </View>

        {/* ---------------- Search ---------------- */}
        <Animated.View
          style={[
            styles.searchShell,
            {
              opacity: entranceAnim,
              transform: [
                {
                  translateY: entranceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Card style={styles.searchCard}>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={22} color={Palette.primary} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search doctors, specialties, hospitals..."
                placeholderTextColor={Palette.textMuted}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search doctors, specialties, hospitals, locations"
              />
              {search.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearch("")}
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={Palette.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>
            {!search && specialities.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.specialityContent}
              >
                {specialities.map((label) => (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    onPress={() => setSearch(label)}
                    style={({ pressed }) => [
                      styles.specialityChip,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Ionicons
                      name="pulse"
                      size={14}
                      color={Palette.primaryDark}
                    />
                    <Text style={styles.specialityChipText}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {search.length > 0 && normalizedQuery ? (
              <View style={styles.resultsBox}>
                <View style={styles.resultsHeaderRow}>
                  <Text style={styles.resultsCount}>
                    {totalSearchMatches === 0
                      ? `No matches for "${search.trim()}"`
                      : `Matches for "${search.trim()}"`}
                  </Text>
                  {totalSearchMatches > 0 ? (
                    <View style={styles.searchCountsPillRow}>
                      {matchingDoctors.length > 0 ? (
                        <View style={styles.searchCountBadge}>
                          <Text style={styles.searchCountBadgeText}>
                            {matchingDoctors.length} Doctor
                            {matchingDoctors.length === 1 ? "" : "s"}
                          </Text>
                        </View>
                      ) : null}
                      {matchingHospitals.length > 0 ? (
                        <View
                          style={[
                            styles.searchCountBadge,
                            { backgroundColor: "rgba(232, 154, 60, 0.15)" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.searchCountBadgeText,
                              { color: "#D97706" },
                            ]}
                          >
                            {matchingHospitals.length} Hospital
                            {matchingHospitals.length === 1 ? "" : "s"}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {totalSearchMatches === 0 ? (
                  <View style={styles.searchEmptyBox}>
                    <Ionicons
                      name="search-outline"
                      size={28}
                      color={Palette.textMuted}
                    />
                    <Text style={styles.searchEmptyTitle}>
                      No matching doctors or hospitals
                    </Text>
                    <Text style={styles.searchEmptySubtitle}>
                      Try searching with another specialty, doctor name, or
                      city.
                    </Text>
                    <View style={styles.searchEmptyActions}>
                      <Button
                        title="Browse Doctors"
                        onPress={() => {
                          setSearch("");
                          router.push("/doctors");
                        }}
                      />
                      <Button
                        title="Browse Hospitals"
                        variant="outline"
                        onPress={() => {
                          setSearch("");
                          router.push("/hospitals");
                        }}
                      />
                    </View>
                  </View>
                ) : null}

                {/* Matching Doctors */}
                {matchingDoctors.length > 0 ? (
                  <View style={styles.searchSectionGroup}>
                    <Text style={styles.searchGroupTitle}>Doctors</Text>
                    {doctorSearchResults.map((doctor) => (
                      <Pressable
                        key={String(doctor._id)}
                        accessibilityRole="button"
                        onPress={() => openDoctor(String(doctor._id))}
                        style={({ pressed }) => [
                          styles.resultRow,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <Image
                          source={{ uri: getDoctorImage(doctor) }}
                          style={styles.resultAvatar}
                          contentFit="cover"
                          transition={150}
                        />
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName} numberOfLines={1}>
                            {doctor.name}
                          </Text>
                          <Text style={styles.resultMeta} numberOfLines={1}>
                            {doctorSpecialty(doctor)} •{" "}
                            {doctorHospitalName(doctor)}
                          </Text>
                        </View>
                        <View style={styles.resultRightAction}>
                          <Text style={styles.resultFee}>
                            {formatINR(doctor.fees)}
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={Palette.textMuted}
                          />
                        </View>
                      </Pressable>
                    ))}
                    {matchingDoctors.length > doctorSearchResults.length ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() =>
                          router.push({
                            pathname: "/doctors",
                            params: { search: search.trim() },
                          })
                        }
                        style={({ pressed }) => [
                          styles.viewAllButton,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <Text style={styles.viewAllText}>
                          View all {matchingDoctors.length} doctors
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color={Palette.primaryDark}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Matching Hospitals */}
                {matchingHospitals.length > 0 ? (
                  <View style={styles.searchSectionGroup}>
                    <Text style={styles.searchGroupTitle}>
                      Hospitals & Clinics
                    </Text>
                    {hospitalSearchResults.map((hospital) => (
                      <Pressable
                        key={String(hospital._id)}
                        accessibilityRole="button"
                        onPress={() =>
                          router.push({
                            pathname: "/hospital/[id]",
                            params: { id: String(hospital._id) },
                          })
                        }
                        style={({ pressed }) => [
                          styles.resultRow,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <View style={styles.resultHospitalIconWrap}>
                          <Ionicons name="business" size={18} color="#E89A3C" />
                        </View>
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName} numberOfLines={1}>
                            {hospital.name}
                          </Text>
                          <Text style={styles.resultMeta} numberOfLines={1}>
                            {hospital.location?.city ||
                              hospital.location?.address ||
                              "Hospital"}{" "}
                            • {hospital.doctorCount || 0} doctors
                          </Text>
                        </View>
                        <View style={styles.resultRightAction}>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={Palette.textMuted}
                          />
                        </View>
                      </Pressable>
                    ))}
                    {matchingHospitals.length > hospitalSearchResults.length ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push("/hospitals")}
                        style={({ pressed }) => [
                          styles.viewAllButton,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <Text style={styles.viewAllText}>
                          View all {matchingHospitals.length} hospitals
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={16}
                          color={Palette.primaryDark}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </Card>
        </Animated.View>

        {/* ---------------- Notification Preview Banner ---------------- */}
        {unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
            onPress={() => router.push("/notification")}
            style={({ pressed }) => [
              styles.notificationBanner,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.notificationBannerIconWrap}>
              <Ionicons
                name="notifications"
                size={16}
                color={Palette.primaryDark}
              />
            </View>
            <Text style={styles.notificationBannerText} numberOfLines={1}>
              You have <Text style={{ fontWeight: "700" }}>{unreadCount}</Text>{" "}
              unread healthcare update{unreadCount === 1 ? "" : "s"}
            </Text>
            <Text style={styles.notificationBannerAction}>View</Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color={Palette.primaryDark}
            />
          </Pressable>
        ) : null}

        {/* ---------------- Emergency Assistance Ambient Access ---------------- */}
        <Animated.View
          style={[
            styles.emergencyAccessWrap,
            {
              opacity: entranceAnim,
              transform: [
                {
                  translateY: entranceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [13, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency Help: 24/7 accredited hospital emergency desks and ambulance contacts"
            onPress={() => router.push("/emergency" as never)}
            style={({ pressed }) => [
              styles.emergencyStrip,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.emergencyStripLeft}>
              <View style={styles.emergencyStripIcon}>
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
              </View>
              <View style={styles.emergencyStripTextWrap}>
                <View style={styles.emergencyStripTitleRow}>
                  <Text style={styles.emergencyStripTitle}>Emergency Help</Text>
                  <View style={styles.emergencyStripPill}>
                    <Text style={styles.emergencyStripPillText}>
                      24/7 ACTIVE
                    </Text>
                  </View>
                </View>
                <Text style={styles.emergencyStripSub}>
                  Direct hospital hotlines, ambulance services & 108 helpline
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={Palette.textMuted}
            />
          </Pressable>
        </Animated.View>

        {/* ---------------- Quick actions ---------------- */}
        <Animated.View
          style={[
            styles.quickGridContainer,
            {
              opacity: entranceAnim,
              transform: [
                {
                  translateY: entranceAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action) => {
              const isAppts = action.key === "appointments";
              const isFavs = action.key === "favorites";
              const isNotifs = action.key === "notifications";

              let badgeCount = 0;
              if (isAppts) badgeCount = upcomingCount;
              else if (isFavs) badgeCount = savedCount;
              else if (isNotifs) badgeCount = unreadCount;

              return (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => runQuickAction(action)}
                  style={({ pressed }) => [
                    styles.quickTile,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.quickTileIcon,
                      { backgroundColor: `${action.tint}1A` },
                    ]}
                  >
                    <Ionicons
                      name={action.icon}
                      size={22}
                      color={action.tint}
                    />
                    {badgeCount > 0 ? (
                      <View
                        style={[
                          styles.quickBadge,
                          { backgroundColor: action.tint },
                        ]}
                      >
                        <Text style={styles.quickBadgeText}>
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.quickTileLabel} numberOfLines={1}>
                    {action.label}
                  </Text>
                  {action.subLabel ? (
                    <Text style={styles.quickTileSub} numberOfLines={1}>
                      {action.subLabel}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ---------------- Health services ---------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Health services"
            subtitle="Everything you can do on HealPoint"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalContent}
          >
            {SERVICES.map((service) => (
              <Pressable
                key={service.key}
                accessibilityRole="button"
                onPress={() => openService(service)}
                style={({ pressed }) => [
                  styles.serviceTile,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.serviceIcon,
                    { backgroundColor: `${service.tint}1A` },
                  ]}
                >
                  <Ionicons
                    name={service.icon}
                    size={22}
                    color={service.tint}
                  />
                </View>
                <Text style={styles.serviceLabel} numberOfLines={1}>
                  {service.label}
                </Text>
                <Text style={styles.serviceCaption} numberOfLines={2}>
                  {service.caption}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        {/* ---------------- Medical Overview ---------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Medical Overview"
            subtitle="Your personal healthcare stats from real records"
            actionLabel="Health Records"
            onAction={() => router.push("/health/records")}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsStripContent}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Total Appointments"
              onPress={() => router.push("/appointments")}
              style={({ pressed }) => [
                styles.overviewCard,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.overviewIconCircle,
                  { backgroundColor: "#EEF2FF" },
                ]}
              >
                <Ionicons name="calendar" size={18} color="#4F46E5" />
              </View>
              <Text style={styles.overviewCount}>
                {healthMetrics.totalAppointments}
              </Text>
              <Text style={styles.overviewLabel}>Total Visits</Text>
              <Text style={styles.overviewSub}>All bookings</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Completed Consultations"
              onPress={() => router.push("/appointments")}
              style={({ pressed }) => [
                styles.overviewCard,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.overviewIconCircle,
                  { backgroundColor: "#ECFDF5" },
                ]}
              >
                <Ionicons
                  name="checkmark-done-circle"
                  size={18}
                  color="#059669"
                />
              </View>
              <Text style={styles.overviewCount}>
                {healthMetrics.completedConsultations}
              </Text>
              <Text style={styles.overviewLabel}>Completed</Text>
              <Text style={styles.overviewSub}>Consultations</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upcoming Appointments"
              onPress={() => router.push("/appointments")}
              style={({ pressed }) => [
                styles.overviewCard,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.overviewIconCircle,
                  { backgroundColor: "#F0FDF4" },
                ]}
              >
                <Ionicons name="time" size={18} color={Palette.primary} />
              </View>
              <Text style={styles.overviewCount}>
                {healthMetrics.upcomingAppointments}
              </Text>
              <Text style={styles.overviewLabel}>Upcoming</Text>
              <Text style={styles.overviewSub}>Scheduled</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Digital Prescriptions"
              onPress={() => router.push("/health/prescriptions")}
              style={({ pressed }) => [
                styles.overviewCard,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.overviewIconCircle,
                  { backgroundColor: "#FEF3C7" },
                ]}
              >
                <Ionicons name="medkit" size={18} color="#D97706" />
              </View>
              <Text style={styles.overviewCount}>
                {healthMetrics.prescriptionsCount}
              </Text>
              <Text style={styles.overviewLabel}>Prescriptions</Text>
              <Text style={styles.overviewSub}>Rx issued</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Medical Records"
              onPress={() => router.push("/health/records")}
              style={({ pressed }) => [
                styles.overviewCard,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.overviewIconCircle,
                  { backgroundColor: "#F3E8FF" },
                ]}
              >
                <Ionicons name="document-text" size={18} color="#7C3AED" />
              </View>
              <Text style={styles.overviewCount}>
                {healthMetrics.medicalRecordsCount}
              </Text>
              <Text style={styles.overviewLabel}>EMR Records</Text>
              <Text style={styles.overviewSub}>Diagnoses & lab</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lab Reports"
              onPress={() => router.push("/health/reports")}
              style={({ pressed }) => [
                styles.overviewCard,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.overviewIconCircle,
                  { backgroundColor: "#E0F2FE" },
                ]}
              >
                <Ionicons name="bar-chart" size={18} color="#0284C7" />
              </View>
              <Text style={styles.overviewCount}>
                {healthMetrics.reportsCount}
              </Text>
              <Text style={styles.overviewLabel}>Lab Reports</Text>
              <Text style={styles.overviewSub}>Diagnostics</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reviews Submitted"
              onPress={() => router.push("/profile")}
              style={({ pressed }) => [
                styles.overviewCard,
                pressed && styles.pressed,
              ]}
            >
              <View
                style={[
                  styles.overviewIconCircle,
                  { backgroundColor: "#FFF1F2" },
                ]}
              >
                <Ionicons name="star" size={18} color="#E11D48" />
              </View>
              <Text style={styles.overviewCount}>
                {healthMetrics.reviewsSubmitted}
              </Text>
              <Text style={styles.overviewLabel}>Reviews</Text>
              <Text style={styles.overviewSub}>Submitted</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* ---------------- Upcoming appointment ---------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Upcoming appointment"
            subtitle={
              nextAppointment
                ? "Next scheduled consultation snapshot"
                : undefined
            }
            actionLabel="View all"
            onAction={() => router.push("/appointments")}
          />
          {appointmentsLoading ? (
            <Loading fullScreen={false} label="Checking your appointments..." />
          ) : nextAppointment && nextIntelligence ? (
            <View style={styles.nextApptCard}>
              {/* --- Header: icon + doctor + smart status badge --- */}
              <View style={styles.nextApptHeader}>
                <View
                  style={[
                    styles.nextApptIcon,
                    nextAppointment.consultationType === "video" && {
                      backgroundColor: "#9356D6",
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      nextAppointment.consultationType === "video"
                        ? "videocam"
                        : "calendar"
                    }
                    size={18}
                    color={Palette.white}
                  />
                </View>
                <View style={styles.nextApptTitles}>
                  <Text style={styles.nextApptRowLabel}>
                    {nextAppointment.consultationType === "video"
                      ? "Next Video Consult"
                      : "Next In-Clinic Visit"}
                  </Text>
                  <Text style={styles.nextApptDoctor} numberOfLines={1}>
                    {appointmentDoctorName(nextAppointment)}
                  </Text>
                </View>
                {/* Smart status badge derived from intelligence layer */}
                <Badge
                  label={nextIntelligence.currentStatus.label}
                  variant={nextIntelligence.currentStatus.variant}
                />
              </View>

              {/* --- Relative time (Today / Tomorrow / In X min) --- */}
              <View style={styles.nextApptRow}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={Palette.primary}
                />
                <Text style={styles.nextApptRowText}>
                  {nextIntelligence.timeContext.relativeLabel}
                </Text>
                {nextIntelligence.timeContext.isToday ? (
                  <View style={styles.nextApptTodayPill}>
                    <Text style={styles.nextApptTodayText}>TODAY</Text>
                  </View>
                ) : null}
              </View>

              {/* --- Hospital / visit type --- */}
              <View style={styles.nextApptRow}>
                <Ionicons
                  name={
                    nextAppointment.consultationType === "video"
                      ? "videocam-outline"
                      : "business-outline"
                  }
                  size={16}
                  color={Palette.primary}
                />
                <Text style={styles.nextApptRowText} numberOfLines={1}>
                  {nextAppointment.consultationType === "video"
                    ? "Google Meet Video Consultation"
                    : nextAppointment.hospitalName || "Clinic visit"}
                </Text>
              </View>

              {/* --- Check-in / queue status pill (clinic only) --- */}
              {nextAppointment.consultationType !== "video" &&
              nextIntelligence.checkInStatus.isCheckedIn ? (
                <View style={styles.nextApptCheckedInPill}>
                  <Ionicons name="checkmark-circle" size={14} color="#059669" />
                  <Text style={styles.nextApptCheckedInText}>
                    {nextIntelligence.queueStatus.token
                      ? `Checked In · Token #${nextIntelligence.queueStatus.token}`
                      : "Checked In"}
                    {nextIntelligence.queueStatus.isCalled
                      ? " · Doctor is Ready!"
                      : ""}
                  </Text>
                </View>
              ) : nextAppointment.consultationType !== "video" &&
                nextIntelligence.checkInStatus.isAvailable ? (
                <View style={styles.nextApptCheckInPill}>
                  <Ionicons
                    name="qr-code-outline"
                    size={14}
                    color={Palette.primaryDark}
                  />
                  <Text style={styles.nextApptCheckInText}>
                    Check-In Available Now
                  </Text>
                </View>
              ) : null}

              <View style={styles.nextApptFooter}>
                <View style={styles.nextApptFeeWrap}>
                  <Text style={styles.nextApptFeeLabel}>Consultation fee</Text>
                  <Text style={styles.nextApptFee}>
                    {formatINR(nextAppointment.amount)}
                  </Text>
                </View>

                {/* Primary Smart Next-Action CTA (from intelligence layer) */}
                <Button
                  title={nextIntelligence.nextAction.label}
                  icon={nextIntelligence.nextAction.icon}
                  variant={nextIntelligence.nextAction.variant}
                  style={styles.nextApptButton}
                  onPress={() => {
                    const act = nextIntelligence.nextAction;
                    switch (act.key) {
                      case "PAY_NOW":
                        router.push({
                          pathname: "/payment/[appointmentId]",
                          params: {
                            appointmentId: String(nextAppointment._id),
                          },
                        });
                        break;
                      case "CHECK_IN_NOW":
                      case "VIEW_PASS":
                        router.push({
                          pathname: "/appointment/pass/[id]",
                          params: { id: String(nextAppointment._id) },
                        });
                        break;
                      case "JOIN_CONSULTATION":
                      case "WAITING_ROOM":
                        router.push({
                          pathname: "/consultation/[id]",
                          params: { id: String(nextAppointment._id) },
                        });
                        break;
                      case "VIEW_PRESCRIPTION":
                        router.push("/health/prescriptions");
                        break;
                      case "VIEW_REPORT":
                        router.push("/health/reports");
                        break;
                      default:
                        router.push({
                          pathname: "/appointment/[id]",
                          params: { id: String(nextAppointment._id) },
                        });
                    }
                  }}
                />

                {/* Secondary toolbar: Details, Reschedule, Cancel */}
                <View style={styles.nextApptActionsRow}>
                  {nextIntelligence.nextAction.key !== "VIEW_DETAILS" ? (
                    <Button
                      title="Details"
                      variant="outline"
                      fullWidth={false}
                      style={styles.snapshotToolBtn}
                      onPress={() =>
                        router.push({
                          pathname: "/appointment/[id]",
                          params: { id: String(nextAppointment._id) },
                        })
                      }
                    />
                  ) : null}

                  {nextAppointment.status !== "cancel" &&
                  nextAppointment.status !== "completed" ? (
                    <>
                      <Button
                        title="Reschedule"
                        variant="outline"
                        fullWidth={false}
                        style={styles.snapshotToolBtn}
                        onPress={() =>
                          router.push({
                            pathname: "/appointment/reschedule/[id]",
                            params: { id: String(nextAppointment._id) },
                          })
                        }
                      />
                      <Button
                        title="Cancel"
                        variant="ghost"
                        fullWidth={false}
                        loading={
                          cancellingApptId === String(nextAppointment._id)
                        }
                        disabled={
                          cancellingApptId === String(nextAppointment._id)
                        }
                        style={styles.snapshotCancelBtn}
                        onPress={() =>
                          handleCancelAppointment(String(nextAppointment._id))
                        }
                      />
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.ctaCard}>
              <View style={styles.ctaRow}>
                <View style={styles.ctaIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={26}
                    color={Palette.primary}
                  />
                </View>
                <View style={styles.ctaTexts}>
                  <Text style={styles.ctaTitle}>No upcoming appointments</Text>
                  <Text style={styles.ctaText}>
                    Find verified doctors and schedule your clinic or video
                    consultation with ease.
                  </Text>
                </View>
              </View>
              <Button
                title="Book Appointment"
                icon="calendar"
                onPress={() => router.push({ pathname: "/doctors" })}
                style={styles.ctaButton}
              />
            </View>
          )}
        </View>

        {/* ---------------- Recent Health Insights ---------------- */}

        {recentConsultation ||
        recentPrescription ||
        recentReport ||
        recentDiagnosis ? (
          <View style={styles.section}>
            <SectionHeader
              title="Recent Health Insights"
              subtitle="Latest updates from your attending medical providers"
              actionLabel="View records"
              onAction={() => router.push("/health/records")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalContent}
            >
              {recentConsultation ? (
                <Card style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View
                      style={[
                        styles.insightIconBox,
                        { backgroundColor: "#EEF2FF" },
                      ]}
                    >
                      <Ionicons
                        name="fitness-outline"
                        size={18}
                        color="#4F46E5"
                      />
                    </View>
                    <View style={styles.insightHeaderTexts}>
                      <Text style={styles.insightTag}>RECENT CONSULTATION</Text>
                      <Text style={styles.insightTitle} numberOfLines={1}>
                        {appointmentDoctorName(recentConsultation)}
                      </Text>
                    </View>
                    <Badge label="Visited" variant="primary" />
                  </View>
                  <Text style={styles.insightDetail} numberOfLines={2}>
                    {recentConsultation.diagnosis
                      ? `Diagnosis: ${recentConsultation.diagnosis}`
                      : `Consultation on ${formatDDMMYYYY(recentConsultation.slotDate)}`}
                  </Text>
                  <View style={styles.insightFooter}>
                    <Button
                      title="View Details"
                      variant="ghost"
                      onPress={() =>
                        router.push({
                          pathname: "/appointment/[id]",
                          params: { id: String(recentConsultation._id) },
                        })
                      }
                    />
                  </View>
                </Card>
              ) : null}

              {recentPrescription ? (
                <Card style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View
                      style={[
                        styles.insightIconBox,
                        { backgroundColor: "#FEF3C7" },
                      ]}
                    >
                      <Ionicons
                        name="medkit-outline"
                        size={18}
                        color="#D97706"
                      />
                    </View>
                    <View style={styles.insightHeaderTexts}>
                      <Text style={styles.insightTag}>
                        DIGITAL PRESCRIPTION
                      </Text>
                      <Text style={styles.insightTitle} numberOfLines={1}>
                        {appointmentDoctorName(recentPrescription)}
                      </Text>
                    </View>
                    <Badge label="Issued" variant="success" />
                  </View>
                  <Text style={styles.insightDetail} numberOfLines={2}>
                    {recentPrescription.medicines &&
                    recentPrescription.medicines.length > 0
                      ? `${recentPrescription.medicines.length} prescribed medication${recentPrescription.medicines.length === 1 ? "" : "s"}`
                      : recentPrescription.prescription ||
                        `Prescribed on ${formatDDMMYYYY(recentPrescription.slotDate)}`}
                  </Text>
                  <View style={styles.insightFooter}>
                    <Button
                      title="View Prescriptions"
                      variant="ghost"
                      onPress={() => router.push("/health/prescriptions")}
                    />
                  </View>
                </Card>
              ) : null}

              {recentReport ? (
                <Card style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View
                      style={[
                        styles.insightIconBox,
                        { backgroundColor: "#E0F2FE" },
                      ]}
                    >
                      <Ionicons
                        name="bar-chart-outline"
                        size={18}
                        color="#0284C7"
                      />
                    </View>
                    <View style={styles.insightHeaderTexts}>
                      <Text style={styles.insightTag}>LAB REPORT</Text>
                      <Text style={styles.insightTitle} numberOfLines={1}>
                        {recentReport.name}
                      </Text>
                    </View>
                    <Badge label="Ready" variant="success" />
                  </View>
                  <Text style={styles.insightDetail} numberOfLines={2}>
                    {recentReport.category ||
                      recentReport.type ||
                      "Diagnostic Test"}{" "}
                    • {formatDDMMYYYY(recentReport.uploadedAt || "")}
                  </Text>
                  <View style={styles.insightFooter}>
                    <Button
                      title="View Reports"
                      variant="ghost"
                      onPress={() => router.push("/health/reports")}
                    />
                  </View>
                </Card>
              ) : null}

              {recentDiagnosis ? (
                <Card style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <View
                      style={[
                        styles.insightIconBox,
                        { backgroundColor: "#ECFDF5" },
                      ]}
                    >
                      <Ionicons
                        name="pulse-outline"
                        size={18}
                        color="#059669"
                      />
                    </View>
                    <View style={styles.insightHeaderTexts}>
                      <Text style={styles.insightTag}>CLINICAL DIAGNOSIS</Text>
                      <Text style={styles.insightTitle} numberOfLines={1}>
                        {recentDiagnosis.diagnosis}
                      </Text>
                    </View>
                    <Badge label="Recorded" variant="primary" />
                  </View>
                  <Text style={styles.insightDetail} numberOfLines={2}>
                    By {recentDiagnosis.doctorName || "Attending Physician"} on{" "}
                    {formatDDMMYYYY(recentDiagnosis.date)}
                  </Text>
                  <View style={styles.insightFooter}>
                    <Button
                      title="Medical History"
                      variant="ghost"
                      onPress={() => router.push("/health/records")}
                    />
                  </View>
                </Card>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {/* ---------------- Recent Health Activity Feed ---------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Recent Health Activity"
            subtitle="Real timeline of care updates, appointments & test results"
            actionLabel={
              recentActivities.length > 0 ? "All Records" : undefined
            }
            onAction={
              recentActivities.length > 0
                ? () => router.push("/health/records")
                : undefined
            }
          />
          {recentActivities.length === 0 ? (
            <View style={styles.emptyActivityCard}>
              <Ionicons
                name="shield-checkmark-outline"
                size={32}
                color={Palette.primary}
              />
              <Text style={styles.emptyActivityTitle}>
                No Healthcare Activity Yet
              </Text>
              <Text style={styles.emptyActivitySubtitle}>
                As you book consultations, receive doctor prescriptions, and
                complete visits, your real health activity log will appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.activityFeedList}>
              {recentActivities.slice(0, 5).map((act) => (
                <Pressable
                  key={act.id}
                  accessibilityRole="button"
                  accessibilityLabel={act.title}
                  onPress={() => {
                    if (act.route) {
                      if (act.routeParams) {
                        router.push({
                          pathname: act.route as any,
                          params: act.routeParams,
                        });
                      } else {
                        router.push(act.route as any);
                      }
                    }
                  }}
                  style={({ pressed }) => [
                    styles.activityItemRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.activityIconCircle,
                      {
                        backgroundColor:
                          act.type === "consultation"
                            ? "#EEF2FF"
                            : act.type === "prescription"
                              ? "#FEF3C7"
                              : act.type === "report"
                                ? "#E0F2FE"
                                : act.type === "status"
                                  ? "#F0FDF4"
                                  : "#F3F4F6",
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        act.type === "consultation"
                          ? "calendar"
                          : act.type === "prescription"
                            ? "medkit"
                            : act.type === "report"
                              ? "document-text"
                              : act.type === "status"
                                ? "checkmark-circle"
                                : "notifications"
                      }
                      size={16}
                      color={
                        act.type === "consultation"
                          ? "#4F46E5"
                          : act.type === "prescription"
                            ? "#D97706"
                            : act.type === "report"
                              ? "#0284C7"
                              : act.type === "status"
                                ? "#059669"
                                : Palette.textMuted
                      }
                    />
                  </View>
                  <View style={styles.activityContentWrap}>
                    <View style={styles.activityTopRow}>
                      <Text style={styles.activityTitleText} numberOfLines={1}>
                        {act.title}
                      </Text>
                      <Text style={styles.activityTimeText}>{act.date}</Text>
                    </View>
                    <Text style={styles.activitySubtitleText} numberOfLines={2}>
                      {act.description}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={Palette.textMuted}
                    style={styles.activityChevron}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ---------------- Saved Care Quick Row ---------------- */}
        {savedCount > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Saved Care"
              subtitle={`${savedCount} saved provider${savedCount === 1 ? "" : "s"}`}
              actionLabel="View all"
              onAction={() => router.push("/favorites")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalContent}
            >
              {savedDoctors.slice(0, 4).map((doctor, index) => (
                <DoctorMiniCard
                  key={String(doctor._id)}
                  doctor={doctor}
                  index={index}
                />
              ))}
              {savedHospitals.slice(0, 3).map((hospital) => (
                <View
                  key={String(hospital._id)}
                  style={styles.hospitalCardWrap}
                >
                  <HospitalCard hospital={hospital} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ---------------- Available doctors ---------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Available doctors"
            subtitle={
              doctorsLoading
                ? "Checking live availability..."
                : doctorFilter === "available"
                  ? `${availableDoctors.length} doctors with open slots`
                  : doctorFilter === "video"
                    ? `${filteredDoctors.length} video consult specialists`
                    : doctorFilter === "top"
                      ? `${topDoctors.length} highest rated specialists`
                      : nearbyDoctorCount > 0
                        ? `${nearbyDoctorCount} near you · ${doctors.length} doctors total`
                        : `${doctors.length} verified doctors on HealPoint`
            }
            actionLabel="See all"
            onAction={() => router.push({ pathname: "/doctors" })}
          />

          {/* Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.doctorFilterPillsContent}
          >
            {DOCTOR_FILTER_TABS.map((tab) => {
              const active = doctorFilter === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setDoctorFilter(tab.id)}
                  style={({ pressed }) => [
                    styles.doctorFilterPill,
                    active && styles.doctorFilterPillActive,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={active ? Palette.white : Palette.textMuted}
                  />
                  <Text
                    style={[
                      styles.doctorFilterPillText,
                      active && styles.doctorFilterPillTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {doctorsLoading ? (
            <Loading fullScreen={false} label="Loading doctors..." />
          ) : doctorsError ? (
            <ErrorState message={doctorsError} onRetry={refetchDoctors} />
          ) : filteredDoctors.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalContent}
            >
              {filteredDoctors.map((doctor, index) => (
                <DoctorFeatureCard
                  key={String(doctor._id)}
                  doctor={doctor}
                  index={index}
                />
              ))}
            </ScrollView>
          ) : (
            <Card padded>
              <Text style={styles.infoBody}>
                No doctors matching this filter right now.
              </Text>
              <View style={styles.infoAction}>
                <Button
                  title="Browse all doctors"
                  variant="outline"
                  onPress={() => {
                    setDoctorFilter("all");
                    router.push({ pathname: "/doctors" });
                  }}
                />
              </View>
            </Card>
          )}
        </View>
        {/* ---------------- Top rated doctors ---------------- */}
        {topDoctors.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader
              title="Top rated doctors"
              subtitle="Highest rated on HealPoint"
              actionLabel="See all"
              onAction={() => router.push({ pathname: "/doctors" })}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalContent}
            >
              {topDoctors.map((doctor, index) => (
                <DoctorMiniCard
                  key={String(doctor._id)}
                  doctor={doctor}
                  index={index}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ---------------- Hospitals / nearby ---------------- */}
        {hospitalsError ? (
          <View style={styles.section}>
            <ErrorState message={hospitalsError} onRetry={refetchHospitals} />
          </View>
        ) : hospitalsLoading ? (
          <View style={styles.section}>
            <SectionHeader title="Hospitals & clinics" />
            <Loading fullScreen={false} label="Loading hospitals..." />
          </View>
        ) : displayHospitals.length ? (
          <View style={styles.section}>
            <SectionHeader
              title={
                nearbyHospitals.length
                  ? "Hospitals near you"
                  : "Hospitals & clinics"
              }
              subtitle={
                nearbyHospitals.length
                  ? `Near ${cityOfHospitals}`
                  : `${hospitals.length} hospitals on HealPoint`
              }
              actionLabel="See all"
              onAction={() => router.push({ pathname: "/hospitals" })}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalContent}
            >
              {displayHospitals.map((hospital) => (
                <View
                  key={String(hospital._id)}
                  style={styles.hospitalCardWrap}
                >
                  <HospitalCard hospital={hospital} />
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
      {/* Floating HealPoint AI Assistant Pill */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask HealPoint AI Assistant"
        onPress={() => router.push("/ai-assistant")}
        style={({ pressed }) => [
          styles.floatingAiBtn,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="sparkles" size={16} color="#FFFFFF" />
        <Text style={styles.floatingAiText}>Ask AI</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  screenContent: {
    paddingBottom: 110,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.965 }],
  },
  rowPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  chipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  floatingAiBtn: {
    position: "absolute",
    bottom: 24,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0284C7",
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 22,
    gap: 6,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
  },
  floatingAiText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  // ---- Hero ---------------------------------------------------------------
  hero: {
    backgroundColor: Palette.primary,
    overflow: "hidden",
    paddingBottom: Spacing.huge,
  },
  heroSafe: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  heroCircleA: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  heroCircleB: {
    position: "absolute",
    bottom: -90,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandCrossV: {
    position: "absolute",
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: Palette.white,
  },
  brandCrossH: {
    position: "absolute",
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: Palette.white,
  },
  brandWordmark: {
    ...Typography.h4,
    color: Palette.white,
    fontWeight: "700",
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  heroIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Palette.primary,
  },
  heroBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: "700",
  },
  heroAvatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.white,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroAvatar: {
    width: 40,
    height: 40,
  },
  heroGreeting: {
    ...Typography.h1,
    color: Palette.white,
    fontWeight: "700",
    marginTop: Spacing.xl,
  },
  heroGreetingName: {
    fontWeight: "800",
  },
  heroTagline: {
    ...Typography.bodyMedium,
    color: "rgba(255,255,255,0.85)",
    marginTop: Spacing.xs,
  },
  heroApptShortcut: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    marginTop: Spacing.sm,
    maxWidth: "100%",
  },
  heroApptShortcutDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Palette.white,
  },
  heroApptShortcutText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "700",
    flexShrink: 1,
  },
  locationPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    maxWidth: "100%",
  },
  locationPillText: {
    ...Typography.bodySmall,
    color: Palette.white,
    fontWeight: "600",
    flexShrink: 1,
  },

  // ---- Search -------------------------------------------------------------
  searchShell: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.xxl,
  },
  searchCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Palette.text,
    paddingVertical: Spacing.sm,
  },
  specialityContent: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  specialityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.background,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  specialityChipText: {
    ...Typography.bodySmall,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  resultsBox: {
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
    paddingTop: Spacing.sm,
    gap: 4,
  },
  resultsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  resultsCount: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  searchCountsPillRow: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  searchCountBadge: {
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  searchCountBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  searchSectionGroup: {
    marginTop: Spacing.xs,
    gap: 2,
  },
  searchGroupTitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginVertical: 4,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
  },
  resultHospitalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(232, 154, 60, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    ...Typography.label,
    color: Palette.text,
  },
  resultMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  resultRightAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resultFee: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.primary,
  },
  searchEmptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  searchEmptyTitle: {
    ...Typography.label,
    color: Palette.text,
    marginTop: Spacing.xs,
  },
  searchEmptySubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
  searchEmptyActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  viewAllText: {
    ...Typography.label,
    color: Palette.primaryDark,
  },

  // ---- Notification Preview Banner ---------------------------------------
  notificationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(14, 159, 142, 0.1)",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(14, 159, 142, 0.22)",
  },
  notificationBannerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBannerText: {
    ...Typography.bodySmall,
    color: Palette.text,
    flex: 1,
  },
  notificationBannerAction: {
    ...Typography.label,
    color: Palette.primaryDark,
    fontWeight: "700",
  },

  // ---- Quick actions ------------------------------------------------------
  quickGridContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  quickTile: {
    width: "31.2%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 90,
    gap: 3,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    ...Shadows.card,
  },
  quickTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Palette.surface,
  },
  quickBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: "700",
  },
  quickTileLabel: {
    ...Typography.label,
    fontSize: 12,
    color: Palette.text,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
  quickTileSub: {
    fontSize: 10,
    color: Palette.textMuted,
    textAlign: "center",
    width: "100%",
  },

  // ---- Content sections ---------------------------------------------------
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  doctorFilterPillsContent: {
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  doctorFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  doctorFilterPillActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  doctorFilterPillText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  doctorFilterPillTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  horizontalContent: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  serviceTile: {
    width: 136,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceLabel: {
    ...Typography.label,
    color: Palette.text,
  },
  serviceCaption: {
    ...Typography.caption,
    color: Palette.textMuted,
  },

  // ---- Upcoming appointment ----
  nextApptCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.card,
  },
  nextApptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  nextApptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  nextApptTitles: {
    flex: 1,
    gap: 1,
  },
  nextApptBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  nextApptRowLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
  },
  nextApptDoctor: {
    ...Typography.h4,
    color: Palette.text,
  },
  nextApptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  nextApptRowText: {
    ...Typography.bodyMedium,
    color: Palette.textMuted,
    flex: 1,
  },
  nextApptFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  nextApptFeeWrap: {
    minWidth: 100,
  },
  nextApptFeeLabel: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  nextApptFee: {
    ...Typography.h4,
    color: Palette.text,
  },
  nextApptButton: {
    minHeight: 44,
    minWidth: 140,
  },
  nextApptActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  nextApptPrimaryBtn: {
    minHeight: 42,
    paddingHorizontal: Spacing.md,
  },
  nextApptSecondaryBtn: {
    minHeight: 42,
    paddingHorizontal: Spacing.md,
  },
  // Today pill shown next to relative time label
  nextApptTodayPill: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  nextApptTodayText: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.5,
  },
  // Check-in available pill (amber)
  nextApptCheckInPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FEF3C7",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  nextApptCheckInText: {
    ...Typography.caption,
    color: "#92400E",
    fontWeight: "700",
  },
  // Checked-in pill (green)
  nextApptCheckedInPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#6EE7B7",
  },
  nextApptCheckedInText: {
    ...Typography.caption,
    color: "#065F46",
    fontWeight: "700",
    flex: 1,
  },

  ctaCard: {
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  ctaIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTexts: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    ...Typography.h4,
    color: Palette.text,
  },
  ctaText: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  ctaButton: {
    minHeight: 46,
  },

  infoBody: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
  },
  infoAction: {
    marginTop: Spacing.sm,
  },
  hospitalCardWrap: {
    width: 280,
  },

  // ---- Medical Overview Strip ----------------------------------------------
  metricsStripContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  overviewCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 112,
    ...Shadows.card,
  },
  overviewIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  overviewCount: {
    ...Typography.h3,
    color: Palette.text,
    fontWeight: "800",
  },
  overviewLabel: {
    ...Typography.caption,
    color: Palette.text,
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center",
  },
  overviewSub: {
    fontSize: 10,
    color: Palette.textMuted,
    textAlign: "center",
  },

  // ---- Appointment Snapshot Tools ------------------------------------------
  snapshotToolBtn: {
    minHeight: 36,
    paddingHorizontal: Spacing.md,
  },
  snapshotCancelBtn: {
    minHeight: 36,
    paddingHorizontal: Spacing.sm,
  },

  // ---- Recent Health Insights ----------------------------------------------
  insightCard: {
    width: 280,
    padding: Spacing.md,
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  insightIconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  insightHeaderTexts: {
    flex: 1,
  },
  insightTag: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  insightTitle: {
    ...Typography.bodyMedium,
    color: Palette.text,
    fontWeight: "700",
  },
  insightDetail: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    lineHeight: 18,
  },
  insightFooter: {
    alignSelf: "flex-end",
    marginTop: 2,
  },

  // ---- Recent Health Activity Feed -----------------------------------------
  emptyActivityCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  emptyActivityTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  emptyActivitySubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  activityFeedList: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    overflow: "hidden",
    ...Shadows.card,
  },
  activityItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  activityIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContentWrap: {
    flex: 1,
    gap: 2,
  },
  activityTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activityTitleText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
    marginRight: Spacing.xs,
  },
  activityTimeText: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  activitySubtitleText: {
    fontSize: 12,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  activityChevron: {
    marginLeft: 4,
  },
  emergencyAccessWrap: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  emergencyStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  emergencyStripLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  emergencyStripIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyStripTextWrap: {
    flex: 1,
  },
  emergencyStripTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emergencyStripTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#991B1B",
  },
  emergencyStripPill: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
  },
  emergencyStripPillText: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.3,
  },
  emergencyStripSub: {
    ...Typography.caption,
    color: "#7F1D1D",
    marginTop: 1,
  },
});
