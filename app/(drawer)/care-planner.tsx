/**
 * HealPoint — Smart Patient Care Planner 2.0.
 *
 * Dedicated personal healthcare planner combining:
 * - Upcoming Appointments (In-Clinic & Video Meet)
 * - Follow-Ups & Care Continuity Plans
 * - Pre-Consultation Preparation (Checklist & Questions)
 * - Hospital QR Check-In & Digital Pass
 * - Online Consultation (Google Meet handoff)
 * - Reports & Documents requiring patient attention
 * - Family Member Schedules & Isolation
 *
 * Views:
 * 1. TODAY: Chronological schedule of today's clinical events and tasks
 * 2. UPCOMING: Future healthcare visits, follow-ups, and continuity
 * 3. CALENDAR: Interactive date strip with real event indicators
 *
 * 100% Real Backend Data. Zero duplicate databases. No medical diagnosis logic.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DrawerHeader } from "@/components/drawer/DrawerHeader";
import { FamilyMemberFilterBar } from "@/components/FamilyMemberFilterBar";
import { PatientBottomNav } from "@/components/PatientBottomNav";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import {
  formatDDMMYYYY,
  formatDoctorName,
  MONTHS_SHORT,
  toDDMMYYYY,
} from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as healthDocumentsService from "@/services/health-documents";
import { subscribeToAppointmentSync } from "@/services/socket";
import type {
  Appointment,
  FollowUpOverviewItem,
  HealthDocumentRecord,
  PatientMedicalHistoryResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type PlannerViewMode = "today" | "upcoming" | "calendar";

export type PlannerEventType =
  | "appointment"
  | "followup"
  | "preparation"
  | "document";

export interface PlannerEventItem {
  id: string;
  type: PlannerEventType;
  title: string;
  subtitle: string;
  dateStr: string; // YYYY-MM-DD
  rawDate: string; // Original backend date
  timeStr: string; // e.g. "10:30 AM"
  timestamp: number;
  status: "today" | "upcoming" | "overdue" | "completed" | "cancelled";
  statusLabel: string;
  badgeVariant: BadgeVariant;
  doctorName?: string;
  doctorSpecialty?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  consultationType?: "clinic" | "video";
  meetingUrl?: string;
  appointmentId?: string;
  displayAppointmentId?: string;
  patientName?: string;
  patientRelationship?: string;
  isFamilyDependent: boolean;
  followUpAdvice?: string;
  isCheckedIn?: boolean;
  queueToken?: string;
  hasPrepQuestions?: boolean;
  hasPrepChecklist?: boolean;
  documentUrl?: string;
  documentCategory?: string;
}

// ---------------------------------------------------------------------------
// DATE UTILITIES
// ---------------------------------------------------------------------------

function normalizeDateToIso(val?: string): string {
  if (!val) return "";
  const trimmed = val.trim();

  // Match DD-MM-YYYY
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Match YYYY-MM-DD
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (yyyymmdd) {
    return yyyymmdd[0];
  }

  // Fallback to JS Date
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return "";
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Generate calendar dates for the next 14 days
function generateCalendarStrip(days = 14): { isoDate: string; dayNum: number; dayName: string; monthName: string }[] {
  const list = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dateNum = String(d.getDate()).padStart(2, "0");
    const isoDate = `${y}-${m}-${dateNum}`;
    const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const monthName = MONTHS_SHORT[d.getMonth()];

    list.push({
      isoDate,
      dayNum: d.getDate(),
      dayName,
      monthName,
    });
  }

  return list;
}

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

export default function SmartCarePlannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    memberId?: string;
    view?: PlannerViewMode;
  }>();
  const { user } = useAuth();
  const userId = user?._id || "";

  // 1. Controls State
  const [viewMode, setViewMode] = useState<PlannerViewMode>(
    params.view || "today",
  );
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(
    getTodayIso(),
  );
  const [familyMemberFilter, setFamilyMemberFilter] = useState<string>(
    params.memberId || "all",
  );

  // 2. Data State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpOverviewItem[]>([]);
  const [recentReports, setRecentReports] = useState<HealthDocumentRecord[]>([]);

  // 3. UI State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // 4. Cancellation Modal State
  const [cancellingAppointmentId, setCancellingAppointmentId] = useState<
    string | null
  >(null);
  const [cancellingLoading, setCancellingLoading] = useState(false);

  // Calendar dates list
  const calendarDates = useMemo(() => generateCalendarStrip(14), []);

  // -------------------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------------------
  const fetchPlannerData = useCallback(
    async (isPullRefresh = false) => {
      if (isPullRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      try {
        const familyParam =
          familyMemberFilter === "all" ? undefined : familyMemberFilter;

        const [apptsRes, followUpsRes, docsRes] = await Promise.allSettled([
          // Appointments
          userId
            ? appointmentService.getUserAppointments(userId)
            : Promise.resolve({ success: true, appoinmtent: [] }),
          // Follow-Ups
          appointmentService.getPatientFollowUps({
            familyMemberId: familyParam,
          }),
          // Documents & Reports requiring attention
          healthDocumentsService.getMyHealthDocuments({
            familyMemberId: familyParam,
            limit: 20,
          }),
        ]);

        // Process Appointments
        if (apptsRes.status === "fulfilled" && apptsRes.value) {
          const val = apptsRes.value;
          const list =
            "appoinmtent" in val
              ? val.appoinmtent
              : "appointments" in val
                ? (val as { appointments?: Appointment[] }).appointments
                : [];
          setAppointments(list || []);
        }

        // Process Follow-ups
        if (followUpsRes.status === "fulfilled" && followUpsRes.value) {
          setFollowUps(followUpsRes.value.followUps || []);
        }

        // Process Reports
        if (docsRes.status === "fulfilled" && docsRes.value?.documents) {
          setRecentReports(docsRes.value.documents);
        }
      } catch (err) {
        console.error("[CarePlanner] Failed to load planner data:", err);
        setError(toErrorMessage(err, "Unable to load healthcare schedule."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [familyMemberFilter, userId],
  );

  useScreenFocus(
    useCallback(() => {
      fetchPlannerData(false);
    }, [fetchPlannerData]),
    20_000,
  );

  useEffect(() => {
    fetchPlannerData(false);
  }, [fetchPlannerData]);

  // Real-time socket sync
  useEffect(() => {
    const unsub = subscribeToAppointmentSync(() => {
      fetchPlannerData(false);
    });
    return () => unsub();
  }, [fetchPlannerData]);

  // -------------------------------------------------------------------------
  // CANCEL APPOINTMENT HANDLER
  // -------------------------------------------------------------------------
  const handleConfirmCancel = async () => {
    if (!cancellingAppointmentId) return;
    setCancellingLoading(true);
    try {
      await appointmentService.cancelAppointment(cancellingAppointmentId);
      setCancellingAppointmentId(null);
      Alert.alert(
        "Appointment Cancelled",
        "Your reserved appointment slot has been released back to the clinic.",
      );
      fetchPlannerData(true);
    } catch (err) {
      Alert.alert(
        "Cancellation Failed",
        toErrorMessage(err, "Could not cancel appointment. Please try again."),
      );
    } finally {
      setCancellingLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // CONSOLIDATED PLANNER EVENTS AGGREGATION
  // -------------------------------------------------------------------------
  const allPlannerEvents = useMemo<PlannerEventItem[]>(() => {
    const todayIso = getTodayIso();
    const items: PlannerEventItem[] = [];

    // Filter by selected family member if active
    const filteredAppts = appointments.filter((a) => {
      if (familyMemberFilter === "all") return true;
      const fId =
        a.familyMemberId ||
        (typeof a.familyMemberId === "object" && a.familyMemberId
          ? (a.familyMemberId as { _id?: string })._id
          : undefined);
      return fId === familyMemberFilter;
    });

    // 1. Map Appointments
    for (const appt of filteredAppts) {
      const rawDate = appt.slotDate || appt.date || "";
      const dateIso = normalizeDateToIso(rawDate);
      const timeStr = appt.slotTime || appt.time || "Scheduled Time";
      const docName =
        typeof appt.doctorId === "object" && appt.doctorId && "name" in appt.doctorId
          ? formatDoctorName(appt.doctorId.name)
          : appt.doctorName
            ? formatDoctorName(appt.doctorName)
            : "Attending Doctor";

      const docSpec =
        typeof appt.doctorId === "object" && appt.doctorId && "speciality" in appt.doctorId
          ? (appt.doctorId as { speciality?: string }).speciality
          : appt.doctorSpecialty;

      const hospName =
        appt.hospitalName ||
        (typeof appt.doctorId === "object" &&
        appt.doctorId &&
        (appt.doctorId as { hospitalName?: string }).hospitalName) ||
        undefined;

      const hospAddress =
        (typeof appt.doctorId === "object" &&
        appt.doctorId &&
        (appt.doctorId as { address?: string }).address) ||
        undefined;

      const isToday = dateIso === todayIso;
      const isPast = dateIso < todayIso;
      const isCompleted = appt.status === "completed";
      const isCancelled = appt.status === "cancel";

      let status: PlannerEventItem["status"] = "upcoming";
      let statusLabel = "Upcoming";
      let badgeVariant: BadgeVariant = "primary";

      if (isCancelled) {
        status = "cancelled";
        statusLabel = "Cancelled";
        badgeVariant = "neutral";
      } else if (isCompleted) {
        status = "completed";
        statusLabel = "Completed";
        badgeVariant = "success";
      } else if (isToday) {
        status = "today";
        statusLabel = "Today";
        badgeVariant = "primary";
      } else if (isPast) {
        status = "overdue";
        statusLabel = "Past Visit";
        badgeVariant = "warning";
      }

      const isFamily = Boolean(
        appt.familyMemberId ||
          (appt.familyRelationship &&
            appt.familyRelationship.toLowerCase() !== "self"),
      );

      items.push({
        id: `appt_${appt._id}`,
        type: "appointment",
        title: `Consultation with ${docName}`,
        subtitle: `${appt.consultationType === "video" ? "Video Consultation" : "In-Clinic Visit"} · ${hospName || "HealPoint Hospital"}`,
        dateStr: dateIso,
        rawDate,
        timeStr,
        timestamp: new Date(dateIso).getTime() || 0,
        status,
        statusLabel,
        badgeVariant,
        doctorName: docName,
        doctorSpecialty: docSpec,
        hospitalName: hospName,
        hospitalAddress: hospAddress,
        consultationType: appt.consultationType as "clinic" | "video",
        meetingUrl: appt.meetingUrl,
        appointmentId: String(appt._id),
        displayAppointmentId: appt.displayAppointmentId || appt.appointmentId,
        patientName: appt.patientName,
        patientRelationship: appt.familyRelationship,
        isFamilyDependent: isFamily,
        isCheckedIn: Boolean(appt.checkedIn || appt.queueToken),
        queueToken: appt.queueToken,
        hasPrepQuestions: Boolean(appt.preparation?.patientQuestions?.length),
        hasPrepChecklist: Boolean(appt.preparation?.checklistCompleted?.length),
      });

      // If appointment is upcoming and pre-consultation is not done, add pre-consultation task!
      if (
        (status === "today" || status === "upcoming") &&
        !isCompleted &&
        !isCancelled &&
        !appt.preparation?.instructionsAcknowledged
      ) {
        items.push({
          id: `prep_${appt._id}`,
          type: "preparation",
          title: `Pre-Visit Readiness · ${docName}`,
          subtitle: "Prepare clinical symptoms, questions, and checklist for doctor",
          dateStr: dateIso,
          rawDate,
          timeStr: "Before Consultation",
          timestamp: (new Date(dateIso).getTime() || 0) - 3600000,
          status: isToday ? "today" : "upcoming",
          statusLabel: isToday ? "Action Needed Today" : "Preparation Due",
          badgeVariant: "warning",
          appointmentId: String(appt._id),
          doctorName: docName,
          hospitalName: hospName,
          patientName: appt.patientName,
          isFamilyDependent: isFamily,
        });
      }
    }

    // 2. Map Follow-Ups
    for (const f of followUps) {
      const rawDate = f.targetDate || f.originalVisitDate || "";
      const dateIso = normalizeDateToIso(rawDate);
      const isToday = dateIso === todayIso;
      const isPast = dateIso < todayIso;
      const isCompleted = f.status === "completed";

      let status: PlannerEventItem["status"] = "upcoming";
      let statusLabel = "Follow-Up Scheduled";
      let badgeVariant: BadgeVariant = "primary";

      if (isCompleted) {
        status = "completed";
        statusLabel = "Completed";
        badgeVariant = "success";
      } else if (isToday) {
        status = "today";
        statusLabel = "Follow-Up Due Today";
        badgeVariant = "primary";
      } else if (isPast) {
        status = "overdue";
        statusLabel = "Follow-Up Overdue";
        badgeVariant = "warning";
      }

      const isFamily = Boolean(
        f.familyMemberId ||
          (f.patientRelationship && f.patientRelationship.toLowerCase() !== "self"),
      );

      items.push({
        id: `fu_${f.id}`,
        type: "followup",
        title: `Follow-Up Consultation · ${formatDoctorName(f.doctorName)}`,
        subtitle: f.advice || "Scheduled medical follow-up consultation",
        dateStr: dateIso,
        rawDate,
        timeStr: f.timeframe || "Consultation Follow-Up",
        timestamp: new Date(dateIso).getTime() || 0,
        status,
        statusLabel,
        badgeVariant,
        doctorName: formatDoctorName(f.doctorName),
        doctorSpecialty: f.doctorSpecialty,
        hospitalName: f.hospitalName,
        appointmentId: f.appointmentId,
        displayAppointmentId: f.displayAppointmentId,
        patientName: f.patientName,
        patientRelationship: f.patientRelationship,
        isFamilyDependent: isFamily,
        followUpAdvice: f.advice,
      });
    }

    // 3. Map Recent Reports requiring patient attention
    for (const doc of recentReports) {
      const rawDate = doc.createdAt;
      const dateIso = normalizeDateToIso(rawDate);
      const isFamily = Boolean(doc.familyMemberId);

      items.push({
        id: `doc_${doc._id}`,
        type: "document",
        title: `Diagnostic Report: ${doc.title}`,
        subtitle: `Vault verified ${doc.category.toUpperCase()} document`,
        dateStr: dateIso,
        rawDate,
        timeStr: "Report Ready",
        timestamp: new Date(doc.createdAt).getTime() || 0,
        status: "completed",
        statusLabel: "Available",
        badgeVariant: "neutral",
        patientName: doc.patientName,
        isFamilyDependent: isFamily,
        documentUrl: doc.url,
        documentCategory: doc.category,
      });
    }

    // Sort chronologically by date and timestamp
    items.sort((a, b) => a.timestamp - b.timestamp);
    return items;
  }, [appointments, followUps, recentReports, familyMemberFilter]);

  // Set of dates that contain real events (for calendar dot indicators)
  const eventDatesSet = useMemo(() => {
    const dates = new Set<string>();
    for (const ev of allPlannerEvents) {
      if (ev.dateStr) dates.add(ev.dateStr);
    }
    return dates;
  }, [allPlannerEvents]);

  // -------------------------------------------------------------------------
  // VIEW FILTERING
  // -------------------------------------------------------------------------
  const todayIso = useMemo(() => getTodayIso(), []);

  const displayedEvents = useMemo(() => {
    switch (viewMode) {
      case "today":
        return allPlannerEvents.filter((ev) => ev.dateStr === todayIso);
      case "upcoming":
        return allPlannerEvents.filter(
          (ev) =>
            ev.dateStr >= todayIso &&
            ev.status !== "cancelled" &&
            ev.status !== "completed",
        );
      case "calendar":
        return allPlannerEvents.filter(
          (ev) => ev.dateStr === selectedCalendarDate,
        );
      default:
        return allPlannerEvents;
    }
  }, [allPlannerEvents, viewMode, todayIso, selectedCalendarDate]);

  // Today count badge
  const todayCount = useMemo(
    () => allPlannerEvents.filter((ev) => ev.dateStr === todayIso).length,
    [allPlannerEvents, todayIso],
  );

  // Upcoming count badge
  const upcomingCount = useMemo(
    () =>
      allPlannerEvents.filter(
        (ev) =>
          ev.dateStr >= todayIso &&
          ev.status !== "cancelled" &&
          ev.status !== "completed",
      ).length,
    [allPlannerEvents, todayIso],
  );

  // -------------------------------------------------------------------------
  // RENDER EVENT CARD
  // -------------------------------------------------------------------------
  const renderPlannerEvent = ({ item }: { item: PlannerEventItem }) => {
    const isAppt = item.type === "appointment";
    const isFollowUp = item.type === "followup";
    const isPrep = item.type === "preparation";
    const isDoc = item.type === "document";

    const canCheckIn =
      isAppt &&
      item.status === "today" &&
      item.consultationType !== "video" &&
      !item.isCheckedIn;

    const canJoinVideo =
      isAppt &&
      item.consultationType === "video" &&
      Boolean(item.meetingUrl);

    const hasDirections =
      isAppt &&
      item.consultationType !== "video" &&
      Boolean(item.hospitalAddress || item.hospitalName);

    return (
      <Card style={styles.eventCard}>
        {/* Card Header: Time & Status Badge */}
        <View style={styles.eventCardHeader}>
          <View style={styles.timeTagRow}>
            <Ionicons
              name={
                isAppt
                  ? "calendar"
                  : isFollowUp
                    ? "refresh"
                    : isPrep
                      ? "clipboard"
                      : "document-text"
              }
              size={15}
              color={
                isAppt
                  ? Palette.primary
                  : isFollowUp
                    ? "#7C3AED"
                    : isPrep
                      ? "#D97706"
                      : "#059669"
              }
            />
            <Text style={styles.timeTagText}>
              {formatDDMMYYYY(item.rawDate)} · {item.timeStr}
            </Text>
          </View>
          <Badge label={item.statusLabel} variant={item.badgeVariant} />
        </View>

        {/* Family Dependent Attribution */}
        {item.isFamilyDependent && item.patientName && (
          <View style={styles.familyBadgeRow}>
            <Ionicons name="people" size={12} color="#0284C7" />
            <Text style={styles.familyBadgeText}>
              For {item.patientName}
              {item.patientRelationship ? ` (${item.patientRelationship})` : ""}
            </Text>
          </View>
        )}

        {/* Title & Subtitle */}
        <Text style={styles.eventTitle}>{item.title}</Text>
        <Text style={styles.eventSubtitle}>{item.subtitle}</Text>

        {/* Doctor & Location Details */}
        {item.doctorName && (
          <View style={styles.doctorInfoRow}>
            <View style={styles.doctorAvatar}>
              <Ionicons name="person" size={14} color={Palette.primary} />
            </View>
            <View style={styles.doctorTexts}>
              <Text style={styles.doctorName}>{item.doctorName}</Text>
              {item.doctorSpecialty ? (
                <Text style={styles.doctorSpec}>{item.doctorSpecialty}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Check-In / Queue Token Banner */}
        {item.isCheckedIn ? (
          <View style={styles.checkedInBanner}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={styles.checkedInText}>
              Checked In · {item.queueToken ? `Token #${item.queueToken}` : "Pass Verified"}
            </Text>
          </View>
        ) : null}

        {/* Follow-Up Advice Box */}
        {isFollowUp && item.followUpAdvice ? (
          <View style={styles.adviceBox}>
            <Text style={styles.adviceText}>
              <Text style={{ fontWeight: "700" }}>Doctor Advice: </Text>
              {item.followUpAdvice}
            </Text>
          </View>
        ) : null}

        {/* Action Buttons Row */}
        <View style={styles.actionsContainer}>
          {/* Join Video Consult */}
          {canJoinVideo && item.meetingUrl ? (
            <Button
              title="Join Consultation"
              icon="videocam"
              onPress={() => Linking.openURL(item.meetingUrl!)}
              style={styles.actionBtn}
            />
          ) : null}

          {/* QR Check-In / Pass */}
          {canCheckIn && item.appointmentId ? (
            <Button
              title="Check In via QR"
              icon="qr-code"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/appointment/pass/[id]" as never,
                  params: { id: item.appointmentId },
                })
              }
              style={styles.actionBtn}
            />
          ) : null}

          {/* Complete Prep Checklist */}
          {isPrep && item.appointmentId ? (
            <Button
              title="Pre-Visit Prep"
              icon="clipboard"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/appointment/prepare/[id]" as never,
                  params: { id: item.appointmentId },
                })
              }
              style={styles.actionBtn}
            />
          ) : null}

          {/* View Appointment Details */}
          {isAppt && item.appointmentId ? (
            <Button
              title="View Details"
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: "/appointment/[id]" as never,
                  params: { id: item.appointmentId },
                })
              }
              style={styles.actionBtn}
            />
          ) : null}

          {/* Google Maps Directions */}
          {hasDirections && (
            <Button
              title="Directions"
              icon="navigate"
              variant="outline"
              onPress={() => {
                const query = encodeURIComponent(
                  item.hospitalAddress || item.hospitalName || "Hospital",
                );
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${query}`,
                );
              }}
              style={styles.actionBtn}
            />
          )}

          {/* Follow-Up Action */}
          {isFollowUp && (
            <Button
              title="Open Follow-Up"
              variant="primary"
              onPress={() => router.push("/health/follow-ups" as never)}
              style={styles.actionBtn}
            />
          )}

          {/* Document Action */}
          {isDoc && (
            <Button
              title="Open Document"
              variant="primary"
              onPress={() => router.push("/health/documents" as never)}
              style={styles.actionBtn}
            />
          )}

          {/* Cancel Appointment Action (active upcoming only) */}
          {isAppt &&
            item.status !== "completed" &&
            item.status !== "cancelled" &&
            item.appointmentId && (
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setCancellingAppointmentId(item.appointmentId!)}
                style={styles.actionBtn}
              />
            )}
        </View>
      </Card>
    );
  };

  // -------------------------------------------------------------------------
  // RENDER HEADER
  // -------------------------------------------------------------------------
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Family Member Isolation Filter */}
      <FamilyMemberFilterBar
        selectedMemberId={familyMemberFilter}
        onSelectMember={(memberId) => setFamilyMemberFilter(memberId)}
      />

      {/* Scope Banner */}
      <View style={styles.scopeBanner}>
        <Ionicons
          name={familyMemberFilter !== "all" ? "people" : "person"}
          size={14}
          color={Palette.primary}
        />
        <Text style={styles.scopeBannerText}>
          {familyMemberFilter !== "all"
            ? "Showing Dependent Family Member Schedule"
            : "Showing My Personal Healthcare Care Plan"}
        </Text>
      </View>

      {/* View Mode Segmented Controls */}
      <View style={styles.segmentedControls}>
        {/* TODAY TAB */}
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: viewMode === "today" }}
          accessibilityLabel="Today schedule"
          onPress={() => setViewMode("today")}
          style={[
            styles.segmentButton,
            viewMode === "today" && styles.segmentButtonActive,
          ]}
        >
          <Ionicons
            name="today-outline"
            size={15}
            color={viewMode === "today" ? Palette.primary : Palette.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              viewMode === "today" && styles.segmentTextActive,
            ]}
          >
            Today
          </Text>
          {todayCount > 0 ? (
            <View
              style={[
                styles.segmentBadge,
                viewMode === "today" && styles.segmentBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentBadgeText,
                  viewMode === "today" && styles.segmentBadgeTextActive,
                ]}
              >
                {todayCount}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {/* UPCOMING TAB */}
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: viewMode === "upcoming" }}
          accessibilityLabel="Upcoming visits"
          onPress={() => setViewMode("upcoming")}
          style={[
            styles.segmentButton,
            viewMode === "upcoming" && styles.segmentButtonActive,
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color={viewMode === "upcoming" ? Palette.primary : Palette.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              viewMode === "upcoming" && styles.segmentTextActive,
            ]}
          >
            Upcoming
          </Text>
          {upcomingCount > 0 ? (
            <View
              style={[
                styles.segmentBadge,
                viewMode === "upcoming" && styles.segmentBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentBadgeText,
                  viewMode === "upcoming" && styles.segmentBadgeTextActive,
                ]}
              >
                {upcomingCount}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {/* CALENDAR TAB */}
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: viewMode === "calendar" }}
          accessibilityLabel="Interactive calendar"
          onPress={() => setViewMode("calendar")}
          style={[
            styles.segmentButton,
            viewMode === "calendar" && styles.segmentButtonActive,
          ]}
        >
          <Ionicons
            name="grid-outline"
            size={15}
            color={viewMode === "calendar" ? Palette.primary : Palette.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              viewMode === "calendar" && styles.segmentTextActive,
            ]}
          >
            Calendar
          </Text>
        </Pressable>
      </View>

      {/* Interactive Calendar Strip (Visible in Calendar Mode) */}
      {viewMode === "calendar" && (
        <View style={styles.calendarStripWrapper}>
          <Text style={styles.calendarStripHeading}>
            Select a Date to View Scheduled Care
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.calendarStripScroll}
          >
            {calendarDates.map((item) => {
              const isSelected = selectedCalendarDate === item.isoDate;
              const hasEvents = eventDatesSet.has(item.isoDate);

              return (
                <Pressable
                  key={item.isoDate}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.dayName}, ${item.dayNum} ${item.monthName}`}
                  onPress={() => setSelectedCalendarDate(item.isoDate)}
                  style={[
                    styles.calendarDayCard,
                    isSelected && styles.calendarDayCardSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarDayName,
                      isSelected && styles.calendarDayTextSelected,
                    ]}
                  >
                    {item.dayName}
                  </Text>
                  <Text
                    style={[
                      styles.calendarDayNum,
                      isSelected && styles.calendarDayTextSelected,
                    ]}
                  >
                    {item.dayNum}
                  </Text>
                  <Text
                    style={[
                      styles.calendarMonthName,
                      isSelected && styles.calendarDayTextSelected,
                    ]}
                  >
                    {item.monthName}
                  </Text>

                  {/* Indicator Dot for Days with Real Events */}
                  {hasEvents && (
                    <View
                      style={[
                        styles.calendarDot,
                        isSelected && styles.calendarDotSelected,
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Section Title */}
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionHeading}>
          {viewMode === "today"
            ? "Today's Scheduled Healthcare"
            : viewMode === "upcoming"
              ? "Upcoming Care Journey & Visits"
              : `Events for ${formatDDMMYYYY(selectedCalendarDate)}`}
        </Text>
        <Text style={styles.sectionCount}>
          {displayedEvents.length} item{displayedEvents.length === 1 ? "" : "s"}
        </Text>
      </View>
    </View>
  );

  // -------------------------------------------------------------------------
  // MAIN SCREEN RENDER
  // -------------------------------------------------------------------------

  if (loading && !refreshing) {
    return (
      <View style={styles.safe}>
        <DrawerHeader
          title="Smart Care Planner"
          subtitle="Loading your healthcare schedule..."
        />
        <Loading label="Organizing your healthcare care plan..." />
        <PatientBottomNav activeTab="health" />
      </View>
    );
  }

  if (error && allPlannerEvents.length === 0) {
    return (
      <View style={styles.safe}>
        <DrawerHeader
          title="Smart Care Planner"
          subtitle="Failed to load planner"
        />
        <View style={styles.errorContainer}>
          <ErrorState
            title="Schedule Unavailable"
            message={error}
            onRetry={() => fetchPlannerData(false)}
          />
        </View>
        <PatientBottomNav activeTab="health" />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <DrawerHeader
        title="Smart Care Planner"
        subtitle={
          todayCount > 0
            ? `${todayCount} scheduled today · Real EMR Verified`
            : "Your Unified Healthcare Schedule"
        }
        rightElement={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh care planner"
            onPress={() => fetchPlannerData(true)}
            style={styles.refreshBtn}
          >
            <Ionicons name="refresh" size={17} color={Palette.primary} />
          </Pressable>
        }
      />

      <FlatList
        data={displayedEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderPlannerEvent}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyState
              title={
                viewMode === "today"
                  ? "Nothing Scheduled Today"
                  : viewMode === "upcoming"
                    ? "No Upcoming Healthcare Activities"
                    : "No Healthcare Activities on This Date"
              }
              message={
                viewMode === "today"
                  ? "You have no appointments, check-ins, or follow-ups scheduled for today."
                  : viewMode === "upcoming"
                    ? "You are all caught up! No pending consultations or follow-ups in the pipeline."
                    : `No clinical appointments or follow-ups found on ${formatDDMMYYYY(selectedCalendarDate)}.`
              }
              action={
                <Button
                  title={
                    viewMode === "today" || viewMode === "upcoming"
                      ? "Book Doctor Appointment"
                      : "View Today's Schedule"
                  }
                  onPress={() => {
                    if (viewMode === "calendar") {
                      setViewMode("today");
                    } else {
                      router.push("/doctors" as never);
                    }
                  }}
                />
              }
            />
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPlannerData(true)}
            colors={[Palette.primary]}
            tintColor={Palette.primary}
          />
        }
      />

      {/* Confirmation Dialog for Appointment Cancellation */}
      <ConfirmDialog
        visible={Boolean(cancellingAppointmentId)}
        title="Cancel Appointment?"
        message="Are you sure you want to cancel this appointment? Your reserved slot will be released back to the hospital clinic."
        confirmLabel="Yes, Cancel Slot"
        cancelLabel="Keep Appointment"
        tone="danger"
        loading={cancellingLoading}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancellingAppointmentId(null)}
      />

      <PatientBottomNav activeTab="health" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingBottom: 90,
  },
  headerContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  scopeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(37, 99, 235, 0.06)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  scopeBannerText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.primary,
  },
  segmentedControls: {
    flexDirection: "row",
    backgroundColor: "rgba(226, 232, 240, 0.5)",
    padding: 3,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  segmentButtonActive: {
    backgroundColor: "#FFFFFF",
    ...Shadows.sm,
  },
  segmentText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  segmentTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  segmentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
  },
  segmentBadgeActive: {
    backgroundColor: Palette.primaryLight,
  },
  segmentBadgeText: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  segmentBadgeTextActive: {
    color: Palette.primary,
  },
  calendarStripWrapper: {
    backgroundColor: Palette.surface,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  calendarStripHeading: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
    marginBottom: Spacing.xs,
    fontSize: 11,
  },
  calendarStripScroll: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  calendarDayCard: {
    width: 52,
    paddingVertical: 8,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.background,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  calendarDayCardSelected: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
    ...Shadows.sm,
  },
  calendarDayName: {
    ...Typography.caption,
    fontSize: 10,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  calendarDayNum: {
    ...Typography.body,
    fontWeight: "800",
    color: Palette.text,
    marginVertical: 1,
  },
  calendarMonthName: {
    ...Typography.caption,
    fontSize: 9,
    color: Palette.textMuted,
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Palette.primary,
    marginTop: 3,
  },
  calendarDotSelected: {
    backgroundColor: "#FFFFFF",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: Spacing.xs,
  },
  sectionHeading: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    letterSpacing: 0.2,
  },
  sectionCount: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },
  eventCard: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadows.sm,
  },
  eventCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  timeTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  timeTagText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  familyBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(2, 132, 199, 0.08)",
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    alignSelf: "flex-start",
    marginBottom: Spacing.xs,
  },
  familyBadgeText: {
    ...Typography.caption,
    fontSize: 11,
    fontWeight: "600",
    color: "#0284C7",
  },
  eventTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: Palette.text,
    marginBottom: 2,
  },
  eventSubtitle: {
    ...Typography.bodySmall,
    color: Palette.textMuted,
    marginBottom: Spacing.xs,
    lineHeight: 18,
  },
  doctorInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(37, 99, 235, 0.04)",
    padding: 6,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  doctorAvatar: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  doctorTexts: {
    flex: 1,
  },
  doctorName: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  doctorSpec: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 10,
  },
  checkedInBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
    alignSelf: "flex-start",
  },
  checkedInText: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#059669",
    fontSize: 11,
  },
  adviceBox: {
    backgroundColor: "rgba(124, 58, 237, 0.05)",
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    marginBottom: Spacing.xs,
  },
  adviceText: {
    ...Typography.caption,
    color: "#5B21B6",
    fontSize: 11,
    lineHeight: 16,
  },
  actionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(226, 232, 240, 0.6)",
  },
  actionBtn: {
    paddingHorizontal: Spacing.sm,
  },
  emptyContainer: {
    padding: Spacing.xl,
  },
  errorContainer: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: "center",
  },
});
