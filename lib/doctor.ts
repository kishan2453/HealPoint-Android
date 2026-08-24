/**
 * HealPoint - doctor presentation helpers.
 *
 * Everything in this file is derived from real backend catalog data only.
 * Availability and "next available slot" are computed from the fields the
 * server actually stores (`available`, `onlineStatus`, `timeSlots`) — we never
 * invent a status or a slot that the backend did not provide.
 */
import type { Doctor, DoctorTimeSlot, Hospital } from '@/types';

/** Specialty label: prefer stored specialty, fall back through the other fields. */
export function doctorSpecialty(doctor: Doctor): string {
  return doctor.speciality || doctor.specialization || doctor.department || 'General physician';
}

/** The hospital record (when the backend populated `hospitalId`). */
export function doctorHospital(doctor: Doctor): Hospital | undefined {
  return doctor.hospitalId && typeof doctor.hospitalId === 'object' ? doctor.hospitalId : undefined;
}

/** Hospital/clinic name for a doctor, matching the rest of the app's fallbacks. */
export function doctorHospitalName(doctor: Doctor): string {
  const hospital = doctorHospital(doctor);
  return (
    hospital?.name ||
    doctor.hospitalName ||
    doctor.clinicInfo?.name ||
    'Hospital details pending'
  );
}

/** Best-effort location text (doctor address → clinic → hospital). Never invents one. */
export function doctorLocationText(doctor: Doctor): string {
  const hospital = doctorHospital(doctor);
  const parts = [
    doctor.address,
    doctor.clinicInfo?.address,
    hospital?.location?.address,
    hospital?.location?.city,
    hospital?.location?.state,
  ].filter((value): value is string => Boolean(value && value.trim()));
  return parts.join(', ');
}

/** Flat lower-cased text used by the home search (name/specialty/hospital/location). */
export function doctorSearchableText(doctor: Doctor): string {
  const hospital = doctorHospital(doctor);
  const hospitalLocation = hospital?.location
    ? [hospital.location.address, hospital.location.city, hospital.location.state]
        .filter(Boolean)
        .join(' ')
    : '';
  return [
    doctor.name,
    doctor.email,
    doctorSpecialty(doctor),
    doctor.department,
    doctorHospitalName(doctor),
    doctor.clinicInfo?.name,
    doctor.address,
    doctor.clinicInfo?.address,
    hospitalLocation,
    ...(doctor.languages || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Parse a backend slot date (DD-MM-YYYY, with an ISO fallback) to a local Date. */
function parseSlotDate(value?: string): Date | null {
  if (!value) return null;
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  return null;
}

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export interface NextSlot {
  date: string;
  time: string;
}

/**
 * Earliest future, non-blocked slot taken from the doctor's real `timeSlots`.
 * Returns null when the backend provides no usable future slot.
 */
export function nextAvailableSlot(doctor: Doctor): NextSlot | null {
  const today = startOfToday();
  const candidates = (doctor.timeSlots || [])
    .filter((slot) => slot.isAvailable !== false)
    .map((slot) => ({ slot, parsed: parseSlotDate(slot.date) }))
    .filter((entry): entry is { slot: DoctorTimeSlot; parsed: Date } => {
      if (!entry.parsed) return false;
      const date = entry.parsed;
      date.setHours(0, 0, 0, 0);
      return date.getTime() >= today.getTime();
    })
    .sort((a, b) => {
      const byDate = a.parsed.getTime() - b.parsed.getTime();
      if (byDate !== 0) return byDate;
      return (a.slot.startTime || '').localeCompare(b.slot.startTime || '');
    });

  const first = candidates[0];
  if (!first?.slot.date) return null;
  return { date: first.slot.date, time: first.slot.startTime || '' };
}

/**
 * True availability, straight from the backend. `available: true` or an
 * explicit `onlineStatus: 'online'` counts; otherwise we only claim
 * availability when a real future time slot exists.
 */
export function isDoctorAvailable(doctor: Doctor): boolean {
  if (doctor.available === true || doctor.onlineStatus === 'online') return true;
  return nextAvailableSlot(doctor) !== null;
}