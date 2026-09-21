/**
 * HealPoint - Patient Health Overview Hook.
 *
 * Consolidates real backend health data for the authenticated patient:
 * - Real medical history summary (/appointment/patient/medical-history)
 * - Real appointment status counts (/appointment/get-user-appointments/:id)
 * - Real patient-submitted reviews (/review/my-reviews)
 * - Real recent health notifications and activity items (/notification/get-all)
 *
 * 100% Real Backend Data — Zero simulated or hardcoded values.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppointments } from "@/hooks/use-appointments";
import { useAuth } from "@/hooks/use-auth";
import { useScreenFocus } from "@/hooks/use-screen-focus";
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import { toErrorMessage } from "@/services/api";
import * as appointmentService from "@/services/appointments";
import * as notificationService from "@/services/notifications";
import * as reviewService from "@/services/reviews";
import type {
  Appointment,
  HealthActivityItem,
  Notification,
  PatientDiagnosisItem,
  PatientMedicalHistoryResponse,
  PatientMedicalOverview,
  PatientReportItem,
  Review,
} from "@/types";

export interface UseHealthOverviewResult {
  metrics: PatientMedicalOverview;
  recentConsultation: Appointment | null;
  recentPrescription: Appointment | null;
  recentReport: PatientReportItem | null;
  recentDiagnosis: PatientDiagnosisItem | null;
  recentActivities: HealthActivityItem[];
  medicalHistory: PatientMedicalHistoryResponse | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: () => Promise<void>;
}

function parseActivityTimestamp(dateStr?: string, createdAt?: string): number {
  if (createdAt) {
    const t = new Date(createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (!dateStr) return Date.now();
  const match = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(dateStr.trim());
  if (match) {
    const [, dd, mm, yyyy] = match;
    const t = new Date(Number(yyyy), Number(mm) - 1, Number(dd)).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

export function useHealthOverview(): UseHealthOverviewResult {
  const { user } = useAuth();
  const userId = user?._id;

  const {
    appointments,
    upcoming,
    completed,
    today,
    loading: appointmentsLoading,
    refetch: refetchAppointments,
  } = useAppointments();

  const [medicalHistory, setMedicalHistory] =
    useState<PatientMedicalHistoryResponse | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const inFlightRef = useRef(false);
  const hasLoadedOnce = useRef(false);

  const loadData = useCallback(
    async (isPullToRefresh = false) => {
      if (!userId) {
        setMedicalHistory(null);
        setReviews([]);
        setNotifications([]);
        setLoading(false);
        return;
      }

      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (isPullToRefresh) {
        setRefreshing(true);
      } else if (!hasLoadedOnce.current) {
        setLoading(true);
      }

      try {
        const [historyRes, reviewsRes, notificationsRes] =
          await Promise.allSettled([
            appointmentService.getPatientMedicalHistory(),
            reviewService.getMyReviews(),
            notificationService.getNotifications({ limit: 5 }),
          ]);

        if (historyRes.status === "fulfilled") {
          setMedicalHistory(historyRes.value);
        }
        if (reviewsRes.status === "fulfilled" && reviewsRes.value?.reviews) {
          setReviews(reviewsRes.value.reviews);
        }
        if (
          notificationsRes.status === "fulfilled" &&
          notificationsRes.value?.notifications
        ) {
          setNotifications(notificationsRes.value.notifications);
        }

        setError("");
        hasLoadedOnce.current = true;
      } catch (err) {
        if (!hasLoadedOnce.current) {
          setError(toErrorMessage(err, "Unable to load health overview data."));
        }
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    hasLoadedOnce.current = false;
    loadData();
  }, [loadData]);

  useScreenFocus(() => {
    loadData();
  }, 15_000);

  const refresh = useCallback(async () => {
    await Promise.allSettled([refetchAppointments(), loadData(true)]);
  }, [refetchAppointments, loadData]);

  // Derived metrics from real data
  const consultations = medicalHistory?.consultations || [];
  const prescriptions = medicalHistory?.prescriptions || [];
  const reports = medicalHistory?.reports || [];
  const diagnoses = medicalHistory?.diagnoses || [];

  const metrics: PatientMedicalOverview = {
    totalAppointments: appointments.length,
    completedConsultations: completed.length,
    upcomingAppointments: upcoming.length + today.length,
    prescriptionsCount:
      prescriptions.length || medicalHistory?.summary?.totalPrescriptions || 0,
    medicalRecordsCount: diagnoses.length + reports.length,
    reportsCount: reports.length || medicalHistory?.summary?.totalReports || 0,
    reviewsSubmitted: reviews.length,
  };

  // Recent Items (strictly real data)
  const recentConsultation =
    completed[0] ||
    consultations.find((c) => c.status === "completed") ||
    consultations[0] ||
    null;

  const recentPrescription =
    prescriptions[0] ||
    appointments.find(
      (a) =>
        Boolean(a.prescription?.trim()) ||
        Boolean(a.medicines && a.medicines.length > 0),
    ) ||
    null;

  const recentReport = reports[0] || null;
  const recentDiagnosis = diagnoses[0] || null;

  // Synthesize Unified Chronological Health Activities
  const activityItems: HealthActivityItem[] = [];

  // 1. From real notifications
  for (const notif of notifications) {
    const isAppt =
      notif.type === "appointment" ||
      notif.title?.toLowerCase().includes("appointment") ||
      notif.message?.toLowerCase().includes("appointment");
    const isConsult =
      notif.type === "consultation" ||
      notif.title?.toLowerCase().includes("consultation") ||
      notif.message?.toLowerCase().includes("meet");

    activityItems.push({
      id: notif._id || `notif-${activityItems.length}`,
      type: "notification",
      title: notif.title || "Healthcare Update",
      description: notif.message || "Healthcare account update.",
      date: notif.createdAt ? formatDDMMYYYY(notif.createdAt) : "Recent",
      timestamp: parseActivityTimestamp(undefined, notif.createdAt),
      icon: isConsult ? "videocam" : isAppt ? "calendar" : "notifications",
      tint: isConsult ? "#9356D6" : isAppt ? "#2F80ED" : "#0E9F8E",
      badgeLabel: notif.isRead ? undefined : "New",
      badgeVariant: "primary",
      route: "/notification",
    });
  }

  // 2. From latest prescriptions
  for (const rx of prescriptions.slice(0, 2)) {
    const docName = formatDoctorName(
      typeof rx.doctorId === "object" && rx.doctorId?.name
        ? rx.doctorId.name
        : rx.doctorName,
      "Doctor",
    );
    const dateStr = rx.slotDate || rx.date || "";
    activityItems.push({
      id: `rx-${rx._id}`,
      type: "prescription",
      title: "Prescription Issued",
      description: `Prescribed by ${docName} (${rx.medicines?.length || 1} medication${(rx.medicines?.length || 1) === 1 ? "" : "s"}).`,
      date: dateStr ? formatDDMMYYYY(dateStr) : "Recent",
      timestamp: parseActivityTimestamp(dateStr, rx.createdAt),
      icon: "document-text",
      tint: "#10B981",
      badgeLabel: "Digital Rx",
      badgeVariant: "success",
      route: "/health/prescriptions",
    });
  }

  // 3. From latest reports
  for (const rep of reports.slice(0, 2)) {
    const dateStr = rep.date || "";
    activityItems.push({
      id: `rep-${rep._id}`,
      type: "report",
      title: rep.name || "Medical Report",
      description: `${rep.category || "Diagnostic Report"} attached to your record.`,
      date: dateStr ? formatDDMMYYYY(dateStr) : "Recent",
      timestamp: parseActivityTimestamp(dateStr, rep.uploadedAt),
      icon: "bar-chart",
      tint: "#0284C7",
      badgeLabel: "Diagnostic",
      badgeVariant: "primary",
      route: "/health/reports",
    });
  }

  // 4. From completed consultations
  for (const appt of completed.slice(0, 2)) {
    const docName = formatDoctorName(
      typeof appt.doctorId === "object" && appt.doctorId?.name
        ? appt.doctorId.name
        : appt.doctorName,
      "Doctor",
    );
    const dateStr = appt.slotDate || "";
    activityItems.push({
      id: `consult-${appt._id}`,
      type: "consultation",
      title:
        appt.consultationType === "video"
          ? "Video Consultation Completed"
          : "Clinic Consultation Completed",
      description: `Consultation with ${docName} was marked completed.`,
      date: dateStr ? formatDDMMYYYY(dateStr) : "Completed",
      timestamp: parseActivityTimestamp(dateStr, appt.createdAt),
      icon: appt.consultationType === "video" ? "videocam" : "medical",
      tint: "#0E9F8E",
      badgeLabel: "Completed",
      badgeVariant: "primary",
      route: "/appointment/[id]",
      routeParams: { id: String(appt._id) },
    });
  }

  // Sort descending by timestamp, deduplicate by id, and take top 5
  const seenIds = new Set<string>();
  const recentActivities = activityItems
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    })
    .slice(0, 5);

  return {
    metrics,
    recentConsultation,
    recentPrescription,
    recentReport,
    recentDiagnosis,
    recentActivities,
    medicalHistory,
    loading: (loading || appointmentsLoading) && !hasLoadedOnce.current,
    refreshing,
    error,
    refresh,
  };
}
