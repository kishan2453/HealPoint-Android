'use strict';

/**
 * HealPoint - Slot service.
 *
 * All slot mutations flow through here. Business rules:
 *  - Generation is IDEMPOTENT: the unique (hospital, doctor, date, startTime)
 *    index rejects duplicates; bulkWrite skips E11000 rows so two concurrent
 *    generation requests cannot duplicate slots (TEST 10).
 *  - Past dates are never generated (TEST past protection).
 *  - Leave / holiday / override-closed dates are skipped (TEST 4/5/6).
 *  - BOOKED slots are NEVER deleted or overwritten during regeneration (TEST 9).
 *  - Blocking an already-booked slot MUST fail server-side (TEST 8).
 *  - Every query is scoped by hospitalId; cross-hospital access is impossible
 */

const { generateDaySlots, dateRange, resolveRange, normalizeTime, normalizeDateKey, parseDateKey } = require('./slotEngine');
const conflictService = require('./conflictService');

const SLOT_STATUS_AVAILABLE = 'available';
const SLOT_STATUS_BOOKED = 'booked';
const SLOT_STATUS_BLOCKED = 'blocked';
const SLOT_STATUS_EXPIRED = 'expired';

function safeObjectId(value) {
  if (!value) return null;
  try {
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(value)) return new mongoose.Types.ObjectId(value);
  } catch (err) {
    // No mongoose in unit tests - keep the raw value.
  }
  return typeof value === 'string' ? value : String(value);
}

function httpError(status, message) {
  const err = new Error(message);
  err.statusCode = status;
  return err;
}

function ok(data) { return { success: true, data }; }

/**
 * Load a doctor whether the model is a real Mongoose model (findById returns
 * a Query with .lean()) or an injected test double (findById returns a
 * Promise of a plain object). Returns the plain doctor object or null.
 */
async function loadDoctor(Doctor, doctorId) {
  if (!Doctor || typeof Doctor.findById !== 'function') return null;
  const query = Doctor.findById(doctorId);
  // Real Mongoose: Query has a synchronous .lean() returning a Query (thenable).
  if (query && typeof query.lean === 'function') {
    try {
      const maybePromise = query.lean();
      if (maybePromise && typeof maybePromise.then === 'function') {
        return await maybePromise;
      }
      return maybePromise || null;
    } catch (err) {
      return null;
    }
  }
  // Test double / already-resolved doc.
  const doc = await query;
  if (!doc) return null;
  if (typeof doc.lean === 'function') {
    try {
      const out = doc.lean();
      return out && typeof out.then === 'function' ? await out : out;
    } catch (err) {
      return { ...doc };
    }
  }
  if (typeof doc.toObject === 'function') {
    try { return doc.toObject(); } catch (err) { /* fall through */ }
  }
  return doc;
}

/** Unwrap a hospitalId that may be an ObjectId, a populated doc, or a string. */
function hospitalIdOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  try { return String(value); } catch (err) { return ''; }
}

/** Normalize any stored 12h/24h time to 24h HH:mm for comparison. */
function bookedKeyOf(value) {
  const normalized = normalizeTime(value);
  return normalized || String(value || '').trim();
}

/**
 * Times already taken on a date: persisted booked/blocked Slots plus legacy
 * Appointment rows booked before the Slot inventory existed. Generation skips
 * (counts as conflicts) instead of overwriting them.
 */
async function bookedTimesFor(Slot, Appointment, hospitalId, doctorId, dateKey) {
  const taken = new Set();
  try {
    const bookedSlots = await findLean(
      Slot,
      { hospitalId: hospitalId, doctorId: doctorId, date: dateKey, status: { $in: [SLOT_STATUS_BOOKED, SLOT_STATUS_BLOCKED] } },
      { _id: 0, startTime: 1 }
    );
    for (const doc of bookedSlots) {
      if (doc && doc.startTime) taken.add(bookedKeyOf(doc.startTime));
    }
  } catch (err) { /* availability pre-check is best-effort */ }
  if (Appointment && typeof Appointment.find === 'function') {
    try {
      const rows = await findLean(Appointment, { doctorId: doctorId, slotDate: dateKey }, { _id: 0, slotTime: 1, status: 1 });
      for (const row of rows) {
        if (!row || !row.slotTime) continue;
        const status = String(row.status || '').toLowerCase();
        if (status === 'cancel' || status === 'cancelled' || status === 'canceled' || status === 'missed') continue;
        taken.add(bookedKeyOf(row.slotTime));
      }
    } catch (err) { /* legacy lookup is advisory only */ }
  }
  return taken;
}

/**
 * Mongoose `find()` returns a Query (chain with .lean(), then await it).
 * The in-memory test double returns `{ lean: () => docs[] }` synchronously.
 * This helper yields a plain array for either shape.
 */
async function findLean(Slot, filter, projection) {
  const cursor = Slot.find(filter, projection);
  if (cursor && typeof cursor.lean === 'function') {
    const out = cursor.lean();
    const docs = out && typeof out.then === 'function' ? await out : out;
    return Array.isArray(docs) ? docs : [];
  }
  const docs = await cursor;
  return Array.isArray(docs) ? docs : [];
}

async function findOneLean(Slot, filter) {
  if (!Slot || typeof Slot.findOne !== 'function') return null;
  const res = Slot.findOne(filter);
  // Mongoose without .lean(): Query (thenable) resolving to a doc.
  if (res && typeof res.lean === 'function') {
    const out = res.lean();
    return out && typeof out.then === 'function' ? await out : out;
  }
  const doc = res && typeof res.then === 'function' ? await res : res;
  if (!doc) return null;
  if (typeof doc.lean === 'function') {
    try {
      const out = doc.lean();
      return out && typeof out.then === 'function' ? await out : out;
    } catch (err) { return { ...doc }; }
  }
  if (typeof doc.toObject === 'function') {
    try { return doc.toObject(); } catch (err) { /* fall through */ }
  }
  return doc;
}

async function findByIdLean(Slot, id) {
  if (!Slot || typeof Slot.findById !== 'function') return null;
  const res = Slot.findById(id);
  if (res && typeof res.lean === 'function') {
    const out = res.lean();
    return out && typeof out.then === 'function' ? await out : out;
  }
  const doc = res && typeof res.then === 'function' ? await res : res;
  if (!doc) return null;
  if (doc && typeof doc.lean === 'function') {
    try {
      const out = doc.lean();
      return out && typeof out.then === 'function' ? await out : out;
    } catch (err) { return { ...doc }; }
  }
  if (doc && typeof doc.toObject === 'function') {
    try { return doc.toObject(); } catch (err) { /* fall through */ }
  }
  return doc;
}

/** Unwrap a findOneAndUpdate result across Mongoose + in-memory doubles. */
async function unwrapUpdated(updated) {
  if (!updated) return null;
  if (typeof updated.lean === 'function') {
    const out = updated.lean();
    return out && typeof out.then === 'function' ? await out : out;
  }
  const doc = updated && typeof updated.then === 'function' ? await updated : updated;
  if (!doc) return null;
  if (typeof doc.lean === 'function') {
    try {
      const out = doc.lean();
      return out && typeof out.then === 'function' ? await out : out;
    } catch (err) { return { ...doc }; }
  }
  if (typeof doc.toObject === 'function') {
    try { return doc.toObject(); } catch (err) { /* fall through */ }
  }
  return doc;
}

async function previewDate(Slot, doctor, dateKey, opts) {
  const normalizedDate = normalizeDateKey(dateKey) || dateKey;
  const plan = generateDaySlots(doctor, normalizedDate, opts);
  const existing = await findLean(
    Slot,
    { hospitalId: doctor.hospitalId, doctorId: doctor._id, date: normalizedDate },
    { _id: 1, startTime: 1, status: 1, endTime: 1 }
  );
  const byTime = new Map(existing.map((e) => [e.startTime, e]));
  const planned = new Set(plan.slots.map((s) => s.startTime));
  const alreadyExisting = plan.slots.filter((s) => byTime.has(s.startTime)).length;
  const bookedCount = [...byTime.values()].filter((e) => e.status === SLOT_STATUS_BOOKED).length;
  const blockedCount = [...byTime.values()].filter((e) => e.status === SLOT_STATUS_BLOCKED).length;
  const staleCount = [...byTime.values()].filter((e) => e.status === SLOT_STATUS_AVAILABLE && !planned.has(e.startTime)).length;
  return {
    date: dateKey,
    reason: plan.reason,
    expected: plan.slots.length,
    alreadyExisting,
    overlappingBooked: bookedCount,
    overlappingBlocked: blockedCount,
    staleAvailable: staleCount,
    slots: plan.slots,
    schedule: plan.schedule,
  };
}

async function previewGeneration(Slot, Doctor, doctorId, fromDate, toDate, opts) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const range = resolveRange(fromDate, toDate, normalized);
  if (!range || !range.fromDate) throw httpError(400, 'Invalid date range');
  const dates = dateRange(range.fromDate, range.toDate, normalized);
  if (!dates.length) throw httpError(400, 'Invalid date range');
  const perDate = [];
  const totals = { expected: 0, alreadyExisting: 0, booked: 0, blocked: 0, staleAvailable: 0, skipped: 0, dates: 0 };
  for (const dateKey of dates) {
    const row = await previewDate(Slot, doctor, dateKey, normalized);
    perDate.push(row);
    if (row.reason !== 'open') totals.skipped += 1;
    totals.expected += row.expected;
    totals.alreadyExisting += row.alreadyExisting;
    totals.booked += row.overlappingBooked;
    totals.blocked += row.overlappingBlocked;
    totals.staleAvailable += row.staleAvailable;
  }
  totals.dates = dates.length;
  return ok({
    doctorId: doctor._id,
    doctorName: doctor.name,
    hospitalId: doctor.hospitalId,
    range: { fromDate: range.fromDate, toDate: range.toDate },
    totals,
    perDate,
  });
}

async function generateForDates(Slot, Doctor, doctorId, dates, opts, Appointment) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const hospitalId = hospitalIdOf(doctor.hospitalId) || hospitalIdOf(normalized.hospitalId);
  if (!hospitalId) throw httpError(400, 'Doctor has no hospital');
  const cleanDates = Array.isArray(dates)
    ? [...new Set(dates.map((d) => normalizeDateKey(d)).filter(Boolean))]
    : [];
  if (!cleanDates.length) throw httpError(400, 'Invalid date range');
  const generatedBy = normalized.generatedBy || 'schedule';
  const result = { created: 0, alreadyExisting: 0, skippedLeave: 0, skippedHoliday: 0, skippedOverride: 0, skippedPast: 0, skippedUnavailable: 0, conflicts: 0, perDate: [] };
  for (const dateKey of cleanDates) {
    const plan = generateDaySlots(doctor, dateKey, normalized);
    const row = { date: dateKey, reason: plan.reason, created: 0, alreadyExisting: 0, skipped: 0 };
    if (plan.reason === 'past') { result.skippedPast += 1; row.skipped = 0; result.perDate.push(row); continue; }
    if (plan.reason === 'leave_full') { result.skippedLeave += 1; row.skipped = 0; result.perDate.push(row); continue; }
    if (plan.reason === 'holiday') { result.skippedHoliday += 1; row.skipped = 0; result.perDate.push(row); continue; }
    if (plan.reason === 'closed') { result.skippedOverride += 1; row.skipped = 0; result.perDate.push(row); continue; }
    if (plan.reason !== 'open') { result.skippedUnavailable += 1; row.skipped = 0; result.perDate.push(row); continue; }
    // Existing appointments (legacy bookings made before materialization) must
    // count as conflicts, not fresh slots.
    const bookedTimes = await bookedTimesFor(Slot, Appointment, hospitalId, doctor._id, dateKey);
    const desired = plan.slots.filter((s) => !bookedTimes.has(s.startTime));
    row.conflicts = plan.slots.length - desired.length;
    result.conflicts += row.conflicts;
    const ops = [];
    for (const slot of desired) {
      ops.push({
        updateOne: {
          filter: { hospitalId: hospitalId, doctorId: doctor._id, date: dateKey, startTime: slot.startTime },
          update: { $setOnInsert: { endTime: slot.endTime, status: SLOT_STATUS_AVAILABLE, generatedBy: generatedBy, source: normalized.source || 'schedule' } },
          upsert: true,
        },
      });
    }
    if (ops.length) {
      try {
        const res = await Slot.bulkWrite(ops, { ordered: false });
        const upserted = Number(res.upsertedCount || 0);
        row.created = upserted;
        row.alreadyExisting = ops.length - upserted;
      } catch (err) {
        if (err && err.code === 11000) { row.alreadyExisting = ops.length; }
        else { row.conflicts += ops.length; result.conflicts += ops.length; }
      }
    } else {
      row.alreadyExisting = 0;
    }
    result.created += row.created;
    result.alreadyExisting += row.alreadyExisting;
    result.perDate.push(row);
  }
  return ok(result);
}

async function regenerateDates(Slot, Doctor, doctorId, dates, opts, Appointment) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const hospitalId = hospitalIdOf(doctor.hospitalId) || hospitalIdOf(normalized.hospitalId);
  if (!hospitalId) throw httpError(400, 'Doctor has no hospital');
  const cleanDates = Array.isArray(dates)
    ? [...new Set(dates.map((d) => normalizeDateKey(d)).filter(Boolean))]
    : [];
  if (!cleanDates.length) throw httpError(400, 'Invalid date range');
  const result = { created: 0, alreadyExisting: 0, released: 0, expiredClosed: 0, preservedBooked: 0, preservedBlocked: 0, perDate: [] };
  const closedReasons = new Set(['leave_full', 'holiday', 'closed', 'past']);
  const pushOpenRow = (row) => {
    result.created += row.created;
    result.alreadyExisting += row.alreadyExisting;
    result.perDate.push(row);
  };
  for (const dateKey of cleanDates) {
    const plan = generateDaySlots(doctor, dateKey, normalized);
    const row = { date: dateKey, reason: plan.reason, created: 0, alreadyExisting: 0, released: 0 };
    if (plan.reason === 'open') {
      const bookedTimes = await bookedTimesFor(Slot, Appointment, hospitalId, doctor._id, dateKey);
      const desired = plan.slots.filter((s) => !bookedTimes.has(s.startTime));
      const ops = [];
      for (const slot of desired) {
        ops.push({
          updateOne: {
            filter: { hospitalId: hospitalId, doctorId: doctor._id, date: dateKey, startTime: slot.startTime },
            update: { $setOnInsert: { endTime: slot.endTime, status: SLOT_STATUS_AVAILABLE, generatedBy: 'regenerate', source: normalized.source || 'schedule' } },
            upsert: true,
          },
        });
      }
      if (ops.length) {
        try {
          const res = await Slot.bulkWrite(ops, { ordered: false });
          const upserted = Number(res.upsertedCount || 0);
          row.created = upserted;
          row.alreadyExisting = ops.length - upserted;
        } catch (err) {
          if (err && err.code === 11000) { row.alreadyExisting = ops.length; }
          else { row.conflicts = ops.length; }
        }
      }
      pushOpenRow(row);
      const planned = new Set(plan.slots.map((s) => s.startTime));
      const stale = await findLean(
        Slot,
        { hospitalId: hospitalId, doctorId: doctor._id, date: dateKey, status: SLOT_STATUS_AVAILABLE, startTime: { $nin: [...planned] } }
      );
      const ids = stale.map((s) => s._id);
      if (ids.length) {
        await Slot.deleteMany({ _id: { $in: ids } });
        row.released = ids.length;
        result.released += ids.length;
      }
      const booked = await Slot.countDocuments({ hospitalId: hospitalId, doctorId: doctor._id, date: dateKey, status: SLOT_STATUS_BOOKED });
      const blocked = await Slot.countDocuments({ hospitalId: hospitalId, doctorId: doctor._id, date: dateKey, status: SLOT_STATUS_BLOCKED });
      row.preservedBooked = booked;
      row.preservedBlocked = blocked;
      result.preservedBooked += booked;
      result.preservedBlocked += blocked;
    } else if (closedReasons.has(plan.reason)) {
      const res = await Slot.updateMany(
        { hospitalId: hospitalId, doctorId: doctor._id, date: dateKey, status: SLOT_STATUS_AVAILABLE },
        { $set: { status: SLOT_STATUS_EXPIRED } }
      );
      row.expiredClosed = res.modifiedCount || 0;
      result.expiredClosed += res.modifiedCount || 0;
      const booked = await Slot.countDocuments({ hospitalId: hospitalId, doctorId: doctor._id, date: dateKey, status: SLOT_STATUS_BOOKED });
      row.preservedBooked = booked;
      result.preservedBooked += booked;
      result.perDate.push(row);
    } else {
      row.skipped = 1;
      result.perDate.push(row);
    }
  }
  return ok(result);
}

async function getCalendar(Slot, Doctor, doctorId, fromDate, toDate, opts) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const range = resolveRange(fromDate, toDate, normalized);
  if (!range || !range.fromDate) throw httpError(400, 'Invalid date range');
  const dates = dateRange(range.fromDate, range.toDate, normalized);
  if (!dates.length) throw httpError(400, 'Invalid date range');
  const slotDocs = await findLean(Slot, {
    hospitalId: doctor.hospitalId,
    doctorId: doctor._id,
    date: { $in: dates },
  });
  const byDate = {};
  for (const d of dates) byDate[d] = [];
  for (const s of slotDocs) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push({
      id: s._id,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      appointmentId: s.appointmentId,
      blockReason: s.blockReason,
      blockedAt: s.blockedAt,
      source: s.source,
    });
  }
  const perDate = dates.map((d) => ({ date: d, slots: byDate[d] }));
  const counts = { available: 0, booked: 0, blocked: 0, cancelled: 0, expired: 0 };
  for (const s of slotDocs) {
    if (counts[s.status] !== undefined) counts[s.status] += 1;
  }
  return ok({
    doctorId: doctor._id,
    doctorName: doctor.name,
    hospitalId: doctor.hospitalId,
    range: { fromDate: range.fromDate, toDate: range.toDate },
    perDate,
    counts,
  });
}

async function blockSlot(Slot, Doctor, doctorId, dateKey, startTime, opts) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const reason = (normalized.reason && String(normalized.reason).trim()) || 'Doctor Meeting';
  const actorId = normalized.actorId ? safeObjectId(normalized.actorId) : null;
  const cleanDate = normalizeDateKey(dateKey);
  const cleanTime = normalizeTime(startTime);
  if (!cleanDate || !cleanTime) throw httpError(400, 'date and startTime are required');

  const slot = await findOneLean(Slot, {
    hospitalId: doctor.hospitalId,
    doctorId: doctor._id,
    date: cleanDate,
    startTime: cleanTime,
  });
  if (!slot) throw httpError(404, 'Slot not found for this doctor and time.');
  if (slot.status !== SLOT_STATUS_AVAILABLE || slot.appointmentId) {
    if (slot.status === SLOT_STATUS_BOOKED || slot.appointmentId) {
      throw httpError(409, 'This slot already has an appointment and cannot be blocked.');
    }
    throw httpError(409, 'Only available slots can be blocked.');
  }

  // Atomic guard: the status filter means a concurrent booking wins the race
  // and this update matches zero documents instead of blocking a booked slot.
  const updated = await Slot.findOneAndUpdate(
    { _id: slot._id, status: SLOT_STATUS_AVAILABLE, appointmentId: null },
    { $set: { status: SLOT_STATUS_BLOCKED, blockReason: reason, blockedBy: actorId, blockedAt: new Date() } },
    { new: true }
  );
  const doc = await unwrapUpdated(updated);
  if (!doc) throw httpError(409, 'This slot was just booked and cannot be blocked.');
  return ok({
    id: doc._id,
    date: doc.date,
    startTime: doc.startTime,
    endTime: doc.endTime,
    status: doc.status,
    blockReason: doc.blockReason,
    blockedAt: doc.blockedAt,
  });
}

async function unblockSlot(Slot, Doctor, doctorId, dateKey, startTime, opts) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');

  const cleanDate = normalizeDateKey(dateKey);
  const cleanTime = normalizeTime(startTime);
  if (!cleanDate || !cleanTime) throw httpError(400, 'date and startTime are required');
  const slot = await findOneLean(Slot, {
    hospitalId: doctor.hospitalId,
    doctorId: doctor._id,
    date: cleanDate,
    startTime: cleanTime,
  });
  if (!slot) throw httpError(404, 'Slot not found for this doctor and time.');
  if (slot.status !== SLOT_STATUS_BLOCKED) {
    throw httpError(409, 'This slot is not blocked.');
  }
  if (slot.appointmentId) {
    throw httpError(409, 'This slot has an appointment and cannot be unblocked.');
  }

  const plan = generateDaySlots(doctor, cleanDate, normalized);
  let nextStatus = SLOT_STATUS_AVAILABLE;
  let note = 'Blocked lifted.';
  if (plan.reason === 'past') {
    nextStatus = SLOT_STATUS_EXPIRED;
    note = 'Date is in the past, slot kept out of availability.';
  } else if (plan.reason !== 'open') {
    nextStatus = SLOT_STATUS_BLOCKED;
    note = 'Schedule conflict (leave/holiday/override) prevents reopening.';
  } else if (!plan.slots.some((s) => s.startTime === cleanTime)) {
    nextStatus = SLOT_STATUS_BLOCKED;
    note = 'Slot is outside the current working hours, kept blocked.';
  }

  await Slot.updateOne(
    { _id: slot._id },
    { $set: { status: nextStatus, blockReason: nextStatus === SLOT_STATUS_BLOCKED ? slot.blockReason : null } }
  );
  const updated = await findByIdLean(Slot, slot._id);
  if (!updated) throw httpError(404, 'Slot not found for this doctor and time.');
  return ok({
    id: updated._id,
    date: updated.date,
    startTime: updated.startTime,
    endTime: updated.endTime,
    status: updated.status,
    note,
  });
}

/**
 * ATOMIC slot reservation (TEST 11: two booking requests, only one wins).
 * findOneAndUpdate with a status guard flips available -> booked in ONE
 * atomic document update, so concurrent requests cannot both claim the slot.
 * Returns the claimed slot or null (caller responds 409 conflict).
 * Works with both Mongoose (Query.lean()) and the in-memory test double.
 */
async function claimSlotAtomic(Slot, hospitalId, doctorId, dateKey, startTime, appointmentId, opts) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const cleanDate = normalizeDateKey(dateKey) || dateKey;
  const cleanTime = normalizeTime(startTime) || startTime;
  // When the doctor model is injected, scope the claim to the doctor's real
  // hospital so a forged hospitalId can never claim another hospital's slot.
  let scopedHospital = hospitalId;
  const DoctorModel = normalized.Doctor || normalized.doctorModel || null;
  if (DoctorModel) {
    try {
      const doctor = await loadDoctor(DoctorModel, doctorId);
      if (doctor) scopedHospital = hospitalIdOf(doctor.hospitalId) || scopedHospital;
    } catch (err) { /* keep caller-supplied scope */ }
  }
  const found = await Slot.findOneAndUpdate(
    {
      hospitalId: scopedHospital,
      doctorId: doctorId,
      date: cleanDate,
      startTime: cleanTime,
      status: SLOT_STATUS_AVAILABLE,
      appointmentId: null,
    },
    {
      $set: {
        status: SLOT_STATUS_BOOKED,
        appointmentId: appointmentId ? safeObjectId(appointmentId) : null,
      },
    },
    { new: true }
  );
  return unwrapUpdated(found);
}

/**
 * Patient/doctor availability for one doctor+date from the SAME source of
 * truth: generated Slot rows when they exist, otherwise the engine plan with
 * legacy appointments subtracted. Blocked/booked/cancelled/expired rows are
 * never advertised as bookable.
 */
async function availabilityForDate(Slot, Doctor, doctorId, dateKey, opts, Appointment) {
  const normalized = (opts && typeof opts === 'object') ? opts : {};
  const doctor = await loadDoctor(Doctor, doctorId);
  if (!doctor) throw httpError(404, 'Doctor not found');
  const cleanDate = normalizeDateKey(dateKey);
  if (!cleanDate) throw httpError(400, 'Invalid date');
  const rows = await findLean(Slot, {
    hospitalId: doctor.hospitalId,
    doctorId: doctor._id,
    date: cleanDate,
  });
  if (rows.length) {
    const available = rows
      .filter((s) => s && s.status === SLOT_STATUS_AVAILABLE && !s.appointmentId)
      .map((s) => s.startTime)
      .sort();
    return ok({ doctorId: doctor._id, date: cleanDate, slots: available, source: 'slots' });
  }
  const plan = generateDaySlots(doctor, cleanDate, normalized);
  if (plan.reason !== 'open') {
    return ok({ doctorId: doctor._id, date: cleanDate, slots: [], source: 'schedule', reason: plan.reason });
  }
  const hospitalId = hospitalIdOf(doctor.hospitalId) || hospitalIdOf(normalized.hospitalId);
  const taken = await bookedTimesFor(Slot, Appointment, hospitalId, doctor._id, cleanDate);
  const slots = plan.slots.map((s) => s.startTime).filter((t) => !taken.has(t));
  return ok({ doctorId: doctor._id, date: cleanDate, slots, source: 'schedule' });
}

module.exports = {
  previewGeneration,
  generateForDates,
  regenerateDates,
  getCalendar,
  blockSlot,
  unblockSlot,
  claimSlotAtomic,
  availabilityForDate,
  bookedTimesFor,
  safeObjectId,
  loadDoctor,
};

