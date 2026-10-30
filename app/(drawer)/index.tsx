/**
 * HealPoint - Premium Patient-Side Home Dashboard (Redesigned Experience)
 *
 * An ultra-premium, animated, world-class healthcare home screen built entirely
 * from real backend data (doctors, hospitals, appointments, health metrics, notifications).
 * Features:
 *  - Dynamic greeting with personalized user name & online indicator
 *  - Animated Hero Carousel with auto-advance & interactive pagination
 *  - Modern Search Hero with live multi-entity matching & specialty chips
 *  - Live Upcoming Appointment Card with countdown, doctor portrait & smart dual CTAs
 *  - Health Summary with 4 soft pastel cards (Visits, Prescriptions, Reports, Diagnoses)
 *  - Quick Actions 4x2 modern app icon grid with expander for all services
 *  - Smart Care Continuity banner & 1-tap re-booking
 *  - Recent Health Insights & real activity feed
 *  - Available doctors with live filter tabs & nearby hospitals discovery
 *  - Ambient 24/7 Emergency Assistance banner
 *  - Floating AI Assistant launcher
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { DoctorFeatureCard } from "@/components/DoctorFeatureCard";
import { DoctorMiniCard } from "@/components/DoctorMiniCard";
import { DrawerToggleButton } from "@/components/DrawerToggleButton";
import { HospitalCard } from "@/components/HospitalCard";
import { PatientBottomNav } from "@/components/PatientBottomNav";
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
import { useUserLocation } from "@/hooks/use-user-location";
import {
  doctorHospitalName,
  doctorSearchableText,
  doctorSpecialty,
  isDoctorAvailable,
} from "@/lib/doctor";
import {
  cleanPatientFirstName,
  formatDDMMYYYY,
  formatDoctorName,
  formatINR,
} from "@/lib/format";
import { getDoctorImage, getUserImage } from "@/lib/image";
import { deriveAppointmentIntelligence } from "@/lib/appointment-intelligence";
import {
  getRebookDoctorName,
  getRebookDoctorSpecialty,
  getRebookHospitalName,
  isAppointmentEligibleForRebook,
  navigateToRebook,
} from "@/lib/rebooking";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import type { Appointment, AppointmentStatus, User } from "@/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const DOCTOR_POOL_SIZE = SHARED_CATALOG_LIMIT;
const FEATURED_DOCTORS = 5;
const SPECIALITY_CHIPS = 7;

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

// ---------------------------------------------------------------------------
// Quick Action Items (8 primary + expanded more)
// ---------------------------------------------------------------------------

interface QuickAction {
  key: string;
  label: string;
  subLabel?: string;
  icon: IconName;
  tint: string;
  bgColor: string;
  path: Href;
  params?: Record<string, string>;
}

const PRIMARY_QUICK_ACTIONS: QuickAction[] = [
  {
    key: "book",
    label: "Book Appointment",
    subLabel: "Top specialists",
    icon: "calendar",
    tint: "#2563EB",
    bgColor: "#EFF6FF",
    path: "/doctors",
  },
  {
    key: "appointments",
    label: "My Appointments",
    subLabel: "Active schedule",
    icon: "time",
    tint: "#4F46E5",
    bgColor: "#EEF2FF",
    path: "/appointments",
  },
  {
    key: "favorites",
    label: "Saved",
    subLabel: "Doctors & clinics",
    icon: "heart",
    tint: "#E11D48",
    bgColor: "#FFF1F2",
    path: "/favorites",
  },
  {
    key: "records",
    label: "Medical Records",
    subLabel: "Vitals & history",
    icon: "document-text",
    tint: "#7C3AED",
    bgColor: "#F5F3FF",
    path: "/health/records",
  },
  {
    key: "prescriptions",
    label: "Prescriptions",
    subLabel: "Digital Rx",
    icon: "medkit",
    tint: "#D97706",
    bgColor: "#FFFBEB",
    path: "/health/prescriptions",
  },
  {
    key: "reports",
    label: "Reports",
    subLabel: "Diagnostics",
    icon: "flask",
    tint: "#0284C7",
    bgColor: "#F0F9FF",
    path: "/health/reports",
  },
  {
    key: "wallet",
    label: "Digital Wallet",
    subLabel: "Vault & pass",
    icon: "wallet",
    tint: "#059669",
    bgColor: "#ECFDF5",
    path: "/health-wallet" as any,
  },
  {
    key: "timeline",
    label: "Past Activity",
    subLabel: "Health timeline",
    icon: "pulse",
    tint: "#0D9488",
    bgColor: "#F0FDFA",
    path: "/health/timeline" as any,
  },
];

const MORE_QUICK_ACTIONS: QuickAction[] = [
  {
    key: "find_doctors",
    label: "Find Doctors",
    subLabel: "Verified care",
    icon: "search",
    tint: "#0D9488",
    bgColor: "#F0FDFA",
    path: "/doctors",
  },
  {
    key: "consult",
    label: "Online Meet",
    subLabel: "Telehealth call",
    icon: "videocam",
    tint: "#9333EA",
    bgColor: "#FAF5FF",
    path: "/consult-online",
  },
  {
    key: "ai_assistant",
    label: "AI Assistant",
    subLabel: "Care guidance",
    icon: "sparkles",
    tint: "#E11D48",
    bgColor: "#FFF1F2",
    path: "/ai-assistant",
  },
  {
    key: "command_center",
    label: "Care Cockpit",
    subLabel: "Live status",
    icon: "pulse",
    tint: "#0D9488",
    bgColor: "#F0FDFA",
    path: "/command-center" as never,
  },
  {
    key: "hospitals",
    label: "Hospitals",
    subLabel: "7 Centres",
    icon: "business",
    tint: "#0E9F6E",
    bgColor: "#ECFDF5",
    path: "/hospitals",
  },
  {
    key: "care_passport",
    label: "Care Passport",
    subLabel: "Identity QR",
    icon: "id-card",
    tint: "#0E9F8E",
    bgColor: "#F0FDFA",
    path: "/care-passport" as any,
  },
  {
    key: "goals",
    label: "Health Goals",
    subLabel: "Wellness track",
    icon: "trophy",
    tint: "#D97706",
    bgColor: "#FFFBEB",
    path: "/health/goals" as never,
  },
  {
    key: "emergency",
    label: "Emergency",
    subLabel: "24/7 Helpline",
    icon: "alert-circle",
    tint: "#DC2626",
    bgColor: "#FEF2F2",
    path: "/emergency",
  },
  {
    key: "support",
    label: "Support",
    subLabel: "Help center",
    icon: "help-buoy",
    tint: "#0D9488",
    bgColor: "#F0FDFA",
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

// ---------------------------------------------------------------------------
// Hero Carousel Banners
// ---------------------------------------------------------------------------

interface HeroBanner {
  id: string;
  badge: string;
  title: string;
  highlightText: string;
  subtitle: string;
  ctaText: string;
  icon: IconName;
  bgGradient: [string, string];
  accentColor: string;
  route: Href;
}

const HERO_BANNERS: HeroBanner[] = [
  {
    id: "doctors",
    badge: "VERIFIED SPECIALISTS",
    title: "Take Control of",
    highlightText: "Your Health",
    subtitle: "Book verified doctors & hospital visits in seconds",
    ctaText: "Find Doctors",
    icon: "shield-checkmark",
    bgGradient: ["#1D4ED8", "#2563EB"],
    accentColor: "#BFDBFE",
    route: "/doctors",
  },
  {
    id: "telehealth",
    badge: "INSTANT TELEHEALTH",
    title: "Consult Doctors",
    highlightText: "Online 24/7",
    subtitle: "High-definition video consultations with Google Meet",
    ctaText: "Consult Online",
    icon: "videocam",
    bgGradient: ["#4F46E5", "#6366F1"],
    accentColor: "#C7D2FE",
    route: "/consult-online",
  },
  {
    id: "wallet",
    badge: "SMART HEALTH VAULT",
    title: "Digital Health",
    highlightText: "Wallet & Pass",
    subtitle: "Prescriptions, reports, and QR hospital pass in one tap",
    ctaText: "Open Wallet",
    icon: "wallet",
    bgGradient: ["#0284C7", "#0EA5E9"],
    accentColor: "#BAE6FD",
    route: "/health-wallet" as any,
  },
  {
    id: "cockpit",
    badge: "REAL-TIME OPERATIONS",
    title: "Smart Care",
    highlightText: "Command Center",
    subtitle: "Live queue tracking, consultation passes & updates",
    ctaText: "Open Cockpit",
    icon: "pulse",
    bgGradient: ["#0D9488", "#059669"],
    accentColor: "#99F6E4",
    route: "/command-center" as never,
  },
];

// ---------------------------------------------------------------------------
// Main Screen Component
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const {
    today,
    upcoming,
    completed,
    past,
    loading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useAppointments();

  const latestRebookableAppointment = useMemo(() => {
    return (
      completed.find(isAppointmentEligibleForRebook) ||
      past.find(isAppointmentEligibleForRebook) ||
      null
    );
  }, [completed, past]);

  const latestCompletedAppointment = useMemo(() => {
    return completed[0] || null;
  }, [completed]);

  const activeCareContinuityState = useMemo(() => {
    if (!latestCompletedAppointment) return null;
    const hasPrescription = Boolean(
      latestCompletedAppointment.prescription ||
      (latestCompletedAppointment.medicines &&
        latestCompletedAppointment.medicines.length > 0),
    );
    const hasReports = Boolean(
      latestCompletedAppointment.medicalReports &&
      latestCompletedAppointment.medicalReports.length > 0,
    );
    const hasFollowUp = Boolean(
      latestCompletedAppointment.followUpAdvice?.trim() ||
      latestCompletedAppointment.followUp?.required,
    );

    if (
      hasFollowUp &&
      !latestCompletedAppointment.followUp?.linkedFollowUpAppointmentId
    ) {
      return {
        label: "Follow-Up Required",
        description: `Follow-up advised with Dr. ${formatDoctorName(latestCompletedAppointment.doctorName, "Doctor")}`,
        actionLabel: "Book Follow-Up",
        variant: "warning" as const,
        icon: "calendar-outline" as const,
      };
    }
    if (hasPrescription && !hasReports) {
      return {
        label: "Prescription Available",
        description: "Digital prescription and dosage details ready",
        actionLabel: "View Prescription",
        variant: "success" as const,
        icon: "document-text-outline" as const,
      };
    }
    if (hasReports) {
      return {
        label: "Report Available",
        description: "Diagnostic report available in health locker",
        actionLabel: "View Report",
        variant: "primary" as const,
        icon: "flask-outline" as const,
      };
    }
    return {
      label: "Consultation Completed",
      description: `Visit with Dr. ${formatDoctorName(latestCompletedAppointment.doctorName, "Doctor")} completed`,
      actionLabel: "View Care Continuity",
      variant: "neutral" as const,
      icon: "checkmark-circle-outline" as const,
    };
  }, [latestCompletedAppointment]);

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
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  // Carousel ref & timer
  const carouselScrollRef = useRef<ScrollView>(null);
  const carouselTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isInteractingCarousel = useRef(false);

  // Animation values
  const entranceAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entranceAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    ]).start();
  }, [entranceAnim, pulseAnim]);

  // Carousel auto-advance
  useEffect(() => {
    carouselTimerRef.current = setInterval(() => {
      if (isInteractingCarousel.current) return;
      setActiveBannerIndex((prev) => {
        const next = (prev + 1) % HERO_BANNERS.length;
        carouselScrollRef.current?.scrollTo({
          x: next * (CAROUSEL_CARD_WIDTH + Spacing.md),
          animated: true,
        });
        return next;
      });
    }, 4500);

    return () => {
      if (carouselTimerRef.current) clearInterval(carouselTimerRef.current);
    };
  }, []);

  const handleCarouselScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (CAROUSEL_CARD_WIDTH + Spacing.md));
      if (
        index >= 0 &&
        index < HERO_BANNERS.length &&
        index !== activeBannerIndex
      ) {
        setActiveBannerIndex(index);
      }
    },
    [activeBannerIndex],
  );

  // Screen Focus refetch
  useScreenFocus(() => {
    refetchAppointments();
    refreshFavorites();
  }, 10_000);

  const {
    displayLabel: locationDisplayLabel,
    locality: userLocality,
    city: userCityName,
    openLocationModal,
  } = useUserLocation();

  const city = (userCityName || userCity(user) || "ahmedabad").toLowerCase();
  const locationLabel =
    locationDisplayLabel ||
    userLocality ||
    userLocationLabel(user) ||
    "Ahmedabad, Gujarat";
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

  // --- Multi-Entity Search
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

  // --- Specialty chips
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

  // --- Doctor filters
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
    if (doctorFilter === "available") return availableDoctors;
    if (doctorFilter === "video") {
      return doctors.filter(
        (d) =>
          d.consultationTypes?.includes("video") ||
          d.onlineStatus === "online" ||
          d.available === true,
      );
    }
    if (doctorFilter === "top") return topDoctors;
    return availableDoctors.length ? availableDoctors : doctors.slice(0, 10);
  }, [doctorFilter, availableDoctors, doctors, topDoctors]);

  // --- Nearby hospitals
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
    if (cancellingApptId) return;
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

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 110 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Palette.primary}
            colors={[Palette.primary]}
          />
        }
      >
        {/* ================================================================= */}
        {/* 1. PERSONALIZED HEADER (Dynamic greeting, brand, notification, avatar) */}
        {/* ================================================================= */}
        <View
          style={[
            styles.headerContainer,
            { paddingTop: Math.max(insets.top, 14) },
          ]}
        >
          <View style={styles.headerSafe}>
            {/* Top Row: [Menu]   HealPoint Logo/Name        [Notification] [Profile] */}
            <View style={styles.headerTopRow}>
              <DrawerToggleButton
                color="#0F172A"
                backgroundColor="rgba(255,255,255,0.92)"
                style={styles.headerMenuBtn}
              />

              <View style={styles.brandLockup}>
                <View style={styles.brandMark}>
                  <View style={styles.brandCrossV} />
                  <View style={styles.brandCrossH} />
                </View>
                <Text style={styles.brandWordmark}>HealPoint</Text>
              </View>

              <View style={styles.headerRightActions}>
                {/* Notifications Bell */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    unreadCount > 0
                      ? `Healthcare Notifications, ${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
                      : "Healthcare Notifications"
                  }
                  onPress={() => router.push("/notification")}
                  style={({ pressed }) => [
                    styles.headerIconBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={20}
                    color="#0F172A"
                  />
                  {unreadCount > 0 ? (
                    <View style={styles.headerBadge}>
                      <Text style={styles.headerBadgeText}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>

                {/* User Avatar with active ring & dot */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Profile"
                  onPress={() => router.push("/profile")}
                  style={({ pressed }) => [
                    styles.headerAvatarBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  {user?.image ? (
                    <Image
                      source={{ uri: getUserImage(user.image) }}
                      style={styles.headerAvatarImg}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <Ionicons name="person" size={20} color={Palette.primary} />
                  )}
                  <View style={styles.avatarOnlineDot} />
                </Pressable>
              </View>
            </View>

            {/* Greeting & Subtitle */}
            <Animated.View
              style={{
                opacity: entranceAnim,
                transform: [
                  {
                    translateY: entranceAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              }}
            >
              <Text style={styles.greetingTitle}>
                {greetingForHour(new Date().getHours())},{" "}
                {patientName || "Patient"} 👋
              </Text>
              <Text style={styles.greetingCaption}>
                Your healthcare, simplified.
              </Text>

              {/* Location Pill */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Current Location: ${locationLabel}`}
                onPress={openLocationModal}
                style={({ pressed }) => [
                  styles.locationPill,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="location" size={15} color="#2563EB" />
                <Text style={styles.locationPillText} numberOfLines={1}>
                  Current Location • {locationLabel}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#64748B" />
              </Pressable>
            </Animated.View>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 2. SMART SEARCH HERO (Floating Card with Live Search & Specialties) */}
        {/* ================================================================= */}
        <Animated.View
          style={[
            styles.searchSectionWrap,
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
          <View style={styles.searchCard}>
            <View style={styles.searchBarRow}>
              <View style={styles.searchIconWrap}>
                <Ionicons name="search" size={20} color={Palette.primary} />
              </View>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search doctors, specialties, hospitals..."
                placeholderTextColor={Palette.textMuted}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search doctors, specialties, hospitals"
              />
              {search.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearch("")}
                  hitSlop={8}
                  style={styles.searchClearBtn}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={Palette.textMuted}
                  />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Browse All Filters"
                  onPress={() => router.push("/doctors")}
                  style={styles.searchFilterBtn}
                >
                  <Ionicons
                    name="options-outline"
                    size={18}
                    color={Palette.primary}
                  />
                </Pressable>
              )}
            </View>

            {/* Specialty Pills (Horizontal) */}
            {!search && specialities.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.specialtiesScroll}
              >
                {specialities.map((label) => (
                  <Pressable
                    key={label}
                    accessibilityRole="button"
                    onPress={() => setSearch(label)}
                    style={({ pressed }) => [
                      styles.specialtyChip,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="pulse"
                      size={13}
                      color={Palette.primaryDark}
                    />
                    <Text style={styles.specialtyChipText}>{label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {/* Live Search Dropdown Results */}
            {search.length > 0 && normalizedQuery ? (
              <View style={styles.searchResultsBox}>
                <View style={styles.searchResultsHeader}>
                  <Text style={styles.searchResultsCount}>
                    {totalSearchMatches === 0
                      ? `No matches for "${search.trim()}"`
                      : `Found ${totalSearchMatches} result${totalSearchMatches === 1 ? "" : "s"}`}
                  </Text>
                  {totalSearchMatches > 0 ? (
                    <View style={styles.searchCountBadgesRow}>
                      {matchingDoctors.length > 0 ? (
                        <View style={styles.searchCountBadge}>
                          <Text style={styles.searchCountBadgeText}>
                            {matchingDoctors.length} Doctors
                          </Text>
                        </View>
                      ) : null}
                      {matchingHospitals.length > 0 ? (
                        <View
                          style={[
                            styles.searchCountBadge,
                            { backgroundColor: "#FEF3C7" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.searchCountBadgeText,
                              { color: "#D97706" },
                            ]}
                          >
                            {matchingHospitals.length} Hospitals
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
                      Try another keyword or browse our full directories below.
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

                {/* Doctors List */}
                {matchingDoctors.length > 0 ? (
                  <View style={styles.searchGroup}>
                    <Text style={styles.searchGroupHeader}>Doctors</Text>
                    {doctorSearchResults.map((doctor) => (
                      <Pressable
                        key={String(doctor._id)}
                        accessibilityRole="button"
                        onPress={() => openDoctor(String(doctor._id))}
                        style={({ pressed }) => [
                          styles.searchResultRow,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Image
                          source={{ uri: getDoctorImage(doctor) }}
                          style={styles.searchResultAvatar}
                          contentFit="cover"
                        />
                        <View style={styles.searchResultInfo}>
                          <Text
                            style={styles.searchResultName}
                            numberOfLines={1}
                          >
                            {doctor.name}
                          </Text>
                          <Text
                            style={styles.searchResultMeta}
                            numberOfLines={1}
                          >
                            {doctorSpecialty(doctor)} •{" "}
                            {doctorHospitalName(doctor)}
                          </Text>
                        </View>
                        <View style={styles.searchResultPriceWrap}>
                          <Text style={styles.searchResultPrice}>
                            {formatINR(doctor.fees)}
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={14}
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
                          styles.searchViewAllBtn,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.searchViewAllText}>
                          View all {matchingDoctors.length} doctors
                        </Text>
                        <Ionicons
                          name="arrow-forward"
                          size={14}
                          color={Palette.primaryDark}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Hospitals List */}
                {matchingHospitals.length > 0 ? (
                  <View style={styles.searchGroup}>
                    <Text style={styles.searchGroupHeader}>Hospitals</Text>
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
                          styles.searchResultRow,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.searchHospitalIcon}>
                          <Ionicons name="business" size={18} color="#D97706" />
                        </View>
                        <View style={styles.searchResultInfo}>
                          <Text
                            style={styles.searchResultName}
                            numberOfLines={1}
                          >
                            {hospital.name}
                          </Text>
                          <Text
                            style={styles.searchResultMeta}
                            numberOfLines={1}
                          >
                            {hospital.location?.city || "Hospital"} •{" "}
                            {hospital.doctorCount || 0} doctors
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={Palette.textMuted}
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* ================================================================= */}
        {/* 3. EMERGENCY HELP (Prominent Upper Placement) */}
        {/* ================================================================= */}
        <View style={styles.emergencyTopContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency Help: Find nearby emergency-supporting hospitals, ambulance & 108 helpline"
            onPress={() => router.push("/emergency" as never)}
            style={({ pressed }) => [
              styles.emergencyTopCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.emergencyTopLeft}>
              <View style={styles.emergencyTopIconWrap}>
                <Ionicons name="alert-circle" size={24} color="#DC2626" />
              </View>
              <View style={styles.emergencyTopTextWrap}>
                <View style={styles.emergencyTopHeaderRow}>
                  <Text style={styles.emergencyTopTitle}>
                    🚨 Emergency Help
                  </Text>
                  <View style={styles.emergencyTopBadge}>
                    <Text style={styles.emergencyTopBadgeText}>
                      24/7 ACTIVE
                    </Text>
                  </View>
                </View>
                <Text style={styles.emergencyTopSub}>
                  Find nearby emergency-supporting hospitals
                </Text>
              </View>
            </View>
            <View style={styles.emergencyArrowCircle}>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        {/* ================================================================= */}
        {/* HERO: BOOK AN APPOINTMENT CARD (Reference Design)                 */}
        {/* ================================================================= */}
        <View style={styles.bookHeroWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Book an Appointment: Find trusted specialists and schedule in-clinic or video visits"
            onPress={() => router.push("/doctors")}
            style={({ pressed }) => [
              styles.bookHeroCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.bookHeroLeft}>
              <View style={styles.bookHeroIconWrap}>
                <Ionicons name="calendar" size={24} color="#2563EB" />
              </View>
              <View style={styles.bookHeroTextWrap}>
                <Text style={styles.bookHeroTitle}>Book an Appointment</Text>
                <Text style={styles.bookHeroSub}>
                  Find trusted specialists and schedule in-clinic or video
                  visits.
                </Text>
              </View>
            </View>
            <View style={styles.bookHeroCtaPill}>
              <Text style={styles.bookHeroCtaText}>Book Now</Text>
              <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        {/* ================================================================= */}
        {/* QUICK ACCESS (4x2 Grid of 8 items matching reference)             */}
        {/* ================================================================= */}
        <View style={styles.sectionWrap}>
          <SectionHeader
            title="Quick Access"
            subtitle="Essential healthcare tools & services"
          />

          <View style={styles.quickGrid}>
            {PRIMARY_QUICK_ACTIONS.map((action) => (
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
                    styles.quickIconCircle,
                    { backgroundColor: action.bgColor },
                  ]}
                >
                  <Ionicons name={action.icon} size={22} color={action.tint} />
                </View>
                <Text style={styles.quickTileLabel} numberOfLines={2}>
                  {action.label}
                </Text>
                <Text style={styles.quickTileSub} numberOfLines={1}>
                  {action.subLabel}
                </Text>
              </Pressable>
            ))}

            {showAllQuickActions
              ? MORE_QUICK_ACTIONS.map((action) => (
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
                        styles.quickIconCircle,
                        { backgroundColor: action.bgColor },
                      ]}
                    >
                      <Ionicons
                        name={action.icon}
                        size={22}
                        color={action.tint}
                      />
                    </View>
                    <Text style={styles.quickTileLabel} numberOfLines={2}>
                      {action.label}
                    </Text>
                    <Text style={styles.quickTileSub} numberOfLines={1}>
                      {action.subLabel}
                    </Text>
                  </Pressable>
                ))
              : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showAllQuickActions ? "Show Fewer Services" : "Show All Services"
            }
            onPress={() => setShowAllQuickActions((prev) => !prev)}
            style={({ pressed }) => [
              styles.expandServicesBtn,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.expandServicesText}>
              {showAllQuickActions
                ? "Show Fewer Services"
                : "View All Healthcare Services"}
            </Text>
            <Ionicons
              name={showAllQuickActions ? "chevron-up" : "chevron-down"}
              size={15}
              color={Palette.primary}
            />
          </Pressable>
        </View>

        {/* ================================================================= */}
        {/* 4. INTERACTIVE HERO CAROUSEL (Auto-sliding cards with pagination) */}
        {/* ================================================================= */}
        <View style={styles.carouselContainer}>
          <ScrollView
            ref={carouselScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CAROUSEL_CARD_WIDTH + Spacing.md}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselScrollContent}
            onScroll={handleCarouselScroll}
            scrollEventThrottle={16}
            onTouchStart={() => {
              isInteractingCarousel.current = true;
            }}
            onTouchEnd={() => {
              isInteractingCarousel.current = false;
            }}
          >
            {HERO_BANNERS.map((banner) => (
              <Pressable
                key={banner.id}
                accessibilityRole="button"
                accessibilityLabel={banner.title}
                onPress={() => router.push(banner.route as never)}
                style={({ pressed }) => [
                  styles.carouselCard,
                  { backgroundColor: banner.bgGradient[0] },
                  pressed && styles.pressed,
                ]}
              >
                {/* Decorative background circles */}
                <View style={styles.bannerDecorCircleA} />
                <View style={styles.bannerDecorCircleB} />

                <View style={styles.bannerTopBadgeRow}>
                  <View style={styles.bannerBadgePill}>
                    <Text style={styles.bannerBadgeText}>{banner.badge}</Text>
                  </View>
                  <Ionicons
                    name={banner.icon}
                    size={24}
                    color="rgba(255,255,255,0.75)"
                  />
                </View>

                <View style={styles.bannerBody}>
                  <Text style={styles.bannerTitlePrefix}>{banner.title}</Text>
                  <Text style={styles.bannerTitleHighlight}>
                    {banner.highlightText}
                  </Text>
                  <Text style={styles.bannerSubtitle}>{banner.subtitle}</Text>
                </View>

                <View style={styles.bannerCtaRow}>
                  <View style={styles.bannerCtaBtn}>
                    <Text style={styles.bannerCtaText}>{banner.ctaText}</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={15}
                      color={Palette.primaryDark}
                    />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {/* Carousel Pagination Dots */}
          <View style={styles.paginationRow}>
            {HERO_BANNERS.map((banner, index) => {
              const isActive = index === activeBannerIndex;
              return (
                <View
                  key={banner.id}
                  style={[
                    styles.paginationDot,
                    isActive && styles.paginationDotActive,
                  ]}
                />
              );
            })}
          </View>
        </View>

        {/* ================================================================= */}
        {/* 4. LIVE UPCOMING APPOINTMENT TRACKER (Stateful Countdown & Pass) */}
        {/* ================================================================= */}
        <View style={styles.sectionWrap}>
          <SectionHeader
            title="Upcoming Appointment"
            subtitle={
              nextAppointment
                ? "Next scheduled consultation snapshot"
                : "Your schedule is clear"
            }
            actionLabel="View all"
            onAction={() => router.push("/appointments")}
          />

          {appointmentsLoading ? (
            <Loading fullScreen={false} label="Checking your schedule..." />
          ) : nextAppointment && nextIntelligence ? (
            <Card style={styles.upcomingCard}>
              {/* Header: Countdown pill & consultation type badge */}
              <View style={styles.upcomingCardHeader}>
                <View style={styles.upcomingCountdownPill}>
                  <Ionicons name="time" size={13} color="#059669" />
                  <Text style={styles.upcomingCountdownText}>
                    {nextIntelligence.timeContext.relativeLabel}
                  </Text>
                  {nextIntelligence.timeContext.isToday ? (
                    <View style={styles.todayPill}>
                      <Text style={styles.todayPillText}>TODAY</Text>
                    </View>
                  ) : null}
                </View>

                <Badge
                  label={nextIntelligence.currentStatus.label}
                  variant={nextIntelligence.currentStatus.variant}
                />
              </View>

              {/* Doctor Info Row */}
              <View style={styles.upcomingDoctorRow}>
                {typeof nextAppointment.doctorId === "object" &&
                nextAppointment.doctorId?.image ? (
                  <Image
                    source={{ uri: getDoctorImage(nextAppointment.doctorId) }}
                    style={styles.upcomingDoctorImg}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.upcomingAvatarWrap}>
                    <Ionicons
                      name={
                        nextAppointment.consultationType === "video"
                          ? "videocam"
                          : "medical"
                      }
                      size={24}
                      color={Palette.primary}
                    />
                  </View>
                )}
                <View style={styles.upcomingDoctorMeta}>
                  <Text style={styles.upcomingDoctorName} numberOfLines={1}>
                    {appointmentDoctorName(nextAppointment)}
                  </Text>
                  <Text style={styles.upcomingDoctorSub} numberOfLines={1}>
                    {nextAppointment.consultationType === "video"
                      ? "Google Meet Video Consultation"
                      : nextAppointment.hospitalName || "In-Clinic Visit"}
                  </Text>
                </View>
              </View>

              {/* Schedule Details Row */}
              <View style={styles.upcomingScheduleBox}>
                <View style={styles.upcomingScheduleItem}>
                  <Ionicons
                    name="calendar-outline"
                    size={15}
                    color={Palette.primary}
                  />
                  <Text style={styles.upcomingScheduleText}>
                    {formatDDMMYYYY(nextAppointment.slotDate)}
                  </Text>
                </View>
                <View style={styles.upcomingScheduleDivider} />
                <View style={styles.upcomingScheduleItem}>
                  <Ionicons
                    name="time-outline"
                    size={15}
                    color={Palette.primary}
                  />
                  <Text style={styles.upcomingScheduleText}>
                    {nextAppointment.slotTime}
                  </Text>
                </View>
                <View style={styles.upcomingScheduleDivider} />
                <View style={styles.upcomingScheduleItem}>
                  <Text style={styles.upcomingFeeText}>
                    {formatINR(nextAppointment.amount)}
                  </Text>
                </View>
              </View>

              {/* Check-In / Queue Token notification (Clinic) */}
              {nextAppointment.consultationType !== "video" &&
              nextIntelligence.checkInStatus.isCheckedIn ? (
                <View style={styles.checkedInBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.checkedInBannerText}>
                    {nextIntelligence.queueStatus.token
                      ? `Checked In · Token #${nextIntelligence.queueStatus.token}`
                      : "Checked In at Clinic"}
                    {nextIntelligence.queueStatus.isCalled
                      ? " · Doctor is Ready!"
                      : ""}
                  </Text>
                </View>
              ) : null}

              {/* Dual Action CTAs */}
              <View style={styles.upcomingActionsRow}>
                <Button
                  title={nextIntelligence.nextAction.label}
                  icon={nextIntelligence.nextAction.icon}
                  variant={nextIntelligence.nextAction.variant}
                  style={styles.upcomingPrimaryBtn}
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

                <Button
                  title="Details"
                  variant="outline"
                  fullWidth={false}
                  style={styles.upcomingSecondaryBtn}
                  onPress={() =>
                    router.push({
                      pathname: "/appointment/[id]",
                      params: { id: String(nextAppointment._id) },
                    })
                  }
                />
              </View>

              {/* Reschedule / Cancel tertiary row */}
              {nextAppointment.status !== "cancel" &&
              nextAppointment.status !== "completed" ? (
                <View style={styles.upcomingTertiaryRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: "/appointment/reschedule/[id]",
                        params: { id: String(nextAppointment._id) },
                      })
                    }
                    style={styles.tertiaryLink}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={14}
                      color={Palette.primaryDark}
                    />
                    <Text style={styles.tertiaryLinkText}>Reschedule</Text>
                  </Pressable>

                  <Text style={styles.tertiaryDot}>•</Text>

                  <Pressable
                    accessibilityRole="button"
                    disabled={cancellingApptId === String(nextAppointment._id)}
                    onPress={() =>
                      handleCancelAppointment(String(nextAppointment._id))
                    }
                    style={styles.tertiaryLink}
                  >
                    <Ionicons
                      name="close-circle-outline"
                      size={14}
                      color={Palette.error}
                    />
                    <Text
                      style={[
                        styles.tertiaryLinkText,
                        { color: Palette.error },
                      ]}
                    >
                      {cancellingApptId === String(nextAppointment._id)
                        ? "Cancelling..."
                        : "Cancel Visit"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          ) : (
            <View style={styles.noApptCard}>
              <View style={styles.noApptIconWrap}>
                <Ionicons
                  name="calendar-clear-outline"
                  size={32}
                  color={Palette.primary}
                />
              </View>
              <View style={styles.noApptTextWrap}>
                <Text style={styles.noApptTitle}>No Upcoming Appointments</Text>
                <Text style={styles.noApptSub}>
                  Find trusted doctors and schedule an in-clinic or video
                  consultation with ease.
                </Text>
              </View>
              <Button
                title="Book an Appointment"
                icon="calendar"
                onPress={() => router.push("/doctors")}
                style={styles.noApptBtn}
              />
            </View>
          )}
        </View>

        {/* ================================================================= */}
        {/* 5. HEALTH SUMMARY (4 Pastel Cards: Visits, Prescriptions, Reports, Diagnoses) */}
        {/* ================================================================= */}
        <View style={styles.sectionWrap}>
          <SectionHeader
            title="Your Health Summary"
            subtitle="Verified data aggregated from your real records"
            actionLabel="View All"
            onAction={() => router.push("/health/records")}
          />

          <View style={styles.summaryGrid}>
            {/* Card 1: Visits */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Visits"
              onPress={() => router.push("/appointments")}
              style={({ pressed }) => [
                styles.summaryCard,
                { backgroundColor: "#EEF2FF", borderColor: "#E0E7FF" },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.summaryCardTopRow}>
                <View
                  style={[
                    styles.summaryIconBox,
                    { backgroundColor: "#4F46E5" },
                  ]}
                >
                  <Ionicons name="calendar" size={16} color={Palette.white} />
                </View>
                <Ionicons name="chevron-forward" size={15} color="#4F46E5" />
              </View>
              <Text style={styles.summaryCount}>
                {healthMetrics.totalAppointments}
              </Text>
              <Text style={styles.summaryLabel}>Visits</Text>
              <Text style={styles.summarySub}>Total consultations</Text>
            </Pressable>

            {/* Card 2: Prescriptions */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Prescriptions"
              onPress={() => router.push("/health/prescriptions")}
              style={({ pressed }) => [
                styles.summaryCard,
                { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.summaryCardTopRow}>
                <View
                  style={[
                    styles.summaryIconBox,
                    { backgroundColor: "#D97706" },
                  ]}
                >
                  <Ionicons name="medkit" size={16} color={Palette.white} />
                </View>
                <Ionicons name="chevron-forward" size={15} color="#D97706" />
              </View>
              <Text style={styles.summaryCount}>
                {healthMetrics.prescriptionsCount}
              </Text>
              <Text style={styles.summaryLabel}>Prescriptions</Text>
              <Text style={styles.summarySub}>Digital Rx issued</Text>
            </Pressable>

            {/* Card 3: Reports */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lab Reports"
              onPress={() => router.push("/health/reports")}
              style={({ pressed }) => [
                styles.summaryCard,
                { backgroundColor: "#E0F2FE", borderColor: "#BAE6FD" },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.summaryCardTopRow}>
                <View
                  style={[
                    styles.summaryIconBox,
                    { backgroundColor: "#0284C7" },
                  ]}
                >
                  <Ionicons name="bar-chart" size={16} color={Palette.white} />
                </View>
                <Ionicons name="chevron-forward" size={15} color="#0284C7" />
              </View>
              <Text style={styles.summaryCount}>
                {healthMetrics.reportsCount}
              </Text>
              <Text style={styles.summaryLabel}>Reports</Text>
              <Text style={styles.summarySub}>Diagnostic tests</Text>
            </Pressable>

            {/* Card 4: Diagnoses */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Diagnoses"
              onPress={() => router.push("/health/records")}
              style={({ pressed }) => [
                styles.summaryCard,
                { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.summaryCardTopRow}>
                <View
                  style={[
                    styles.summaryIconBox,
                    { backgroundColor: "#059669" },
                  ]}
                >
                  <Ionicons name="pulse" size={16} color={Palette.white} />
                </View>
                <Ionicons name="chevron-forward" size={15} color="#059669" />
              </View>
              <Text style={styles.summaryCount}>
                {healthMetrics.medicalRecordsCount}
              </Text>
              <Text style={styles.summaryLabel}>Diagnoses</Text>
              <Text style={styles.summarySub}>Clinical entries</Text>
            </Pressable>
          </View>
        </View>

        {/* ================================================================= */}
        {/* 7. SMART CARE CONTINUITY (Post-consultation follow-up & Rx) */}
        {/* ================================================================= */}
        {activeCareContinuityState && latestCompletedAppointment ? (
          <View style={styles.sectionWrap}>
            <SectionHeader
              title="Continue Your Care"
              subtitle="Follow-ups, reports and recovery from your recent consultation"
              actionLabel="View Continuity"
              onAction={() => router.push("/care-continuity")}
            />
            <Card padded style={styles.continuityCard}>
              <View style={styles.continuityRow}>
                <View style={styles.continuityIconWrap}>
                  <Ionicons
                    name={activeCareContinuityState.icon}
                    size={22}
                    color={Palette.primary}
                  />
                </View>
                <View style={styles.continuityTextWrap}>
                  <View style={styles.continuityHeaderLine}>
                    <Text style={styles.continuityDoctor} numberOfLines={1}>
                      {formatDoctorName(
                        latestCompletedAppointment.doctorName,
                        "Attending Physician",
                      )}
                    </Text>
                    <Badge
                      label={activeCareContinuityState.label}
                      variant={activeCareContinuityState.variant}
                    />
                  </View>
                  <Text style={styles.continuityDesc} numberOfLines={2}>
                    {activeCareContinuityState.description}
                  </Text>
                </View>
              </View>
              <Button
                title="View Care Continuity"
                variant="primary"
                icon="repeat-outline"
                onPress={() =>
                  router.push({
                    pathname: "/care-continuity",
                    params: {
                      appointmentId: String(latestCompletedAppointment._id),
                    },
                  })
                }
                style={styles.continuityBtn}
              />
            </Card>
          </View>
        ) : null}

        {/* ================================================================= */}
        {/* 8. 1-TAP RE-BOOKING (Repeat Consultation with previous doctor) */}
        {/* ================================================================= */}
        {latestRebookableAppointment ? (
          <View style={styles.sectionWrap}>
            <SectionHeader
              title="Repeat Consultation"
              subtitle="Quick 1-tap booking with your previous specialist"
              actionLabel="All Bookings"
              onAction={() => router.push("/appointments")}
            />
            <View style={styles.rebookCard}>
              <View style={styles.rebookTopRow}>
                <View style={styles.rebookAvatarWrap}>
                  <Ionicons name="medical" size={20} color={Palette.primary} />
                </View>
                <View style={styles.rebookMeta}>
                  <Text style={styles.rebookDoctorName}>
                    {getRebookDoctorName(latestRebookableAppointment)}
                  </Text>
                  <Text style={styles.rebookDoctorSpecialty}>
                    {getRebookDoctorSpecialty(latestRebookableAppointment)}
                    {getRebookHospitalName(latestRebookableAppointment)
                      ? ` • ${getRebookHospitalName(latestRebookableAppointment)}`
                      : ""}
                  </Text>
                  <Text style={styles.rebookLastDate}>
                    Last visit:{" "}
                    {formatDDMMYYYY(
                      latestRebookableAppointment.slotDate ||
                        latestRebookableAppointment.date ||
                        latestRebookableAppointment.appointmentDate,
                    )}
                  </Text>
                </View>
              </View>
              <Button
                title="Book Again"
                icon="repeat"
                variant="primary"
                onPress={() =>
                  navigateToRebook(router, latestRebookableAppointment)
                }
                style={styles.rebookBtn}
              />
            </View>
          </View>
        ) : null}

        {/* ================================================================= */}
        {/* 9. RECENT HEALTH INSIGHTS (Latest Consultation, Rx, Report) */}
        {/* ================================================================= */}
        {recentConsultation ||
        recentPrescription ||
        recentReport ||
        recentDiagnosis ? (
          <View style={styles.sectionWrap}>
            <SectionHeader
              title="Recent Health Insights"
              subtitle="Latest medical updates from your attending specialists"
              actionLabel="View Records"
              onAction={() => router.push("/health/records")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollList}
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
                    <View style={styles.insightHeaderTextWrap}>
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
                    <View style={styles.insightHeaderTextWrap}>
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
                  <Button
                    title="View Prescriptions"
                    variant="ghost"
                    onPress={() => router.push("/health/prescriptions")}
                  />
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
                    <View style={styles.insightHeaderTextWrap}>
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
                  <Button
                    title="View Reports"
                    variant="ghost"
                    onPress={() => router.push("/health/reports")}
                  />
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
                    <View style={styles.insightHeaderTextWrap}>
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
                  <Button
                    title="Medical History"
                    variant="ghost"
                    onPress={() => router.push("/health/records")}
                  />
                </Card>
              ) : null}
            </ScrollView>
          </View>
        ) : null}

        {/* ================================================================= */}
        {/* 10. AVAILABLE DOCTORS (With Filter Tabs) */}
        {/* ================================================================= */}
        <View style={styles.sectionWrap}>
          <SectionHeader
            title="Available Doctors"
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
                        ? `${nearbyDoctorCount} near you · ${doctors.length} verified doctors`
                        : `${doctors.length} verified doctors on HealPoint`
            }
            actionLabel="See all"
            onAction={() => router.push({ pathname: "/doctors" })}
          />

          {/* Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsScroll}
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
                    pressed && styles.pressed,
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
              contentContainerStyle={styles.horizontalScrollList}
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
              <Text style={styles.emptyDoctorText}>
                No doctors matching this filter right now.
              </Text>
              <View style={{ marginTop: Spacing.sm }}>
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

        {/* ================================================================= */}
        {/* 11. TOP RATED DOCTORS */}
        {/* ================================================================= */}
        {topDoctors.length > 0 ? (
          <View style={styles.sectionWrap}>
            <SectionHeader
              title="Top Rated Doctors"
              subtitle="Highest patient ratings on HealPoint"
              actionLabel="See all"
              onAction={() => router.push({ pathname: "/doctors" })}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollList}
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

        {/* ================================================================= */}
        {/* 12. HOSPITALS & CLINICS NEARBY */}
        {/* ================================================================= */}
        {hospitalsError ? (
          <View style={styles.sectionWrap}>
            <ErrorState message={hospitalsError} onRetry={refetchHospitals} />
          </View>
        ) : hospitalsLoading ? (
          <View style={styles.sectionWrap}>
            <SectionHeader title="Hospitals & Clinics" />
            <Loading fullScreen={false} label="Loading hospitals..." />
          </View>
        ) : displayHospitals.length ? (
          <View style={styles.sectionWrap}>
            <SectionHeader
              title={
                nearbyHospitals.length
                  ? "Hospitals Near You"
                  : "Hospitals & Clinics"
              }
              subtitle={
                nearbyHospitals.length
                  ? `Healthcare facilities in ${cityOfHospitals}`
                  : `${hospitals.length} accredited hospitals on HealPoint`
              }
              actionLabel="See all"
              onAction={() => router.push({ pathname: "/hospitals" })}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollList}
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

        {/* ================================================================= */}
        {/* 13. SAVED CARE (Favorites) */}
        {/* ================================================================= */}
        {savedCount > 0 ? (
          <View style={styles.sectionWrap}>
            <SectionHeader
              title="Saved Care"
              subtitle={`${savedCount} saved provider${savedCount === 1 ? "" : "s"}`}
              actionLabel="View all"
              onAction={() => router.push("/favorites")}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScrollList}
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

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Floating HealPoint AI Assistant Pill */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask HealPoint AI Assistant"
        onPress={() => router.push("/ai-assistant")}
        style={({ pressed }) => [
          styles.floatingAiBtn,
          { bottom: 74 + Math.max(insets.bottom, 10) },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="sparkles" size={17} color="#FFFFFF" />
        <Text style={styles.floatingAiText}>Ask AI</Text>
      </Pressable>

      {/* ================================================================= */}
      {/* 14. FIXED LIQUID GLASS BOTTOM NAVIGATION BAR                      */}
      {/* ================================================================= */}
      <PatientBottomNav activeTab="home" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stylesheet
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F0F6FE",
  },
  scrollContent: {
    paddingBottom: 110,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },

  // ---- 1. Header ---------------------------------------------------------
  headerContainer: {
    backgroundColor: "transparent",
    paddingBottom: Spacing.sm,
    overflow: "hidden",
  },
  headerSafe: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  headerMenuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.90)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandCrossV: {
    position: "absolute",
    width: 3.5,
    height: 18,
    borderRadius: 2,
    backgroundColor: Palette.primary,
  },
  brandCrossH: {
    position: "absolute",
    width: 18,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: Palette.primary,
  },
  brandWordmark: {
    ...Typography.h4,
    color: "#0F172A",
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.90)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Palette.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Palette.white,
  },
  headerBadgeText: {
    color: Palette.white,
    fontSize: 10,
    fontWeight: "800",
  },
  headerAvatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.90)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  headerAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarOnlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: Palette.white,
  },
  greetingSub: {
    fontSize: 15,
    color: "#64748B",
    fontWeight: "500",
  },
  greetingTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: "#0F172A",
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  greetingCaption: {
    ...Typography.bodySmall,
    color: "#64748B",
    marginTop: 2,
  },
  locationPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: Spacing.sm,
    maxWidth: "95%",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.70)",
  },
  locationPillText: {
    ...Typography.caption,
    color: "#1E293B",
    fontWeight: "700",
    flexShrink: 1,
  },

  // ---- 2. Search Section -------------------------------------------------
  searchSectionWrap: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  searchCard: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.70)",
    gap: Spacing.sm,
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  searchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(37, 99, 235, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Palette.text,
    paddingVertical: Spacing.xs,
  },
  searchRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  searchMicBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  searchClearBtn: {
    padding: 4,
  },
  searchFilterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.50)",
    alignItems: "center",
    justifyContent: "center",
  },
  specialtiesScroll: {
    gap: Spacing.xs,
    paddingTop: 4,
  },
  specialtyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  specialtyChipText: {
    fontSize: 12,
    color: Palette.primaryDark,
    fontWeight: "700",
  },
  searchResultsBox: {
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  searchResultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  searchResultsCount: {
    fontSize: 12,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  searchCountBadgesRow: {
    flexDirection: "row",
    gap: 6,
  },
  searchCountBadge: {
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  searchCountBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primaryDark,
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
  },
  searchEmptySubtitle: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  searchEmptyActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  searchGroup: {
    marginTop: Spacing.xs,
    gap: 2,
  },
  searchGroupHeader: {
    fontSize: 11,
    color: Palette.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginVertical: 4,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  searchResultAvatar: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Palette.primaryLight,
  },
  searchHospitalIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  searchResultMeta: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  searchResultPriceWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  searchResultPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.primary,
  },
  searchViewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Palette.primaryLight,
    borderRadius: Radius.md,
    paddingVertical: 8,
    marginTop: 4,
  },
  searchViewAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.primaryDark,
  },

  // ---- 3. Carousel -------------------------------------------------------
  carouselContainer: {
    marginTop: Spacing.lg,
  },
  carouselScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: "hidden",
    minHeight: 165,
    justifyContent: "space-between",
  },
  bannerDecorCircleA: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  bannerDecorCircleB: {
    position: "absolute",
    bottom: -50,
    left: -30,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  bannerTopBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerBadgePill: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  bannerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.6,
  },
  bannerBody: {
    marginVertical: Spacing.xs,
  },
  bannerTitlePrefix: {
    fontSize: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  bannerTitleHighlight: {
    fontSize: 22,
    fontWeight: "800",
    color: Palette.white,
    lineHeight: 26,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    lineHeight: 16,
  },
  bannerCtaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannerCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Palette.white,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  bannerCtaText: {
    fontSize: 12,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: Palette.primary,
  },

  // ---- 4. Upcoming Appointment Card --------------------------------------
  sectionWrap: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  upcomingCard: {
    backgroundColor: "rgba(255, 255, 255, 0.90)",
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.45)",
    gap: Spacing.md,
  },
  upcomingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  upcomingCountdownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  upcomingCountdownText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065F46",
  },
  todayPill: {
    backgroundColor: "#059669",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    marginLeft: 3,
  },
  todayPillText: {
    fontSize: 8,
    fontWeight: "800",
    color: Palette.white,
  },
  upcomingDoctorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  upcomingAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingDoctorMeta: {
    flex: 1,
    gap: 2,
  },
  upcomingDoctorName: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.text,
  },
  upcomingDoctorSub: {
    fontSize: 12,
    color: Palette.textMuted,
  },
  upcomingScheduleBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  upcomingScheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  upcomingScheduleDivider: {
    width: 1,
    height: 16,
    backgroundColor: "#CBD5E1",
  },
  upcomingScheduleText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
  },
  upcomingFeeText: {
    fontSize: 13,
    fontWeight: "800",
    color: Palette.primary,
  },
  checkedInBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#6EE7B7",
  },
  checkedInBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065F46",
    flex: 1,
  },
  upcomingActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  upcomingPrimaryBtn: {
    flex: 1,
    minHeight: 44,
  },
  upcomingSecondaryBtn: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
  },
  upcomingTertiaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingTop: 2,
  },
  tertiaryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tertiaryLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  tertiaryDot: {
    color: "#CBD5E1",
  },
  noApptCard: {
    backgroundColor: "rgba(255, 255, 255, 0.90)",
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.45)",
    gap: Spacing.sm,
  },
  noApptIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  noApptTextWrap: {
    alignItems: "center",
    gap: 2,
  },
  noApptTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.text,
  },
  noApptSub: {
    fontSize: 12,
    color: Palette.textMuted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  noApptBtn: {
    marginTop: Spacing.sm,
    minWidth: 200,
  },

  // ---- 5. Health Summary -------------------------------------------------
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  summaryCard: {
    width: "48%",
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.md,
  },
  summaryCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  summaryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCount: {
    fontSize: 24,
    fontWeight: "800",
    color: Palette.text,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
    marginTop: 1,
  },
  summarySub: {
    fontSize: 10,
    color: Palette.textMuted,
    marginTop: 1,
  },

  // ---- 6. Quick Actions Grid ---------------------------------------------
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  quickTile: {
    width: "22.8%",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.90)",
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.40)",
    gap: 4,
  },
  quickIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  quickTileLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    width: "100%",
    lineHeight: 14,
    minHeight: 28,
  },
  quickTileSub: {
    fontSize: 9,
    color: Palette.textMuted,
    textAlign: "center",
    width: "100%",
  },
  expandServicesBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    marginTop: Spacing.xs,
  },
  expandServicesText: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.primaryDark,
  },

  // ---- 7. Care Continuity ------------------------------------------------
  continuityCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    gap: Spacing.sm,
  },
  continuityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  continuityIconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  continuityTextWrap: {
    flex: 1,
  },
  continuityHeaderLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  continuityDoctor: {
    fontSize: 14,
    fontWeight: "800",
    color: Palette.text,
  },
  continuityDesc: {
    fontSize: 12,
    color: Palette.textMuted,
    marginTop: 2,
  },
  continuityBtn: {
    marginTop: 2,
  },

  // ---- 8. Re-Booking -----------------------------------------------------
  rebookCard: {
    backgroundColor: "rgba(255, 255, 255, 0.90)",
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.25)",
    gap: Spacing.md,
  },
  rebookTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  rebookAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rebookMeta: {
    flex: 1,
    gap: 2,
  },
  rebookDoctorName: {
    fontSize: 15,
    fontWeight: "800",
    color: Palette.text,
  },
  rebookDoctorSpecialty: {
    fontSize: 12,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  rebookLastDate: {
    fontSize: 11,
    color: Palette.textMuted,
  },
  rebookBtn: {
    width: "100%",
  },

  // ---- 9. Insights -------------------------------------------------------
  horizontalScrollList: {
    gap: Spacing.md,
    paddingVertical: 4,
  },
  insightCard: {
    width: 270,
    padding: Spacing.md,
    borderRadius: Radius.xl,
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
  insightHeaderTextWrap: {
    flex: 1,
  },
  insightTag: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Palette.text,
  },
  insightDetail: {
    fontSize: 12,
    color: Palette.textMuted,
    lineHeight: 16,
  },

  // ---- 10. Available Doctors ---------------------------------------------
  filterPillsScroll: {
    gap: Spacing.xs,
    paddingBottom: 2,
  },
  doctorFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
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
    fontSize: 12,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  doctorFilterPillTextActive: {
    color: Palette.white,
    fontWeight: "800",
  },
  emptyDoctorText: {
    fontSize: 13,
    color: Palette.textMuted,
  },

  // ---- 12. Hospitals -----------------------------------------------------
  hospitalCardWrap: {
    width: 280,
  },

  // ---- 3. Emergency Top -------------------------------------------------
  emergencyTopContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  emergencyTopCard: {
    backgroundColor: "rgba(254, 242, 242, 0.95)",
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(254, 202, 202, 0.85)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    ...Shadows.card,
  },
  emergencyTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  emergencyTopIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyTopTextWrap: {
    flex: 1,
    gap: 2,
  },
  emergencyTopHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emergencyTopTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#991B1B",
  },
  emergencyTopBadge: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  emergencyTopBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.white,
    letterSpacing: 0.3,
  },
  emergencyTopSub: {
    fontSize: 12,
    color: "#7F1D1D",
    lineHeight: 16,
  },
  emergencyArrowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },

  // "Book an Appointment" Hero Card
  bookHeroWrap: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  bookHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.70)",
  },
  bookHeroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  bookHeroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "rgba(191, 219, 254, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookHeroTextWrap: {
    flex: 1,
  },
  bookHeroTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  bookHeroSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 15,
  },
  bookHeroCtaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2563EB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  bookHeroCtaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  upcomingDoctorImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Palette.primaryLight,
  },

  // Floating AI Assistant Button
  floatingAiBtn: {
    position: "absolute",
    bottom: 74,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
    shadowColor: Palette.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    zIndex: 99,
  },
  floatingAiText: {
    color: Palette.white,
    fontSize: 13,
    fontWeight: "800",
  },
});
