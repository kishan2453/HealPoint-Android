'use strict';
/* HealPoint Part5 - conflict detection (pure, no DB). */
const engine = require('./slotEngine');

function mk(list, c) {
  list.push({
    id: [c.doctorId || '', c.date || '', c.type, c.startTime || ''].join('|'),
    severity: c.severity || 'warning',
    status: 'open',
    doctorId: c.doctorId || null,
    doctorName: c.doctorName || 'Doctor',
    date: c.date || null,
    startTime: c.startTime || null,
    endTime: c.endTime || null,
    type: c.type,
    title: c.title,
    detail: c.detail || '',
    existingRecord: c.existingRecord || null,
    conflictingRecord: c.conflictingRecord || null,
    recommendedAction: c.recommendedAction || '',
  });
}

function sessOf(rec) {
  if (!rec || typeof rec !== 'object') return [];
  if (Array.isArray(rec.sessions)) {
    return rec.sessions.map((s) => ({
      startTime: engine.normalizeTime(s && s.startTime),
      endTime: engine.normalizeTime(s && s.endTime),
    })).filter((s) => s.startTime && s.endTime);
  }
  const a = engine.normalizeTime(rec.startTime);
  const b = engine.normalizeTime(rec.endTime);
  return a && b ? [{ startTime: a, endTime: b }] : [];
}

function brkOf(rec) {
  if (!rec || typeof rec !== 'object' || !Array.isArray(rec.breaks)) return [];
  return rec.breaks.map((x) => ({
    startTime: engine.normalizeTime(x && x.startTime),
    endTime: engine.normalizeTime(x && x.endTime),
  })).filter((x) => x.startTime && x.endTime);
}

function overlap(aS, aE, bS, bE) {
  const s1 = engine.minutesOfDay(aS);
  const e1 = engine.minutesOfDay(aE);
  const s2 = engine.minutesOfDay(bS);
  const e2 = engine.minutesOfDay(bE);
  if (!Number.isFinite(s1) || !Number.isFinite(e1)) return false;
  if (!Number.isFinite(s2) || !Number.isFinite(e2)) return false;
  return s1 < e2 && s2 < e1;
}

function activeFor(doctor, dateKey) {
  const ov = doctor ? engine.overrideOn(doctor, dateKey) : null;
  if (ov && ov.isClosed === true) return { sessions: [], breaks: [], override: ov };
  if (ov) {
    const s = sessOf(ov);
    if (s.length) return { sessions: s, breaks: brkOf(ov), override: ov };
  }
  if (!doctor) return { sessions: [], breaks: [], override: null };
  const parsed = engine.parseDateKey(dateKey);
  const wd = parsed ? ['sun','mon','tue','wed','thu','fri','sat'][parsed.getDay()] : null;
  const day = wd && Array.isArray(doctor.weeklySchedule)
    ? doctor.weeklySchedule.find((e) => e && String(e.day || '').slice(0,3).toLowerCase() === wd && e.enabled !== false)
    : null;
  if (!day) return { sessions: [], breaks: [], override: null };
  return { sessions: sessOf(day), breaks: brkOf(day), override: null };
}

function checkWeekly(doctor, out) {
  const did = doctor ? String(doctor._id || doctor.id || '') : '';
  const nm = (doctor && doctor.name) || 'Doctor';
  const dur = doctor ? engine.resolveSlotDuration(doctor, null) : 30;
  if (doctor && !(dur >= 5 && dur <= 240)) {
    mk(out, { severity: 'critical', doctorId: did, doctorName: nm,
      type: 'invalid_slot_duration', title: 'Invalid slot duration',
      detail: 'Duration ' + dur + ' min (allowed 5-240).',
      existingRecord: { slotDurationMinutes: doctor.slotDurationMinutes },
      recommendedAction: 'Fix slot duration to 5-240 minutes.' });
  }
  const weekly = doctor && Array.isArray(doctor.weeklySchedule) ? doctor.weeklySchedule : [];
  weekly.forEach((entry, idx) => {
    if (!entry || typeof entry !== 'object') return;
    const ss = sessOf(entry);
    const bb = brkOf(entry);
    ss.forEach((s) => {
      if (!(engine.minutesOfDay(s.endTime) > engine.minutesOfDay(s.startTime))) {
        mk(out, { severity: 'critical', doctorId: did, doctorName: nm,
          startTime: s.startTime, endTime: s.endTime, type: 'invalid_session_times',
          title: 'Invalid session times',
          detail: 'Weekly entry ' + (idx + 1) + ' ends before it starts.',
          existingRecord: { day: entry.day || null, session: s },
          recommendedAction: 'Edit schedule so end is after start.' });
      }
    });
    for (let i = 0; i < ss.length; i += 1) {
      for (let j = i + 1; j < ss.length; j += 1) {
        if (overlap(ss[i].startTime, ss[i].endTime, ss[j].startTime, ss[j].endTime)) {
          mk(out, { severity: 'critical', doctorId: did, doctorName: nm,
            startTime: ss[i].startTime, endTime: ss[j].endTime, type: 'overlapping_sessions',
            title: 'Overlapping working sessions',
            detail: 'Weekly entry ' + (idx + 1) + ' sessions overlap.',
            existingRecord: { day: entry.day || null, session: ss[i] },
            conflictingRecord: { day: entry.day || null, session: ss[j] },
            recommendedAction: 'Edit schedule so sessions do not overlap.' });
        }
      }
    }
    for (let i = 0; i < bb.length; i += 1) {
      for (let j = i + 1; j < bb.length; j += 1) {
        if (overlap(bb[i].startTime, bb[i].endTime, bb[j].startTime, bb[j].endTime)) {
          mk(out, { severity: 'warning', doctorId: did, doctorName: nm,
            startTime: bb[i].startTime, endTime: bb[j].endTime, type: 'overlapping_breaks',
            title: 'Overlapping breaks',
            detail: 'Weekly entry ' + (idx + 1) + ' breaks overlap.',
            existingRecord: { day: entry.day || null, brk: bb[i] },
            conflictingRecord: { day: entry.day || null, brk: bb[j] },
            recommendedAction: 'Merge the overlapping breaks.' });
        }
      }
    }
  });
}

function checkDates(doctor, dates, out, markers) {
  const did = doctor ? String(doctor._id || doctor.id || '') : '';
  const nm = (doctor && doctor.name) || 'Doctor';
  const list = Array.isArray(dates) ? dates : [];
  list.forEach((raw) => {
    const key = engine.normalizeDateKey(raw);
    if (!key) return;
    const holiday = doctor ? engine.holidayOn(doctor, key) : null;
    const leave = doctor ? engine.leaveOn(doctor, key) : null;
    const override = doctor ? engine.overrideOn(doctor, key) : null;
    const active = activeFor(doctor, key);
    markers.push({
      date: key,
      leave: leave ? { type: leave.leaveType, reason: leave.reason || 'Leave' } : null,
      holiday: holiday ? (holiday.reason || 'Holiday') : null,
      override: override ? { closed: override.isClosed === true, reason: override.reason || null } : null,
      hasBreak: active.breaks.length > 0,
      hasSchedule: active.sessions.length > 0,
    });
    if (holiday && active.sessions.length) {
      mk(out, { severity: 'warning', doctorId: did, doctorName: nm, date: key,
        type: 'holiday_with_active_schedule', title: 'Holiday with active schedule',
        detail: key + ': holiday but hours configured. Generation skipped.',
        existingRecord: { holiday: holiday.reason || 'Holiday' },
        conflictingRecord: { sessions: active.sessions },
        recommendedAction: 'Keep holiday closed or remove holiday.' });
    }
    if (leave && leave.leaveType === 'full_day' && active.sessions.length) {
      mk(out, { severity: 'warning', doctorId: did, doctorName: nm, date: key,
        type: 'leave_overlapping_working_hours', title: 'Leave overlapping working hours',
        detail: key + ': full-day leave overlaps hours. Generation skipped.',
        existingRecord: { leave: leave.reason || 'Leave' },
        conflictingRecord: { sessions: active.sessions },
        recommendedAction: 'Keep leave or shorten it.' });
    }
    if (leave && override && override.isClosed !== true) {
      mk(out, { severity: 'warning', doctorId: did, doctorName: nm, date: key,
        type: 'override_conflicting_with_leave', title: 'Date override conflicting with leave',
        detail: key + ': override opens hours while leave active. Leave wins.',
        existingRecord: { leave: leave.reason || 'Leave' },
        conflictingRecord: { override: override.reason || 'Override' },
        recommendedAction: 'Remove override for this leave date.' });
    }
  });
}

function checkSlots(doctor, slots, out) {
  const did = doctor ? String(doctor._id || doctor.id || '') : '';
  const nm = (doctor && doctor.name) || 'Doctor';
  const rows = Array.isArray(slots) ? slots.filter(Boolean) : [];
  const byDate = new Map();
  rows.forEach((s) => {
    const key = engine.normalizeDateKey(s.date);
    if (!key) return;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(s);
  });
  byDate.forEach((dayRows, dateKey) => {
    const seen = new Map();
    dayRows.forEach((s) => {
      const t = engine.normalizeTime(s.startTime) || String(s.startTime || '');
      if (seen.has(t)) {
        mk(out, { severity: 'critical', doctorId: did, doctorName: nm, date: dateKey,
          startTime: t, endTime: s.endTime || null, type: 'duplicate_slot',
          title: 'Duplicate slot',
          detail: dateKey + ' ' + t + ': duplicate rows exist.',
          existingRecord: { id: String((seen.get(t) || {})._id || ''), startTime: t },
          conflictingRecord: { id: String(s._id || ''), startTime: t },
          recommendedAction: 'Regenerate the date; duplicates are skipped.' });
      } else { seen.set(t, s); }
      if (s.status === 'blocked' && s.appointmentId) {
        mk(out, { severity: 'critical', doctorId: did, doctorName: nm, date: dateKey,
          startTime: t, endTime: s.endTime || null, type: 'blocked_slot_with_appointment',
          title: 'Blocked slot with active appointment',
          detail: dateKey + ' ' + t + ': blocked but linked to appointment.',
          existingRecord: { id: String(s._id || ''), status: 'blocked' },
          conflictingRecord: { appointmentId: String(s.appointmentId) },
          recommendedAction: 'Unblock slot or move appointment; never auto-cancel.' });
      }
    });
    const sorted = dayRows.map((s) => ({
      row: s,
      st: engine.minutesOfDay(engine.normalizeTime(s.startTime) || ''),
      en: engine.minutesOfDay(engine.normalizeTime(s.endTime) || ''),
    })).filter((e) => Number.isFinite(e.st) && Number.isFinite(e.en) && e.en > e.st)
      .sort((a, b) => a.st - b.st);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].st < sorted[i - 1].en) {
        const a = sorted[i - 1].row;
        const b = sorted[i].row;
        if (String(a.startTime) === String(b.startTime)) continue;
        mk(out, { severity: 'warning', doctorId: did, doctorName: nm, date: dateKey,
          startTime: b.startTime || null, endTime: b.endTime || null, type: 'overlapping_slots',
          title: 'Slot overlapping another slot',
          detail: dateKey + ': slots overlap.',
          existingRecord: { id: String(a._id || ''), startTime: a.startTime, endTime: a.endTime },
          conflictingRecord: { id: String(b._id || ''), startTime: b.startTime, endTime: b.endTime },
          recommendedAction: 'Regenerate the date to match session grid.' });
      }
    }
  });
}



function checkAppointments(doctor, appointments, out) {
  const did = doctor ? String(doctor._id || doctor.id || '') : '';
  const nm = (doctor && doctor.name) || 'Doctor';
  const rows = Array.isArray(appointments) ? appointments.filter(Boolean) : [];
  rows.forEach((appt) => {
    const st = String(appt.status || '').toLowerCase();
    if (st === 'cancel' || st === 'cancelled' || st === 'missed') return;
    const dateKey = engine.normalizeDateKey(appt.slotDate || appt.date);
    const start = engine.normalizeTime(appt.slotTime || appt.startTime);
    if (!dateKey || !start) return;
    const aid = String(appt._id || appt.id || '');
    const holiday = doctor ? engine.holidayOn(doctor, dateKey) : null;
    if (holiday) {
      mk(out, { severity: 'critical', doctorId: did, doctorName: nm, date: dateKey,
        startTime: start, type: 'appointment_on_holiday', title: 'Appointment on holiday',
        detail: dateKey + ' ' + start + ': appointment on holiday.',
        existingRecord: { holiday: holiday.reason || 'Holiday' },
        conflictingRecord: { appointmentId: aid, slotTime: start },
        recommendedAction: 'Reschedule with patient; never auto-cancel paid.' });
      return;
    }
    const leave = doctor ? engine.leaveOn(doctor, dateKey) : null;
    if (leave && leave.leaveType === 'full_day') {
      mk(out, { severity: 'critical', doctorId: did, doctorName: nm, date: dateKey,
        startTime: start, type: 'appointment_during_leave', title: 'Appointment during leave',
        detail: dateKey + ' ' + start + ': appointment during leave.',
        existingRecord: { leave: leave.reason || 'Leave' },
        conflictingRecord: { appointmentId: aid, slotTime: start },
        recommendedAction: 'Reschedule with patient; never auto-cancel paid.' });
      return;
    }
    const act = activeFor(doctor, dateKey);
    let excl = act.breaks.slice();
    if (leave && leave.leaveType === 'partial_day' && leave.startTime && leave.endTime) {
      excl.push({ startTime: leave.startTime, endTime: leave.endTime });
    }
    const t = engine.minutesOfDay(start);
    const inBreak = excl.some((b) => {
      const s = engine.minutesOfDay(b.startTime);
      const e = engine.minutesOfDay(b.endTime);
      return Number.isFinite(s) && Number.isFinite(e) && t >= s && t < e;
    });
    if (inBreak) {
      mk(out, { severity: 'warning', doctorId: did, doctorName: nm, date: dateKey,
        startTime: start, type: 'appointment_inside_break', title: 'Appointment inside break',
        detail: dateKey + ' ' + start + ': appointment inside break.',
        existingRecord: { breaks: excl },
        conflictingRecord: { appointmentId: aid, slotTime: start },
        recommendedAction: 'Review break placement; keep booked appointment.' });
      return;
    }
    const inSession = act.sessions.some((s) => {
      const a = engine.minutesOfDay(s.startTime);
      const b = engine.minutesOfDay(s.endTime);
      return Number.isFinite(a) && Number.isFinite(b) && t >= a && t < b;
    });
    if (!act.sessions.length || !inSession) {
      mk(out, { severity: 'warning', doctorId: did, doctorName: nm, date: dateKey,
        startTime: start, type: 'appointment_outside_working_hours',
        title: 'Appointment outside working hours',
        detail: dateKey + ' ' + start + ': outside configured sessions.',
        existingRecord: { sessions: act.sessions },
        conflictingRecord: { appointmentId: aid, slotTime: start },
        recommendedAction: 'Review schedule change with patient.' });
    }
  });
}

function rankOf(s) { return s === 'critical' ? 0 : s === 'warning' ? 1 : 2; }

function detectAll(doctor, dates, slots, appointments) {
  const out = [];
  const markers = [];
  checkWeekly(doctor, out);
  checkDates(doctor, dates, out, markers);
  checkSlots(doctor, slots, out);
  checkAppointments(doctor, appointments, out);
  out.sort((a, b) => {
    const r = rankOf(a.severity) - rankOf(b.severity);
    if (r !== 0) return r;
    const c = engine.compareDateKeys(a.date || '01-01-2099', b.date || '01-01-2099');
    if (c) return c;
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });
  const summary = { total: out.length, critical: 0, warning: 0, info: 0, byType: {} };
  out.forEach((c) => {
    if (c.severity === 'critical') summary.critical += 1;
    else if (c.severity === 'warning') summary.warning += 1;
    else summary.info += 1;
    summary.byType[c.type] = (summary.byType[c.type] || 0) + 1;
  });
  return { conflicts: out, summary, dateMarkers: markers };
}

module.exports = { detectAll, checkWeekly, checkDates, checkSlots, checkAppointments, activeFor };

