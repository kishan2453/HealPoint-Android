/**
 * HealPoint — Smart Hospital Digital Command & Resource Management Intelligence Engine.
 *
 * Deterministic hospital-level operations evaluation derived strictly from real,
 * authenticated, hospital-scoped appointments, doctors, queues, and departments.
 *
 * Strict safety rules:
 * - NO fake metrics, placeholder numbers, or invented patient severity.
 * - All operational states are derived purely from real administrative metrics.
 * - If physical beds/rooms are not configured, transparently reports "Resource capacity data not configured".
 */
import { Ionicons } from "@expo/vector-icons";
import type {
  Appointment,
  Doctor,
  HospitalDepartment,
} from "@/types";
import {
  appointmentDepartment,
  appointmentDoctorName,
  appointmentPatientName,
  appointmentReference,
} from "@/lib/appointments";
import { formatDoctorName } from "@/lib/format";

export type HospitalOperationalState =
  | "OPERATIONAL"
  | "BUSY"
  | "HIGH LOAD"
  | "DELAYED"
  | "LIMITED AVAILABILITY";

export type OperationalAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface OperationalAlert {
  id: string;
  severity: OperationalAlertSeverity;
  title: string;
  message: string;
  count?: number;
  actionRoute?: string;
  actionLabel?: string;
}

export interface DelayedAppointmentItem {
  id: string;
  appointment: Appointment;
  slotTime: string;
  patientName: string;
  doctorName: string;
  delayMinutes: number;
}

export interface OperationalActivityItem {
  id: string;
  timeText: string;
  timestamp: Date;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: "success" | "warning" | "primary" | "neutral" | "error";
}

export interface DepartmentOperationalSummary {
  name: string;
  departmentId?: string;
  totalToday: number;
  waitingCount: number;
  inConsultationCount: number;
  completedCount: number;
  upcomingCount: number;
  assignedDoctorsCount: number;
  availableDoctorsCount: number;
  loadState: "Normal" | "Busy" | "High Load" | "No Activity";
  loadVariant: "success" | "warning" | "error" | "neutral";
}

/**
 * Parses time string (e.g. "09:30 AM", "14:00", "09:30") to hours and minutes.
 */
function parseSlotTimeToMinutes(slotTime?: string): number | null {
  if (!slotTime) return null;
  const str = slotTime.trim();

  // Try matching 12-hour format e.g. "09:30 AM" or "09:30 PM"
  const match12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(str);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const mins = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return hours * 60 + mins;
  }

  // Try matching 24-hour format e.g. "14:30"
  const match24 = /^(\d{1,2}):(\d{2})$/.exec(str);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const mins = parseInt(match24[2], 10);
    return hours * 60 + mins;
  }

  return null;
}

/**
 * Detect appointments where the scheduled slot has passed but patient is still waiting.
 */
export function detectDelayedAppointments(
  todayAppointments: Appointment[],
): DelayedAppointmentItem[] {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const delayed: DelayedAppointmentItem[] = [];

  for (const a of todayAppointments) {
    const status = (a.status || "").toLowerCase();
    const queueStatus = (a.queueStatus || "").toLowerCase();
    const consultationStatus = (a.consultationStatus || "").toLowerCase();

    // Only consider appointments that are not finished or cancelled
    if (
      status === "completed" ||
      status === "cancel" ||
      status === "missed" ||
      queueStatus === "completed" ||
      consultationStatus === "completed"
    ) {
      continue;
    }

    // If already in consultation, not in waiting delay
    if (queueStatus === "in_consultation" || consultationStatus === "in_progress") {
      continue;
    }

    // Must be confirmed, checked in, or waiting
    const isWaitingOrChecked =
      a.checkedIn ||
      queueStatus === "waiting" ||
      queueStatus === "called" ||
      status === "confirmed";

    if (!isWaitingOrChecked) continue;

    const slotMinutes = parseSlotTimeToMinutes(a.slotTime || a.time);
    if (slotMinutes !== null) {
      const diff = currentMinutes - slotMinutes;
      // Consider delayed if 20 minutes or more have passed
      if (diff >= 20) {
        delayed.push({
          id: String(a._id),
          appointment: a,
          slotTime: a.slotTime || a.time || "Scheduled",
          patientName: a.patientName || appointmentPatientName(a),
          doctorName: appointmentDoctorName(a),
          delayMinutes: diff,
        });
      }
    }
  }

  // Sort by highest delay first
  return delayed.sort((a, b) => b.delayMinutes - a.delayMinutes);
}

/**
 * Evaluate factual hospital operational status.
 */
export function evaluateHospitalOperationalStatus(params: {
  totalToday: number;
  waitingCount: number;
  inConsultationCount: number;
  availableDoctorsCount: number;
  totalDoctorsCount: number;
  delayedCount: number;
  highQueueDoctorsCount: number;
}): {
  status: HospitalOperationalState;
  statusLabel: string;
  statusColor: string;
  badgeVariant: "success" | "warning" | "error" | "primary" | "neutral";
  description: string;
} {
  const {
    totalToday,
    waitingCount,
    inConsultationCount,
    availableDoctorsCount,
    totalDoctorsCount,
    delayedCount,
    highQueueDoctorsCount,
  } = params;

  // 1. High Load condition: many waiting patients or multiple bottlenecked doctors
  if (waitingCount >= 10 || highQueueDoctorsCount >= 3) {
    return {
      status: "HIGH LOAD",
      statusLabel: "HIGH OPERATIONAL LOAD",
      statusColor: "#DC2626", // red
      badgeVariant: "error",
      description: `${waitingCount} patients in OPD queue with ${highQueueDoctorsCount} doctor queues elevated.`,
    };
  }

  // 2. Delayed condition: multiple appointments delayed past slot time
  if (delayedCount >= 3) {
    return {
      status: "DELAYED",
      statusLabel: "OPD DELAYS DETECTED",
      statusColor: "#EA580C", // orange-red
      badgeVariant: "warning",
      description: `${delayedCount} appointments waiting past scheduled slot time.`,
    };
  }

  // 3. Limited Availability: more than half doctors offline with scheduled bookings
  if (
    totalDoctorsCount > 0 &&
    availableDoctorsCount < totalDoctorsCount * 0.4 &&
    totalToday > 0
  ) {
    return {
      status: "LIMITED AVAILABILITY",
      statusLabel: "LIMITED CLINICAL STAFFING",
      statusColor: "#D97706", // amber
      badgeVariant: "warning",
      description: `Only ${availableDoctorsCount} of ${totalDoctorsCount} doctors currently available for duty.`,
    };
  }

  // 4. Busy condition: active consultations and moderate queue
  if (waitingCount >= 4 || inConsultationCount >= 4 || totalToday >= 20) {
    return {
      status: "BUSY",
      statusLabel: "BUSY OPD FLOW",
      statusColor: "#0284C7", // sky blue
      badgeVariant: "primary",
      description: `${inConsultationCount} active consultations, ${waitingCount} patients waiting in queue.`,
    };
  }

  // 5. Default Normal Operational
  return {
    status: "OPERATIONAL",
    statusLabel: "NORMAL OPERATIONS",
    statusColor: "#059669", // emerald green
    badgeVariant: "success",
    description: `OPD queue flowing smoothly with ${availableDoctorsCount} doctor(s) on duty.`,
  };
}

/**
 * Build transparent operational alerts.
 */
export function buildOperationalAlerts(params: {
  pendingCount: number;
  delayedAppointments: DelayedAppointmentItem[];
  highQueueDoctors: Array<{ doctorName: string; waitingCount: number }>;
  offlineDoctorsWithBookings: Array<{ doctorName: string; apptCount: number }>;
  inConsultationCount: number;
  videoConsultationCount: number;
}): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const {
    pendingCount,
    delayedAppointments,
    highQueueDoctors,
    offlineDoctorsWithBookings,
    inConsultationCount,
    videoConsultationCount,
  } = params;

  // 1. Critical Delay Alert
  if (delayedAppointments.length > 0) {
    alerts.push({
      id: "delayed-appointments",
      severity: "CRITICAL",
      title: "Patient Appointment Delays Detected",
      message: `${delayedAppointments.length} appointment${
        delayedAppointments.length > 1 ? "s are" : " is"
      } delayed past scheduled slot time (longest: ${delayedAppointments[0].delayMinutes} mins for ${
        delayedAppointments[0].patientName
      }).`,
      count: delayedAppointments.length,
      actionRoute: "/admin/appointments?status=delayed",
      actionLabel: "View Delayed",
    });
  }

  // 2. Offline Doctor with Scheduled Patients
  if (offlineDoctorsWithBookings.length > 0) {
    alerts.push({
      id: "offline-doctor-conflict",
      severity: "CRITICAL",
      title: "Doctor Offline With Scheduled Bookings",
      message: `${offlineDoctorsWithBookings
        .map((d) => `${d.doctorName} (${d.apptCount} patients)`)
        .join(", ")} marked unavailable but has patients scheduled today.`,
      count: offlineDoctorsWithBookings.length,
      actionRoute: "/admin/doctor-availability",
      actionLabel: "Manage Availability",
    });
  }

  // 3. High Queue Warning
  if (highQueueDoctors.length > 0) {
    alerts.push({
      id: "high-queue-warning",
      severity: "WARNING",
      title: "Elevated OPD Waiting Queue",
      message: `${highQueueDoctors
        .map((d) => `${d.doctorName} (${d.waitingCount} waiting)`)
        .join(", ")} experiencing high queue load.`,
      count: highQueueDoctors.length,
      actionRoute: "/admin/operations",
      actionLabel: "Monitor Queue",
    });
  }

  // 4. Pending Confirmation Warning
  if (pendingCount > 0) {
    alerts.push({
      id: "pending-confirmation",
      severity: "WARNING",
      title: "Unconfirmed Bookings for Today",
      message: `${pendingCount} appointment${
        pendingCount > 1 ? "s" : ""
      } scheduled for today still require administrative confirmation.`,
      count: pendingCount,
      actionRoute: "/admin/appointments?status=pending",
      actionLabel: "Review Bookings",
    });
  }

  // 5. Active Consultation Info Broadcast
  if (inConsultationCount > 0) {
    alerts.push({
      id: "active-consultations-info",
      severity: "INFO",
      title: "Live Consultations In Session",
      message: `${inConsultationCount} patient${
        inConsultationCount > 1 ? "s are" : " is"
      } currently inside doctor consultation rooms.`,
      count: inConsultationCount,
      actionRoute: "/admin/operations",
      actionLabel: "View Rooms",
    });
  }

  // 6. Online Video Consultation Load Info
  if (videoConsultationCount > 0) {
    alerts.push({
      id: "video-consultation-info",
      severity: "INFO",
      title: "Online Video Consultations Scheduled",
      message: `${videoConsultationCount} video consultation${
        videoConsultationCount > 1 ? "s" : ""
      } scheduled for today via Google Meet.`,
      count: videoConsultationCount,
      actionRoute: "/admin/consultations",
      actionLabel: "Video Station",
    });
  }

  return alerts;
}

/**
 * Extract recent operational activity from actual appointments data.
 */
export function extractRecentOperationalActivity(
  todayAppointments: Appointment[],
): OperationalActivityItem[] {
  const activities: OperationalActivityItem[] = [];

  for (const a of todayAppointments) {
    const pName = a.patientName || appointmentPatientName(a);
    const dName = appointmentDoctorName(a);
    const tokenStr = a.queueToken ? ` (Token #${a.queueToken})` : "";

    // Check-in event
    if (a.checkedIn && a.checkInAt) {
      const dateObj = new Date(a.checkInAt);
      if (!Number.isNaN(dateObj.getTime())) {
        activities.push({
          id: `checkin-${a._id}`,
          timeText: dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: dateObj,
          title: `${pName} checked in at hospital`,
          subtitle: `OPD Queue for ${dName}${tokenStr}`,
          icon: "qr-code-outline",
          variant: "success",
        });
      }
    }

    // Consultation started event
    const startedAt = (a as unknown as { consultationStartedAt?: string }).consultationStartedAt;
    if (startedAt) {
      const dateObj = new Date(startedAt);
      if (!Number.isNaN(dateObj.getTime())) {
        activities.push({
          id: `started-${a._id}`,
          timeText: dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: dateObj,
          title: `Dr. ${dName} started consultation`,
          subtitle: `Patient: ${pName}${tokenStr}`,
          icon: "pulse",
          variant: "primary",
        });
      }
    }

    // Consultation completed event
    const completedAt = (a as unknown as { consultationCompletedAt?: string }).consultationCompletedAt;
    if (completedAt || a.status === "completed") {
      const dateObj = completedAt ? new Date(completedAt) : new Date(a.updatedAt || a.createdAt || Date.now());
      if (!Number.isNaN(dateObj.getTime())) {
        activities.push({
          id: `completed-${a._id}`,
          timeText: dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: dateObj,
          title: `Consultation completed for ${pName}`,
          subtitle: `Physician: ${dName} · Record locked`,
          icon: "checkmark-done-circle",
          variant: "success",
        });
      }
    }

    // Cancellation event
    if (a.status === "cancel") {
      const dateObj = new Date(a.updatedAt || a.createdAt || Date.now());
      activities.push({
        id: `cancelled-${a._id}`,
        timeText: dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        timestamp: dateObj,
        title: `Appointment cancelled for ${pName}`,
        subtitle: `Ref: ${appointmentReference(a)}`,
        icon: "close-circle-outline",
        variant: "error",
      });
    }
  }

  // Sort descending by timestamp
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Return up to 10 most recent factual activity events
  return activities.slice(0, 10);
}

/**
 * Compute department workload breakdown.
 */
export function computeDepartmentWorkload(
  departments: HospitalDepartment[],
  todayAppointments: Appointment[],
  upcomingAppointments: Appointment[],
  doctors: Doctor[],
): DepartmentOperationalSummary[] {
  const map: Record<string, DepartmentOperationalSummary> = {};

  // Seed configured departments
  for (const d of departments) {
    map[d.name] = {
      name: d.name,
      departmentId: String(d._id),
      totalToday: 0,
      waitingCount: 0,
      inConsultationCount: 0,
      completedCount: 0,
      upcomingCount: 0,
      assignedDoctorsCount: 0,
      availableDoctorsCount: 0,
      loadState: "No Activity",
      loadVariant: "neutral",
    };
  }

  // Doctors per department
  for (const doc of doctors) {
    const dName = doc.department || doc.speciality || "General";
    if (!map[dName]) {
      map[dName] = {
        name: dName,
        totalToday: 0,
        waitingCount: 0,
        inConsultationCount: 0,
        completedCount: 0,
        upcomingCount: 0,
        assignedDoctorsCount: 0,
        availableDoctorsCount: 0,
        loadState: "No Activity",
        loadVariant: "neutral",
      };
    }
    map[dName].assignedDoctorsCount++;
    if (doc.available !== false && doc.isActive !== false) {
      map[dName].availableDoctorsCount++;
    }
  }

  // Today appointments
  for (const a of todayAppointments) {
    const dName = appointmentDepartment(a) || "General";
    if (!map[dName]) {
      map[dName] = {
        name: dName,
        totalToday: 0,
        waitingCount: 0,
        inConsultationCount: 0,
        completedCount: 0,
        upcomingCount: 0,
        assignedDoctorsCount: 0,
        availableDoctorsCount: 0,
        loadState: "No Activity",
        loadVariant: "neutral",
      };
    }
    map[dName].totalToday++;
    if (a.queueStatus === "in_consultation" || a.consultationStatus === "in_progress") {
      map[dName].inConsultationCount++;
    } else if (a.queueStatus === "waiting" || a.checkedIn) {
      map[dName].waitingCount++;
    }
    if (a.status === "completed") {
      map[dName].completedCount++;
    }
  }

  // Upcoming appointments
  for (const a of upcomingAppointments) {
    const dName = appointmentDepartment(a) || "General";
    if (map[dName]) {
      map[dName].upcomingCount++;
    }
  }

  // Determine load state for each department
  return Object.values(map).map((dept) => {
    let state: DepartmentOperationalSummary["loadState"] = "Normal";
    let variant: DepartmentOperationalSummary["loadVariant"] = "success";

    if (dept.totalToday === 0 && dept.upcomingCount === 0) {
      state = "No Activity";
      variant = "neutral";
    } else if (dept.waitingCount >= 6) {
      state = "High Load";
      variant = "error";
    } else if (dept.waitingCount >= 3 || dept.totalToday >= 10) {
      state = "Busy";
      variant = "warning";
    } else {
      state = "Normal";
      variant = "success";
    }

    return {
      ...dept,
      loadState: state,
      loadVariant: variant,
    };
  });
}
