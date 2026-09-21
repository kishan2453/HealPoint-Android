/**
 * HealPoint - Super Admin analytics computation helpers.
 *
 * Every number in this file is derived from REAL backend records only.
 * Nothing is invented: when there is no data for a range, the helpers
 * return an empty result and the UI shows an honest empty state instead.
 */
import type { Appointment, Doctor, PlatformUser } from '@/types';
import {
  appointmentDepartment,
  appointmentDoctorName,
  appointmentHospitalName,
  appointmentPatientName,
  appointmentPayment,
  appointmentReference,
  hospitalIdValue,
} from '@/lib/appointments';
import { doctorHospitalName } from '@/lib/doctor';
import { MONTHS_SHORT } from '@/lib/format';

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------
export interface AnalyticsRange {
  key: string;
  label: string;
  from: Date | null;
  to: Date | null;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23,  59,  59,  999);
  return d;
}

function daysAgo(days: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
}

export function findRangePreset(key: string): AnalyticsRange {
  const presets = dateRangePresets();
  return presets.find((range) => range.key === key) || presets[0];
}

export function formatRangeLabel(range: AnalyticsRange | null | undefined): string {
  return range?.label || 'All time';
}

/** Live date-range presets (re-evaluated each render so "today" stays correct). */
export function dateRangePresets(): AnalyticsRange[] {
  const now = new Date();
  const todayStart = startOfDay(now);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() -  1,  1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(),  0);
  return [
    { key: 'all', label: 'All time', from: null,to: null },
    { key: 'today', label: 'Today', from: todayStart,to: endOfDay(now) },
    { key: '7d', label: 'Last 7 days', from: daysAgo(6), to: endOfDay(now) },
    { key: '30d', label: 'Last 30 days', from: daysAgo(29), to: endOfDay(now) },
    { key: 'month', label: 'This month', from: thisMonth,to: endOfDay(now) },
    { key: 'lastmonth', label: 'Last month', from: startOfDay(lastMonthStart), to: endOfDay(lastMonthEnd) },
  ];
}

/** Parse an ISO/date string to a Date (or null when invalid). */
function parseDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateInRange(value: string | Date | null | undefined, range: AnalyticsRange): boolean {
  const date = parseDate(value);
  if (date) {
    if (range.from && date.getTime() < range.from.getTime()) return false;
    if (range.to && date.getTime() > range.to.getTime()) return false;
    return true;
  }
  // No usable date: only counted in the "All time" universe (never a bounded range).
  return !range.from && !range.to;
}

export function appointmentCreatedInRange(appointment: Appointment, range: AnalyticsRange): boolean {
  return dateInRange(appointment.createdAt, range);
}

export function patientCreatedInRange(patient: PlatformUser, range: AnalyticsRange): boolean {
  return dateInRange(patient.createdAt, range);
}

// ---------------------------------------------------------------------------
// Status / payment helpers
// ---------------------------------------------------------------------------
export function normalizeStatus(status?: string): string {
  const raw = (status || '').trim().toLowerCase();
  if (raw === 'cancelled') return 'cancel';
  return raw;
}

export interface StatusCount { status: string; count: number }

export function appointmentStatusBreakdown(appointments: Appointment[]): StatusCount[] {
  const map: Record<string, number> = {};
  for (const appointment of appointments) {
    const status = normalizeStatus(appointment.status) || 'unknown';
    map[status] = (map[status] || 0) + 1;
  }
  return Object.entries(map)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

export function statusCount(appointments: Appointment[], status: string): number {
  const wanted = normalizeStatus(status);
  return appointments.filter((appointment) => normalizeStatus(appointment.status) === wanted).length;
}

export interface PaymentRow { status: string; label: string; count: number; amount: number }

/** Payment-state breakdown from real appointment payment fields (lib/appointments). */
export function paymentBreakdown(appointments: Appointment[]): PaymentRow[] {
  const map = new Map<string, PaymentRow>();
  for (const appointment of appointments) {
    const payment = appointmentPayment(appointment);
    let entry = map.get(payment.status);
    if (!entry) {
      entry = { status: payment.status, label: payment.label, count: 0, amount: 0 };
      map.set(payment.status, entry);
    }
    entry.count +=  1;
    entry.amount += Number(appointment.amount || 0);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

/** Revenue strictly from CONFIRMED/paid records per the existing business logic. */
export function paidRevenue(appointments: Appointment[]): number {
  return appointments.reduce((sum, appointment) => {
    const payment = appointmentPayment(appointment);
    if (payment.paid) return sum + Number(appointment.amount || 0);
    return sum;
  }, 0);
}

export function paidAppointmentCount(appointments: Appointment[]): number {
  return appointments.filter((appointment) => appointmentPayment(appointment).paid).length;
}
// ---------------------------------------------------------------------------
// Trends (appointments / patient registrations)
// ---------------------------------------------------------------------------
export interface TrendBucket {
  key: string;
  label: string;
  count: number;
}

function dayKey(date: Date): string {
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

function monthKey(date: Date): string {
  return date.getFullYear() + '-' + date.getMonth();
}

function bucketLabel(date: Date): string {
  return date.getDate() + ' ' + MONTHS_SHORT[date.getMonth()];
}

function monthLabel(date: Date): string {
  return MONTHS_SHORT[date.getMonth()] + ' ' + String(date.getFullYear()).slice(-2);
}

function capBuckets(buckets: TrendBucket[], max: number): TrendBucket[] {
  if (buckets.length <= max) return buckets;
  const excess = buckets.slice(0, buckets.length - max +  1);
  const kept = buckets.slice(buckets.length - max +  1);
  const total = excess.reduce((sum, bucket) => sum + bucket.count,  0);
  return [{ key: 'earlier', label: 'Earlier (' + excess.length + ' buckets)', count: total }, ...kept];
}

function buildTrend(dates: Date[], range: AnalyticsRange, maxBuckets =  24): TrendBucket[] {
  if (dates.length ===  0) return [];
  const minTime = Math.min(...dates.map((date) => date.getTime()));
  const maxTime = Math.max(...dates.map((date) => date.getTime()));
  const from = startOfDay(range.from ?? new Date(minTime));
  const to = endOfDay(range.to ?? new Date(maxTime));
  const spanDays = Math.round((to.getTime() - from.getTime()) / 86400000) +  1;

  if (spanDays <=  35) {

    const byDay = new Map<string, TrendBucket>();
    for (const date of dates){
      const key = dayKey(date);
      const entry = byDay.get(key);
      if (entry) entry.count +=  1;
      else byDay.set(key, { key, label: bucketLabel(date), count:  1 });
    }
    return [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  if (spanDays <=  200) {

    const chunks = new Map<string, TrendBucket>();
    for (const date of dates){
      const diff = Math.floor((startOfDay(date).getTime() - from.getTime()) / (7 * 86400000));
      const start = new Date(from.getFullYear(), from.getMonth(), from.getDate() + diff *  7);
      const key = dayKey(start);
      const entry = chunks.get(key);
      if (entry) entry.count +=  1;
      else chunks.set(key, { key, label: bucketLabel(start), count:  1 });
    }
    return capBuckets([...chunks.values()].sort((a, b) => a.key.localeCompare(b.key)), maxBuckets);
  }

  const byMonth = new Map<string, TrendBucket>();
  for (const date of dates){
    const key = monthKey(date);
    const entry = byMonth.get(key);
    if (entry) entry.count +=  1;
    else byMonth.set(key, { key, label: monthLabel(date), count:  1 });
  }
  return capBuckets([...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)), maxBuckets);
}

/** Appointment booking trend from real createdAt timestamps (bounded by range). */
export function appointmentTrend(appointments: Appointment[], range: AnalyticsRange): TrendBucket[] {
  const dates = appointments
    .map((appointment) => parseDate(appointment.createdAt))
    .filter((date): date is Date => Boolean(date));
  return buildTrend(dates, range);
}

/** New patient registrations trend from real patient createdAt values. */
export function patientTrend(patients: PlatformUser[], range: AnalyticsRange): TrendBucket[] {
  const dates = patients
    .map((patient) => parseDate(patient.createdAt))
    .filter((date): date is Date => Boolean(date));
  return buildTrend(dates, range);
}
// ---------------------------------------------------------------------------
// Rankings (hospitals / doctors / departments)
// ---------------------------------------------------------------------------
export interface RankRow {
  key: string;
  label: string;
  count: number;
}

function buildRanking(
  rows: Map<string, { label: string; count: number }>,
  limit: number,
): RankRow[] {
  return [...rows.values()]
    .map(function (row) {
      return { key: row.label, ...row };
    })
    .sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}

/** Hospitals ranked by real appointment count (populated hospitalId/name). */
export function topHospitals(appointments: Appointment[], limit: number): RankRow[] {
  const buckets = new Map<string, { label: string; count: number }>();
  for (const appointment of appointments) {
    const label = appointmentHospitalName(appointment);
    const entry = buckets.get(label);
    if (entry) entry.count += 1;
    else buckets.set(label, { label, count: 1 });
  }
  return buildRanking(buckets, limit);
}

/** Doctors ranked by real appointment count (populated doctorId/name). */
export function topDoctors(appointments: Appointment[], limit: number): RankRow[] {
  const buckets = new Map<string, { label: string; count: number }>();
  for (const appointment of appointments) {
    const label = appointmentDoctorName(appointment);
    const entry = buckets.get(label);
    if (entry) entry.count += 1;
    else buckets.set(label, { label, count: 1 });
  }
  return buildRanking(buckets, limit);
}

/** Departments ranked by real appointment count (doctor.department). */
export function topDepartments(appointments: Appointment[], limit: number): RankRow[] {
  const buckets = new Map<string, { label: string; count: number }>();
  for (const appointment of appointments) {
    const label = appointmentDepartment(appointment) || 'Not available';
    const entry = buckets.get(label);
    if (entry) entry.count += 1;
    else buckets.set(label, { label, count: 1 });
  }
  return buildRanking(buckets, limit);
}

/** Unique patient count across real appointments (sanitized ids only). */
export function uniquePatientCount(appointments: Appointment[]): number {
  const ids = new Set<string>();
  for (const appointment of appointments) {
    const userId = appointment.userId;
    if (userId && typeof userId === 'object') {
      const id = (userId as { _id?: unknown })._id;
      if (typeof id === 'string' && id) ids.add(id);
    } else if (typeof userId === 'string' && userId) {
      ids.add(userId);
    }
  }
  return ids.size;
}
// ---------------------------------------------------------------------------
// Report tables
// ---------------------------------------------------------------------------
export interface AppointmentSummaryRow {
  hospital: string;
  doctor: string;
  appointments: number;
  completed: number;
  cancelled: number;
  paid: number;
}

/** Appointment summary table aggregated from REAL appointment records. */
export function appointmentSummaryRows(appointments: Appointment[]): AppointmentSummaryRow[] {
  const byKeys = new Map<string, AppointmentSummaryRow>();
  for (const appointment of appointments) {
    const hospital = appointmentHospitalName(appointment);
    const doctor = appointmentDoctorName(appointment);
    const key = hospital + '|' + doctor;
    const status = normalizeStatus(appointment.status);
    const payment = appointmentPayment(appointment);
    let row = byKeys.get(key);
    if (!row) {
      row = { hospital, doctor, appointments: 0, completed: 0, cancelled: 0, paid: 0 };
      byKeys.set(key, row);
    }
    row.appointments += 1;
    if (status === 'completed') row.completed += 1;
    if (status === 'cancel' || status === 'missed') row.cancelled += 1;
    if (payment.paid) row.paid += 1;
  }
  return [...byKeys.values()].sort((a, b) => b.appointments - a.appointments || a.hospital.localeCompare(b.hospital));
}

export interface HospitalSummaryRow {
  hospital: string;
  doctors: number;
  appointments: number;
  active: boolean;
}

/** Hospital summary aggregated from real hospitals (counts) + appointments. */
export function hospitalSummaryRows(
  hospitals: { _id: string; name: string; isActive?: boolean; doctorCount?: number }[],
  appointments: Appointment[],
): HospitalSummaryRow[] {
  const apptCounts = new Map<string, number>();
  for (const appointment of appointments) {
    const id = hospitalIdValue(appointment);
    const key = id || appointmentHospitalName(appointment);
    apptCounts.set(key, (apptCounts.get(key) || 0) + 1);
  }
  return hospitals.map((hospital) => {
    const key = String(hospital._id);
    const byName = appointmentHospitalName({ hospitalId: hospital } as Appointment);
    return {
      hospital: hospital.name || 'Unnamed hospital',
      doctors: hospital.doctorCount ?? 0,
      appointments: apptCounts.get(key) ?? apptCounts.get(byName) ?? 0,
      active: hospital.isActive !== false,
    };
  });
}

export interface DoctorSummaryRow {
  doctor: string;
  hospital: string;
  appointments: number;
  completed: number;
  active: boolean;
}

/** Doctor summary from real doctors + their real appointment counts. */
export function doctorSummaryRows(
  doctors: Doctor[],
  appointments: Appointment[],
): DoctorSummaryRow[] {
  const byKeys = new Map<string, { doctor: string; hospital: string; appointments: number; completed: number }>();
  const apptByDoctor = new Map<string, string>();
  for (const appointment of appointments) {
    const doctorLabel = appointmentDoctorName(appointment);
    if (doctorLabel === 'Not available') continue;
    const entry = byKeys.get(doctorLabel);
    if (entry) {
      entry.appointments += 1;
      if (normalizeStatus(appointment.status) === 'completed') entry.completed += 1;
      apptByDoctor.set(doctorLabel, appointmentHospitalName(appointment));
    } else {
      byKeys.set(doctorLabel, {
        doctor: doctorLabel,
        hospital: appointmentHospitalName(appointment),
        appointments: 1,
        completed: normalizeStatus(appointment.status) === 'completed' ? 1 : 0,
      });
      apptByDoctor.set(doctorLabel, appointmentHospitalName(appointment));
    }
  }
  const apptDoctorNames = new Set(byKeys.keys());
  for (const doctor of doctors) {
    const label = doctor.name || 'Unnamed doctor';
    if (!apptDoctorNames.has(label)) {
      byKeys.set(label, {
        doctor: label,
        hospital: doctorHospitalName(doctor),
// ---------------------------------------------------------------------------
        appointments: 0,
        completed: 0,
      });
    } else {
      const entry = byKeys.get(label);
      if (entry && !entry.hospital && doctorHospitalName(doctor)) {
        entry.hospital = doctorHospitalName(doctor);
      }
    }
  }
  return [...byKeys.values()].sort((a, b) => b.appointments - a.appointments || a.doctor.localeCompare(b.doctor))
    .map((row) => ({ ...row, active: true }));
}

// CSV export (real filtered data only â€” never fake rows)
// ---------------------------------------------------------------------------
export type CsvCell = string | number | boolean;

export interface CsvTable {
  columns: string[];
  rows: Record<string, CsvCell>[];
}

function csvEscape(value: CsvCell | null | undefined): string {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
  return text;
}

export function toCsv(table: CsvTable): string {
  const lines: string[] = [table.columns.map((column) => csvEscape(column)).join(',')];
  for (const row of table.rows) {
    lines.push(table.columns.map((column) => csvEscape(row[column])).join(','));
  }
  return lines.join('\n');
}

/** Appointment analytics report as a CSV (the currently filtered REAL records). */
export function buildAppointmentsCsv(
  appointments: Appointment[],
  range: AnalyticsRange,
  counter: number,
): { filename: string; content: string } {
  const table: CsvTable = {
    columns: [
      'Reference',
      'Patient',
      'Doctor',
      'Hospital',
      'Department',
      'Slot date',
      'Slot time',
      'Status',
      'Payment status',
      'Amount (INR)',
      'Booked on',
    ],
    rows: appointments.map((appointment) => ({
      Reference: appointmentReference(appointment),
      Patient: appointmentPatientName(appointment),
      Doctor: appointmentDoctorName(appointment),
      Hospital: appointmentHospitalName(appointment),
      Department: appointmentDepartment(appointment) || 'Not available',
      'Slot date': appointment.slotDate || 'Not available',
      'Slot time': appointment.slotTime || 'Not available',
      Status: normalizeStatus(appointment.status) || 'unknown',
      'Payment status': appointmentPayment(appointment).label,
      'Amount (INR)': Number(appointment.amount || 0),
      'Booked on': appointment.createdAt || '',
    })),
  };
  const safeKey = range.key.replace(/[^a-z0-9]/gi, '');
  return {
    filename: 'healpoint-appointments-' + (safeKey || 'all') + '-' + counter + '.csv',
    content: toCsv(table),
  };
}
