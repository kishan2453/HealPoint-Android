'use strict';

/**
 * HealPoint Part 5 - Bulk scheduling + hospital calendar + conflict services.
 *
 * This module EXTENDS the existing slotService (same Slot collection, same
 * engine, same idempotency index) - it never creates a second scheduling or
 * slot system. All functions reuse slotService primitives so booking safety,
 * duplicate protection and hospital scoping stay identical.
 */

const engine = require('./slotEngine');
const slotService = require('./slotService');
const conflictService = require('./conflictService');

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function ok(data) { return { success: true, data }; }

function weekdayIndexOf(dateKey) {
  const parsed = engine.parseDateKey(dateKey);
  return parsed ? parsed.getDay() : -1;
}

function expandBulkDates(fromDate, toDate, daysOfWeek, maxDays) {
  const all = engine.dateRange(fromDate, toDate, { maxDays: maxDays || 93 });
  if (!Array.isArray(daysOfWeek) || !daysOfWeek.length) return all;
  const wanted = new Set(
    daysOfWeek.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d >= 0 && d <= 6),
  );
  if (!wanted.size) return all;
  return all.filter((d) => wanted.has(weekdayIndexOf(d)));
}

function toDateOnly(dateKey) {
  const parsed = engine.parseDateKey(dateKey);
  if (!parsed) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function bookedKeyOf(value) {
  const normalized = engine.normalizeTime(value);
  return normalized || String(value || '').trim();
}

async function appointmentsFor(Slot, Appointment, hospitalId, doctorId, dates) {
  void Slot;
  if (!Appointment || typeof Appointment.find !== 'function') return [];
  try {
    const query = { doctorId: doctorId, slotDate: { $in: dates } };
    if (hospitalId) query.hospitalId = hospitalId;
    const found = Appointment.find(query);
    const rows = found && typeof found.lean === 'function' ? await found.lean() : await found;
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    return [];
  }
}

function hospitalIdOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  try { return String(value); } catch (err) { return ''; }
}

/** Real conflict detection for one doctor+range. */
async function detectConflicts(Slot, Doctor, doctorId, fromDate, toDate, opts, Appointment) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await slotService.loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const range = engine.resolveRange(fromDate, toDate, { maxDays: normalized.maxDays || 42, now: normalized.now });
  if (!range || !range.fromDate) throw httpError(400, 'Invalid date range');
  const dates = engine.dateRange(range.fromDate, range.toDate, { maxDays: normalized.maxDays || 42 });
  if (!dates.length) throw httpError(400, 'Invalid date range');
  if (normalized.slotDurationMinutes && !((normalized.slotDurationMinutes >= 5) && (normalized.slotDurationMinutes <= 240))) {
    throw httpError(422, 'Slot duration must be between 5 and 240 minutes.');
  }
  const slotRows = await listSlots(Slot, doctor, dates);
  const appts = Appointment
    ? await appointmentsFor(Slot, Appointment, hospitalIdOf(doctor.hospitalId), doctor._id, dates)
    : [];
  const detected = conflictService.detectAll(doctor, dates, slotRows, appts);
  return ok({
    doctorId: doctor._id, doctorName: doctor.name, hospitalId: doctor.hospitalId,
    range: { fromDate: range.fromDate, toDate: range.toDate },
    summary: detected.summary, conflicts: detected.conflicts, dateMarkers: detected.dateMarkers,
  });
}

async function listSlots(Slot, doctor, dates) {
  const found = Slot.find({ hospitalId: doctor.hospitalId, doctorId: doctor._id, date: { $in: dates } });
  const rows = found && typeof found.lean === 'function' ? await found.lean() : await found;
  return Array.isArray(rows) ? rows : [];
}

/** Bulk scheduling PREVIEW. Never writes. Real numbers from engine + DB. */
async function planBulkScheduling(Slot, Doctor, doctorId, payload, opts, Appointment) {
  const extra = (payload && payload.options && typeof payload.options === 'object') ? payload.options : {};
  const normalized = Object.assign({}, opts, extra);
  const doctor = await slotService.loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const fromDate = engine.normalizeDateKey(payload.fromDate) || null;
  const toDate = engine.normalizeDateKey(payload.toDate) || null;
  if (!fromDate || !toDate) throw httpError(422, 'fromDate and toDate are required (DD-MM-YYYY).');
  const fromOnly = toDateOnly(fromDate);
  const toOnly = toDateOnly(toDate);
  if (!fromOnly || !toOnly || toOnly.getTime() < fromOnly.getTime()) {
    throw httpError(422, 'Invalid date range: toDate is before fromDate.');
  }
  const behavior = payload.behavior === 'regenerate_available' ? 'regenerate_available' : 'generate_missing';
  const slotDuration = payload.slotDurationMinutes ? Number(payload.slotDurationMinutes) : null;
  if (slotDuration !== null && !(slotDuration >= 5 && slotDuration <= 240)) {
    throw httpError(422, 'Slot duration must be between 5 and 240 minutes.');
  }
  const dates = expandBulkDates(fromDate, toDate, payload.daysOfWeek, 93);
  if (!dates.length) throw httpError(422, 'No dates match the selected days of week.');
  const existing = await listSlots(Slot, doctor, dates);
  const byDate = {};
  dates.forEach((d) => { byDate[d] = []; });
  existing.forEach((s) => { if (byDate[s.date]) byDate[s.date].push(s); });
  const perDate = [];
  const totals = {
    datesAffected: dates.length, expectedSlots: 0, existingSlots: existing.length,
    bookedSlots: 0, conflicts: 0, skippedSlots: 0, newSlots: 0,
    blockedDates: 0, leaveDates: 0, holidayDates: 0, overrideDates: 0,
  };
  for (const dateKey of dates) {
    const plan = engine.generateDaySlots(doctor, dateKey, {
      now: normalized.now, slotDurationMinutes: slotDuration || undefined,
    });
    const rows = byDate[dateKey] || [];
    const booked = rows.filter((s) => s.status === 'booked' || s.appointmentId).length;
    const blocked = rows.filter((s) => s.status === 'blocked').length;
    totals.bookedSlots += booked;
    const entry = {
      date: dateKey, reason: plan.reason, expected: 0, existing: rows.length,
      booked, blocked, skipped: 0, created: 0, leave: null, holiday: null,
      override: null, hasBreak: false, conflicts: [],
    };
    if (plan.reason !== 'open') {
      totals.skippedSlots += (plan.slots || []).length;
      if (plan.reason === 'leave') { entry.leave = 'Leave'; totals.leaveDates += 1; }
      if (plan.reason === 'holiday') { entry.holiday = 'Holiday'; totals.holidayDates += 1; }
      if (plan.reason === 'override_closed') { entry.override = 'Closed'; totals.overrideDates += 1; }
      const detected = conflictService.detectAll(
        doctor, [dateKey], rows,
        Appointment ? await appointmentsFor(Slot, Appointment, hospitalIdOf(doctor.hospitalId), doctor._id, [dateKey]) : [],
      );
      entry.conflicts = detected.conflicts;
      totals.conflicts += detected.conflicts.length;
      perDate.push(entry);
      continue;
    }
    const wanted = plan.slots || [];
    entry.expected = wanted.length;
    totals.expectedSlots += wanted.length;
    const have = new Set(rows.map((s) => bookedKeyOf(s.startTime)));
    let fresh = 0;
    wanted.forEach((w) => { if (!have.has(bookedKeyOf(w.startTime))) fresh += 1; });
    entry.created = fresh;
    totals.newSlots += fresh;
    if (plan.schedule && plan.schedule.exclusions && plan.schedule.exclusions.length) entry.hasBreak = true;
    if (plan.schedule && plan.schedule.sessions) entry.sessions = plan.schedule.sessions;
    perDate.push(entry);
  }
  return ok({
    doctorId: doctor._id, doctorName: doctor.name, hospitalId: doctor.hospitalId,
    range: { fromDate, toDate }, behavior, slotDurationMinutes: slotDuration,
    daysOfWeek: payload.daysOfWeek || [], totals, perDate,
  });
}
/** Bulk scheduling APPLY. Reuses generate/regenerate per date (idempotent). */
async function applyBulkScheduling(Slot, Doctor, doctorId, payload, opts) {
  const plan = await planBulkScheduling(Slot, Doctor, doctorId, payload, opts, null);
  const behavior = plan.data.behavior;
  const dates = (plan.data.perDate || []).map((d) => d.date);
  const slotDuration = plan.data.slotDurationMinutes || undefined;
  const result = {
    created: 0, skipped: 0, alreadyExisting: 0,
    bookedProtected: plan.data.totals.bookedSlots || 0,
    blocked: 0, leaveConflicts: plan.data.totals.leaveDates || 0,
    holidayConflicts: plan.data.totals.holidayDates || 0,
    overrideConflicts: plan.data.totals.overrideDates || 0,
    otherConflicts: 0, failed: 0, perDate: [],
  };
  for (const dateKey of dates) {
    try {
      const single = behavior === 'regenerate_available'
        ? await slotService.regenerateDates(Slot, Doctor, doctorId, dateKey, dateKey, {
          now: (opts && opts.now) || new Date(), slotDurationMinutes: slotDuration,
        })
        : await slotService.generateForDates(Slot, Doctor, doctorId, [dateKey], {
          now: (opts && opts.now) || new Date(),
          actorId: opts && opts.actorId, slotDurationMinutes: slotDuration,
        });
      const d = single.data || {};
      result.created += d.created || 0;
      result.alreadyExisting += d.alreadyExisting || 0;
      result.skipped += (d.skippedLeave || 0) + (d.skippedHoliday || 0) + (d.skippedOverride || 0) + (d.skippedPast || 0) + (d.skippedUnavailable || 0);
      result.blocked += d.preservedBlocked || 0;
      result.bookedProtected += d.preservedBooked || 0;
      result.otherConflicts += d.conflicts || 0;
      result.perDate.push({ date: dateKey, created: d.created || 0, alreadyExisting: d.alreadyExisting || 0 });
    } catch (err2) {
      result.failed += 1;
      result.perDate.push({ date: dateKey, failed: true, message: (err2 && err2.message) || 'Failed' });
    }
  }
  return ok(result);
}

/** Block many AVAILABLE slots. Booked rows stay protected. */
async function bulkBlockSlots(Slot, Doctor, doctorId, items, opts) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const preDoctor = await slotService.loadDoctor(Doctor, doctorId);
  if (!preDoctor) throw httpError(404, 'Doctor not found');
  const list = Array.isArray(items) ? items : [];
  if (!list.length) throw httpError(422, 'No slots supplied.');
  if (list.length > 200) throw httpError(422, 'Too many slots (max 200 per bulk action).');
  const result = { blocked: 0, alreadyBlocked: 0, protected: 0, failed: 0, perSlot: [] };
  for (const item of list) {
    const dateKey = engine.normalizeDateKey(item && item.date);
    const start = engine.normalizeTime(item && item.startTime);
    if (!dateKey || !start) { result.failed += 1; continue; }
    try {
      const out = await slotService.blockSlot(Slot, Doctor, doctorId, dateKey, start, {
        reason: (item && item.reason) || normalized.reason, actorId: normalized.actorId,
      });
      result.blocked += 1;
      result.perSlot.push({ date: dateKey, startTime: start, status: (out.data && out.data.status) || 'blocked' });
    } catch (err) {
      if (err && err.statusCode === 409) {
        const msg = String((err && err.message) || '');
        if (/appointment/i.test(msg)) result.protected += 1;
        else result.alreadyBlocked += 1;
        result.perSlot.push({ date: dateKey, startTime: start, skipped: true, message: msg });
      } else {
        result.failed += 1;
        result.perSlot.push({ date: dateKey, startTime: start, failed: true, message: (err && err.message) || 'Failed' });
      }
    }
  }
  return ok(result);
}

/** Unblock many BLOCKED unbooked slots. */
async function bulkUnblockSlots(Slot, Doctor, doctorId, items, opts) {
  const doctor = await slotService.loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const list = Array.isArray(items) ? items : [];
  if (!list.length) throw httpError(422, 'No slots supplied.');
  if (list.length > 200) throw httpError(422, 'Too many slots (max 200 per bulk action).');
  const result = { unblocked: 0, skipped: 0, failed: 0, perSlot: [] };
  for (const item of list) {
    const dateKey = engine.normalizeDateKey(item && item.date);
    const start = engine.normalizeTime(item && item.startTime);
    if (!dateKey || !start) { result.failed += 1; continue; }
    try {
      const out = await slotService.unblockSlot(Slot, Doctor, doctorId, dateKey, start, opts);
      result.unblocked += 1;
      result.perSlot.push({ date: dateKey, startTime: start, status: (out.data && out.data.status) || 'available' });
    } catch (err) {
      if (err && err.statusCode === 409) {
        result.skipped += 1;
        result.perSlot.push({ date: dateKey, startTime: start, skipped: true, message: (err && err.message) || 'Skipped' });
      } else {
        result.failed += 1;
        result.perSlot.push({ date: dateKey, startTime: start, failed: true, message: (err && err.message) || 'Failed' });
      }
    }
  }
  return ok(result);
}

/** Clear ONLY unbooked generated slots (available/expired, no appointment). */
async function clearUnbookedSlots(Slot, Doctor, doctorId, fromDate, toDate, opts) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await slotService.loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const range = engine.resolveRange(fromDate, toDate, { maxDays: 93, now: normalized.now });
  if (!range || !range.fromDate) throw httpError(400, 'Invalid date range');
  const dates = engine.dateRange(range.fromDate, range.toDate, { maxDays: 93 });
  if (!dates.length) throw httpError(400, 'Invalid date range');
  const res = await Slot.deleteMany({
    hospitalId: doctor.hospitalId,
    doctorId: doctor._id,
    date: { $in: dates },
    status: { $in: ['available', 'expired'] },
    appointmentId: null,
  });
  const cleared = (res && (res.deletedCount || 0)) || 0;
  const remaining = await Slot.countDocuments({
    hospitalId: doctor.hospitalId, doctorId: doctor._id, date: { $in: dates },
  });
  return ok({ cleared, remaining, range: { fromDate: range.fromDate, toDate: range.toDate } });
}

/** Multi-doctor hospital calendar aggregation. */
async function getHospitalCalendar(Slot, Doctor, doctorIds, fromDate, toDate, opts, Appointment) {
  const normalized2 = (opts && typeof opts === 'object') ? opts : {};
  const range2 = engine.resolveRange(fromDate, toDate, { maxDays: normalized2.maxDays || 42, now: normalized2.now });
  if (!range2 || !range2.fromDate) throw httpError(400, 'Invalid date range');
  const dates2 = engine.dateRange(range2.fromDate, range2.toDate, { maxDays: normalized2.maxDays || 42 });
  if (!dates2.length) throw httpError(400, 'Invalid date range');
  const ids = Array.isArray(doctorIds) ? doctorIds.map((v) => String(v)).filter(Boolean) : [];
  if (!ids.length) throw httpError(422, 'No doctors supplied.');
  if (ids.length > 50) throw httpError(422, 'Too many doctors (max 50 per calendar request).');
  const perDoctor = [];
  const perDateMap = {};
  dates2.forEach((d) => {
    perDateMap[d] = {
      date: d, available: 0, booked: 0, blocked: 0, cancelled: 0, expired: 0,
      leave: 0, holiday: 0, override: 0, doctors: [],
    };
  });
  for (const id of ids) {
    const doctor = await slotService.loadDoctor(Doctor, id);
    if (!doctor) continue;
    if (normalized2.department) {
      const want = String(normalized2.department).trim().toLowerCase();
      const got = String(doctor.department || doctor.speciality || '').trim().toLowerCase();
      if (want && got !== want) continue;
    }
    const cal = await slotService.getCalendar(Slot, Doctor, doctor._id, range2.fromDate, range2.toDate, normalized2);
    const slotRows = await listSlots(Slot, doctor, dates2);
    const appts = Appointment
      ? await appointmentsFor(Slot, Appointment, hospitalIdOf(doctor.hospitalId), doctor._id, dates2)
      : [];
    const detected = conflictService.detectAll(doctor, dates2, slotRows, appts);
    const doctorAppts = {};
    appts.forEach((a) => {
      const k = engine.normalizeDateKey(a.slotDate || a.date);
      if (!k) return;
      if (!doctorAppts[k]) doctorAppts[k] = [];
      doctorAppts[k].push({
        id: String(a._id || a.id || ''),
        slotTime: a.slotTime || a.startTime || null,
        status: a.status || null,
        paymentStatus: a.paymentStatus || null,
      });
    });
    const perDate = (cal.data.perDate || []).map((day) => {
      const marker = (detected.dateMarkers || []).find((m) => m.date === day.date) || null;
      const agg = perDateMap[day.date];
      if (agg) {
        (day.slots || []).forEach((s) => { if (agg[s.status] !== undefined) agg[s.status] += 1; });
        if (marker && marker.leave) agg.leave += 1;
        if (marker && marker.holiday) agg.holiday += 1;
        if (marker && marker.override) agg.override += 1;
        agg.doctors.push(String(doctor._id));
      }
      return { date: day.date, slots: day.slots || [], marker, appointments: doctorAppts[day.date] || [] };
    });
    perDoctor.push({
      doctorId: doctor._id, doctorName: doctor.name,
      department: doctor.department || doctor.speciality || null,
      counts: cal.data.counts, perDate,
    });
  }
  return ok({
    range: { fromDate: range2.fromDate, toDate: range2.toDate },
    perDoctor, perDate: dates2.map((d) => perDateMap[d]),
  });
}

module.exports = {
  detectConflicts,
  planBulkScheduling,
  applyBulkScheduling,
  bulkBlockSlots,
  bulkUnblockSlots,
  clearUnbookedSlots,
  getHospitalCalendar,
};
