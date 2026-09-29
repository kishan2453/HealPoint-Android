/**
 * HealPoint — Smart Re-Booking & One-Tap Repeat Appointment Intelligence.
 *
 * Deterministic helper module managing eligibility, context preservation
 * (doctor, hospital, department, consultation type, family member),
 * and route parameter generation for repeat medical consultations.
 */
import type { Router } from "expo-router";

import { parseSlotDateTime } from "@/lib/appointment-intelligence";
import { formatDoctorName } from "@/lib/format";
import type { Appointment, AppointmentDetails, ConsultationType } from "@/types";

/**
 * Extracts the doctor MongoDB ID from an appointment whether it is a raw ID string,
 * a populated Doctor object, or an AppointmentDetails structure.
 */
export function getRebookDoctorId(
  appointment?: Appointment | AppointmentDetails | null,
): string {
  if (!appointment) return "";
  const anyAppt = appointment as any;
  const doc = anyAppt.doctorId || anyAppt.doctor;
  if (!doc) return "";
  if (typeof doc === "string") return doc.trim();
  if (typeof doc === "object") {
    if ("_id" in doc && doc._id) return String(doc._id).trim();
    if ("id" in doc && doc.id) return String(doc.id).trim();
  }
  return "";
}

/**
 * Extracts the doctor's display name from an appointment.
 */
export function getRebookDoctorName(
  appointment?: Appointment | AppointmentDetails | null,
): string {
  if (!appointment) return "Doctor";
  const anyAppt = appointment as any;
  const doc = anyAppt.doctorId || anyAppt.doctor;
  if (typeof doc === "object" && doc && "name" in doc && doc.name) {
    return formatDoctorName(doc.name);
  }
  if (anyAppt.doctorName) {
    return formatDoctorName(anyAppt.doctorName);
  }
  return "Doctor";
}

/**
 * Extracts the medical specialty or department from an appointment.
 */
export function getRebookDoctorSpecialty(
  appointment?: Appointment | AppointmentDetails | null,
): string {
  if (!appointment) return "Specialist";
  const anyAppt = appointment as any;
  const doc = anyAppt.doctorId || anyAppt.doctor;
  if (typeof doc === "object" && doc) {
    if ("speciality" in doc && doc.speciality) return String(doc.speciality);
    if ("specialization" in doc && doc.specialization)
      return String(doc.specialization);
    if ("department" in doc && doc.department) return String(doc.department);
  }
  if (anyAppt.doctorSpecialty) return String(anyAppt.doctorSpecialty);
  if (anyAppt.doctorDepartment) return String(anyAppt.doctorDepartment);
  return "Specialist";
}

/**
 * Extracts the hospital name from an appointment.
 */
export function getRebookHospitalName(
  appointment?: Appointment | AppointmentDetails | null,
): string {
  if (!appointment) return "";
  const anyAppt = appointment as any;
  if (anyAppt.hospitalName) return String(anyAppt.hospitalName).trim();
  const doc = anyAppt.doctorId || anyAppt.doctor;
  if (typeof doc === "object" && doc) {
    if ("hospitalName" in doc && doc.hospitalName)
      return String(doc.hospitalName);
    if ("clinicInfo" in doc && doc.clinicInfo?.name)
      return String(doc.clinicInfo.name);
  }
  return "";
}

/**
 * Extracts the hospital ID from an appointment if available.
 */
export function getRebookHospitalId(
  appointment?: Appointment | AppointmentDetails | null,
): string {
  if (!appointment) return "";
  const anyAppt = appointment as any;
  if (anyAppt.hospitalId) {
    const hid = anyAppt.hospitalId;
    if (typeof hid === "string") return hid.trim();
    if (typeof hid === "object" && hid && "_id" in hid) return String(hid._id).trim();
  }
  const doc = anyAppt.doctorId || anyAppt.doctor;
  if (typeof doc === "object" && doc && "hospitalId" in doc && doc.hospitalId) {
    return String(doc.hospitalId).trim();
  }
  return "";
}

/**
 * Determines if an appointment is eligible for "Book Again" / Repeat Consultation.
 *
 * Eligible appointments:
 * - Completed visits
 * - Cancelled visits
 * - Missed visits
 * - Past scheduled visits whose slot date/time has already lapsed
 *
 * Ineligible:
 * - Active upcoming visits (pending approval, or confirmed/rescheduled for future dates/times)
 * - Missing doctor ID
 */
export function isAppointmentEligibleForRebook(
  appointment?: Appointment | AppointmentDetails | null,
): boolean {
  if (!appointment) return false;
  const doctorId = getRebookDoctorId(appointment);
  if (!doctorId) return false;

  const anyAppt = appointment as any;
  const rawStatus = String(
    anyAppt.status || anyAppt.bookingStatus || "",
  ).toLowerCase().trim();

  // Completed, cancelled, and missed visits are always rebookable
  if (rawStatus === "completed" || rawStatus === "cancel" || rawStatus === "missed") {
    return true;
  }

  // Pending appointments are active upcoming requests awaiting doctor confirmation
  if (rawStatus === "pending") {
    return false;
  }

  // Check if slot date/time has passed
  const slotDate = String(
    anyAppt.slotDate || anyAppt.bookingDate || anyAppt.date || "",
  ).trim();
  const slotTime = String(
    anyAppt.slotTime || anyAppt.bookingTime || anyAppt.time || "",
  ).trim();
  const slotDateTime = parseSlotDateTime(slotDate, slotTime);

  if (slotDateTime && slotDateTime.getTime() < Date.now()) {
    // Slot is in the past — rebooking is allowed
    return true;
  }

  // Future confirmed/rescheduled appointments are currently active
  return false;
}

export interface RebookParams {
  doctorId: string;
  type: ConsultationType;
  mode: "scheduled" | "instant";
  memberId?: string;
  hospitalId?: string;
  previousAppointmentId?: string;
  source: "rebook";
  [key: string]: string | undefined;
}

/**
 * Constructs the query parameters for navigating to the booking screen.
 * Reuses:
 * - Same doctor
 * - Same hospital
 * - Same consultation type (clinic vs video)
 * - Same patient/family dependent
 */
export function buildRebookParams(
  appointment: Appointment | AppointmentDetails,
): RebookParams {
  const anyAppt = appointment as any;
  const doctorId = getRebookDoctorId(appointment);
  const consultationType: ConsultationType =
    anyAppt.consultationType === "video" ? "video" : "clinic";
  const hospitalId = getRebookHospitalId(appointment);
  const memberId = anyAppt.familyMemberId
    ? String(anyAppt.familyMemberId).trim()
    : "";
  const previousAppointmentId = String(
    anyAppt._id || anyAppt.appointmentId || anyAppt.mongoAppointmentId || "",
  ).trim();

  const params: RebookParams = {
    doctorId,
    type: consultationType,
    mode: "scheduled",
    source: "rebook",
  };

  if (memberId) {
    params.memberId = memberId;
  }
  if (hospitalId) {
    params.hospitalId = hospitalId;
  }
  if (previousAppointmentId) {
    params.previousAppointmentId = previousAppointmentId;
  }

  return params;
}

/**
 * Performs type-safe navigation to the booking screen with complete rebook context.
 */
export function navigateToRebook(
  router: Router | { push: (arg: any) => void },
  appointment: Appointment | AppointmentDetails,
): void {
  const doctorId = getRebookDoctorId(appointment);
  if (!doctorId) {
    router.push("/doctors" as never);
    return;
  }

  const params = buildRebookParams(appointment);
  router.push({
    pathname: "/booking/[doctorId]",
    params,
  });
}
