/**
 * HealPoint — Smart Appointment Intelligence & Live Status Resolver.
 *
 * Centralized, deterministic intelligence layer deriving authentic lifecycle state,
 * time context, check-in availability, queue status, and singular next-action CTAs
 * directly from MongoDB appointment models.
 */
import type { Ionicons } from "@expo/vector-icons";

import type { BadgeVariant } from "@/components/ui/Badge";
import { formatDDMMYYYY, formatDoctorName, formatINR } from "@/lib/format";
import type {
  Appointment,
  AppointmentDetails,
  AppointmentStatus,
} from "@/types";

export type NextActionKey =
  | "PAY_NOW"
  | "WAITING_DOCTOR"
  | "VIEW_PASS"
  | "CHECK_IN_NOW"
  | "VIEW_QUEUE"
  | "JOIN_CONSULTATION"
  | "WAITING_ROOM"
  | "IN_CONSULTATION"
  | "VIEW_PRESCRIPTION"
  | "VIEW_REPORT"
  | "BOOK_FOLLOWUP"
  | "VIEW_DETAILS";

export interface AppointmentIntelligence {
  currentStatus: {
    key: string;
    label: string;
    variant: BadgeVariant;
    description: string;
  };
  nextAction: {
    key: NextActionKey;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    variant: "primary" | "secondary" | "outline";
    route: string;
    badge?: string;
  };
  timeContext: {
    relativeLabel: string;
    isToday: boolean;
    isTomorrow: boolean;
    isPast: boolean;
    minutesRemaining: number | null;
    formattedSlot: string;
  };
  checkInStatus: {
    isAvailable: boolean;
    isOpenSoon: boolean;
    isCheckedIn: boolean;
    opensAtLabel?: string;
    badgeLabel: string;
    badgeVariant: BadgeVariant;
  };
  queueStatus: {
    isCheckedIn: boolean;
    token?: string;
    statusKey?: string;
    statusLabel?: string;
    isCalled: boolean;
    isInConsultation: boolean;
  };
  consultationStatus: {
    isVideo: boolean;
    isReadyToJoin: boolean;
    isWaitingRoom: boolean;
    badgeLabel: string;
    badgeVariant: BadgeVariant;
  };
  paymentStatus: {
    isPaid: boolean;
    isPending: boolean;
    isFailed: boolean;
    isCash: boolean;
    label: string;
    variant: BadgeVariant;
  };
  doctorStatus: {
    isConfirmed: boolean;
    isPending: boolean;
    label: string;
  };
}

/**
 * Safely parses date & time strings into a valid JS Date.
 * Supports:
 *   Date: DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY
 *   Time: "10:30 AM", "02:15 PM", "14:30"
 */
export function parseSlotDateTime(
  dateStr?: string,
  timeStr?: string,
): Date | null {
  if (!dateStr) return null;
  const cleanDate = dateStr.trim();
  let year = 0;
  let month = 0;
  let day = 0;

  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(cleanDate);
  if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10) - 1;
    year = parseInt(dmyMatch[3], 10);
  } else {
    // Match YYYY-MM-DD
    const ymdMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(cleanDate);
    if (ymdMatch) {
      year = parseInt(ymdMatch[1], 10);
      month = parseInt(ymdMatch[2], 10) - 1;
      day = parseInt(ymdMatch[3], 10);
    } else {
      const parsed = new Date(cleanDate);
      if (!isNaN(parsed.getTime())) {
        year = parsed.getFullYear();
        month = parsed.getMonth();
        day = parsed.getDate();
      } else {
        return null;
      }
    }
  }

  let hours = 9;
  let minutes = 0;

  if (timeStr && timeStr.trim()) {
    const cleanTime = timeStr.trim();
    // 12-hour format e.g. "10:30 AM" or "02:15 PM"
    const ampmMatch = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(cleanTime);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = parseInt(ampmMatch[2], 10);
      const ampm = ampmMatch[3] ? ampmMatch[3].toUpperCase() : null;

      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;

      hours = h;
      minutes = m;
    }
  }

  const d = new Date(year, month, day, hours, minutes, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Derives comprehensive Smart Appointment Intelligence for an appointment.
 */
export function deriveAppointmentIntelligence(
  appointment: Appointment | AppointmentDetails,
  options?: { now?: Date },
): AppointmentIntelligence {
  const now = options?.now || new Date();

  // Basic appointment identifiers
  // Resolve the appointment ID: _id is present on Appointment, and optionally
  // on AppointmentDetails; mongoAppointmentId is the AppointmentDetails fallback.
  const appointmentId =
    "_id" in appointment && appointment._id
      ? String(appointment._id)
      : "mongoAppointmentId" in appointment && appointment.mongoAppointmentId
        ? String(appointment.mongoAppointmentId)
        : "appointmentId" in appointment &&
            (appointment as AppointmentDetails).appointmentId
          ? String((appointment as AppointmentDetails).appointmentId)
          : "";

  const doctorId =
    typeof appointment.doctorId === "object" && appointment.doctorId
      ? String((appointment.doctorId as { _id?: string })._id || "")
      : typeof appointment.doctorId === "string"
        ? appointment.doctorId
        : "";

  // Normalize status
  const rawStatus =
    "bookingStatus" in appointment && appointment.bookingStatus
      ? appointment.bookingStatus
      : "status" in appointment && appointment.status
        ? appointment.status
        : "pending";
  const status = String(rawStatus).toLowerCase() as AppointmentStatus;

  const isCancelled = status === "cancel";
  const isCompleted = status === "completed";
  const isConfirmed = status === "confirmed";
  const isPending = status === "pending";
  const isRescheduled = status === "rescheduled";
  const isMissed = status === "missed";

  // Slot and Timing extraction
  const slotDateStr =
    "bookingDate" in appointment && appointment.bookingDate
      ? appointment.bookingDate
      : "slotDate" in appointment && appointment.slotDate
        ? appointment.slotDate
        : "";
  const slotTimeStr =
    "bookingTime" in appointment && appointment.bookingTime
      ? appointment.bookingTime
      : "slotTime" in appointment && appointment.slotTime
        ? appointment.slotTime
        : "";

  const slotDateTime = parseSlotDateTime(slotDateStr, slotTimeStr);

  // Time context computation
  let isToday = false;
  let isTomorrow = false;
  let isPast = false;
  let minutesRemaining: number | null = null;
  let relativeLabel = formatDDMMYYYY(slotDateStr);

  if (slotDateTime) {
    const nowDateOnly = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const slotDateOnly = new Date(
      slotDateTime.getFullYear(),
      slotDateTime.getMonth(),
      slotDateTime.getDate(),
    ).getTime();

    const diffDays = Math.round(
      (slotDateOnly - nowDateOnly) / (24 * 60 * 60 * 1000),
    );
    isToday = diffDays === 0;
    isTomorrow = diffDays === 1;
    isPast = slotDateTime.getTime() < now.getTime() && !isToday;

    const diffMs = slotDateTime.getTime() - now.getTime();
    minutesRemaining = Math.round(diffMs / 60000);

    if (isToday) {
      if (minutesRemaining > 0 && minutesRemaining <= 120) {
        relativeLabel = `In ${minutesRemaining} min${minutesRemaining === 1 ? "" : "s"}`;
      } else {
        relativeLabel = slotTimeStr ? `Today at ${slotTimeStr}` : "Today";
      }
    } else if (isTomorrow) {
      relativeLabel = slotTimeStr ? `Tomorrow at ${slotTimeStr}` : "Tomorrow";
    } else if (isPast) {
      relativeLabel = `${formatDDMMYYYY(slotDateStr)}${slotTimeStr ? ` (${slotTimeStr})` : ""}`;
    } else {
      relativeLabel = `${formatDDMMYYYY(slotDateStr)}${slotTimeStr ? ` at ${slotTimeStr}` : ""}`;
    }
  }

  // Payment status computation
  const rawPaymentStatus = String(appointment.paymentStatus || "")
    .trim()
    .toLowerCase();
  const isPaid =
    appointment.payment === true ||
    ["paid", "success", "succeeded", "captured"].includes(rawPaymentStatus);
  const isPaymentFailed = ["failed", "cancelled", "cancel"].includes(
    rawPaymentStatus,
  );
  const isCash = appointment.paymentMethod === "cash";
  const amount = Number(appointment.amount || 0);

  let paymentLabel = "Pay at Clinic";
  let paymentVariant: BadgeVariant = "primary";

  if (amount <= 0) {
    paymentLabel = "Free";
    paymentVariant = "success";
  } else if (isPaid) {
    paymentLabel = "Paid";
    paymentVariant = "success";
  } else if (isPaymentFailed) {
    paymentLabel = "Payment Failed";
    paymentVariant = "error";
  } else if (
    appointment.paymentMethod === "online" ||
    rawPaymentStatus.includes("pending")
  ) {
    paymentLabel = "Pay Online Now";
    paymentVariant = "warning";
  }

  // Consultation & Consultation Mode
  const isVideo = appointment.consultationType === "video";
  const hasValidMeet =
    isVideo &&
    Boolean(appointment.meetingUrl) &&
    /^https:\/\/meet\.google\.com\//i.test(appointment.meetingUrl || "");

  const consultationStatusVal = appointment.consultationStatus || "waiting";
  const isDoctorReady =
    consultationStatusVal === "ready_to_join" ||
    consultationStatusVal === "doctor_ready" ||
    consultationStatusVal === "in_progress";

  const isConsultationInProgress =
    consultationStatusVal === "in_progress" ||
    appointment.queueStatus === "in_consultation";

  // Check-In and Queue Computation
  const isCheckedIn = Boolean(appointment.checkedIn);
  const queueToken = appointment.queueToken
    ? String(appointment.queueToken)
    : undefined;
  const queueStatusKey =
    appointment.queueStatus || (isCheckedIn ? "waiting" : "not_checked_in");
  const isQueueCalled = queueStatusKey === "called";

  // Check-in window rule:
  // In-clinic, confirmed, visit is today, and within 2 hours before slot or ongoing during day
  const isCheckInWindowActive =
    !isVideo &&
    isConfirmed &&
    !isCheckedIn &&
    isToday &&
    (minutesRemaining === null || minutesRemaining <= 120);

  const isCheckInOpenSoon =
    !isVideo &&
    isConfirmed &&
    !isCheckedIn &&
    isToday &&
    minutesRemaining !== null &&
    minutesRemaining > 120;

  let checkInBadgeLabel = "Opens on visit day";
  let checkInBadgeVariant: BadgeVariant = "neutral";

  if (isCheckedIn) {
    checkInBadgeLabel = queueToken
      ? `Checked In (#${queueToken})`
      : "Checked In";
    checkInBadgeVariant = "success";
  } else if (isCheckInWindowActive) {
    checkInBadgeLabel = "Check-In Available";
    checkInBadgeVariant = "success";
  } else if (isCheckInOpenSoon) {
    checkInBadgeLabel = "Opens 2h before slot";
    checkInBadgeVariant = "warning";
  } else if (isConfirmed) {
    checkInBadgeLabel = "Digital Pass Ready";
    checkInBadgeVariant = "neutral";
  }

  // Consultation readiness badge
  let consultBadgeLabel = isVideo ? "Video Consult" : "Clinic Visit";
  let consultBadgeVariant: BadgeVariant = "neutral";
  if (isVideo) {
    if (isCompleted) {
      consultBadgeLabel = "Attended";
      consultBadgeVariant = "primary";
    } else if (hasValidMeet && isDoctorReady) {
      consultBadgeLabel = "Room Ready";
      consultBadgeVariant = "success";
    } else {
      consultBadgeLabel = "Virtual Waiting Room";
      consultBadgeVariant = "warning";
    }
  }

  // Current Status label & variant
  let currentStatusKey = status as string;
  let currentStatusLabel = "Pending Approval";
  let currentStatusVariant: BadgeVariant = "warning";
  let currentStatusDesc = "Awaiting doctor confirmation";

  if (isCancelled) {
    currentStatusKey = "cancelled";
    currentStatusLabel = "Cancelled";
    currentStatusVariant = "error";
    currentStatusDesc = "Appointment was cancelled";
  } else if (isMissed) {
    currentStatusKey = "missed";
    currentStatusLabel = "Missed";
    currentStatusVariant = "error";
    currentStatusDesc = "Scheduled consultation was missed";
  } else if (isCompleted) {
    currentStatusKey = "completed";
    currentStatusLabel = "Completed";
    currentStatusVariant = "primary";
    currentStatusDesc = "Clinical consultation completed";
  } else if (isConsultationInProgress) {
    currentStatusKey = "in_consultation";
    currentStatusLabel = "In Consultation";
    currentStatusVariant = "success";
    currentStatusDesc = "Currently in session with the doctor";
  } else if (isQueueCalled) {
    currentStatusKey = "called";
    currentStatusLabel = "Doctor is Ready";
    currentStatusVariant = "success";
    currentStatusDesc = "Please proceed to consultation room";
  } else if (isCheckedIn) {
    currentStatusKey = "in_queue";
    currentStatusLabel = `In Queue (Token #${queueToken || "Assigned"})`;
    currentStatusVariant = "primary";
    currentStatusDesc = "Checked in at reception desk";
  } else if (isCheckInWindowActive) {
    currentStatusKey = "check_in_available";
    currentStatusLabel = "Check-In Available";
    currentStatusVariant = "success";
    currentStatusDesc = "Fast-track QR pass is active for check-in";
  } else if (isConfirmed) {
    currentStatusKey = "confirmed";
    currentStatusLabel = "Confirmed";
    currentStatusVariant = "success";
    currentStatusDesc = "Doctor confirmed your booking";
  } else if (isRescheduled) {
    currentStatusKey = "rescheduled";
    currentStatusLabel = "Rescheduled";
    currentStatusVariant = "neutral";
    currentStatusDesc = "Appointment was rescheduled";
  }

  // Next Action Resolution Hierarchy (Deterministic Single Action)
  let nextActionKey: NextActionKey = "VIEW_DETAILS";
  let nextActionLabel = "View Details";
  let nextActionIcon: keyof typeof Ionicons.glyphMap = "chevron-forward";
  let nextActionVariant: "primary" | "secondary" | "outline" = "primary";
  let nextActionRoute = `/appointment/${appointmentId}`;

  const hasPrescription =
    Boolean(appointment.prescription && appointment.prescription.trim()) ||
    Boolean(appointment.medicines && appointment.medicines.length > 0);
  const hasReports = Boolean(
    appointment.medicalReports && appointment.medicalReports.length > 0,
  );

  if (isCancelled || isMissed) {
    nextActionKey = "VIEW_DETAILS";
    nextActionLabel = "View Appointment Details";
    nextActionIcon = "document-text-outline";
    nextActionVariant = "outline";
    nextActionRoute = `/appointment/${appointmentId}`;
  } else if (
    !isPaid &&
    !isCash &&
    amount > 0 &&
    (appointment.paymentMethod === "online" ||
      isPaymentFailed ||
      rawPaymentStatus.includes("pending"))
  ) {
    // 1. Unpaid online appointment requires payment completion
    nextActionKey = "PAY_NOW";
    nextActionLabel = isPaymentFailed
      ? "Retry Payment Online"
      : "Pay Online Now";
    nextActionIcon = "card-outline";
    nextActionVariant = "primary";
    nextActionRoute = `/payment/${appointmentId}`;
  } else if (isPending) {
    // 2. Pending doctor confirmation
    nextActionKey = "WAITING_DOCTOR";
    nextActionLabel = "Awaiting Doctor Confirmation";
    nextActionIcon = "hourglass-outline";
    nextActionVariant = "outline";
    nextActionRoute = `/appointment/${appointmentId}`;
  } else if (isCompleted) {
    // 3. Completed visit outcomes
    if (hasPrescription) {
      nextActionKey = "VIEW_PRESCRIPTION";
      nextActionLabel = "View Prescription";
      nextActionIcon = "document-text-outline";
      nextActionVariant = "primary";
      nextActionRoute = "/health/prescriptions";
    } else if (hasReports) {
      nextActionKey = "VIEW_REPORT";
      nextActionLabel = "View Medical Reports";
      nextActionIcon = "bar-chart-outline";
      nextActionVariant = "primary";
      nextActionRoute = "/health/reports";
    } else {
      nextActionKey = "BOOK_FOLLOWUP";
      nextActionLabel = "Book Follow-up";
      nextActionIcon = "calendar-outline";
      nextActionVariant = "primary";
      nextActionRoute = doctorId ? `/booking/${doctorId}` : "/doctors";
    }
  } else if (isConsultationInProgress) {
    // 4. In active consultation
    nextActionKey = isVideo ? "JOIN_CONSULTATION" : "IN_CONSULTATION";
    nextActionLabel = isVideo ? "Resume Consultation" : "In Consultation";
    nextActionIcon = isVideo ? "videocam" : "medical";
    nextActionVariant = "primary";
    nextActionRoute = isVideo
      ? `/consultation/${appointmentId}`
      : `/appointment/${appointmentId}`;
  } else if (isVideo) {
    // 5. Video appointment lifecycle
    if (hasValidMeet && isDoctorReady) {
      nextActionKey = "JOIN_CONSULTATION";
      nextActionLabel = "Join Video Consultation";
      nextActionIcon = "videocam";
      nextActionVariant = "primary";
      nextActionRoute = `/consultation/${appointmentId}`;
    } else {
      nextActionKey = "WAITING_ROOM";
      nextActionLabel = "Virtual Waiting Room";
      nextActionIcon = "videocam-outline";
      nextActionVariant = "outline";
      nextActionRoute = `/consultation/${appointmentId}`;
    }
  } else {
    // 6. Clinic visit lifecycle
    if (isCheckedIn) {
      nextActionKey = "VIEW_QUEUE";
      nextActionLabel = isQueueCalled
        ? "Doctor is Ready — Enter Room"
        : `Live Queue (Token #${queueToken || "Assigned"})`;
      nextActionIcon = isQueueCalled ? "megaphone" : "people-outline";
      nextActionVariant = "primary";
      nextActionRoute = `/appointment/${appointmentId}`;
    } else if (isCheckInWindowActive) {
      nextActionKey = "CHECK_IN_NOW";
      nextActionLabel = "Check In Now";
      nextActionIcon = "qr-code-outline";
      nextActionVariant = "primary";
      nextActionRoute = `/appointment/pass/${appointmentId}`;
    } else {
      nextActionKey = "VIEW_PASS";
      nextActionLabel = "Digital Hospital Pass";
      nextActionIcon = "card-outline";
      nextActionVariant = "outline";
      nextActionRoute = `/appointment/pass/${appointmentId}`;
    }
  }

  return {
    currentStatus: {
      key: currentStatusKey,
      label: currentStatusLabel,
      variant: currentStatusVariant,
      description: currentStatusDesc,
    },
    nextAction: {
      key: nextActionKey,
      label: nextActionLabel,
      icon: nextActionIcon,
      variant: nextActionVariant,
      route: nextActionRoute,
      badge: isCheckedIn && queueToken ? `#${queueToken}` : undefined,
    },
    timeContext: {
      relativeLabel,
      isToday,
      isTomorrow,
      isPast,
      minutesRemaining,
      formattedSlot: `${formatDDMMYYYY(slotDateStr)}${slotTimeStr ? ` at ${slotTimeStr}` : ""}`,
    },
    checkInStatus: {
      isAvailable: isCheckInWindowActive,
      isOpenSoon: isCheckInOpenSoon,
      isCheckedIn,
      opensAtLabel: isCheckInOpenSoon
        ? "Opens 2 hours before slot"
        : isCheckInWindowActive
          ? "Check-in available now"
          : isCheckedIn
            ? "Checked in"
            : "Opens on visit day",
      badgeLabel: checkInBadgeLabel,
      badgeVariant: checkInBadgeVariant,
    },
    queueStatus: {
      isCheckedIn,
      token: queueToken,
      statusKey: queueStatusKey,
      statusLabel: queueStatusKey
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      isCalled: isQueueCalled,
      isInConsultation: queueStatusKey === "in_consultation",
    },
    consultationStatus: {
      isVideo,
      isReadyToJoin: Boolean(hasValidMeet && isDoctorReady),
      isWaitingRoom: Boolean(isVideo && (!hasValidMeet || !isDoctorReady)),
      badgeLabel: consultBadgeLabel,
      badgeVariant: consultBadgeVariant,
    },
    paymentStatus: {
      isPaid,
      isPending: !isPaid && !isCash && amount > 0,
      isFailed: isPaymentFailed,
      isCash,
      label: paymentLabel,
      variant: paymentVariant,
    },
    doctorStatus: {
      isConfirmed: isConfirmed || isCompleted,
      isPending,
      label:
        isConfirmed || isCompleted
          ? "Doctor Confirmed"
          : isPending
            ? "Awaiting Doctor"
            : "Rescheduled",
    },
  };
}
