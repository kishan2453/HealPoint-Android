'use strict'

/**
 * HealPoint - Smart Slot Generation Engine (pure, dependency-free).
 * Computes bookable slot grids from the doctor's stored scheduling fields
 * (weeklySchedule, dateOverrides, blockedHolidays, leaves, slotDurationMinutes).
 * Slots are 24h HH:mm values; presentation layers convert to 12h strings.
 */

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];
const DEFAULT_SLOT_DURATION = 30;
const MIN_SLOT_DURATION = 5;
const MAX_SLOT_DURATION = 240;

function pad2(value) {
  const s = String(value);
  return s.length >= 2 ? s : s.padStart(2,'0');
}

function normalizeTime(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g,' ');
  if (!trimmed) return null;
  let raw = trimmed.toLowerCase();
  const ampm = /(am|pm)$/.test(raw);
  const isAm = /am$/.test(raw);
  raw = raw.replace(/(am|pm)$/,'').trim();
  let hourRaw;
  let minute = 0;
  const colon = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (colon) {
    hourRaw = Number(colon[1]);
    minute = Number(colon[2]);
  } else if (/^\d{1,2}$/.test(raw)) {
    hourRaw = Number(raw);
  } else {
    return null;
  }
  let hour;
  if (hourRaw === 12) {
    hour = isAm ? 0 : 12;
  } else {
    hour = hourRaw;
  }
  if (ampm && !isAm && hourRaw !== 12) hour = hour + 12;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return pad2(hour) + ':' + pad2(minute);
}

function minutesOfDay(hhmm) {
  const parts = typeof hhmm === 'string' ? hhmm.split(':') : [];
  if (parts.length !== 2) return NaN;
  return Number(parts[0]) * 60 + Number(parts[1]);
}

function formatMinutes(minutes) {
  const clamped = Math.max(0, Math.min(1439, Math.round(minutes)));
  return pad2(Math.floor(clamped / 60)) + ':' + pad2(clamped % 60);
}

function normalizeDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return pad2(value.getDate()) + '-' + pad2(value.getMonth() + 1) + '-' + value.getFullYear();
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (dmy) {
    const d = Number(dmy[1]); const m = Number(dmy[2]); const y = Number(dmy[3]);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return pad2(d) + '-' + pad2(m) + '-' + y;
    return null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const y = Number(iso[1]); const m = Number(iso[2]); const d = Number(iso[3]);
    return pad2(d) + '-' + pad2(m) + '-' + y;
  }
  return null;
}

function parseDateKey(dateKey) {
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(dateKey || ''));
  if (!dmy) return null;
  const date = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function weekdayKeyOf(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  return DAY_KEYS[parsed.getDay()];
}
function startOfToday(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function isPastDate(dateKey, now = new Date()) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return true;
  return parsed.getTime() < startOfToday(now).getTime();
}

function isPastTimeOnToday(dateKey, startTime24, now = new Date()) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return true;
  const todayStart = startOfToday(now);
  if (parsed.getTime() < todayStart.getTime()) return true;
  if (parsed.getTime() > todayStart.getTime()) return false;
  const slotMinutes = minutesOfDay(startTime24);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slotMinutes <= nowMinutes;
}

function matchesWeekday(dayValue, dateKey) {
  const weekdayKey = weekdayKeyOf(dateKey);
  if (!weekdayKey || dayValue === null || dayValue === undefined) return false;
  if (typeof dayValue === 'number') return dayValue % 7 === DAY_KEYS.indexOf(weekdayKey);
  if (typeof dayValue !== 'string') return false;
  const raw = dayValue.trim();
  if (!raw) return false;
  if (/^\d{1,2}$/.test(raw)) return Number(raw) % 7 === DAY_KEYS.indexOf(weekdayKey);
  const key = raw.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
  if (!key) return false;
  if (key === 'thu' || key === 'thur') return weekdayKey === 'thu';
  return key === weekdayKey || key.endsWith(weekdayKey) || weekdayKey.endsWith(key);
}

function holidayOn(doctor, dateKey) {
  const holidays = Array.isArray(doctor.blockedHolidays) ? doctor.blockedHolidays : [];
  for (const holiday of holidays) {
    if (holiday && normalizeDateKey(holiday.date) === dateKey) {
      return { reason: holiday.reason || 'Holiday' };
    }
  }
  return null;
}

function compareDateKeys(a, b) {
  const pa = parseDateKey(a);
  const pb = parseDateKey(b);
  if (!pa || !pb) return null;
  const ta = new Date(pa.getFullYear(), pa.getMonth(), pa.getDate()).getTime();
  const tb = new Date(pb.getFullYear(), pb.getMonth(), pb.getDate()).getTime();
  if (ta < tb) return -1;
  if (ta > tb) return 1;
  return 0;
}

function leaveOn(doctor, dateKey) {
  const leaves = Array.isArray(doctor.leaves) ? doctor.leaves : [];
  for (const leave of leaves) {
    if (!leave || typeof leave !== 'object') continue;
    const type = leave.leaveType || 'full_day';
    const startKey = normalizeDateKey(leave.startDate);
    const endKey = normalizeDateKey(leave.endDate || leave.startDate);
    const dates = Array.isArray(leave.dates) ? leave.dates.map(normalizeDateKey).filter(Boolean) : [];
    const hasPartialWindow = type === 'partial_day' && (leave.startTime || leave.endTime);
    // Any dated range (multi_day OR full_day with start+end) covers the whole day.
    // DD-MM-YYYY strings are NOT lexicographically comparable, so compare via dates.
    let inRange = false;
    if (startKey && endKey) {
      const lo = compareDateKeys(startKey, dateKey);
      const hi = compareDateKeys(dateKey, endKey);
      if (lo !== null && hi !== null && lo <= 0 && hi <= 0) inRange = true;
    } else if (startKey === dateKey) {
      inRange = true;
    }
    const coversFullDay = !hasPartialWindow && (inRange || dates.includes(dateKey));
    if (coversFullDay) return { leaveType: 'full_day', reason: leave.reason || 'Leave' };
    if (type === 'partial_day' && (startKey === dateKey || dates.includes(dateKey))) {
      const start = normalizeTime(leave.startTime);
      const end = normalizeTime(leave.endTime);
      if (start && end && minutesOfDay(end) > minutesOfDay(start)) {
        return { leaveType: 'partial_day', startTime: start, endTime: end, reason: leave.reason || 'Leave' };
      }
      // partial_day entry without a valid window still blocks the day rather
      // than silently opening it.
      if (!start || !end) return { leaveType: 'full_day', reason: leave.reason || 'Leave' };
    }
  }
  const leaveDates = Array.isArray(doctor.leaveDates) ? doctor.leaveDates : [];
  for (const raw of leaveDates) {
    if (normalizeDateKey(raw) === dateKey) return { leaveType: 'full_day', reason: 'Leave' };
  }
  return null;
}
function overrideOn(doctor, dateKey) {
  const overrides = Array.isArray(doctor.dateOverrides) ? doctor.dateOverrides : [];
  for (const override of overrides) {
    if (override && normalizeDateKey(override.date) === dateKey) return override;
  }
  return null;
}
function resolveSlotDuration(doctor, requested) {
  const value = Number(requested ?? doctor.slotDurationMinutes ?? DEFAULT_SLOT_DURATION);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_SLOT_DURATION;
  return Math.min(MAX_SLOT_DURATION, Math.max(MIN_SLOT_DURATION, Math.round(value)));
}

function sessionsFromField(sessions, startTime, endTime) {
  const out = [];
  if (Array.isArray(sessions)) {
    for (const session of sessions) {
      if (!session) continue;
      const start = normalizeTime(session.startTime);
      const end = normalizeTime(session.endTime);
      if (start && end) out.push({ name: session.name || '', startTime: start, endTime: end });
    }
  } else {
    const start = normalizeTime(startTime);
    const end = normalizeTime(endTime);
    if (start && end) out.push({ name: '', startTime: start, endTime: end });
  }
	  return out;
}

function breaksFromField(breaks) {
  const out = [];
  if (Array.isArray(breaks)) {
    for (const br of breaks) {
      if (!br) continue;
      const start = normalizeTime(br.startTime);
      const end = normalizeTime(br.endTime);
      if (start && end) out.push({ name: br.name || '', startTime: start, endTime: end });
    }
  }
	  return out;
}

function normalizeSessions(sessions) {
  return [...sessions].sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));
}

function normalizeBreaks(breaks) {
  return [...breaks].filter((b) => minutesOfDay(b.endTime) > minutesOfDay(b.startTime)).sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime));
}

function isExcluded(startMinutes, exclusions) {
  for (const ex of exclusions) {
	    const s = minutesOfDay(ex.startTime);
	    const e = minutesOfDay(ex.endTime);
	    if (startMinutes >= s && startMinutes < e) return true;
	  }
	  return false;
}

function resolveEffectiveSchedule(doctor, dateKey, opts) {
  const out = { status: 'open', sessions: [], exclusions: [], reason: null };
  const now = (opts && opts.now) || new Date();
  const availableFlag = doctor.available === false || doctor.availableStatus === false;
  if (!doctor || doctor.isActive === false || availableFlag) {
    return { ...out, status: 'unavailable', reason: 'Doctor is not accepting bookings' };
  }
  const holiday = holidayOn(doctor, dateKey);
  if (holiday) {
    return { ...out, status: 'holiday', reason: holiday.reason || 'Holiday' };
  }
	  const leave = leaveOn(doctor, dateKey);
	  if (leave && leave.leaveType === 'full_day') {
	    return { ...out, status: 'leave_full', reason: leave.reason || 'Leave' };
	  }
	  const override = overrideOn(doctor, dateKey);
	  if (override && override.isClosed === true) {
	    return { ...out, status: 'closed', reason: override.reason || 'Closed on this date' };
	  }
	  let sessions = [];
	  let breaks = [];
	  if (override) {
	    const overrideSessions = sessionsFromField(override.sessions, override.startTime, override.endTime);
	    if (overrideSessions.length > 0) sessions = overrideSessions;
    breaks = breaksFromField(override.breaks);
	  } else {
	    const weekday = weekdayKeyOf(dateKey);
	    const day = Array.isArray(doctor.weeklySchedule) ? doctor.weeklySchedule.find((entry) => entry && matchesWeekday(entry.day, dateKey) && entry.enabled !== false) : null;
	    if (day) {
	      if (Array.isArray(day.sessions) && day.sessions.length > 0) {
	        sessions = sessionsFromField(day.sessions);
	      } else if (day.startTime || day.endTime) {
	        sessions = sessionsFromField(null, day.startTime, day.endTime);
	      }
	      breaks = breaksFromField(day.breaks);
	    }
	  }
	  if (sessions.length === 0) {
	    return { ...out, status: 'no_schedule', reason: 'No working hours configured for this date' };
	  }
	  if (leave && leave.leaveType === 'partial_day' && leave.startTime && leave.endTime) {
	    breaks.push({ name: leave.reason || 'Leave', startTime: leave.startTime, endTime: leave.endTime });
	  }
	  return {
	    ...out,
	    status: 'open',
	    sessions: normalizeSessions(sessions),
	    exclusions: normalizeBreaks(breaks),
	  };
}

function slotsForSession(session, durationMinutes, exclusions) {
  const out = [];
  const sessionStart = minutesOfDay(session.startTime);
  const sessionEnd = minutesOfDay(session.endTime);
  if (!Number.isFinite(sessionStart) || !Number.isFinite(sessionEnd) || sessionEnd <= sessionStart) return out;
  if (!Number.isFinite(durationMinutes) || durationMinutes <=    0) return out;
  for (let cursor = sessionStart; cursor + durationMinutes <= sessionEnd; cursor += durationMinutes) {
    if (isExcluded(cursor, exclusions)) continue;
    out.push({ startTime: formatMinutes(cursor), endTime: formatMinutes(cursor + durationMinutes) });
  }
	  return out;
}

function generateDaySlots(doctor, dateKey, opts) {
  const key = normalizeDateKey(dateKey);
  if (!key || !doctor) {
    return { reason: doctor ? 'no_schedule' : 'unavailable', slots: [], schedule: null };
	  }
	  const now = (opts && opts.now) || new Date();
	  if (isPastDate(key, now)) {
	    return { reason: 'past', slots: [], schedule: null };
	  }
	  const duration = resolveSlotDuration(doctor, opts && opts.slotDurationMinutes);
	  const schedule = resolveEffectiveSchedule(doctor, key, opts);
	  if (schedule.status !== 'open') {
	    return { reason: schedule.status, slots: [], schedule };
	  }
	  const slots = [];
	  for (const session of schedule.sessions) {
	    const perSession = slotsForSession(session, duration, schedule.exclusions);
	    for (const slot of perSession) {
	      if (!isPastTimeOnToday(key, slot.startTime, now)) {
	        slots.push({ ...slot });
	      }
	    }
	  }
	  const byKey = new Map();
	  for (const slot of slots) {
	    const existing = byKey.get(slot.startTime);
	    if (!existing || slot.endTime < existing.endTime) byKey.set(slot.startTime, slot);
	  }
	  return {
	    reason: 'open',
	    slots: [...byKey.values()].sort((a, b) => minutesOfDay(a.startTime) - minutesOfDay(b.startTime)),
	    schedule,
	  };
}

function dateRange(fromDate, toDate, opts) {
  const from = normalizeDateKey(fromDate);
  const to = normalizeDateKey(toDate);
  if (!from || !to) return [];
  const maxDays = (opts && opts.maxDays) || 31;
  const cursor = parseDateKey(from);
  const end = parseDateKey(to);
  if (!cursor || !end || cursor.getTime() > end.getTime()) return [];

	  const out = [];
	  while (out.length < maxDays) {
	    out.push(normalizeDateKey(cursor));
	    if (cursor.getTime() >= end.getTime()) break;
	    cursor.setDate(cursor.getDate() + 1);
	  }
	  return out;
}

function resolveRange(fromDate, toDate, opts) {
  const maxDays = (opts && opts.maxDays) || 31;
  const start = new Date((opts && opts.now) || new Date());
  start.setHours(0, 0, 0, 0);
  const defFrom = start;
  const defTo = new Date(start);
  defTo.setDate(defTo.getDate() + 14);
  const from = normalizeDateKey(fromDate || defFrom);
  const to = normalizeDateKey(toDate || defTo);
  const fromParsed = parseDateKey(from);
	  const toParsed = parseDateKey(to);
	  if (!fromParsed || !toParsed) return [];
	  if (fromParsed.getTime() > toParsed.getTime()) return [];
	  const cappedTo = new Date(fromParsed);
	  cappedTo.setDate(cappedTo.getDate() + (maxDays - 1));
	  const effectiveTo = toParsed.getTime() > cappedTo.getTime() ? cappedTo : toParsed;
	  return { fromDate: from, toDate: normalizeDateKey(effectiveTo) };
}

module.exports = {
  DEFAULT_SLOT_DURATION,
  MIN_SLOT_DURATION,
  MAX_SLOT_DURATION,
  DAY_KEYS,
  normalizeTime,
  compareDateKeys,
  formatMinutes,
  minutesOfDay,
  normalizeDateKey,
  parseDateKey,
  isPastDate,
  isPastTimeOnToday,
  matchesWeekday,
  holidayOn,
  leaveOn,
  overrideOn,
  resolveSlotDuration,
  resolveEffectiveSchedule,
  slotsForSession,
  generateDaySlots,
  dateRange,
  resolveRange,
};

