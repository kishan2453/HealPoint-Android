'use strict';

/**
 * HealPoint - Slot management controller (Hospital Admin).
 *
 * Every handler enforces HOSPITAL ISOLATION server-side (TEST 12):
 *  1. Resolve the hospital the admin actually owns (req.hospitalId).
 *  2. Load the target doctor and VERIFY doctor.hospitalId MATCHES that hospital.
 *     Hospital A admin can never preview/generate/block/unblock Hospital B
 *     doctors or slots - even by passing a foreign id directly.
 *  3. All slot queries are additionally scoped by hospitalId.
 *
 * Audit: when an Audit model is injected, mutations append an audit entry
 * (actor, action, summary) WITHOUT any secrets.
 */

const slotService = require('../services/slotService');
const bulkService = require('../services/bulkService');

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function adminHospitalId(req) {
  const userId = (req.user && (req.user._id || req.user.id))
    || (req.admin && (req.admin._id || req.admin.id))
    || req.userId
    || null;
  const raw = req.hospitalId
    || (req.user && (req.user.hospitalId || req.user.hospital))
    || (req.admin && (req.admin.hospitalId || req.admin.hospital))
    || null;
  const hospitalId = raw && typeof raw === 'object'
    ? String(raw._id || raw.id || '')
    : (raw ? String(raw) : null);
  return { userId, hospitalId: hospitalId || null };
}

async function unwrapDoctor(found) {
  if (!found) return null;
  // Mongoose Query: has synchronous .lean() returning a thenable.
  if (typeof found.lean === 'function') {
    try {
      const out = found.lean();
      const doc = out && typeof out.then === 'function' ? await out : out;
      return doc || null;
    } catch (err) {
      return null;
    }
  }
  const doc = found && typeof found.then === 'function' ? await found : found;
  if (!doc) return null;
  if (typeof doc.lean === 'function') {
    try {
      const out = doc.lean();
      return (out && typeof out.then === 'function' ? await out : out) || null;
    } catch (err) {
      return { ...doc };
    }
  }
  if (typeof doc.toObject === 'function') {
    try { return doc.toObject(); } catch (err) { /* fall through */ }
  }
  return doc;
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

async function loadDoctorForAdmin(Doctor, doctorId, hospitalId) {
  if (!Doctor || typeof Doctor.findById !== 'function') {
    const e = new Error('Doctor service unavailable'); e.statusCode = 500; throw e;
  }
  const doctor = await unwrapDoctor(Doctor.findById(doctorId));
  if (!doctor) { const e = new Error('Doctor not found'); e.statusCode = 404; throw e; }
  const docHospital = hospitalIdOf(doctor.hospitalId);
  if (!hospitalId || !docHospital || docHospital !== hospitalId) {
    const e = new Error('You do not have permission to manage this doctor'); e.statusCode = 403; throw e;
  }
  return doctor;
}
async function audit(Audit, req, action, summary) {
  if (!Audit) return;
  try {
    const { userId } = adminHospitalId(req);
    await Audit.create({
      actorType: 'admin',
      actorId: userId,
      action,
      summary,
      createdAt: new Date(),
    });
  } catch (err) {
    try { console.warn('[slot-audit] failed', String(err.message || '')); } catch (e) {}
  }
}

async function previewHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Appointment = models.Appointment || null;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    const query = req.query || {};
    const body = req.body || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const fromDate = query.fromDate || body.fromDate;
    const toDate = query.toDate || body.toDate;
    const result = await slotService.previewGeneration(
      Slot, Doctor, doctor._id, fromDate, toDate, { maxDays: 31, now: new Date() }, Appointment
    );
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to preview slots');
  }
}


async function generateHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Audit = models.Audit;
    const Appointment = models.Appointment || null;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    const dates = slotServiceRange(body.fromDate, body.toDate);
    if (!dates.length) return fail(res, 400, 'Enter a valid date range (DD-MM-YYYY).');
    const result = await slotService.generateForDates(
      Slot, Doctor, doctor._id, dates, { now: new Date(), source: 'bulk' }, Appointment
    );
    await audit(Audit, req, 'slot_generate', 'Generated slots for doctor ' + String(doctor._id));
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to generate slots');
  }
}

async function regenerateHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Audit = models.Audit;
    const Appointment = models.Appointment || null;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    const dates = slotServiceRange(body.fromDate, body.toDate);
    if (!dates.length) return fail(res, 400, 'Enter a valid date range (DD-MM-YYYY).');
    const result = await slotService.regenerateDates(
      Slot, Doctor, doctor._id, dates, { now: new Date(), source: 'bulk' }, Appointment
    );
    await audit(Audit, req, 'slot_regenerate', 'Regenerated slots for doctor ' + String(doctor._id));
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to regenerate slots');
  }
}

function slotServiceRange(fromDate, toDate) {
  const engine = require('../services/slotEngine');
  const range = engine.resolveRange(fromDate, toDate, { maxDays: 31, now: new Date() });
  return range ? engine.dateRange(range.fromDate, range.toDate, { maxDays: 31 }) : [];
}

async function calendarHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    const query = req.query || {};
    const body = req.body || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const fromDate = query.fromDate || body.fromDate;
    const toDate = query.toDate || body.toDate;
    const result = await slotService.getCalendar(Slot, Doctor, doctor._id, fromDate, toDate, { maxDays: 31, now: new Date() });
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to load slot calendar');
  }
}

async function blockHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Audit = models.Audit;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { userId, hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    const query = req.query || {};
    const dateKey = body.date || query.date;
    const startTime = body.startTime || query.startTime;
    if (!dateKey || !startTime) return fail(res, 400, 'date and startTime are required');
    const result = await slotService.blockSlot(Slot, Doctor, doctor._id, dateKey, startTime, { reason: body.reason, actorId: userId });
    await audit(Audit, req, 'slot_block', 'Blocked ' + dateKey + ' ' + startTime + ' for doctor ' + String(doctor._id));
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to block slot');
  }
}

async function bulkPreviewHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Appointment = models.Appointment || null;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    const result = await bulkService.planBulkScheduling(
      Slot, Doctor, doctor._id,
      {
        fromDate: body.fromDate, toDate: body.toDate,
        daysOfWeek: body.daysOfWeek, behavior: body.behavior,
        slotDurationMinutes: body.slotDurationMinutes, options: { now: new Date() },
      },
      { now: new Date() }, Appointment,
    );
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to preview bulk scheduling');
  }
}

async function bulkApplyHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Audit = models.Audit;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { userId, hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    if (body.confirm !== true) return fail(res, 422, 'Bulk apply requires explicit confirmation (confirm: true).');
    const result = await bulkService.applyBulkScheduling(
      Slot, Doctor, doctor._id,
      {
        fromDate: body.fromDate, toDate: body.toDate,
        daysOfWeek: body.daysOfWeek, behavior: body.behavior,
        slotDurationMinutes: body.slotDurationMinutes, options: { now: new Date() },
      },
      { now: new Date(), actorId: userId },
    );
    const d = result.data || {};
    await audit(Audit, req, 'slot_bulk_generate', 'Bulk apply for doctor ' + String(doctor._id) + ': created ' + (d.created || 0));
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to apply bulk scheduling');
  }
}

async function bulkBlockHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Audit = models.Audit;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { userId, hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    const result = await bulkService.bulkBlockSlots(Slot, Doctor, doctor._id, body.slots, { reason: body.reason, actorId: userId });
    const d = result.data || {};
    await audit(Audit, req, 'slot_bulk_block', 'Bulk block for doctor ' + String(doctor._id) + ': ' + (d.blocked || 0));
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to bulk block slots');
  }
}

async function bulkUnblockHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Audit = models.Audit;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    const result = await bulkService.bulkUnblockSlots(Slot, Doctor, doctor._id, body.slots, {});
    const d = result.data || {};
    await audit(Audit, req, 'slot_bulk_unblock', 'Bulk unblock for doctor ' + String(doctor._id) + ': ' + (d.unblocked || 0));
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to bulk unblock slots');
  }
}

async function unblockHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Audit = models.Audit;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    const query = req.query || {};
    const dateKey = body.date || query.date;
    const startTime = body.startTime || query.startTime;
    if (!dateKey || !startTime) return fail(res, 400, 'date and startTime are required');
    const result = await slotService.unblockSlot(Slot, Doctor, doctor._id, dateKey, startTime, { now: new Date() });
    await audit(Audit, req, 'slot_unblock', 'Unblocked ' + dateKey + ' ' + startTime + ' for doctor ' + String(doctor._id));
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to unblock slot');
  }
}

/**
 * Patient/doctor availability for one doctor+date from the SAME generated
 * Slot rows the admin manages. No hospital context is needed because this is
 * scoped to a single doctor+date pair.
 *
 * Mounting (see routes/slotRoutes.js):
 *   - patientJWT           -> GET /slots/availability/:doctorId  (patient)
 *   - doctorJWT            -> GET /doctor/slots/availability     (own slots)
 *   - admin slots router   -> GET /admin/slots/:doctorId/availability
 */
async function availabilityHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Appointment = models.Appointment || null;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const params = req.params || {};
    const query = req.query || {};
    const body = req.body || {};
    const doctorId = params.doctorId || query.doctorId || body.doctorId
      || (req.doctor && (req.doctor._id || req.doctor.id)) || null;
    if (!doctorId) return fail(res, 400, 'Doctor is required.');
    const dateKey = query.date || query.slotDate || body.date || body.slotDate;
    if (!dateKey) return fail(res, 400, 'date is required (DD-MM-YYYY).');
    const doctor = await unwrapDoctor(Doctor.findById(doctorId));
    if (!doctor) return fail(res, 404, 'Doctor not found');
    const result = await slotService.availabilityForDate(
      Slot, Doctor, doctor._id, dateKey, { now: new Date() }, Appointment
    );
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to load availability');
  }
}

async function doctorCalendarHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const query = req.query || {};
    const body = req.body || {};
    // The doctor reads ONLY their own slots: the id comes from the verified
    // doctor JWT, never from a client-supplied param (no cross-doctor reads).
    const doctorId = (req.doctor && (req.doctor._id || req.doctor.id))
      || (req.user && (req.user._id || req.user.id)) || null;
    if (!doctorId) return fail(res, 401, 'Doctor sign-in is required.');
    const fromDate = query.fromDate || body.fromDate;
    const toDate = query.toDate || body.toDate;
    const result = await slotService.getCalendar(Slot, Doctor, doctorId, fromDate, toDate, { maxDays: 31, now: new Date() });
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to load slot calendar');
  }
}

async function doctorAvailabilityHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Appointment = models.Appointment || null;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const query = req.query || {};
    const body = req.body || {};
    const doctorId = (req.doctor && (req.doctor._id || req.doctor.id))
      || (req.user && (req.user._id || req.user.id)) || null;
    if (!doctorId) return fail(res, 401, 'Doctor sign-in is required.');
    const dateKey = query.date || query.slotDate || body.date || body.slotDate;
    if (!dateKey) return fail(res, 400, 'date is required (DD-MM-YYYY).');
    const doctor = await unwrapDoctor(Doctor.findById(doctorId));
    if (!doctor) return fail(res, 404, 'Doctor not found');
    const result = await slotService.availabilityForDate(
      Slot, Doctor, doctor._id, dateKey, { now: new Date() }, Appointment,
    );
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to load availability');
  }
}

async function clearHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Audit = models.Audit;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const body = req.body || {};
    if (body.confirm !== true) return fail(res, 422, 'Clear requires explicit confirmation (confirm: true).');
    const result = await bulkService.clearUnbookedSlots(Slot, Doctor, doctor._id, body.fromDate, body.toDate, { now: new Date() });
    const d = result.data || {};
    await audit(Audit, req, 'slot_clear_unbooked', 'Cleared ' + (d.cleared || 0) + ' unbooked for doctor ' + String(doctor._id));
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to clear slots');
  }
}

async function conflictsHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Appointment = models.Appointment || null;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const params = req.params || {};
    if (!params.doctorId) return fail(res, 400, 'Doctor is required.');
    const doctor = await loadDoctorForAdmin(Doctor, params.doctorId, hospitalId);
    const query = req.query || {};
    const result = await bulkService.detectConflicts(
      Slot, Doctor, doctor._id, query.fromDate, query.toDate,
      { maxDays: 42, now: new Date() }, Appointment,
    );
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to detect conflicts');
  }
}

async function hospitalCalendarHandler(req, res) {
  try {
    const models = req.models || {};
    const Doctor = models.Doctor;
    const Slot = models.Slot;
    const Appointment = models.Appointment || null;
    if (!Doctor || !Slot) return fail(res, 500, 'Slot service is not configured.');
    const { hospitalId } = adminHospitalId(req);
    if (!hospitalId) return fail(res, 403, 'Hospital administrator context missing');
    const query = req.query || {};
    const body = req.body || {};
    const rawIds = query.doctorIds || body.doctorIds || query.doctorId || body.doctorId || '';
    const doctorIds = String(rawIds).split(',').map((s) => s.trim()).filter(Boolean);
    if (!doctorIds.length) return fail(res, 422, 'doctorIds are required (comma-separated).');
    for (const id of doctorIds) {
      await loadDoctorForAdmin(Doctor, id, hospitalId);
    }
    const result = await bulkService.getHospitalCalendar(
      Slot, Doctor, doctorIds, query.fromDate || body.fromDate, query.toDate || body.toDate,
      { maxDays: 42, now: new Date(), department: query.department || body.department },
      Appointment,
    );
    return res.json(result);
  } catch (err) {
    return fail(res, err.statusCode || 400, err.message || 'Unable to load hospital calendar');
  }
}

/**
 * Factory - dependency-inject the models so the module drops into the existing
 * backend without auto-detection:
 *
 *   const createSlotController = require('./server-slots/controllers/slotController');
 *   const controller = createSlotController({
 *     slotModel, doctorModel, auditModel,
 *   });
 */
function createSlotController(deps = {}) {
  return {
    preview: previewHandler,
    generate: generateHandler,
    regenerate: regenerateHandler,
    calendar: calendarHandler,
    availability: availabilityHandler,
    doctorCalendar: doctorCalendarHandler,
    doctorAvailability: doctorAvailabilityHandler,
    block: blockHandler,
    unblock: unblockHandler,
    bulkPreview: bulkPreviewHandler,
    bulkApply: bulkApplyHandler,
    bulkBlock: bulkBlockHandler,
    bulkUnblock: bulkUnblockHandler,
    clearUnbooked: clearHandler,
    conflicts: conflictsHandler,
    hospitalCalendar: hospitalCalendarHandler,
    deps,
  };
}

module.exports = createSlotController;

