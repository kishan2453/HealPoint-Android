/**
 * HealPoint — Smart Care Command Center Intelligence & Priority Engine.
 *
 * Evaluates the patient's immediate real-time healthcare situation to determine:
 * "What does this patient need to know or do RIGHT NOW?"
 *
 * Deterministically ranks operational states:
 * 1. IN_CONSULTATION: Currently in clinical or video session.
 * 2. DOCTOR_CALLED: Token called into consultation room.
 * 3. CONSULTATION_READY: Video room open & ready to join.
 * 4. IN_QUEUE: Checked in, token assigned, waiting in hospital queue.
 * 5. CHECK_IN_AVAILABLE: Appointment today, check-in window active (QR pass ready).
 * 6. PAYMENT_PENDING: Confirmed booking with unpaid fee.
 * 7. APPOINTMENT_TODAY: Scheduled appointment today.
 * 8. MEDICATION_DUE: Scheduled dose for today not yet taken.
 * 9. FOLLOW_UP_DUE: Doctor-recommended follow-up pending booking.
 * 10. PRESCRIPTION_NEW: New digital prescription available.
 * 11. REPORT_NEW: Diagnostic report uploaded.
 * 12. UPCOMING_CARE: Future appointment scheduled.
 * 13. CALM: No urgent healthcare tasks today.
 */
import type { Ionicons } from "@expo/vector-icons";
import type { BadgeVariant } from "@/components/ui/Badge";
import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import {
  deriveAppointmentIntelligence,
  type AppointmentIntelligence,
} from "@/lib/appointment-intelligence";
import type {
  Appointment,
  FamilyMember,
  FollowUpOverviewItem,
  PatientReportItem,
  TodayMedicationDose,
} from "@/types";

export type CarePulseLevel =
  | "urgent"
  | "action_required"
  | "active"
  | "ready"
  | "info"
  | "calm";

export type CareCommandStateKey =
  | "in_consultation"
  | "doctor_called"
  | "consultation_ready"
  | "in_queue"
  | "check_in_available"
  | "payment_pending"
  | "appointment_today"
  | "medication_due"
  | "follow_up_due"
  | "prescription_new"
  | "report_new"
  | "upcoming_care"
  | "calm";

export interface CareCommandAction {
  id: string;
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant: "primary" | "secondary" | "outline";
  route: string;
  badge?: string;
  badgeVariant?: BadgeVariant;
  urgency: "critical" | "high" | "medium" | "low";
  ctaLabel: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}

export interface CarePulseState {
  stateKey: CareCommandStateKey;
  level: CarePulseLevel;
  headline: string;
  subheadline: string;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
  pulseColor: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface CareJourneyStep {
  key: string;
  label: string;
  description: string;
  status: "completed" | "current" | "upcoming";
  time?: string;
}

export interface CareCommandSnapshot {
  pulse: CarePulseState;
  primaryAction: CareCommandAction | null;
  secondaryActions: CareCommandAction[];
  activeAppointment: Appointment | null;
  activeAppointmentIntel: AppointmentIntelligence | null;
  journeyStages: CareJourneyStep[];
  pendingDosesToday: TodayMedicationDose[];
  completedDosesToday: TodayMedicationDose[];
  pendingFollowUps: FollowUpOverviewItem[];
  upcomingAppointments: Appointment[];
  metrics: {
    todayAppointmentsCount: number;
    pendingDosesCount: number;
    pendingFollowUpsCount: number;
    unreadNotificationsCount: number;
    walletItemsCount: number;
  };
}

function parseSlotDateKey(slotDate?: string): string {
  if (!slotDate) return "";
  return slotDate.trim();
}

function isDateToday(slotDate?: string): boolean {
  if (!slotDate) return false;
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const todayKey1 = `${day}-${month}-${year}`;
  const todayKey2 = `${year}-${month}-${day}`;
  const clean = slotDate.trim();
  return clean === todayKey1 || clean === todayKey2;
}

/**
 * Determine the exact 5-step lifecycle stages for an active appointment.
 */
export function deriveCareJourneyStages(
  appointment: Appointment | null,
  intel: AppointmentIntelligence | null,
): CareJourneyStep[] {
  if (!appointment) return [];

  const status = appointment.status;
  const isVideo = appointment.consultationType === "video";
  const isCheckedIn =
    Boolean(appointment.checkedIn) ||
    appointment.queueStatus === "waiting" ||
    appointment.queueStatus === "called" ||
    appointment.queueStatus === "in_consultation";
  const isCalled = appointment.queueStatus === "called";
  const isServing =
    appointment.queueStatus === "in_consultation" ||
    appointment.meetingStatus === "started" ||
    appointment.consultationStatus === "in_progress";
  const isCompleted = status === "completed";
  const hasPrescription =
    Boolean(appointment.prescription?.trim()) ||
    Boolean(appointment.medicines && appointment.medicines.length > 0);

  const steps: CareJourneyStep[] = [
    {
      key: "booked",
      label: "Booked & Confirmed",
      description: `Appointment confirmed with ${formatDoctorName(
        typeof appointment.doctorId === "object" && appointment.doctorId?.name
          ? appointment.doctorId.name
          : appointment.doctorName,
        "Doctor",
      )}`,
      status: "completed",
      time: appointment.slotDate,
    },
    {
      key: "checkin",
      label: isVideo ? "Virtual Waiting Room" : "Digital Pass & Check-In",
      description: isVideo
        ? "Device & connection readiness verified"
        : isCheckedIn
          ? "Checked in at hospital reception"
          : "Fast-track QR pass available on arrival",
      status:
        isCheckedIn || isCalled || isServing || isCompleted
          ? "completed"
          : intel?.checkInStatus.isAvailable
            ? "current"
            : "upcoming",
      time: appointment.slotTime,
    },
    {
      key: "queue",
      label: isVideo ? "Doctor Availability" : "Live Queue & Token",
      description: isVideo
        ? intel?.consultationStatus.isReadyToJoin
          ? "Doctor is in room ready for video"
          : "Awaiting doctor arrival in session"
        : appointment.queueToken
          ? `Token #${appointment.queueToken} assigned`
          : "Token assigned upon check-in",
      status:
        isServing || isCompleted
          ? "completed"
          : isCalled || (isVideo && intel?.consultationStatus.isReadyToJoin)
            ? "current"
            : isCheckedIn
              ? "current"
              : "upcoming",
    },
    {
      key: "consultation",
      label: isVideo ? "Video Consultation" : "Clinical Consultation",
      description: isCompleted
        ? "Consultation finished successfully"
        : isServing
          ? "Session actively in progress"
          : isCalled
            ? "Proceed to doctor's consultation room"
            : "Consultation with specialist",
      status: isCompleted ? "completed" : isServing ? "current" : "upcoming",
    },
    {
      key: "care_plan",
      label: "Prescription & Follow-Up",
      description: hasPrescription
        ? "Digital prescription & instructions issued"
        : "Prescription, notes, and continuity plan",
      status: hasPrescription || isCompleted ? "completed" : "upcoming",
    },
  ];

  return steps;
}

export interface CareCommandEvaluationParams {
  userId: string;
  userName?: string;
  appointments: Appointment[];
  todayDoses: TodayMedicationDose[];
  followUps: FollowUpOverviewItem[];
  recentReports?: PatientReportItem[];
  unreadNotifications?: number;
  walletCount?: number;
  selectedMemberId?: string;
}

/**
 * Main priority engine evaluating all real signals into a single unified snapshot.
 */
export function deriveCareCommandSnapshot(
  params: CareCommandEvaluationParams,
): CareCommandSnapshot {
  const {
    userName = "Patient",
    appointments,
    todayDoses,
    followUps,
    recentReports = [],
    unreadNotifications = 0,
    walletCount = 0,
  } = params;

  // Filter out cancelled/missed appointments
  const activeAppointments = appointments.filter(
    (a) => a.status !== "cancel" && a.status !== "missed",
  );

  // Today's appointments sorted by slot time
  const todayAppointments = activeAppointments
    .filter((a) => isDateToday(a.slotDate))
    .sort((a, b) => (a.slotTime || "").localeCompare(b.slotTime || ""));

  // Upcoming appointments in future days
  const upcomingAppointments = activeAppointments
    .filter((a) => !isDateToday(a.slotDate) && a.status !== "completed")
    .sort((a, b) => (a.slotDate || "").localeCompare(b.slotDate || ""));

  // Primary active appointment for today (if any)
  const activeAppointment =
    todayAppointments.find((a) => a.status !== "completed") ||
    todayAppointments[0] ||
    upcomingAppointments[0] ||
    null;

  const activeAppointmentIntel = activeAppointment
    ? deriveAppointmentIntelligence(activeAppointment)
    : null;

  // Medication Doses
  const pendingDosesToday = todayDoses.filter(
    (d) => d.status === "pending" || d.status === "snoozed",
  );
  const completedDosesToday = todayDoses.filter((d) => d.status === "taken");

  // Follow-ups pending booking
  const pendingFollowUps = followUps.filter(
    (f) => f.status === "pending_booking",
  );

  // Derive Priority State
  let stateKey: CareCommandStateKey = "calm";
  let pulseLevel: CarePulseLevel = "calm";
  let headline = `All Clear, ${userName}`;
  let subheadline = "No urgent care actions require your attention right now.";
  let badgeLabel = "CARE STATUS: ALL CAUGHT UP";
  let badgeVariant: BadgeVariant = "neutral";
  let pulseColor = "#10B981";
  let icon: keyof typeof Ionicons.glyphMap = "shield-checkmark";

  const primaryActions: CareCommandAction[] = [];
  const secondaryActions: CareCommandAction[] = [];

  // Check 1: In consultation currently
  const isInConsultation =
    activeAppointment &&
    (activeAppointment.queueStatus === "in_consultation" ||
      activeAppointment.meetingStatus === "started" ||
      activeAppointment.consultationStatus === "in_progress");

  // Check 2: Doctor called patient
  const isDoctorCalled =
    activeAppointment &&
    (activeAppointment.queueStatus === "called" ||
      activeAppointment.consultationStatus === "doctor_ready");

  // Check 3: Video consultation ready to join
  const isVideoMeetReady =
    activeAppointment &&
    activeAppointment.consultationType === "video" &&
    isDateToday(activeAppointment.slotDate) &&
    activeAppointmentIntel?.consultationStatus.isReadyToJoin;

  // Check 4: In queue (checked in and waiting)
  const isInQueue =
    activeAppointment &&
    isDateToday(activeAppointment.slotDate) &&
    activeAppointment.status !== "completed" &&
    (Boolean(activeAppointment.checkedIn) ||
      activeAppointment.queueStatus === "waiting");

  // Check 5: Fast-track Check-in available right now
  const isCheckInAvailable =
    activeAppointment &&
    isDateToday(activeAppointment.slotDate) &&
    activeAppointment.status !== "completed" &&
    !isInQueue &&
    Boolean(activeAppointmentIntel?.checkInStatus.isAvailable);

  // Check 6: Unpaid online booking
  const isPaymentPending =
    activeAppointment &&
    activeAppointment.status !== "completed" &&
    !activeAppointment.payment &&
    activeAppointment.paymentMethod === "online" &&
    (activeAppointment.amount || 0) > 0;

  // Check 7: Appointment scheduled today
  const hasAppointmentToday =
    activeAppointment &&
    isDateToday(activeAppointment.slotDate) &&
    activeAppointment.status !== "completed";

  // Check 8: Medication dose due today
  const hasMedicationDue = pendingDosesToday.length > 0;

  // Check 9: Follow-up pending booking
  const hasFollowUpDue = pendingFollowUps.length > 0;

  // Priority Ranking Resolution
  if (isInConsultation && activeAppointment) {
    stateKey = "in_consultation";
    pulseLevel = "urgent";
    headline = "Consultation In Progress";
    subheadline = `Active session with ${formatDoctorName(
      typeof activeAppointment.doctorId === "object" && activeAppointment.doctorId?.name
        ? activeAppointment.doctorId.name
        : activeAppointment.doctorName,
      "Doctor",
    )}`;
    badgeLabel = "LIVE • IN CONSULTATION";
    badgeVariant = "success";
    pulseColor = "#10B981";
    icon = activeAppointment.consultationType === "video" ? "videocam" : "medical";

    primaryActions.push({
      id: `in-consult-${activeAppointment._id}`,
      key: "IN_CONSULTATION",
      title: activeAppointment.consultationType === "video" ? "Resume Video Meet" : "In Clinic Consultation",
      subtitle: `Doctor session is active now • Slot: ${activeAppointment.slotTime || "Today"}`,
      icon: activeAppointment.consultationType === "video" ? "videocam" : "medical",
      variant: "primary",
      route: activeAppointment.consultationType === "video"
        ? `/consultation/${activeAppointment._id}`
        : `/appointment/${activeAppointment._id}`,
      urgency: "critical",
      ctaLabel: activeAppointment.consultationType === "video" ? "Re-Join Video Call" : "View Session",
    });
  } else if (isDoctorCalled && activeAppointment) {
    stateKey = "doctor_called";
    pulseLevel = "urgent";
    headline = "Doctor is Ready For You!";
    subheadline = `Token #${activeAppointment.queueToken || "Assigned"} called. Please proceed to consultation room.`;
    badgeLabel = "DOCTOR READY • PROCEED NOW";
    badgeVariant = "success";
    pulseColor = "#059669";
    icon = "megaphone";

    primaryActions.push({
      id: `doctor-called-${activeAppointment._id}`,
      key: "DOCTOR_CALLED",
      title: "Doctor Ready — Enter Room",
      subtitle: `Your token #${activeAppointment.queueToken} is being called by the doctor`,
      icon: "megaphone",
      variant: "primary",
      route: `/appointment/${activeAppointment._id}`,
      urgency: "critical",
      ctaLabel: "View Room & Token Pass",
    });
  } else if (isVideoMeetReady && activeAppointment) {
    stateKey = "consultation_ready";
    pulseLevel = "urgent";
    headline = "Video Consultation Ready";
    subheadline = "Your doctor is in the consultation room. You may join the video call.";
    badgeLabel = "ROOM READY • JOIN NOW";
    badgeVariant = "success";
    pulseColor = "#7C3AED";
    icon = "videocam";

    primaryActions.push({
      id: `join-video-${activeAppointment._id}`,
      key: "JOIN_VIDEO",
      title: "Join Video Consultation",
      subtitle: `Doctor is ready on Google Meet • Slot: ${activeAppointment.slotTime}`,
      icon: "videocam",
      variant: "primary",
      route: `/consultation/${activeAppointment._id}`,
      urgency: "critical",
      ctaLabel: "Join Video Call Now",
    });
  } else if (isInQueue && activeAppointment) {
    stateKey = "in_queue";
    pulseLevel = "active";
    const token = activeAppointment.queueToken || "Registered";
    headline = `Waiting in Hospital Queue (#${token})`;
    subheadline = `Checked in at ${typeof activeAppointment.hospitalId === "object" && activeAppointment.hospitalId?.name ? activeAppointment.hospitalId.name : activeAppointment.hospitalName || "Hospital"}.`;
    badgeLabel = `QUEUE TOKEN #${token}`;
    badgeVariant = "primary";
    pulseColor = "#0284C7";
    icon = "people";

    primaryActions.push({
      id: `queue-${activeAppointment._id}`,
      key: "VIEW_QUEUE",
      title: `Live Queue Token #${token}`,
      subtitle: `Checked in • Live tracking at ${activeAppointment.hospitalName || "Hospital"}`,
      icon: "qr-code-outline",
      variant: "primary",
      route: `/appointment/${activeAppointment._id}`,
      urgency: "high",
      ctaLabel: "View Live Queue & Token",
    });
  } else if (isCheckInAvailable && activeAppointment) {
    stateKey = "check_in_available";
    pulseLevel = "action_required";
    headline = "Digital Check-In Available";
    subheadline = "Your appointment is today. Show your digital pass or fast-track check-in.";
    badgeLabel = "CHECK-IN WINDOW OPEN";
    badgeVariant = "warning";
    pulseColor = "#D97706";
    icon = "qr-code";

    primaryActions.push({
      id: `checkin-${activeAppointment._id}`,
      key: "CHECK_IN_NOW",
      title: "Fast-Track Digital Check-In",
      subtitle: `Slot: ${activeAppointment.slotTime || "Today"} • Tap to reveal QR check-in pass`,
      icon: "qr-code-outline",
      variant: "primary",
      route: `/appointment/pass/${activeAppointment._id}`,
      urgency: "high",
      ctaLabel: "Check In / Show QR Pass",
    });
  } else if (isPaymentPending && activeAppointment) {
    stateKey = "payment_pending";
    pulseLevel = "action_required";
    headline = "Consultation Payment Pending";
    subheadline = `Please complete your online payment of ₹${activeAppointment.amount || 0} to confirm booking.`;
    badgeLabel = "PAYMENT REQUIRED";
    badgeVariant = "warning";
    pulseColor = "#DC2626";
    icon = "card";

    primaryActions.push({
      id: `pay-${activeAppointment._id}`,
      key: "PAY_NOW",
      title: "Pay Consultation Fee",
      subtitle: `Online payment pending: ₹${activeAppointment.amount || 0}`,
      icon: "card-outline",
      variant: "primary",
      route: `/payment/${activeAppointment._id}`,
      urgency: "high",
      ctaLabel: "Complete Payment Online",
    });
  } else if (hasAppointmentToday && activeAppointment) {
    stateKey = "appointment_today";
    pulseLevel = "ready";
    headline = "Appointment Scheduled Today";
    subheadline = `Consultation with ${formatDoctorName(
      typeof activeAppointment.doctorId === "object" && activeAppointment.doctorId?.name
        ? activeAppointment.doctorId.name
        : activeAppointment.doctorName,
      "Doctor",
    )} at ${activeAppointment.slotTime || "scheduled time"}.`;
    badgeLabel = "VISIT TODAY";
    badgeVariant = "primary";
    pulseColor = "#2563EB";
    icon = "calendar";

    primaryActions.push({
      id: `appt-today-${activeAppointment._id}`,
      key: "APPT_TODAY",
      title: "Prepare For Today's Visit",
      subtitle: `Slot: ${activeAppointment.slotTime || "Today"} • ${activeAppointment.hospitalName || "HealPoint Clinic"}`,
      icon: "document-text-outline",
      variant: "primary",
      route: `/appointment/${activeAppointment._id}`,
      urgency: "medium",
      ctaLabel: "View Visit Details & Pass",
    });
  } else if (hasMedicationDue) {
    const nextDose = pendingDosesToday[0];
    stateKey = "medication_due";
    pulseLevel = "action_required";
    headline = "Medication Dose Scheduled";
    subheadline = `${nextDose.medicineName} (${nextDose.dosage}) scheduled for ${nextDose.scheduledTime || "today"}.`;
    badgeLabel = "MEDICATION DUE";
    badgeVariant = "warning";
    pulseColor = "#F59E0B";
    icon = "medkit";

    primaryActions.push({
      id: `med-${nextDose.reminderId}`,
      key: "TAKE_MEDICATION",
      title: `Take ${nextDose.medicineName}`,
      subtitle: `${nextDose.dosage} • ${nextDose.timing || "Scheduled"} • ${nextDose.scheduledTime}`,
      icon: "medkit-outline",
      variant: "primary",
      route: "/health/prescriptions",
      urgency: "high",
      ctaLabel: "Mark Dose Taken",
      metadata: { reminderId: nextDose.reminderId, medicineName: nextDose.medicineName },
    });
  } else if (hasFollowUpDue) {
    const nextFu = pendingFollowUps[0];
    stateKey = "follow_up_due";
    pulseLevel = "ready";
    headline = "Follow-Up Consultation Advised";
    subheadline = `Recommended by ${nextFu.doctorName}: "${nextFu.advice.slice(0, 70)}..."`;
    badgeLabel = "FOLLOW-UP ADVICED";
    badgeVariant = "primary";
    pulseColor = "#8B5CF6";
    icon = "refresh";

    primaryActions.push({
      id: `fu-${nextFu.id}`,
      key: "BOOK_FOLLOWUP",
      title: "Book Recommended Follow-Up",
      subtitle: `With ${nextFu.doctorName} • Advice: ${nextFu.timeframe || "Soon"}`,
      icon: "calendar-outline",
      variant: "primary",
      route: nextFu.doctorId ? `/booking/${nextFu.doctorId}` : "/health/follow-ups",
      urgency: "medium",
      ctaLabel: "Book Follow-Up Slot",
    });
  } else if (upcomingAppointments.length > 0) {
    const nextAppt = upcomingAppointments[0];
    stateKey = "upcoming_care";
    pulseLevel = "info";
    headline = "Upcoming Care Scheduled";
    subheadline = `Next consultation on ${formatDDMMYYYY(nextAppt.slotDate)} with ${formatDoctorName(
      typeof nextAppt.doctorId === "object" && nextAppt.doctorId?.name
        ? nextAppt.doctorId.name
        : nextAppt.doctorName,
      "Doctor",
    )}.`;
    badgeLabel = "UPCOMING CARE";
    badgeVariant = "neutral";
    pulseColor = "#0284C7";
    icon = "calendar-outline";

    primaryActions.push({
      id: `up-${nextAppt._id}`,
      key: "UPCOMING_APPT",
      title: "Upcoming Consultation",
      subtitle: `${formatDDMMYYYY(nextAppt.slotDate)} at ${nextAppt.slotTime || ""}`,
      icon: "calendar-outline",
      variant: "secondary",
      route: `/appointment/${nextAppt._id}`,
      urgency: "low",
      ctaLabel: "View Details & Preparation",
    });
  }

  // Populate Secondary Actions (if not already primary)
  if (hasMedicationDue && stateKey !== "medication_due") {
    const nextDose = pendingDosesToday[0];
    secondaryActions.push({
      id: `sec-med-${nextDose.reminderId}`,
      key: "TAKE_MEDICATION",
      title: `Medication Dose: ${nextDose.medicineName}`,
      subtitle: `${nextDose.dosage} • ${nextDose.scheduledTime || "Today"}`,
      icon: "medkit-outline",
      variant: "outline",
      route: "/health/prescriptions",
      urgency: "medium",
      ctaLabel: "Mark Taken",
      metadata: { reminderId: nextDose.reminderId },
    });
  }

  if (hasFollowUpDue && stateKey !== "follow_up_due") {
    const nextFu = pendingFollowUps[0];
    secondaryActions.push({
      id: `sec-fu-${nextFu.id}`,
      key: "BOOK_FOLLOWUP",
      title: "Care Continuity Follow-Up",
      subtitle: `Advised by ${nextFu.doctorName}`,
      icon: "refresh-outline",
      variant: "outline",
      route: nextFu.doctorId ? `/booking/${nextFu.doctorId}` : "/health/follow-ups",
      urgency: "medium",
      ctaLabel: "Book Slot",
    });
  }

  if (recentReports.length > 0 && (stateKey as string) !== "report_new") {
    const rep = recentReports[0];
    secondaryActions.push({
      id: `sec-rep-${rep._id}`,
      key: "VIEW_REPORT",
      title: rep.name || "Diagnostic Report",
      subtitle: `${rep.category || "Report"} ready in Health Wallet`,
      icon: "bar-chart-outline",
      variant: "outline",
      route: "/health/reports",
      urgency: "low",
      ctaLabel: "Inspect Report",
    });
  }

  const journeyStages = deriveCareJourneyStages(
    activeAppointment,
    activeAppointmentIntel,
  );

  return {
    pulse: {
      stateKey,
      level: pulseLevel,
      headline,
      subheadline,
      badgeLabel,
      badgeVariant,
      pulseColor,
      icon,
    },
    primaryAction: primaryActions[0] || null,
    secondaryActions,
    activeAppointment,
    activeAppointmentIntel,
    journeyStages,
    pendingDosesToday,
    completedDosesToday,
    pendingFollowUps,
    upcomingAppointments,
    metrics: {
      todayAppointmentsCount: todayAppointments.length,
      pendingDosesCount: pendingDosesToday.length,
      pendingFollowUpsCount: pendingFollowUps.length,
      unreadNotificationsCount: unreadNotifications,
      walletItemsCount: walletCount,
    },
  };
}

