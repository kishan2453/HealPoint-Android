/**
 * HealPoint - appointment presentation helpers.
 *
 * Every value in this file is derived from REAL backend appointment records
 * only (GET /appointment/get-all?platform=1). Where the backend does not
 * expose a field, the helper returns an explicit "Not available" style so we
 * never invent a patient, doctor, hospital, or payment value.
 */
import type { Appointment } from '@/types';

/** Today's date as the backend slot format `DD-MM-YYYY`. */
export function todayKey(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()}`;
}

/** Parse a backend slot date (`DD-MM-YYYY`) to a local Date at midnight, or null. */
export function parseSlotDate(value?: string): Date | null {
  if (!value) return null;
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Appointment reference preferred by the app: stored display id, then id, then short mongo id. */
export function appointmentReference(appointment: Appointment): string {
  const stored = appointment.displayAppointmentId || appointment.appointmentId;
  if (stored?.trim()) return stored.trim();
  return `#${String(appointment._id || '').slice(-6) || '——'}`;
}

interface PopulatedUser {
  _id?: unknown;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
}

function populatedUser(appointment: Appointment): PopulatedUser | null {
  const userId = appointment.userId as unknown;
  if (userId && typeof userId === 'object') return userId as PopulatedUser;
  return null;
}

/** Patient name from the populated relation, or an honest fallback. */
export function appointmentPatientName(appointment: Appointment): string {
  const user = populatedUser(appointment);
  if (user?.name && typeof user.name === 'string' && user.name.trim()) return user.name.trim();
  return 'Not available';
}
export function appointmentDoctorName(appointment: Appointment): string {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === 'object') {
    const name = (doctor as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return 'Not available';
}

export function appointmentDoctorSpecialty(appointment: Appointment): string {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === 'object') {
    const raw = (doctor as { speciality?: string }).speciality || (doctor as { specialization?: string }).specialization;
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return '';
}

export function appointmentDepartment(appointment: Appointment): string {
  const doctor = appointment.doctorId;
  if (doctor && typeof doctor === 'object') {
    const dept = (doctor as { department?: string }).department;
    if (typeof dept === 'string' && dept.trim()) return dept.trim();
  }
  return '';
}

export function hospitalIdValue(appointment: Appointment): string {
  const hospital = appointment.hospitalId;
  if (hospital && typeof hospital === 'object') {
    const id = (hospital as { _id?: unknown })._id;
    if (typeof id === 'string') return id;
  }
  return '';
}

export function appointmentHospitalName(appointment: Appointment): string {
  if (appointment.hospitalName?.trim()) return appointment.hospitalName.trim();
  const hospital = appointment.hospitalId;
  if (hospital && typeof hospital === 'object') {
    const name = (hospital as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  return 'Not available';
}

export function appointmentPatientPhone(appointment: Appointment): string {
  const user = populatedUser(appointment);
  if (user?.phone && typeof user.phone === 'string' && user.phone.trim()) return user.phone.trim();
  return (appointment.patientPhone || '').trim();
}

export function appointmentPatientEmail(appointment: Appointment): string {
  const user = populatedUser(appointment);
  return user?.email && typeof user.email === 'string' ? user.email.trim() : '';
}
export interface AppointmentPayment {
  /** Normalised status used for local filters. */
  status: 'paid' | 'pending' | 'failed' | 'refunded' | 'cancelled' | 'cash' | 'unpaid';
  label: string;
  paid: boolean;
  raw: string;
}

/** Normalized payment picture derived from the real backend fields. */
export function appointmentPayment(appointment: Appointment): AppointmentPayment {
  const raw = (appointment.paymentStatus || '').trim().toLowerCase();
  const paid = appointment.payment === true || ['success', 'paid', 'succeeded', 'captured', 'completed'].includes(raw);
  if (paid) return { status: 'paid', label: 'Paid', paid: true, raw };
  if (raw === 'refunded' || raw === 'refund') return { status: 'refunded', label: 'Refunded', paid: false, raw };
  if (raw === 'failed') return { status: 'failed', label: 'Payment failed', paid: false, raw };
  if (raw === 'cancelled' || raw === 'cancel') return { status: 'cancelled', label: 'Payment cancelled', paid: false, raw };
  if (raw === 'pending' || raw === 'processing') return { status: 'pending', label: 'Payment pending', paid: false, raw };
  if (appointment.paymentMethod === 'online') return { status: 'unpaid', label: 'Payment due', paid: false, raw };
  if (appointment.paymentMethod === 'cash') return { status: 'cash', label: 'Pay at clinic', paid: false, raw };
  return { status: 'unpaid', label: 'Unpaid', paid: false, raw };
}

/** Flat lower-cased search text across every real field we can search on. */
export function appointmentSearchable(appointment: Appointment): string {
  const hospital = appointment.hospitalId;
  return [
    appointmentReference(appointment),
    appointment._id,
    appointmentPatientName(appointment),
    appointmentPatientPhone(appointment),
    appointmentPatientEmail(appointment),
    appointmentDoctorName(appointment),
    appointmentDoctorSpecialty(appointment),
    appointmentDepartment(appointment),
    appointmentHospitalName(appointment),
    typeof hospital === 'object' ? (hospital as { about?: string }).about : '',
    appointment.slotDate,
    appointment.slotTime,
    appointment.paymentStatus,
    appointment.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** True when the appointment falls on the given `DD-MM-YYYY` date. */
export function isAppointmentOn(appointment: Appointment, ddMMyyyy: string): boolean {
  return (appointment.slotDate || '').trim() === ddMMyyyy;
}

/** Chronological sort key: slot date + slot time (createdAt as a tiebreaker). */
export function appointmentSortKey(appointment: Appointment): { datetime: number; created: string } {
  const parsed = parseSlotDate(appointment.slotDate);
  const hour = parse12hTime(appointment.slotTime);
  const datetime = parsed ? parsed.getTime() + hour : 0;
  return { datetime, created: appointment.createdAt || '' };
}

/** Best-effort minutes-of-day for a `"09:00 AM"` style slot time. */
export function parse12hTime(value?: string): number {
  if (!value) return 0;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return 0;
  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  if (/pm/i.test(match[3] || '')) hours += 12;
  return hours * 60 + minutes;
}