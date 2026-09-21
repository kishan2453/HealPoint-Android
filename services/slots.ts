/**
 * HealPoint — Hospital Admin · Slot Management API.
 *
 * Mirrors the drop-in backend module `server-slots/routes/slotRoutes.js`.
 * Every endpoint is scoped server-side to the admin's OWN hospital; a foreign
 * doctor/slot request returns 403. Times use "HH:mm" (24h) and dates use
 * "DD-MM-YYYY" to match the existing HealPoint slot format.
 */
import { api } from './api';

export interface SlotItem {
  id: string;
  date: string; // DD-MM-YYYY
  startTime: string; // HH:mm (24h machine form)
  endTime: string; // HH:mm
  status: 'available' | 'booked' | 'blocked' | 'cancelled' | 'expired';
  appointmentId?: string | null;
  blockReason?: string | null;
  blockedAt?: string | null;
  source?: string | null;
}

export interface SlotDay {
  date: string;
  slots: SlotItem[];
}

export interface SlotPreviewTotals {
  expected: number;
  alreadyExisting: number;
  booked: number;
  blocked: number;
  staleAvailable: number;
  skipped: number;
  dates: number;
}

export interface SlotPreviewDate {
  date: string;
  reason: string;
  expected: number;
  alreadyExisting: number;
  overlappingBooked: number;
  overlappingBlocked: number;
  staleAvailable: number;
  slots: { startTime: string; endTime: string }[];
  schedule?: {
    status?: string;
    sessions?: { startTime: string; endTime: string; name?: string }[];
    exclusions?: { startTime: string; endTime: string; name?: string }[];
    reason?: string | null;
  } | null;
}

export interface SlotPreviewResponse {
  success: boolean;
  data?: {
    doctorId: string;
    doctorName?: string;
    hospitalId?: string;
    range: { fromDate: string; toDate: string };
    totals: SlotPreviewTotals;
    perDate: SlotPreviewDate[];
  };
}

export interface SlotGenerateResponse {
  success: boolean;
  data?: {
    created: number;
    alreadyExisting: number;
    skippedLeave: number;
    skippedHoliday: number;
    skippedOverride: number;
    skippedPast: number;
    skippedUnavailable: number;
    conflicts: number;
    perDate: { date: string; reason: string; created: number; alreadyExisting: number; skipped: number }[];
  };
}

export interface SlotRegenerateResponse {
  success: boolean;
  data?: {
    created: number;
    alreadyExisting: number;
    released: number;
    expiredClosed: number;
    preservedBooked: number;
    preservedBlocked: number;
    perDate: { date: string; reason: string; created: number; alreadyExisting: number; released: number }[];
  };
}

export interface SlotCalendarResponse {
  success: boolean;
  data?: {
    doctorId: string;
    doctorName?: string;
    hospitalId?: string;
    range: { fromDate: string; toDate: string };
    perDate: SlotDay[];
    counts: { available: number; booked: number; blocked: number; cancelled: number; expired: number };
  };
}

export interface SlotBlockResponse {
  success: boolean;
  data?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    blockReason: string;
    blockedAt: string;
  };
}

export interface SlotUnblockResponse {
  success: boolean;
  data?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    note: string;
  };
}

type Params = Record<string, string | undefined>;

function toQuery(params: Params): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, value);
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Preview what would be generated before ANY insert (user-visible, no writes). */
export async function previewSlots(
  doctorId: string,
  fromDate: string,
  toDate: string,
): Promise<SlotPreviewResponse> {
  return api.get<SlotPreviewResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/preview${toQuery({ fromDate, toDate })}`,
    { auth: true },
  );
}

/** Create missing bookable slots for a date range. Idempotent server-side. */
export async function generateSlots(
  doctorId: string,
  fromDate: string,
  toDate: string,
): Promise<SlotGenerateResponse> {
  return api.post<SlotGenerateResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/generate`,
    { fromDate, toDate },
    { auth: true },
  );
}

/** Safely refill a range: inserts missing slots, releases stale available only. */
export async function regenerateSlots(
  doctorId: string,
  fromDate: string,
  toDate: string,
): Promise<SlotRegenerateResponse> {
  return api.post<SlotRegenerateResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/regenerate`,
    { fromDate, toDate },
    { auth: true },
  );
}

export interface SlotAvailabilityResponse {
  success: boolean;
  data?: {
    doctorId: string;
    date: string;
    slots: string[];
    source?: string;
    reason?: string;
  };
}

/** Read the slot calendar for a doctor (Doctor Portal reads the same data). */
export async function getSlotCalendar(
  doctorId: string,
  fromDate: string,
  toDate: string,
): Promise<SlotCalendarResponse> {
  return api.get<SlotCalendarResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/calendar${toQuery({ fromDate, toDate })}`,
    { auth: true },
  );
}

/**
 * Patient single-day availability from the SAME Slot inventory the Hospital
 * Admin manages (blocked/booked never advertised). Mounted at
 * `GET /slots/availability/:doctorId` behind the patient JWT.
 *
 * The legacy `/appointment/get-available-slots/:doctorId` flow is preserved:
 * booking tries the synced Slot inventory first and falls back to the legacy
 * endpoint when the slot module is not mounted on the deployed backend.
 */
export async function getSlotAvailability(
  doctorId: string,
  date: string,
): Promise<SlotAvailabilityResponse> {
  return api.get<SlotAvailabilityResponse>(
    `/slots/availability/${encodeURIComponent(doctorId)}${toQuery({ date })}`,
    { auth: true },
  );
}

/**
 * HealPoint - Doctor Portal · own slot calendar.
 *
 * Doctors read the SAME Slot inventory the Hospital Admin generates/blocks:
 * `GET /doctor/slots/calendar?fromDate&toDate` (auth: doctor JWT). The legacy
 * `GET /doctor/get-slots` schedule view is preserved (see getDoctorSlots
 * below); this is the persisted source of truth.
 */
export async function getDoctorSlotCalendar(
  fromDate: string,
  toDate: string,
): Promise<SlotCalendarResponse> {
  return api.get<SlotCalendarResponse>(
    `/doctor/slots/calendar${toQuery({ fromDate, toDate })}`,
    { auth: true },
  );
}

/**
 * Doctor Portal · single-day availability for the signed-in doctor (same
 * source of truth as the admin calendar + patient booking).
 */
export async function getDoctorSlotAvailability(date: string): Promise<SlotAvailabilityResponse> {
  return api.get<SlotAvailabilityResponse>(`/doctor/slots/availability${toQuery({ date })}`, { auth: true });
}

export interface SchedulingConflict {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  status: string;
  doctorId: string | null;
  doctorName: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  type: string;
  title: string;
  detail: string;
  existingRecord: unknown;
  conflictingRecord: unknown;
  recommendedAction: string;
}

export interface ConflictDateMarker {
  date: string;
  leave: { type?: string; reason?: string } | null;
  holiday: string | null;
  override: { closed?: boolean; reason?: string | null } | null;
  hasBreak: boolean;
  hasSchedule: boolean;
}

export interface ConflictListResponse {
  success: boolean;
  data?: {
    doctorId: string;
    doctorName?: string;
    hospitalId?: string;
    range: { fromDate: string; toDate: string };
    summary: { total: number; critical: number; warning: number; info: number; byType: Record<string, number> };
    conflicts: SchedulingConflict[];
    dateMarkers: ConflictDateMarker[];
  };
}

export interface BulkSchedulePayload {
  fromDate: string;
  toDate: string;
  daysOfWeek?: number[];
  behavior?: 'generate_missing' | 'regenerate_available';
  slotDurationMinutes?: number | null;
  confirm?: boolean;
}

/** Bulk apply result summary rendered from REAL backend numbers. */
export interface BulkResultSummary {
  created: number;
  skipped: number;
  alreadyExisting: number;
  bookedProtected: number;
  blocked: number;
  leaveConflicts: number;
  holidayConflicts: number;
  overrideConflicts: number;
  otherConflicts: number;
  failed: number;
}

/** Hospital calendar aggregate for the advanced cal card (per-date chips). */
export interface HospitalCalendarDay {
  date: string;
  available: number;
  booked: number;
  blocked: number;
  cancelled: number;
  expired: number;
  leave: number;
  holiday: number;
  override: number;
  doctors: string[];
}

/** Block an AVAILABLE slot. Booked slots are rejected server-side (409). */
export async function blockSlot(
  doctorId: string,
  date: string,
  startTime: string,
  reason: string,
): Promise<SlotBlockResponse> {
  return api.post<SlotBlockResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/block`,
    { date, startTime, reason },
    { auth: true },
  );
}

/** Unblock a blocked slot when it is safe to reopen (schedule still valid). */
export async function unblockSlot(
  doctorId: string,
  date: string,
  startTime: string,
): Promise<SlotUnblockResponse> {
  return api.post<SlotUnblockResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/unblock`,
    { date, startTime },
    { auth: true },
  );
}

export interface BulkDayPlan {
  date: string;
  reason: string;
  expected: number;
  existing: number;
  booked: number;
  blocked: number;
  skipped: number;
  created: number;
  leave: string | null;
  holiday: string | null;
  override: string | null;
  hasBreak: boolean;
  conflicts: SchedulingConflict[];
}

export interface BulkPreviewTotals {
  datesAffected: number;
  expectedSlots: number;
  existingSlots: number;
  bookedSlots: number;
  conflicts: number;
  skippedSlots: number;
  newSlots: number;
  blockedDates: number;
  leaveDates: number;
  holidayDates: number;
  overrideDates: number;
}

export interface BulkPreviewResponse {
  success: boolean;
  data?: {
    doctorId: string;
    doctorName?: string;
    hospitalId?: string;
    range: { fromDate: string; toDate: string };
    behavior: 'generate_missing' | 'regenerate_available';
    slotDurationMinutes: number | null;
    daysOfWeek: number[];
    totals: BulkPreviewTotals;
    perDate: BulkDayPlan[];
  };
}

export interface BulkApplyResponse {
  success: boolean;
  data?: {
    created: number;
    skipped: number;
    alreadyExisting: number;
    bookedProtected: number;
    blocked: number;
    leaveConflicts: number;
    holidayConflicts: number;
    overrideConflicts: number;
    otherConflicts: number;
    failed: number;
  };
}

export interface BulkBlockResponse {
  success: boolean;
  data?: { blocked: number; alreadyBlocked: number; protected: number; failed: number };
}

export interface BulkUnblockResponse {
  success: boolean;
  data?: { unblocked: number; skipped: number; failed: number };
}

export interface ClearUnbookedResponse {
  success: boolean;
  data?: { cleared: number; remaining: number; range: { fromDate: string; toDate: string } };
}

export interface HospitalCalendarResponse {
  success: boolean;
  data?: {
    range: { fromDate: string; toDate: string };
    perDoctor: {
      doctorId: string;
      doctorName?: string;
      department?: string | null;
      counts: { available: number; booked: number; blocked: number; cancelled: number; expired: number };
      perDate: { date: string; slots: SlotItem[]; marker: unknown; appointments: { id: string; slotTime: string | null; status: string | null }[] }[];
    }[];
    perDate: { date: string; available: number; booked: number; blocked: number; leave: number; holiday: number; override: number; doctors: string[] }[];
  };
}

/** Bulk preview: real per-date plan, no writes. */
export async function previewBulkScheduling(
  doctorId: string,
  payload: BulkSchedulePayload,
): Promise<BulkPreviewResponse> {
  return api.post<BulkPreviewResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/bulk/preview`,
    payload,
    { auth: true },
  );
}

/** Bulk apply: requires explicit confirm:true. */
export async function applyBulkScheduling(
  doctorId: string,
  payload: BulkSchedulePayload & { confirm: true },
): Promise<BulkApplyResponse> {
  return api.post<BulkApplyResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/bulk/apply`,
    payload,
    { auth: true },
  );
}

export async function bulkBlockSlots(
  doctorId: string,
  slots: { date: string; startTime: string; reason?: string }[],
  reason?: string,
): Promise<BulkBlockResponse> {
  return api.post<BulkBlockResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/bulk/block`,
    { slots, reason },
    { auth: true },
  );
}

export async function bulkUnblockSlots(
  doctorId: string,
  slots: { date: string; startTime: string }[],
): Promise<BulkUnblockResponse> {
  return api.post<BulkUnblockResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/bulk/unblock`,
    { slots },
    { auth: true },
  );
}

export async function clearUnbookedSlots(
  doctorId: string,
  fromDate: string,
  toDate: string,
): Promise<ClearUnbookedResponse> {
  return api.post<ClearUnbookedResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/clear-unbooked`,
    { fromDate, toDate, confirm: true },
    { auth: true },
  );
}

export async function getSchedulingConflicts(
  doctorId: string,
  fromDate: string,
  toDate: string,
): Promise<ConflictListResponse> {
  return api.get<ConflictListResponse>(
    `/admin/slots/${encodeURIComponent(doctorId)}/conflicts${toQuery({ fromDate, toDate })}`,
    { auth: true },
  );
}

export async function getHospitalCalendar(
  doctorIds: string[],
  fromDate: string,
  toDate: string,
  department?: string,
): Promise<HospitalCalendarResponse> {
  return api.get<HospitalCalendarResponse>(
    `/admin/slots/hospital/calendar${toQuery({ doctorIds: doctorIds.join(','), fromDate, toDate, department })}`,
    { auth: true },
  );
}