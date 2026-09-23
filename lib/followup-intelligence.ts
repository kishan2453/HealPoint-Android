/**
 * HealPoint — Smart Follow-Up & Care Plan Intelligence Engine.
 *
 * Deterministic, server-aligned care plan intelligence derived strictly from
 * authentic MongoDB appointment records, doctor instructions, prescriptions,
 * and lab reports.
 *
 * This engine:
 * 1. Identifies follow-up requirements from real consultation advice
 * 2. Correlates subsequent patient visits to determine lifecycle status:
 *    - PENDING_BOOKING: Doctor advised follow-up; patient hasn't booked yet
 *    - SCHEDULED: Patient has a confirmed/pending subsequent visit with this doctor
 *    - COMPLETED: The follow-up consultation has taken place and finished
 *    - CANCELLED: The underlying visit was cancelled
 * 3. Estimates recommended target dates from doctor advice (e.g. "after 7 days")
 * 4. Resolves single-click next actions (Book Slot, View Prescription, View Reports)
 *
 * Strict safety rules:
 * - NO diagnosis or disease prediction
 * - NO artificial treatment generation
 * - NO invented dates or phantom appointments
 */

import { formatDDMMYYYY, formatDoctorName } from "@/lib/format";
import { parseSlotDate } from "@/lib/appointments";
import type { Appointment, AppointmentDetails } from "@/types";

export type FollowUpStatus =
  | "pending_booking"
  | "scheduled"
  | "completed"
  | "cancelled";

export interface FollowUpNextAction {
  key:
    | "BOOK_FOLLOWUP"
    | "VIEW_APPOINTMENT"
    | "VIEW_PRESCRIPTION"
    | "VIEW_REPORTS"
    | "JOIN_CONSULTATION";
  label: string;
  icon: string;
  variant: "primary" | "secondary" | "outline";
  route: string;
  params?: Record<string, string>;
}

export interface FollowUpCarePlanItem {
  id: string;
  appointmentId: string;
  displayAppointmentId?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorImage?: string;
  hospitalId?: string;
  hospitalName: string;
  department: string;
  consultationType: "clinic" | "video";
  originalVisitDate: string;
  originalVisitTime: string;
  originalStatus: string;
  advice: string;
  recommendedTimeframe?: string;
  recommendedTargetDate?: string;
  status: FollowUpStatus;
  statusLabel: string;
  statusVariant: "warning" | "primary" | "success" | "neutral";
  hasPrescription: boolean;
  medicinesCount: number;
  hasReports: boolean;
  reportsCount: number;
  linkedAppointmentId?: string;
  linkedAppointmentDate?: string;
  linkedAppointmentTime?: string;
  nextAction: FollowUpNextAction;
}

/**
 * Parses textual follow-up advice to extract a recommended timeframe or date.
 * Examples:
 * - "Review after 7 days" -> "7 days"
 * - "Follow up in 2 weeks with blood report" -> "2 weeks"
 * - "Come back after 1 month" -> "1 month"
 * - "Review in 3 days" -> "3 days"
 */
export function parseRecommendedTimeframe(
  advice: string,
  baseDateDDMMYYYY?: string,
): { timeframe?: string; targetDate?: string } {
  if (!advice || typeof advice !== "string") return {};
  const clean = advice.trim().toLowerCase();

  let daysToAdd = 0;
  let timeframe = "";

  const dayMatch = /(?:after|in|within)?\s*(\d+)\s*days?/i.exec(clean);
  const weekMatch = /(?:after|in|within)?\s*(\d+)\s*weeks?/i.exec(clean);
  const monthMatch = /(?:after|in|within)?\s*(\d+)\s*months?/i.exec(clean);

  if (dayMatch) {
    daysToAdd = parseInt(dayMatch[1], 10);
    timeframe = `${daysToAdd} Days`;
  } else if (weekMatch) {
    const weeks = parseInt(weekMatch[1], 10);
    daysToAdd = weeks * 7;
    timeframe = `${weeks} Week${weeks > 1 ? "s" : ""}`;
  } else if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    daysToAdd = months * 30;
    timeframe = `${months} Month${months > 1 ? "s" : ""}`;
  } else if (clean.includes("next week")) {
    daysToAdd = 7;
    timeframe = "1 Week";
  } else if (clean.includes("tomorrow")) {
    daysToAdd = 1;
    timeframe = "1 Day";
  } else {
    // Default standard clinical review window if advice mentions review/follow-up
    timeframe = "As Advised";
  }

  let targetDate: string | undefined;
  if (daysToAdd > 0 && baseDateDDMMYYYY) {
    const parsedBase = parseSlotDate(baseDateDDMMYYYY);
    if (parsedBase) {
      const target = new Date(parsedBase.getTime());
      target.setDate(target.getDate() + daysToAdd);
      const d = String(target.getDate()).padStart(2, "0");
      const m = String(target.getMonth() + 1).padStart(2, "0");
      targetDate = `${d}-${m}-${target.getFullYear()}`;
    }
  }

  return { timeframe, targetDate };
}

/**
 * Extracts normalized Doctor ID from appointment.
 */
function resolveDoctorId(
  appointment: Appointment | AppointmentDetails,
): string {
  if (typeof appointment.doctorId === "object" && appointment.doctorId) {
    const docObj = appointment.doctorId as { _id?: string };
    if (docObj._id) return String(docObj._id);
  }
  return String(appointment.doctorId || "");
}

/**
 * Extracts normalized Doctor Name.
 */
function resolveDoctorName(
  appointment: Appointment | AppointmentDetails,
): string {
  if (typeof appointment.doctorId === "object" && appointment.doctorId) {
    const docObj = appointment.doctorId as { name?: string };
    if (docObj.name) return docObj.name;
  }
  return appointment.doctorName || "Doctor";
}

/**
 * Extracts normalized Doctor Specialty.
 */
function resolveDoctorSpecialty(
  appointment: Appointment | AppointmentDetails,
): string {
  if (typeof appointment.doctorId === "object" && appointment.doctorId) {
    const docObj = appointment.doctorId as {
      speciality?: string;
      specialization?: string;
    };
    if (docObj.speciality) return docObj.speciality;
    if (docObj.specialization) return docObj.specialization;
  }
  return appointment.doctorSpecialty || "Specialist";
}

/**
 * Extracts normalized Hospital Name.
 */
function resolveHospitalName(
  appointment: Appointment | AppointmentDetails,
): string {
  if (appointment.hospitalName?.trim()) return appointment.hospitalName.trim();
  if (typeof appointment.hospitalId === "object" && appointment.hospitalId) {
    const hospObj = appointment.hospitalId as { name?: string };
    if (hospObj.name) return hospObj.name;
  }
  return "HealPoint Hospital";
}

/**
 * Main Pure Intelligence Resolver.
 * Computes all active and completed care plans from the patient's real appointment history.
 */
export function deriveFollowUpsFromAppointments(
  appointments: Appointment[],
): FollowUpCarePlanItem[] {
  if (!Array.isArray(appointments) || appointments.length === 0) {
    return [];
  }

  // Filter all visits where doctor provided follow-up instructions/advice
  const candidateAppointments = appointments.filter((appt) => {
    const advice = (appt.followUpAdvice || "").trim();
    const instructions =
      (appt as { prescriptionInstructions?: { followUpInstructions?: string } })
        .prescriptionInstructions?.followUpInstructions || "";
    return advice.length > 0 || instructions.trim().length > 0;
  });

  const carePlans: FollowUpCarePlanItem[] = [];

  for (const appt of candidateAppointments) {
    const apptId = String(appt._id);
    const advice =
      (appt.followUpAdvice || "").trim() ||
      (
        appt as {
          prescriptionInstructions?: { followUpInstructions?: string };
        }
      ).prescriptionInstructions?.followUpInstructions?.trim() ||
      "Follow-up visit recommended by doctor";

    const docId = resolveDoctorId(appt);
    const docName = resolveDoctorName(appt);
    const docSpec = resolveDoctorSpecialty(appt);
    const hospName = resolveHospitalName(appt);
    const dept =
      (typeof appt.doctorId === "object" &&
        appt.doctorId &&
        (appt.doctorId as { department?: string }).department) ||
      docSpec;

    const baseDate = appt.slotDate || appt.appointmentDate || "";
    const baseTime = appt.slotTime || "";
    const originalStatus = (appt.status || "").toLowerCase();

    const { timeframe, targetDate } = parseRecommendedTimeframe(
      advice,
      baseDate,
    );

    // Correlate with all subsequent appointments for this doctor
    const baseDateObj = parseSlotDate(baseDate);
    const subsequentAppts = appointments.filter((other) => {
      if (String(other._id) === apptId) return false;
      const otherDocId = resolveDoctorId(other);
      if (otherDocId !== docId) return false;
      if (!baseDateObj) return false;
      const otherDateObj = parseSlotDate(
        other.slotDate || other.appointmentDate,
      );
      if (!otherDateObj) return false;
      return otherDateObj.getTime() >= baseDateObj.getTime();
    });

    // Check if any subsequent appointment is completed, confirmed, or pending
    const completedSubsequent = subsequentAppts.find(
      (a) => a.status === "completed",
    );
    const scheduledSubsequent = subsequentAppts.find(
      (a) => a.status === "confirmed" || a.status === "pending",
    );

    let status: FollowUpStatus = "pending_booking";
    let statusLabel = "Follow-Up Due";
    let statusVariant: FollowUpCarePlanItem["statusVariant"] = "warning";
    let linkedAppt: Appointment | undefined;

    if (originalStatus === "cancel" || originalStatus === "missed") {
      status = "cancelled";
      statusLabel = "Consultation Cancelled";
      statusVariant = "neutral";
    } else if (completedSubsequent) {
      status = "completed";
      statusLabel = "Follow-Up Completed";
      statusVariant = "success";
      linkedAppt = completedSubsequent;
    } else if (scheduledSubsequent) {
      status = "scheduled";
      statusLabel = "Follow-Up Scheduled";
      statusVariant = "primary";
      linkedAppt = scheduledSubsequent;
    } else {
      status = "pending_booking";
      statusLabel = "Follow-Up Due";
      statusVariant = "warning";
    }

    // Prescription and Reports availability
    const medicinesCount = Array.isArray(appt.medicines)
      ? appt.medicines.length
      : appt.medicinesCount || 0;
    const hasPrescription =
      Boolean(appt.prescription?.trim()) || medicinesCount > 0;
    const reportsCount = Array.isArray(appt.medicalReports)
      ? appt.medicalReports.length
      : appt.reportsCount || 0;
    const hasReports = reportsCount > 0;

    // Single Deterministic Next Action
    let nextAction: FollowUpNextAction;
    if (status === "pending_booking") {
      nextAction = {
        key: "BOOK_FOLLOWUP",
        label: "Book Follow-Up Visit",
        icon: "calendar-outline",
        variant: "primary",
        route: "/booking/[doctorId]",
        params: { doctorId: docId },
      };
    } else if (status === "scheduled" && linkedAppt) {
      if (
        linkedAppt.consultationType === "video" &&
        (linkedAppt.consultationStatus === "in_progress" ||
          linkedAppt.meetingStatus === "ready")
      ) {
        nextAction = {
          key: "JOIN_CONSULTATION",
          label: "Join Online Consultation",
          icon: "videocam-outline",
          variant: "primary",
          route: "/consultation/[id]",
          params: { id: String(linkedAppt._id) },
        };
      } else {
        nextAction = {
          key: "VIEW_APPOINTMENT",
          label: "View Scheduled Visit",
          icon: "calendar-outline",
          variant: "primary",
          route: "/appointment/[id]",
          params: { id: String(linkedAppt._id) },
        };
      }
    } else if (hasPrescription) {
      nextAction = {
        key: "VIEW_PRESCRIPTION",
        label: "View Prescription",
        icon: "document-text-outline",
        variant: "secondary",
        route: "/(drawer)/health/prescriptions",
      };
    } else {
      nextAction = {
        key: "VIEW_APPOINTMENT",
        label: "View Visit Details",
        icon: "clipboard-outline",
        variant: "outline",
        route: "/appointment/[id]",
        params: { id: apptId },
      };
    }

    carePlans.push({
      id: `careplan-${apptId}`,
      appointmentId: apptId,
      displayAppointmentId:
        appt.displayAppointmentId ||
        appt.appointmentId ||
        `#${apptId.slice(-6)}`,
      doctorId: docId,
      doctorName: formatDoctorName(docName),
      doctorSpecialty: docSpec,
      hospitalName: hospName,
      department: dept,
      consultationType: appt.consultationType === "video" ? "video" : "clinic",
      originalVisitDate: formatDDMMYYYY(baseDate) || baseDate,
      originalVisitTime: baseTime,
      originalStatus,
      advice,
      recommendedTimeframe: timeframe,
      recommendedTargetDate: targetDate,
      status,
      statusLabel,
      statusVariant,
      hasPrescription,
      medicinesCount,
      hasReports,
      reportsCount,
      linkedAppointmentId: linkedAppt ? String(linkedAppt._id) : undefined,
      linkedAppointmentDate: linkedAppt
        ? formatDDMMYYYY(linkedAppt.slotDate) || linkedAppt.slotDate
        : undefined,
      linkedAppointmentTime: linkedAppt?.slotTime,
      nextAction,
    });
  }

  // Sort: Pending Booking first, then Scheduled, then Completed
  return carePlans.sort((a, b) => {
    const score = (s: FollowUpStatus) => {
      switch (s) {
        case "pending_booking":
          return 1;
        case "scheduled":
          return 2;
        case "completed":
          return 3;
        case "cancelled":
          return 4;
      }
    };
    return score(a.status) - score(b.status);
  });
}
