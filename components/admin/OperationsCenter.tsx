/**
 * HealPoint — Smart Hospital Operations Center.
 *
 * Centralized, real-time operational cockpit for Hospital Admin:
 * - 100% Real backend data strictly isolated to the authenticated admin's hospital
 * - Today's Live KPI cards: Total, Checked In, Waiting Queue, Active Consultations, Available Doctors, Completed
 * - Real-Time Queue Center grouped per doctor/department with serving tokens & waiting counts
 * - Operational Appointment List with real-time status badges, check-in pills, tokens, and actions
 * - Doctor Availability Live Status (Available, In Consultation, On Break, On Leave, Not Available)
 * - Department Load Monitor based on database departments and real appointment volume
 * - Online Consultations Monitor with verified Google Meet launch
 * - Smart Operational Alerts triggered strictly by actual conditions (high queue, pending bookings, conflicts)
 * - Cross-Portal Real-Time Synchronization via Socket.IO (appointment:sync, queue:sync)
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  AppointmentDetailAction,
  AppointmentDetailsModal,
} from "@/components/admin/AppointmentDetailsModal";
import { CapacityIntelligenceSection } from "@/components/admin/CapacityIntelligenceSection";
import { RescheduleModal } from "@/components/admin/RescheduleModal";
import {
  appointmentPaymentBadge,
  appointmentStatusBadge,
  StatusBadge,
} from "@/components/admin/StatusBadge";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Loading } from "@/components/ui/Loading";
import {
  Palette,
  Radius,
  Shadows,
  Spacing,
  Typography,
} from "@/constants/theme";
import {
  appointmentDepartment,
  appointmentDoctorName,
  appointmentPatientName,
  appointmentPayment,
  appointmentReference,
  todayKey,
} from "@/lib/appointments";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import { openGoogleMeetUrl } from "@/lib/meet";
import { useResponsiveVariant } from "@/lib/responsive";
import * as adminService from "@/services/admin";
import { toErrorMessage } from "@/services/api";
import * as checkinService from "@/services/checkin";
import * as consultationService from "@/services/consultations";
import {
  subscribeToAppointmentSync,
  subscribeToConsultationSync,
  subscribeToQueueSync,
} from "@/services/socket";
import type {
  Appointment,
  Doctor,
  HospitalConsultationStats,
  HospitalDepartment,
} from "@/types";
import {
  evaluateHospitalOperationalStatus,
  detectDelayedAppointments,
  buildOperationalAlerts,
  computeDepartmentWorkload,
  extractRecentOperationalActivity,
  type HospitalOperationalState,
  type OperationalAlert,
  type DelayedAppointmentItem,
  type OperationalActivityItem,
  type DepartmentOperationalSummary,
} from "@/lib/hospital-command-center";

export type OperationalTab =
  | "all"
  | "waiting"
  | "in_consultation"
  | "checked_in"
  | "confirmed"
  | "pending"
  | "completed"
  | "cancelled"
  | "delayed"
  | "clinic"
  | "video";

interface DoctorOperationalView {
  doctor: Doctor;
  status:
    | "available"
    | "in_consultation"
    | "on_break"
    | "on_leave"
    | "not_available";
  todayAppointmentsCount: number;
  activePatient?: Appointment;
  waitingCount: number;
  nextPatient?: Appointment;
}

export function OperationsCenter() {
  const router = useRouter();
  const responsive = useResponsiveVariant();
  const isDesktop = responsive === "desktop";
  const isTablet = responsive === "tablet";

  // Data states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [backendData, setBackendData] =
    useState<adminService.OperationsCommandCenterResponse | null>(null);
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<
    Appointment[]
  >([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<HospitalDepartment[]>([]);
  const [consultationStats, setConsultationStats] =
    useState<HospitalConsultationStats | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [syncCount, setSyncCount] = useState<number>(0);

  // Filter and tab
  const [activeTab, setActiveTab] = useState<OperationalTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [consultationTypeFilter, setConsultationTypeFilter] = useState<
    "all" | "clinic" | "video"
  >("all");

  // Interaction modals
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] =
    useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [actionError, setActionError] = useState("");
  const [togglingDoctorId, setTogglingDoctorId] = useState("");

  // Quick Check-In / Reception Desk States
  const [checkingInId, setCheckingInId] = useState<string>("");
  const [quickCheckInVisible, setQuickCheckInVisible] = useState(false);
  const [quickReferenceInput, setQuickReferenceInput] = useState("");
  const [quickCheckInLoading, setQuickCheckInLoading] = useState(false);
  const [quickCheckInError, setQuickCheckInError] = useState("");

  // Consolidated Master Fetch
  const fetchOperationsData = useCallback(async (isBackground = false) => {
    if (!isBackground) setError("");
    try {
      // 1. Primary: dedicated Hospital Operations Command Center 2.0 backend aggregation API
      const opCenterRes = await adminService
        .getHospitalAdminOperationsCommandCenter({
          date: todayKey(),
        })
        .catch(() => null);

      if (opCenterRes && opCenterRes.success) {
        setBackendData(opCenterRes);
        setTodayAppointments(opCenterRes.appointments || []);
        if (opCenterRes.hospitalName) setHospitalName(opCenterRes.hospitalName);
        if (opCenterRes.doctorOperations) {
          setDoctors(opCenterRes.doctorOperations.map((d) => d.doctor));
        }
      } else {
        // Fallback: Individual endpoints
        const [apptsRes, upcomingRes, doctorsRes, deptsRes, consultRes] =
          await Promise.all([
            adminService.getHospitalAdminAppointments({
              dateFilter: "today",
              limit: 150,
              sortBy: "date_asc",
            }),
            adminService
              .getHospitalAdminAppointments({
                dateFilter: "upcoming",
                limit: 250,
                sortBy: "date_asc",
              })
              .catch(() => ({ appointments: [] })),
            adminService.getHospitalDoctors(),
            adminService.getHospitalDepartments().catch(() => ({
              success: true,
              departments: [],
              stats: { total: 0, active: 0, inactive: 0, withDoctors: 0 },
            })),
            consultationService.getHospitalConsultationStats().catch(() => null),
          ]);

        setTodayAppointments(apptsRes.appointments || []);
        setUpcomingAppointments(upcomingRes.appointments || []);
        if (apptsRes.hospitalName) setHospitalName(apptsRes.hospitalName);
        setDoctors(doctorsRes.data || doctorsRes.doctors || []);
        setDepartments(deptsRes.departments || []);
        if (consultRes) setConsultationStats(consultRes);
      }

      setLastSyncTime(new Date());
      setSyncCount((prev) => prev + 1);
    } catch (err) {
      if (!isBackground) {
        setError(
          toErrorMessage(err, "Unable to load hospital operations data."),
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOperationsData(false);
  }, [fetchOperationsData]);

  // Real-time socket synchronization
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const triggerBackgroundRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void fetchOperationsData(true);
      }, 400);
    };

    const unsubscribeAppt = subscribeToAppointmentSync(() => {
      triggerBackgroundRefresh();
    });

    const unsubscribeQueue = subscribeToQueueSync(() => {
      triggerBackgroundRefresh();
    });

    const unsubscribeConsult = subscribeToConsultationSync(() => {
      triggerBackgroundRefresh();
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeAppt();
      unsubscribeQueue();
      unsubscribeConsult();
    };
  }, [fetchOperationsData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchOperationsData(false);
  }, [fetchOperationsData]);

  // Derived Operational Metrics
  const metrics = useMemo(() => {
    if (backendData?.kpis) {
      const k = backendData.kpis;
      const followUps = todayAppointments.filter((a) =>
        Boolean(a.followUpAdvice?.trim()),
      ).length;
      return {
        total: k.total,
        pending: k.pending,
        confirmed: k.confirmed,
        checkedIn: k.checkedIn,
        waitingQueue: k.inQueue,
        inConsultation: k.inConsultation,
        availableDoctors: k.availableDoctors,
        completed: k.completed,
        cancelled: k.cancelled,
        rescheduled: k.rescheduled,
        delayed: k.delayed,
        online: k.onlineConsultations,
        inPerson: k.inPersonConsultations,
        videoCount: k.onlineConsultations,
        followUpsAdvised: k.followUpsAdvised || followUps,
      };
    }

    const total = todayAppointments.length;
    let pending = 0;
    let confirmed = 0;
    let checkedIn = 0;
    let waitingQueue = 0;
    let inConsultation = 0;
    let completed = 0;
    let cancelled = 0;
    let rescheduled = 0;
    let delayed = 0;
    let videoCount = 0;
    let inPerson = 0;
    let followUpsAdvised = 0;

    for (const a of todayAppointments) {
      const s = (a.status || "").toLowerCase();
      const qs = (a.queueStatus || "").toLowerCase();
      const cs = (a.consultationStatus || "").toLowerCase();
      const isChecked = a.checkedIn === true || Boolean(a.checkInAt);

      if (s === "pending") pending++;
      if (s === "confirmed") confirmed++;
      if (s === "completed") completed++;
      if (s === "cancel" || s === "missed") cancelled++;
      if (s === "rescheduled") rescheduled++;

      if (a.consultationType === "video") {
        videoCount++;
      } else {
        inPerson++;
      }

      if (a.followUpAdvice?.trim()) followUpsAdvised++;

      if (
        isChecked ||
        qs === "waiting" ||
        qs === "called" ||
        qs === "in_consultation"
      ) {
        checkedIn++;
      }

      if (qs === "in_consultation" || cs === "in_progress") {
        inConsultation++;
      } else if (
        qs === "waiting" ||
        qs === "called" ||
        (isChecked && s !== "completed" && s !== "cancel" && s !== "missed")
      ) {
        waitingQueue++;
      }
    }

    const availableDoctors = doctors.filter(
      (d) => d.available !== false && d.isActive !== false,
    ).length;

    return {
      total,
      pending,
      confirmed,
      checkedIn,
      waitingQueue,
      inConsultation,
      availableDoctors,
      completed,
      cancelled,
      rescheduled,
      delayed,
      online: videoCount,
      inPerson,
      videoCount,
      followUpsAdvised,
    };
  }, [backendData, todayAppointments, doctors]);

  // Derived Doctor Operational View
  const doctorOperationalList: DoctorOperationalView[] = useMemo(() => {
    const todayStr = todayKey();

    return doctors.map((doc) => {
      const docIdStr = String(doc._id);

      // Appointments assigned to this doctor today
      const docAppts = todayAppointments.filter((a) => {
        const aDocId =
          typeof a.doctorId === "object" && a.doctorId
            ? String((a.doctorId as { _id?: string })._id || "")
            : String(a.doctorId || "");
        return aDocId === docIdStr;
      });

      // Find if doctor is currently in consultation
      const activeAppt = docAppts.find(
        (a) =>
          a.queueStatus === "in_consultation" ||
          a.consultationStatus === "in_progress",
      );

      // Waiting patients for this doctor
      const waitingList = docAppts.filter(
        (a) =>
          a.queueStatus === "waiting" ||
          a.queueStatus === "called" ||
          (a.checkedIn && a.status !== "completed" && a.status !== "cancel"),
      );

      // Next patient in line
      const nextAppt = waitingList.find((a) => a !== activeAppt);

      // Determine doctor status
      let docStatus: DoctorOperationalView["status"] = "available";
      const isLeaveToday = (doc.leaveDates || []).includes(todayStr);

      if (doc.isActive === false || doc.available === false) {
        docStatus = "not_available";
      } else if (isLeaveToday) {
        docStatus = "on_leave";
      } else if (activeAppt) {
        docStatus = "in_consultation";
      } else {
        docStatus = "available";
      }

      return {
        doctor: doc,
        status: docStatus,
        todayAppointmentsCount: docAppts.length,
        activePatient: activeAppt,
        waitingCount: waitingList.length,
        nextPatient: nextAppt,
      };
    });
  }, [doctors, todayAppointments]);

  // Detect delayed appointments based on real scheduled slot time (>20m past slot)
  const delayedAppointments = useMemo(
    () => detectDelayedAppointments(todayAppointments),
    [todayAppointments],
  );

  const delayedMap = useMemo(
    () => new Map(delayedAppointments.map((d) => [d.id, d.delayMinutes])),
    [delayedAppointments],
  );

  // Derived factual Hospital Operational Status
  const operationalStatus = useMemo(() => {
    const highQueueDocsCount = doctorOperationalList.filter(
      (d) => d.waitingCount >= 4,
    ).length;
    return evaluateHospitalOperationalStatus({
      totalToday: metrics.total,
      waitingCount: metrics.waitingQueue,
      inConsultationCount: metrics.inConsultation,
      availableDoctorsCount: metrics.availableDoctors,
      totalDoctorsCount: doctors.length,
      delayedCount: delayedAppointments.length,
      highQueueDoctorsCount: highQueueDocsCount,
    });
  }, [
    metrics,
    doctors.length,
    delayedAppointments.length,
    doctorOperationalList,
  ]);

  // Derived Department Workload summaries with load states
  const departmentSummaries: DepartmentOperationalSummary[] = useMemo(() => {
    return computeDepartmentWorkload({
      departments,
      todayAppointments,
      doctors,
      upcomingAppointments,
    });
  }, [departments, todayAppointments, doctors, upcomingAppointments]);

  // Derived Operational Alerts (Strictly Real Backend Driven)
  const smartAlerts: OperationalAlert[] = useMemo(() => {
    if (backendData?.smartAlerts && backendData.smartAlerts.length > 0) {
      return backendData.smartAlerts;
    }

    const highQueueDocs = doctorOperationalList
      .filter((d) => d.waitingCount >= 4)
      .map((d) => ({
        doctorName: formatDoctorName(d.doctor.name),
        waitingCount: d.waitingCount,
      }));

    const offlineWithBookings = doctorOperationalList
      .filter(
        (d) => d.status === "not_available" && d.todayAppointmentsCount > 0,
      )
      .map((d) => ({
        doctorName: formatDoctorName(d.doctor.name),
        apptCount: d.todayAppointmentsCount,
      }));

    return buildOperationalAlerts({
      pendingCount: metrics.pending,
      delayedAppointments,
      highQueueDoctors: highQueueDocs,
      offlineDoctorsWithBookings: offlineWithBookings,
      inConsultationCount: metrics.inConsultation,
      videoConsultationCount: metrics.videoCount,
    });
  }, [backendData, doctorOperationalList, metrics, delayedAppointments]);

  // Derived Recent Operational Activity timeline
  const recentActivities: OperationalActivityItem[] = useMemo(() => {
    return extractRecentOperationalActivity(todayAppointments);
  }, [todayAppointments]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return todayAppointments.filter((a) => {
      // Tab filter
      if (activeTab === "waiting") {
        const isWaiting =
          a.queueStatus === "waiting" ||
          a.queueStatus === "called" ||
          (a.checkedIn && a.status !== "completed" && a.status !== "cancel");
        if (!isWaiting) return false;
      } else if (activeTab === "in_consultation") {
        if (
          a.queueStatus !== "in_consultation" &&
          a.consultationStatus !== "in_progress"
        )
          return false;
      } else if (activeTab === "checked_in") {
        if (!a.checkedIn && !a.checkInAt) return false;
      } else if (activeTab === "confirmed") {
        if (a.status !== "confirmed") return false;
      } else if (activeTab === "pending") {
        if (a.status !== "pending") return false;
      } else if (activeTab === "completed") {
        if (a.status !== "completed") return false;
      } else if (activeTab === "cancelled") {
        if (a.status !== "cancel" && a.status !== "missed") return false;
      } else if (activeTab === "delayed") {
        const isDelayed = delayedAppointments.some(
          (d) => d.id === String(a._id),
        );
        if (!isDelayed) return false;
      } else if (activeTab === "clinic") {
        if (a.consultationType === "video") return false;
      } else if (activeTab === "video") {
        if (a.consultationType !== "video") return false;
      }

      // Consultation Type filter
      if (consultationTypeFilter === "clinic" && a.consultationType === "video") {
        return false;
      }
      if (consultationTypeFilter === "video" && a.consultationType !== "video") {
        return false;
      }

      // Department filter
      if (departmentFilter !== "all") {
        const d = appointmentDepartment(a);
        if (d !== departmentFilter) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const pName = appointmentPatientName(a).toLowerCase();
        const dName = appointmentDoctorName(a).toLowerCase();
        const ref = appointmentReference(a).toLowerCase();
        const token = String(a.queueToken || "").toLowerCase();
        if (
          !pName.includes(q) &&
          !dName.includes(q) &&
          !ref.includes(q) &&
          !token.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    todayAppointments,
    activeTab,
    departmentFilter,
    consultationTypeFilter,
    searchQuery,
    delayedAppointments,
  ]);

  // Handlers for Appointment Operations
  const handleUpdateStatus = useCallback(
    async (appointmentId: string, nextStatus: string) => {
      setActionError("");
      setActionSuccess("");
      try {
        await adminService.updateHospitalAdminAppointmentStatus(appointmentId, {
          status: nextStatus,
        });
        setActionSuccess(`Status updated to ${nextStatus}.`);
        setSelectedAppointment(null);
        void fetchOperationsData(true);
      } catch (err) {
        setActionError(toErrorMessage(err, "Failed to update status."));
      }
    },
    [fetchOperationsData],
  );

  const handleCancelSubmit = useCallback(async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      setCancelError("Please specify a cancellation reason.");
      return;
    }
    setCancelling(true);
    setCancelError("");
    try {
      await adminService.cancelHospitalAdminAppointment(
        String(cancelTarget._id),
        cancelReason.trim(),
      );
      setCancelTarget(null);
      setCancelReason("");
      setSelectedAppointment(null);
      setActionSuccess("Appointment cancelled successfully.");
      void fetchOperationsData(true);
    } catch (err) {
      setCancelError(toErrorMessage(err, "Failed to cancel appointment."));
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelReason, fetchOperationsData]);

  const handleRescheduleSubmit = useCallback(
    async (payload: {
      slotDate: string;
      slotTime: string;
      reason: string;
    }): Promise<string> => {
      if (!rescheduleAppointment) return "No appointment selected.";
      try {
        await adminService.rescheduleHospitalAdminAppointment(
          String(rescheduleAppointment._id),
          payload,
        );
        setRescheduleAppointment(null);
        setSelectedAppointment(null);
        setActionSuccess("Appointment rescheduled successfully.");
        void fetchOperationsData(true);
        return "";
      } catch (err) {
        return toErrorMessage(err, "Reschedule failed.");
      }
    },
    [rescheduleAppointment, fetchOperationsData],
  );

  // Check-In Handlers (Smart Check-In & OPD Queue Token Assignment)
  const handleDirectCheckIn = useCallback(
    async (appt: Appointment) => {
      const apptId = String(appt._id);
      setCheckingInId(apptId);
      setActionError("");
      setActionSuccess("");
      try {
        const res = await checkinService.verifyAndCheckInPatient({
          appointmentId: apptId,
        });
        const tokenNum =
          res.tokenNumber || res.token || res.appointment?.queueToken || "";
        setActionSuccess(
          `Checked in ${appointmentPatientName(appt)} successfully! Assigned Queue Token: #${tokenNum}`,
        );
        void fetchOperationsData(true);
      } catch (err) {
        setActionError(toErrorMessage(err, "Patient check-in failed."));
      } finally {
        setCheckingInId("");
      }
    },
    [fetchOperationsData],
  );

  const handleQuickCheckInSubmit = useCallback(async () => {
    if (!quickReferenceInput.trim()) {
      setQuickCheckInError(
        "Please enter an appointment ID, reference, or QR code.",
      );
      return;
    }
    setQuickCheckInLoading(true);
    setQuickCheckInError("");
    try {
      const res = await checkinService.verifyAndCheckInPatient({
        rawReference: quickReferenceInput.trim(),
      });
      const tokenNum =
        res.tokenNumber || res.token || res.appointment?.queueToken || "";
      const pName = res.appointment?.patientName || "Patient";
      setActionSuccess(
        `Checked in ${pName} successfully! Assigned Queue Token: #${tokenNum}`,
      );
      setQuickCheckInVisible(false);
      setQuickReferenceInput("");
      void fetchOperationsData(true);
    } catch (err) {
      setQuickCheckInError(
        toErrorMessage(err, "Check-in failed. Please verify reference."),
      );
    } finally {
      setQuickCheckInLoading(false);
    }
  }, [quickReferenceInput, fetchOperationsData]);

  const handleToggleDoctor = useCallback(
    async (doc: Doctor, nextVal: boolean) => {
      const docId = String(doc._id);
      setTogglingDoctorId(docId);
      try {
        await adminService.toggleDoctorAvailability(docId, nextVal);
        setDoctors((prev) =>
          prev.map((d) =>
            String(d._id) === docId ? { ...d, available: nextVal } : d,
          ),
        );
      } catch (err) {
        setActionError(toErrorMessage(err, "Unable to change availability."));
      } finally {
        setTogglingDoctorId("");
      }
    },
    [],
  );

  // Detail Modal Actions
  const detailActions: AppointmentDetailAction[] = useMemo(() => {
    if (!selectedAppointment) return [];
    const actions: AppointmentDetailAction[] = [];
    const st = String(selectedAppointment.status || "").toLowerCase();

    if (st === "pending") {
      actions.push({
        key: "confirm",
        label: "Confirm Appointment",
        icon: "checkmark-circle-outline",
        variant: "primary",
        onPress: () =>
          handleUpdateStatus(String(selectedAppointment._id), "confirmed"),
      });
    }

    if (st === "confirmed") {
      if (
        !selectedAppointment.checkedIn &&
        !selectedAppointment.checkInAt
      ) {
        actions.push({
          key: "check_in",
          label: "Check-In Patient to OPD",
          icon: "qr-code-outline",
          variant: "primary",
          onPress: () => {
            const appt = selectedAppointment;
            setSelectedAppointment(null);
            void handleDirectCheckIn(appt);
          },
        });
      }

      actions.push({
        key: "complete",
        label: "Complete Consultation",
        icon: "checkmark-done-outline",
        variant: "primary",
        onPress: () =>
          handleUpdateStatus(String(selectedAppointment._id), "completed"),
      });
      actions.push({
        key: "missed",
        label: "Mark No-Show",
        icon: "close-circle-outline",
        variant: "outline",
        onPress: () =>
          handleUpdateStatus(String(selectedAppointment._id), "missed"),
      });
    }

    if (
      selectedAppointment.consultationType === "video" &&
      selectedAppointment.meetingUrl
    ) {
      actions.push({
        key: "join_meet",
        label: "Launch Google Meet",
        icon: "videocam-outline",
        variant: "primary",
        onPress: () => {
          if (selectedAppointment.meetingUrl) {
            openGoogleMeetUrl(selectedAppointment.meetingUrl);
          }
        },
      });
    }

    if (st !== "cancel" && st !== "completed") {
      actions.push({
        key: "reschedule",
        label: "Reschedule Slot",
        icon: "calendar-outline",
        variant: "outline",
        onPress: () => {
          setRescheduleAppointment(selectedAppointment);
        },
      });
      actions.push({
        key: "cancel",
        label: "Cancel Booking",
        icon: "trash-outline",
        variant: "danger",
        onPress: () => {
          setCancelTarget(selectedAppointment);
          setCancelReason("");
          setCancelError("");
        },
      });
    }

    return actions;
  }, [selectedAppointment, handleUpdateStatus]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loading label="Initializing Smart Hospital Operations Center..." />
      </View>
    );
  }

  if (error && todayAppointments.length === 0) {
    return (
      <View style={styles.stateContainer}>
        <ErrorState
          message={error}
          onRetry={() => fetchOperationsData(false)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Palette.primary}
        />
      }
    >
      {/* ----------------- BANNER & LIVE SYNC STATUS ----------------- */}
      <View style={styles.topLiveBar}>
        <View style={styles.topLiveLeft}>
          <View
            style={[
              styles.livePulseDot,
              { backgroundColor: operationalStatus.statusColor },
            ]}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.topStatusRow}>
              <Text style={styles.topLiveTitle} numberOfLines={1}>
                {operationalStatus.statusLabel} · {hospitalName || "Hospital"}
              </Text>
              <Badge
                label={operationalStatus.status}
                variant={operationalStatus.badgeVariant}
              />
            </View>
            <Text style={styles.topLiveSub}>
              {operationalStatus.description}
            </Text>
            <Text style={styles.topLiveMeta}>
              {metrics.total} visits today · {metrics.waitingQueue} waiting in
              OPD · {metrics.inConsultation} in consultation ·{" "}
              {metrics.availableDoctors}/{doctors.length} doctors on duty
              {delayedAppointments.length > 0
                ? ` · ⏱️ ${delayedAppointments.length} delayed`
                : ""}
            </Text>
          </View>
        </View>
        <View style={styles.topLiveRight}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setQuickReferenceInput("");
              setQuickCheckInError("");
              setQuickCheckInVisible(true);
            }}
            style={styles.receptionCheckInBtn}
          >
            <Ionicons name="qr-code" size={14} color="#fff" />
            <Text style={styles.receptionCheckInText}>Reception Check-In</Text>
          </Pressable>
          <View style={styles.topLiveSyncBadge}>
            <Ionicons name="sync-outline" size={12} color={Palette.primaryDark} />
            <Text style={styles.topLiveTimestamp}>
              Live{" "}
              {lastSyncTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Banners */}
      {actionSuccess ? (
        <FormMessage type="info" message={actionSuccess} />
      ) : null}
      {actionError ? <FormMessage type="error" message={actionError} /> : null}

      {/* ----------------- TOP OPERATIONAL KPI CARDS (ALL 12 CORE OPERATIONS) ----------------- */}
      <View style={styles.kpiContainer}>
        {/* 1. Today's Bookings */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("all")}
          style={[
            styles.kpiCard,
            activeTab === "all" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#E6F4FE" }]}>
            <Ionicons name="calendar" size={20} color="#0284C7" />
          </View>
          <Text style={styles.kpiValue}>{metrics.total}</Text>
          <Text style={styles.kpiLabel}>{"Today's Bookings"}</Text>
          <Text style={styles.kpiSub}>All scheduled visits</Text>
        </Pressable>

        {/* 2. Checked In */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("checked_in")}
          style={[
            styles.kpiCard,
            activeTab === "checked_in" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#ECFDF5" }]}>
            <Ionicons name="qr-code" size={20} color="#059669" />
          </View>
          <Text style={styles.kpiValue}>{metrics.checkedIn}</Text>
          <Text style={styles.kpiLabel}>Checked In</Text>
          <Text style={styles.kpiSub}>Present at hospital</Text>
        </Pressable>

        {/* 3. Waiting Queue */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("waiting")}
          style={[
            styles.kpiCard,
            activeTab === "waiting" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="hourglass" size={20} color="#D97706" />
          </View>
          <Text style={styles.kpiValue}>{metrics.waitingQueue}</Text>
          <Text style={styles.kpiLabel}>Waiting Queue</Text>
          <Text style={styles.kpiSub}>OPD lounge line</Text>
        </Pressable>

        {/* 4. In Consultation */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("in_consultation")}
          style={[
            styles.kpiCard,
            activeTab === "in_consultation" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#F3E8FF" }]}>
            <Ionicons name="pulse" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.kpiValue}>{metrics.inConsultation}</Text>
          <Text style={styles.kpiLabel}>In Consultation</Text>
          <Text style={styles.kpiSub}>With doctors now</Text>
        </Pressable>

        {/* 5. Available Staff Doctors */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/admin/doctor-availability" as never)}
          style={[
            styles.kpiCard,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#E0F2FE" }]}>
            <Ionicons name="medkit" size={20} color="#0284C7" />
          </View>
          <Text style={styles.kpiValue}>{metrics.availableDoctors}</Text>
          <Text style={styles.kpiLabel}>Available Doctors</Text>
          <Text style={styles.kpiSub}>{doctors.length} total staff</Text>
        </Pressable>

        {/* 6. Completed Consultations */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("completed")}
          style={[
            styles.kpiCard,
            activeTab === "completed" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#DCFCE7" }]}>
            <Ionicons name="checkmark-done" size={20} color="#16A34A" />
          </View>
          <Text style={styles.kpiValue}>{metrics.completed}</Text>
          <Text style={styles.kpiLabel}>Completed</Text>
          <Text style={styles.kpiSub}>Consulted today</Text>
        </Pressable>

        {/* 7. Pending Confirmations */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("pending")}
          style={[
            styles.kpiCard,
            activeTab === "pending" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#FFF7ED" }]}>
            <Ionicons name="alert-circle-outline" size={20} color="#EA580C" />
          </View>
          <Text style={styles.kpiValue}>{metrics.pending}</Text>
          <Text style={styles.kpiLabel}>Pending Confirm</Text>
          <Text style={styles.kpiSub}>Awaiting triage</Text>
        </Pressable>

        {/* 8. Delayed Appointments */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("delayed")}
          style={[
            styles.kpiCard,
            (metrics.delayed > 0 || delayedAppointments.length > 0) && {
              borderColor: "#EF4444",
              backgroundColor: "#FEF2F2",
            },
            activeTab === "delayed" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View
            style={[
              styles.kpiIconWrap,
              {
                backgroundColor:
                  metrics.delayed > 0 || delayedAppointments.length > 0
                    ? "#FEE2E2"
                    : "#F1F5F9",
              },
            ]}
          >
            <Ionicons
              name="time"
              size={20}
              color={
                metrics.delayed > 0 || delayedAppointments.length > 0
                  ? "#DC2626"
                  : Palette.textMuted
              }
            />
          </View>
          <Text
            style={[
              styles.kpiValue,
              (metrics.delayed > 0 || delayedAppointments.length > 0) && {
                color: "#DC2626",
              },
            ]}
          >
            {metrics.delayed || delayedAppointments.length}
          </Text>
          <Text
            style={[
              styles.kpiLabel,
              (metrics.delayed > 0 || delayedAppointments.length > 0) && {
                color: "#991B1B",
              },
            ]}
          >
            Delayed Visits
          </Text>
          <Text style={styles.kpiSub}>&gt;20m past slot</Text>
        </Pressable>

        {/* 9. In-Clinic Visits */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("clinic")}
          style={[
            styles.kpiCard,
            activeTab === "clinic" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#F0FDF4" }]}>
            <Ionicons name="business" size={20} color="#15803D" />
          </View>
          <Text style={styles.kpiValue}>{metrics.inPerson}</Text>
          <Text style={styles.kpiLabel}>In-Clinic</Text>
          <Text style={styles.kpiSub}>Physical visits</Text>
        </Pressable>

        {/* 10. Video Consultations */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("video")}
          style={[
            styles.kpiCard,
            activeTab === "video" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#F3E8FF" }]}>
            <Ionicons name="videocam" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.kpiValue}>
            {metrics.online || metrics.videoCount}
          </Text>
          <Text style={styles.kpiLabel}>Video Calls</Text>
          <Text style={styles.kpiSub}>Google Meet visits</Text>
        </Pressable>

        {/* 11. Cancelled / Missed */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("cancelled")}
          style={[
            styles.kpiCard,
            activeTab === "cancelled" && styles.kpiCardActive,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#FEE2E2" }]}>
            <Ionicons name="close-circle" size={20} color="#DC2626" />
          </View>
          <Text style={styles.kpiValue}>{metrics.cancelled}</Text>
          <Text style={styles.kpiLabel}>Cancelled / Missed</Text>
          <Text style={styles.kpiSub}>No-shows & releases</Text>
        </Pressable>

        {/* 12. Care Plans / Follow-Ups */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab("all")}
          style={[
            styles.kpiCard,
            isDesktop && styles.kpiCardDesktop,
            isTablet && styles.kpiCardTablet,
          ]}
        >
          <View style={[styles.kpiIconWrap, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="refresh" size={20} color="#D97706" />
          </View>
          <Text style={styles.kpiValue}>{metrics.followUpsAdvised}</Text>
          <Text style={styles.kpiLabel}>Care Plans</Text>
          <Text style={styles.kpiSub}>Follow-ups advised</Text>
        </Pressable>
      </View>

      {/* ----------------- SMART ALERTS SECTION ----------------- */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons
            name="notifications-circle"
            size={20}
            color={Palette.primary}
          />
          <Text style={styles.sectionHeading}>
            Real-Time Operational Alerts
          </Text>
          {smartAlerts.length > 0 ? (
            <Badge
              label={`${smartAlerts.length} Active`}
              variant={
                smartAlerts.some((a) => a.severity === "CRITICAL")
                  ? "error"
                  : "warning"
              }
            />
          ) : null}
        </View>

        {smartAlerts.length > 0 ? (
          <View style={styles.alertsList}>
            {smartAlerts.map((alert) => (
              <View
                key={alert.id}
                style={[
                  styles.alertItem,
                  alert.severity === "CRITICAL" && styles.alertItemError,
                  alert.severity === "WARNING" && styles.alertItemWarning,
                  alert.severity === "INFO" && styles.alertItemInfo,
                ]}
              >
                <Ionicons
                  name={
                    alert.severity === "CRITICAL"
                      ? "alert-circle"
                      : alert.severity === "WARNING"
                        ? "warning"
                        : "information-circle"
                  }
                  size={20}
                  color={
                    alert.severity === "CRITICAL"
                      ? Palette.error
                      : alert.severity === "WARNING"
                        ? "#D97706"
                        : Palette.primaryDark
                  }
                />
                <View style={styles.alertTexts}>
                  <View style={styles.alertHeaderRow}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    <Badge
                      label={alert.severity}
                      variant={
                        alert.severity === "CRITICAL"
                          ? "error"
                          : alert.severity === "WARNING"
                            ? "warning"
                            : "primary"
                      }
                    />
                  </View>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  {alert.actionRoute && alert.actionLabel ? (
                    <Pressable
                      style={styles.alertActionBtn}
                      onPress={() => {
                        if (alert.actionRoute?.includes("status=delayed")) {
                          setActiveTab("delayed");
                        } else if (
                          alert.actionRoute?.includes("status=pending")
                        ) {
                          setActiveTab("pending");
                        } else if (alert.actionRoute) {
                          router.push(alert.actionRoute as never);
                        }
                      }}
                    >
                      <Text style={styles.alertActionBtnText}>
                        {alert.actionLabel} →
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Card padded style={styles.normalStateCard}>
            <Ionicons name="shield-checkmark" size={24} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={styles.normalStateTitle}>All Operations Normal</Text>
              <Text style={styles.normalStateSub}>
                Zero queues overflowing, no delays or schedule conflicts
                detected.
              </Text>
            </View>
          </Card>
        )}
      </View>

      {/* ----------------- CAPACITY & RESOURCE INTELLIGENCE SECTION ----------------- */}
      <CapacityIntelligenceSection
        todayAppointments={todayAppointments}
        upcomingAppointments={upcomingAppointments}
        doctors={doctors}
        departments={departments}
        consultationStats={consultationStats}
      />

      {/* ----------------- QUEUE CENTER SECTION ----------------- */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="list" size={20} color={Palette.primary} />
          <Text style={styles.sectionHeading}>Live OPD Queue Center</Text>
          <Badge
            label={`${metrics.waitingQueue} in line`}
            variant={metrics.waitingQueue > 0 ? "warning" : "neutral"}
          />
        </View>

        {doctorOperationalList.filter((d) => d.todayAppointmentsCount > 0)
          .length === 0 ? (
          <Card padded style={styles.emptyQueueCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={32}
              color={Palette.textMuted}
            />
            <Text style={styles.emptyQueueTitle}>Queue is Clear</Text>
            <Text style={styles.emptyQueueSub}>
              No doctors currently have active OPD queues scheduled for today.
            </Text>
          </Card>
        ) : (
          <View style={styles.queueGrid}>
            {doctorOperationalList
              .filter((d) => d.todayAppointmentsCount > 0)
              .map((item) => {
                const docName = formatDoctorName(item.doctor.name);
                const dept =
                  item.doctor.speciality || item.doctor.department || "OPD";
                const liveDoc = backendData?.liveQueue?.find(
                  (q) => String(q.doctorId) === String(item.doctor._id),
                );

                return (
                  <Card
                    key={String(item.doctor._id)}
                    padded
                    style={styles.queueDoctorCard}
                  >
                    <View style={styles.queueCardHeader}>
                      <View style={styles.queueDoctorAvatar}>
                        <Ionicons
                          name="person"
                          size={20}
                          color={Palette.primary}
                        />
                      </View>
                      <View style={styles.queueDoctorInfo}>
                        <Text style={styles.queueDoctorName} numberOfLines={1}>
                          {docName}
                        </Text>
                        <Text style={styles.queueDoctorDept} numberOfLines={1}>
                          {dept}
                        </Text>
                      </View>
                      <Badge
                        label={
                          item.status === "in_consultation"
                            ? "Consulting"
                            : item.status === "available"
                              ? "Ready"
                              : item.status === "on_leave"
                                ? "On Leave"
                                : "Offline"
                        }
                        variant={
                          item.status === "in_consultation"
                            ? "primary"
                            : item.status === "available"
                              ? "success"
                              : "neutral"
                        }
                      />
                    </View>

                    <View style={styles.queueDivider} />

                    {/* Serving Patient Block */}
                    <View style={styles.queueServingRow}>
                      <View style={styles.queueServingLeft}>
                        <Text style={styles.queueMicroLabel}>
                          CURRENT CONSULTATION
                        </Text>
                        {item.activePatient ? (
                          <View style={styles.tokenBadgeRow}>
                            <View style={styles.tokenPillActive}>
                              <Text style={styles.tokenPillText}>
                                {item.activePatient.queueToken
                                  ? `Token #${item.activePatient.queueToken}`
                                  : "In Room"}
                              </Text>
                            </View>
                            <Text
                              style={styles.queuePatientName}
                              numberOfLines={1}
                            >
                              {appointmentPatientName(item.activePatient)}
                            </Text>
                          </View>
                        ) : (
                          <Text style={styles.queueNoActive}>
                            Consultation room vacant
                          </Text>
                        )}
                      </View>
                      <View style={styles.queueWaitingBadgeWrap}>
                        <Text style={styles.queueWaitingCount}>
                          {item.waitingCount}
                        </Text>
                        <Text style={styles.queueWaitingText}>Waiting</Text>
                      </View>
                    </View>

                    {/* Next in line or Live Waiting Line */}
                    {liveDoc && liveDoc.waitingList && liveDoc.waitingList.length > 0 ? (
                      <View style={styles.waitingQueueListWrap}>
                        <Text style={styles.queueWaitingListHeader}>
                          WAITING IN LINE ({liveDoc.waitingList.length})
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.waitingTokensRow}
                        >
                          {liveDoc.waitingList.map((wp) => (
                            <View
                              key={wp._id}
                              style={[
                                styles.waitingTokenChip,
                                wp.isDelayed && styles.waitingTokenChipDelayed,
                              ]}
                            >
                              <View style={styles.waitingTokenTopRow}>
                                <Text
                                  style={[
                                    styles.waitingTokenNum,
                                    wp.isDelayed && { color: "#DC2626" },
                                  ]}
                                >
                                  {wp.queueToken ? `#${wp.queueToken}` : "Queue"}
                                </Text>
                                <Text
                                  style={[
                                    styles.waitingTokenDuration,
                                    wp.isDelayed && { color: "#DC2626" },
                                  ]}
                                >
                                  {wp.waitMinutes > 0
                                    ? `${wp.waitMinutes}m`
                                    : "just in"}
                                  {wp.isDelayed ? " ⏱" : ""}
                                </Text>
                              </View>
                              <Text
                                style={styles.waitingTokenPatient}
                                numberOfLines={1}
                              >
                                {wp.patientName}
                              </Text>
                              <Text style={styles.waitingTokenSlot} numberOfLines={1}>
                                {wp.slotTime}
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                      </View>
                    ) : item.nextPatient ? (
                      <View style={styles.nextPatientStrip}>
                        <Ionicons
                          name="arrow-forward-circle"
                          size={16}
                          color={Palette.primary}
                        />
                        <Text style={styles.nextPatientLabel}>Next:</Text>
                        <Text style={styles.nextPatientName} numberOfLines={1}>
                          {appointmentPatientName(item.nextPatient)}
                        </Text>
                        {item.nextPatient.queueToken ? (
                          <Text style={styles.nextPatientToken}>
                            (#{item.nextPatient.queueToken})
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
          </View>
        )}
      </View>

      {/* ----------------- APPOINTMENT OPERATIONS ----------------- */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="calendar-outline" size={20} color={Palette.primary} />
          <Text style={styles.sectionHeading}>
            {"Today's Appointment Operations"}
          </Text>
          <Text style={styles.sectionCountText}>
            ({filteredAppointments.length})
          </Text>
        </View>

        {/* Tab Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {(
            [
              { key: "all", label: "All Today" },
              { key: "waiting", label: "Waiting Queue" },
              { key: "in_consultation", label: "In Consultation" },
              { key: "checked_in", label: "Checked In" },
              { key: "confirmed", label: "Confirmed" },
              { key: "pending", label: "Pending" },
              { key: "clinic", label: "In-Clinic" },
              { key: "video", label: "Video Visits" },
              { key: "completed", label: "Completed" },
              { key: "cancelled", label: "Cancelled" },
              ...(metrics.delayed > 0 || delayedAppointments.length > 0
                ? [
                    {
                      key: "delayed" as OperationalTab,
                      label: `Delayed (${metrics.delayed || delayedAppointments.length})`,
                    },
                  ]
                : []),
            ] as { key: OperationalTab; label: string }[]
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabChip, active && styles.tabChipActive]}
              >
                <Text
                  style={[
                    styles.tabChipText,
                    active && styles.tabChipTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Search & Department Filters */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color={Palette.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patient, doctor, token, reference..."
              placeholderTextColor={Palette.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={Palette.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Operational Appointment List */}
        {filteredAppointments.length === 0 ? (
          <EmptyState
            title="No appointments matching filters"
            message="No appointment operations currently meet this selection criteria."
          />
        ) : (
          <View style={styles.appointmentsList}>
            {filteredAppointments.map((appt) => {
              const payment = appointmentPayment(appt);
              const pName = appointmentPatientName(appt);
              const dName = formatDoctorName(appointmentDoctorName(appt));
              const dept = appointmentDepartment(appt);
              const isVideo = appt.consultationType === "video";
              const isChecked = appt.checkedIn || Boolean(appt.checkInAt);
              const isConsulting =
                appt.queueStatus === "in_consultation" ||
                appt.consultationStatus === "in_progress";
              const delayMins = delayedMap.get(String(appt._id));

              return (
                <Pressable
                  key={String(appt._id)}
                  accessibilityRole="button"
                  onPress={() => setSelectedAppointment(appt)}
                >
                  <Card padded style={styles.apptOpCard}>
                    {/* Header: Ref + Mode + Time */}
                    <View style={styles.apptCardTop}>
                      <View style={styles.apptTopLeft}>
                        <Text style={styles.apptRef}>
                          {appointmentReference(appt)}
                        </Text>
                        <View
                          style={[
                            styles.apptModePill,
                            isVideo && { backgroundColor: "#F3E8FF" },
                          ]}
                        >
                          <Ionicons
                            name={isVideo ? "videocam" : "business"}
                            size={12}
                            color={isVideo ? "#7C3AED" : Palette.primaryDark}
                          />
                          <Text
                            style={[
                              styles.apptModeText,
                              isVideo && { color: "#7C3AED" },
                            ]}
                          >
                            {isVideo ? "Video" : "Clinic"}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.apptTimeWrap}>
                        <Ionicons
                          name="time-outline"
                          size={14}
                          color={Palette.primaryDark}
                        />
                        <Text style={styles.apptTime}>
                          {appt.slotTime || "Scheduled"}
                        </Text>
                      </View>
                    </View>

                    {/* Patient and Doctor */}
                    <View style={styles.apptPeopleRow}>
                      <View style={styles.apptPersonBlock}>
                        <Text style={styles.microLabel}>PATIENT</Text>
                        <Text style={styles.personTitle} numberOfLines={1}>
                          {pName}
                        </Text>
                        <Text style={styles.personSub} numberOfLines={1}>
                          {appt.patientPhone || "No phone listed"}
                        </Text>
                      </View>
                      <View style={styles.apptPersonBlock}>
                        <Text style={styles.microLabel}>DOCTOR</Text>
                        <Text style={styles.personTitle} numberOfLines={1}>
                          {dName}
                        </Text>
                        <Text style={styles.personSub} numberOfLines={1}>
                          {dept || "General Medicine"}
                        </Text>
                      </View>
                    </View>

                    {/* Operational Badges: Check-In, Queue Token, Delayed, Payment, Status */}
                    <View style={styles.apptBadgesRow}>
                      {/* Delayed Alert Pill */}
                      {typeof delayMins === "number" ? (
                        <View style={styles.badgeDelayed}>
                          <Ionicons
                            name="alert-circle"
                            size={12}
                            color="#DC2626"
                          />
                          <Text style={styles.badgeDelayedText}>
                            Delayed {delayMins}m
                          </Text>
                        </View>
                      ) : null}

                      {/* Check-In status */}
                      {isChecked ? (
                        <View style={styles.badgeCheckedIn}>
                          <Ionicons
                            name="checkmark-circle"
                            size={13}
                            color="#059669"
                          />
                          <Text style={styles.badgeCheckedInText}>
                            Checked In
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.badgeNotCheckedIn}>
                          <Ionicons
                            name="time-outline"
                            size={13}
                            color={Palette.textMuted}
                          />
                          <Text style={styles.badgeNotCheckedInText}>
                            Not Checked In
                          </Text>
                        </View>
                      )}

                      {/* Token status if in queue */}
                      {appt.queueToken ? (
                        <View
                          style={[
                            styles.badgeToken,
                            isConsulting && { backgroundColor: "#7C3AED" },
                          ]}
                        >
                          <Text style={styles.badgeTokenText}>
                            Token #{appt.queueToken}
                          </Text>
                        </View>
                      ) : null}

                      {/* Payment */}
                      <StatusBadge
                        value={payment.label}
                        variant={appointmentPaymentBadge(payment.status)}
                      />

                      {/* Booking status */}
                      <StatusBadge
                        value={appt.status}
                        variant={appointmentStatusBadge(appt.status)}
                      />
                    </View>

                    {/* Quick Reception & Telehealth Action Row */}
                    {(appt.status === "confirmed" && !isChecked) ||
                    (isVideo && appt.meetingUrl) ? (
                      <View style={styles.apptCardQuickActions}>
                        {appt.status === "confirmed" && !isChecked ? (
                          <Pressable
                            accessibilityRole="button"
                            disabled={checkingInId === String(appt._id)}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              void handleDirectCheckIn(appt);
                            }}
                            style={[
                              styles.cardCheckInBtn,
                              checkingInId === String(appt._id) &&
                                styles.cardCheckInBtnDisabled,
                            ]}
                          >
                            {checkingInId === String(appt._id) ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <>
                                <Ionicons
                                  name="log-in-outline"
                                  size={14}
                                  color="#fff"
                                />
                                <Text style={styles.cardCheckInBtnText}>
                                  Check In to OPD
                                </Text>
                              </>
                            )}
                          </Pressable>
                        ) : null}

                        {isVideo && appt.meetingUrl ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={(e) => {
                              e.stopPropagation?.();
                              if (appt.meetingUrl) {
                                openGoogleMeetUrl(appt.meetingUrl);
                              }
                            }}
                            style={styles.cardMeetBtn}
                          >
                            <Ionicons
                              name="videocam-outline"
                              size={14}
                              color="#fff"
                            />
                            <Text style={styles.cardMeetBtnText}>
                              Launch Video
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* ----------------- DOCTOR AVAILABILITY & DEPARTMENT LOAD ----------------- */}
      <View style={[styles.splitGrid, isDesktop && styles.splitGridDesktop]}>
        {/* DOCTOR AVAILABILITY */}
        <View style={styles.splitCol}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="people-outline" size={20} color={Palette.primary} />
            <Text style={styles.sectionHeading}>Doctor Operational Status</Text>
            <Pressable
              onPress={() => router.push("/admin/doctor-availability" as never)}
              style={styles.headerActionBtn}
            >
              <Text style={styles.headerActionText}>Manage →</Text>
            </Pressable>
          </View>
          <Card padded style={styles.panelCard}>
            {doctors.length === 0 ? (
              <Text style={styles.emptyText}>
                No registered doctors in hospital.
              </Text>
            ) : (
              doctors.map((doc) => {
                const docId = String(doc._id);
                const isAvail =
                  doc.available !== false && doc.isActive !== false;
                const dName = formatDoctorName(doc.name);

                return (
                  <View key={docId} style={styles.docAvailRow}>
                    <View style={styles.docAvailInfo}>
                      <Text style={styles.docAvailName} numberOfLines={1}>
                        {dName}
                      </Text>
                      <Text style={styles.docAvailDept} numberOfLines={1}>
                        {doc.speciality || doc.department || "Medical Staff"}
                      </Text>
                    </View>
                    <View style={styles.docAvailAction}>
                      <Switch
                        value={isAvail}
                        onValueChange={(val) => handleToggleDoctor(doc, val)}
                        disabled={togglingDoctorId === docId}
                        trackColor={{
                          false: Palette.border,
                          true: Palette.primary,
                        }}
                        thumbColor={Palette.white}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </View>

        {/* DEPARTMENT ACTIVITY LOAD */}
        <View style={styles.splitCol}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="layers-outline" size={20} color={Palette.primary} />
            <Text style={styles.sectionHeading}>Department Workload</Text>
            <Pressable
              onPress={() => router.push("/admin/departments" as never)}
              style={styles.headerActionBtn}
            >
              <Text style={styles.headerActionText}>View All →</Text>
            </Pressable>
          </View>
          <Card padded style={styles.panelCard}>
            {departmentSummaries.length === 0 ? (
              <Text style={styles.emptyText}>
                No active departments configured.
              </Text>
            ) : (
              departmentSummaries.map((dept) => {
                const percent =
                  metrics.total > 0
                    ? Math.round((dept.totalToday / metrics.total) * 100)
                    : 0;

                return (
                  <View key={dept.name} style={styles.deptLoadItem}>
                    <View style={styles.deptLoadTop}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.deptLoadName} numberOfLines={1}>
                          {dept.name}
                        </Text>
                        <Text style={styles.deptLoadSub}>
                          {dept.availableDoctorsCount}/
                          {dept.assignedDoctorsCount} Doctors Available ·{" "}
                          {dept.waitingCount} Waiting
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 2 }}>
                        <Badge
                          label={dept.loadState}
                          variant={dept.loadVariant}
                        />
                        <Text style={styles.deptLoadStats}>
                          {dept.totalToday} visit
                          {dept.totalToday === 1 ? "" : "s"} ({percent}%)
                        </Text>
                      </View>
                    </View>
                    <View style={styles.deptLoadBarTrack}>
                      <View
                        style={[
                          styles.deptLoadBarFill,
                          { width: `${Math.min(percent, 100)}%` },
                          dept.loadState === "High Load" && {
                            backgroundColor: "#DC2626",
                          },
                          dept.loadState === "Busy" && {
                            backgroundColor: "#D97706",
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </Card>
        </View>
      </View>

      {/* ----------------- RECENT OPERATIONAL ACTIVITY TIMELINE ----------------- */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="time-outline" size={20} color={Palette.primary} />
          <Text style={styles.sectionHeading}>Recent Operational Activity</Text>
          <Badge
            label={`${recentActivities.length} Events`}
            variant="neutral"
          />
        </View>
        <Card padded style={styles.activityCard}>
          {recentActivities.length === 0 ? (
            <View style={styles.emptyActivityBox}>
              <Ionicons
                name="hourglass-outline"
                size={28}
                color={Palette.textMuted}
              />
              <Text style={styles.emptyActivityTitle}>
                No operational activity recorded today yet
              </Text>
              <Text style={styles.emptyActivitySub}>
                Patient check-ins and consultation status updates will appear
                here in real-time.
              </Text>
            </View>
          ) : (
            <View style={styles.activityTimelineList}>
              {recentActivities.slice(0, 10).map((act, index) => (
                <View key={act.id} style={styles.activityItemRow}>
                  <View style={styles.activityTimeCol}>
                    <Text style={styles.activityTimeText}>{act.timeText}</Text>
                  </View>
                  <View style={styles.activityIconCol}>
                    <View
                      style={[
                        styles.activityIconDot,
                        act.variant === "success" && {
                          backgroundColor: "#059669",
                        },
                        act.variant === "primary" && {
                          backgroundColor: "#0284C7",
                        },
                        act.variant === "warning" && {
                          backgroundColor: "#D97706",
                        },
                        act.variant === "error" && {
                          backgroundColor: Palette.error,
                        },
                      ]}
                    >
                      <Ionicons name={act.icon} size={13} color="#fff" />
                    </View>
                    {index < Math.min(recentActivities.length, 10) - 1 ? (
                      <View style={styles.activityLine} />
                    ) : null}
                  </View>
                  <View style={styles.activityBodyCol}>
                    <Text style={styles.activityTitleText}>{act.title}</Text>
                    <Text style={styles.activitySubText}>{act.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      </View>

      {/* ----------------- QUICK ADMINISTRATIVE SHORTCUTS ----------------- */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="grid-outline" size={20} color={Palette.primary} />
          <Text style={styles.sectionHeading}>Administrative Shortcuts</Text>
        </View>
        <View style={styles.shortcutsGrid}>
          {[
            {
              label: "Appointments",
              icon: "calendar-outline" as const,
              route: "/admin/appointments",
              color: "#0E9F8E",
            },
            {
              label: "Staff Doctors",
              icon: "medkit-outline" as const,
              route: "/admin/doctors",
              color: "#2F80ED",
            },
            {
              label: "Doctor Verification",
              icon: "shield-checkmark-outline" as const,
              route: "/admin/doctor-verification",
              color: "#059669",
            },
            {
              label: "Slot Scheduling",
              icon: "time-outline" as const,
              route: "/admin/slots",
              color: "#7B61FF",
            },
            {
              label: "Departments",
              icon: "layers-outline" as const,
              route: "/admin/departments",
              color: "#E89A3C",
            },
            {
              label: "Consultations",
              icon: "videocam-outline" as const,
              route: "/admin/consultations",
              color: "#7C3AED",
            },
            {
              label: "Earnings",
              icon: "cash-outline" as const,
              route: "/admin/earnings",
              color: "#10B981",
            },
            {
              label: "Settings",
              icon: "settings-outline" as const,
              route: "/admin/settings",
              color: "#6B7280",
            },
          ].map((item) => (
            <Pressable
              key={item.route}
              accessibilityRole="button"
              onPress={() => router.push(item.route as never)}
              style={styles.shortcutCard}
            >
              <View
                style={[
                  styles.shortcutIconWrap,
                  { backgroundColor: `${item.color}15` },
                ]}
              >
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.shortcutLabel} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* ----------------- MODALS ----------------- */}
      {/* 1. Appointment Details Modal */}
      {selectedAppointment ? (
        <AppointmentDetailsModal
          visible={Boolean(selectedAppointment)}
          appointment={selectedAppointment}
          actions={detailActions}
          onClose={() => setSelectedAppointment(null)}
        />
      ) : null}

      {/* 2. Reschedule Modal */}
      {rescheduleAppointment ? (
        <RescheduleModal
          visible={Boolean(rescheduleAppointment)}
          appointment={rescheduleAppointment}
          onClose={() => setRescheduleAppointment(null)}
          onSubmit={handleRescheduleSubmit}
        />
      ) : null}

      {/* 3. Cancel Confirmation Modal */}
      {cancelTarget ? (
        <Modal
          visible={Boolean(cancelTarget)}
          transparent
          animationType="fade"
          onRequestClose={() => setCancelTarget(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="warning" size={28} color={Palette.error} />
              </View>
              <Text style={styles.modalTitle}>Cancel Appointment?</Text>
              <Text style={styles.modalSub}>
                Cancelling {appointmentReference(cancelTarget)} for{" "}
                {appointmentPatientName(cancelTarget)}. The slot will be
                released.
              </Text>

              {cancelError ? (
                <FormMessage type="error" message={cancelError} />
              ) : null}

              <TextInput
                style={styles.cancelInput}
                placeholder="Reason for cancellation (required)..."
                placeholderTextColor={Palette.textMuted}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
                numberOfLines={3}
              />

              <View style={styles.modalBtnRow}>
                <Button
                  title="Keep Booking"
                  variant="outline"
                  onPress={() => setCancelTarget(null)}
                  disabled={cancelling}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Confirm Cancel"
                  variant="danger"
                  onPress={handleCancelSubmit}
                  loading={cancelling}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* 4. Reception Quick Check-In Modal */}
      {quickCheckInVisible ? (
        <Modal
          visible={quickCheckInVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQuickCheckInVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.quickCheckInCard}>
              <View style={styles.quickCheckInHeader}>
                <View style={styles.quickCheckInTitleRow}>
                  <View style={styles.quickCheckInIconWrap}>
                    <Ionicons
                      name="qr-code-outline"
                      size={22}
                      color={Palette.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickCheckInTitle}>
                      Reception OPD Check-In
                    </Text>
                    <Text style={styles.quickCheckInSub}>
                      Enter Appointment ID, Reference, or QR Scan code
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setQuickCheckInVisible(false)}
                    hitSlop={8}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color={Palette.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              {quickCheckInError ? (
                <View
                  style={{
                    paddingHorizontal: Spacing.md,
                    paddingTop: Spacing.sm,
                  }}
                >
                  <FormMessage type="error" message={quickCheckInError} />
                </View>
              ) : null}

              <View style={styles.quickCheckInBody}>
                <Text style={styles.quickCheckInInputLabel}>
                  APPOINTMENT REFERENCE OR CODE
                </Text>
                <TextInput
                  style={styles.quickCheckInInput}
                  placeholder="e.g. APT-260324-1234 or MongoDB ID"
                  placeholderTextColor={Palette.textMuted}
                  value={quickReferenceInput}
                  onChangeText={setQuickReferenceInput}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />

                <View style={styles.quickHintBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={Palette.primary}
                  />
                  <Text style={styles.quickHintText}>
                    Directly verifies hospital booking, sets status to Checked In, and assigns a sequential OPD queue token (e.g. A-001) for the doctor.
                  </Text>
                </View>
              </View>

              <View style={styles.quickCheckInFooter}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setQuickCheckInVisible(false)}
                  disabled={quickCheckInLoading}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Verify & Check In"
                  variant="primary"
                  onPress={handleQuickCheckInSubmit}
                  loading={quickCheckInLoading}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: "center",
  },
  stateContainer: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.lg,
  },

  // Top live bar
  topLiveBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Palette.surface,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  topLiveLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#059669",
  },
  topLiveTitle: {
    ...Typography.caption,
    fontWeight: "800",
    color: Palette.text,
    letterSpacing: 0.5,
  },
  topStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  topLiveSub: {
    ...Typography.bodySmall,
    color: Palette.text,
    fontWeight: "700",
  },
  topLiveMeta: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  topLiveRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  receptionCheckInBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.md,
  },
  receptionCheckInText: {
    ...Typography.caption,
    color: Palette.white,
    fontWeight: "700",
  },
  topLiveSyncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  topLiveTimestamp: {
    fontSize: 11,
    color: Palette.primaryDark,
    fontWeight: "600",
  },

  // KPI Cards
  kpiContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  kpiCard: {
    width: "47%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    gap: 2,
    ...Shadows.card,
  },
  kpiCardActive: {
    borderColor: Palette.primary,
    borderWidth: 2,
  },
  kpiCardTablet: {
    width: "31%",
  },
  kpiCardDesktop: {
    width: "15.2%",
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiValue: {
    ...Typography.h2,
    fontSize: 22,
    fontWeight: "800",
    color: Palette.text,
  },
  kpiLabel: {
    ...Typography.label,
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
  },
  kpiSub: {
    fontSize: 10,
    color: Palette.textMuted,
  },

  // Sections
  sectionBlock: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sectionHeading: {
    ...Typography.h4,
    fontSize: 15,
    fontWeight: "800",
    color: Palette.text,
    flex: 1,
  },
  sectionCountText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.textMuted,
  },

  // Alerts
  alertsList: {
    gap: Spacing.xs,
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  alertItemError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
  },
  alertItemWarning: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
  },
  alertItemInfo: {
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
  },
  alertTexts: {
    flex: 1,
    gap: 2,
  },
  alertHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.xs,
  },
  alertTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  alertMessage: {
    ...Typography.caption,
    color: Palette.textMuted,
    lineHeight: 16,
  },
  alertActionBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: Palette.primaryDark,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.xs,
  },
  alertActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.white,
  },
  normalStateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  normalStateTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: "#065F46",
  },
  normalStateSub: {
    ...Typography.caption,
    color: "#047857",
  },

  // Queue Center
  emptyQueueCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  emptyQueueTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  emptyQueueSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  queueGrid: {
    gap: Spacing.sm,
  },
  queueDoctorCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.xs,
    ...Shadows.card,
  },
  queueCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  queueDoctorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  queueDoctorInfo: {
    flex: 1,
    gap: 1,
  },
  queueDoctorName: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  queueDoctorDept: {
    ...Typography.caption,
    color: Palette.primaryDark,
  },
  queueDivider: {
    height: 1,
    backgroundColor: Palette.divider,
    marginVertical: 4,
  },
  queueServingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueServingLeft: {
    flex: 1,
    gap: 2,
  },
  queueMicroLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  tokenBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: 2,
  },
  tokenPillActive: {
    backgroundColor: "#059669",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  tokenPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.white,
  },
  queuePatientName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
  },
  queueNoActive: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
  },
  queueWaitingBadgeWrap: {
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "#FCD34D",
    minWidth: 54,
  },
  queueWaitingCount: {
    fontSize: 16,
    fontWeight: "800",
    color: "#92400E",
  },
  queueWaitingText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#92400E",
  },
  nextPatientStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(14, 159, 142, 0.06)",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: 2,
  },
  nextPatientLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  nextPatientName: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.text,
    flex: 1,
  },
  nextPatientToken: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.primaryDark,
  },

  // Tabs & Search
  tabBarScroll: {
    gap: Spacing.xs,
    paddingVertical: 2,
  },
  tabChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  tabChipActive: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  tabChipText: {
    ...Typography.caption,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  tabChipTextActive: {
    color: Palette.white,
    fontWeight: "700",
  },
  searchRow: {
    marginTop: 2,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: Spacing.sm,
    height: 40,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: Palette.text,
  },

  // Appointment operations cards
  appointmentsList: {
    gap: Spacing.sm,
  },
  apptOpCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  apptCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  apptTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  apptRef: {
    ...Typography.caption,
    fontWeight: "800",
    color: Palette.text,
  },
  apptModePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  apptModeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  apptTimeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  apptTime: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.primaryDark,
  },
  apptPeopleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  apptPersonBlock: {
    flex: 1,
    gap: 1,
  },
  microLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  personTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: Palette.text,
  },
  personSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  apptBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  badgeCheckedIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeCheckedInText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  badgeNotCheckedIn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Palette.border,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeNotCheckedInText: {
    fontSize: 11,
    fontWeight: "600",
    color: Palette.textMuted,
  },
  badgeToken: {
    backgroundColor: Palette.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeTokenText: {
    fontSize: 11,
    fontWeight: "800",
    color: Palette.white,
  },
  badgeDelayed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
  badgeDelayedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
  },

  // Split Panel
  splitGrid: {
    gap: Spacing.md,
  },
  splitGridDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  splitCol: {
    flex: 1,
    gap: Spacing.sm,
  },
  panelCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  emptyText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontStyle: "italic",
    padding: Spacing.sm,
  },

  // Doctor Avail row
  docAvailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  docAvailInfo: {
    flex: 1,
    gap: 1,
  },
  docAvailName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  docAvailDept: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  docAvailAction: {
    marginLeft: Spacing.sm,
  },

  // Department load
  deptLoadItem: {
    gap: 4,
    paddingVertical: 4,
  },
  deptLoadTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deptLoadName: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  deptLoadStats: {
    ...Typography.caption,
    color: Palette.primaryDark,
    fontWeight: "600",
  },
  deptLoadBarTrack: {
    height: 6,
    backgroundColor: Palette.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  deptLoadBarFill: {
    height: "100%",
    backgroundColor: Palette.primary,
    borderRadius: 3,
  },
  headerActionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.primary,
  },
  deptLoadSub: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontSize: 11,
  },

  // Activity timeline
  activityCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.md,
    ...Shadows.card,
  },
  emptyActivityBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    gap: 4,
  },
  emptyActivityTitle: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  emptyActivitySub: {
    ...Typography.caption,
    color: Palette.textMuted,
    textAlign: "center",
  },
  activityTimelineList: {
    gap: Spacing.md,
  },
  activityItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  activityTimeCol: {
    width: 65,
  },
  activityTimeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  activityIconCol: {
    alignItems: "center",
    width: 24,
  },
  activityIconDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  activityLine: {
    width: 2,
    flex: 1,
    minHeight: 24,
    backgroundColor: Palette.divider,
    marginVertical: 2,
  },
  activityBodyCol: {
    flex: 1,
    gap: 1,
  },
  activityTitleText: {
    ...Typography.bodySmall,
    fontWeight: "700",
    color: Palette.text,
  },
  activitySubText: {
    ...Typography.caption,
    color: Palette.textMuted,
  },

  // Quick shortcuts grid
  shortcutsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  shortcutCard: {
    width: "48%",
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadows.card,
  },
  shortcutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: {
    flex: 1,
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(9, 20, 18, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.lg,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  modalTitle: {
    ...Typography.h3,
    textAlign: "center",
    color: Palette.text,
  },
  modalSub: {
    ...Typography.bodySmall,
    textAlign: "center",
    color: Palette.textMuted,
    lineHeight: 18,
  },
  cancelInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    ...Typography.bodySmall,
    color: Palette.text,
    minHeight: 70,
    textAlignVertical: "top",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  // Live waiting queue list in doctor card
  waitingQueueListWrap: {
    marginTop: Spacing.xs,
    gap: 4,
  },
  queueWaitingListHeader: {
    fontSize: 9,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  waitingTokensRow: {
    gap: 6,
    paddingVertical: 2,
  },
  waitingTokenChip: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 110,
    gap: 1,
  },
  waitingTokenChipDelayed: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  waitingTokenTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  waitingTokenNum: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.primaryDark,
  },
  waitingTokenDuration: {
    fontSize: 9,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  waitingTokenPatient: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.text,
  },
  waitingTokenSlot: {
    fontSize: 9,
    color: Palette.textMuted,
  },

  // Appointment Card Quick Actions
  apptCardQuickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Palette.divider,
  },
  cardCheckInBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#059669",
    paddingVertical: 7,
    borderRadius: Radius.md,
  },
  cardCheckInBtnDisabled: {
    opacity: 0.6,
  },
  cardCheckInBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.white,
  },
  cardMeetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#7C3AED",
    paddingVertical: 7,
    borderRadius: Radius.md,
  },
  cardMeetBtnText: {
    ...Typography.caption,
    fontWeight: "700",
    color: Palette.white,
  },

  // Quick Check-In Reception Modal
  quickCheckInCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.lg,
  },
  quickCheckInHeader: {
    gap: Spacing.xs,
  },
  quickCheckInTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  quickCheckInIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickCheckInTitle: {
    ...Typography.h3,
    color: Palette.text,
  },
  quickCheckInSub: {
    ...Typography.caption,
    color: Palette.textMuted,
  },
  modalCloseBtn: {
    padding: Spacing.xs,
  },
  quickCheckInBody: {
    gap: Spacing.sm,
  },
  quickCheckInInputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Palette.textMuted,
    letterSpacing: 0.5,
  },
  quickCheckInInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.bodyMedium,
    color: Palette.text,
    backgroundColor: Palette.surfaceAlt,
    minHeight: 44,
  },
  quickHintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(14, 159, 142, 0.08)",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
  },
  quickHintText: {
    ...Typography.caption,
    color: Palette.primaryDark,
    flex: 1,
    lineHeight: 16,
  },
  quickCheckInFooter: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
});
