'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../services/slotEngine');
const slotService = require('../services/slotService');
const { FakeSlot } = require('./fakeSlot');

const MON = '07-09-2026';
const TUE = '08-09-2026';
const NOW = new Date(2026, 8, 7, 8, 0, 0);

function doctorOverrides(extra) {
  const doctor = {
    _id: 'doc-1',
    hospitalId: 'hosp-1',
    name: 'Dr. XYZ',
    isActive: true,
    available: true,
    slotDurationMinutes: 30,
    weeklySchedule: [
      {
        day: 'Monday',
        enabled: true,
        sessions: [
          { startTime: '09:00', endTime: '13:00' },
          { startTime: '14:00', endTime: '18:00' },
        ],
        breaks: [{ startTime: '13:00', endTime: '14:00', name: 'Lunch' }],
      },
      { day: 'Tuesday', enabled: true, startTime: '10:00', endTime: '12:00' },
    ],
  };
  return Object.assign(doctor, extra);
}

function fakeDoctorWith(doctor) {
  return {
    findById: async (id) => {
      if (String(id) !== String(doctor._id)) return null;
      const doc = { ...doctor };
      doc.lean = () => ({ ...doctor });
      return doc;
    },
  };
}

function okRes() {
  const state = { status: 200, payload: null };
  const res = {
    status: (s) => { state.status = s; return res; },
    json: (body) => { state.payload = body; return res; },
    statusCode: () => state.status,
    body: () => state.payload,
  };
  return res;
}
describe('TEST 1: Generate slots from valid schedule', () => {
  test('Monday 09:00-13:00 + 14:00-18:00 -> 16 slots', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    const res = await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    assert.equal(res.data.created, 16);
    assert.equal(res.data.alreadyExisting, 0);
    const times = slot.dump().map((s) => s.startTime).sort();
    assert.equal(times[0], '09:00');
    assert.equal(times[7], '12:30');
    assert.equal(times[8], '14:00');
    assert.equal(times[15], '17:30');
  });
});

describe('TEST 2: Generate same schedule twice -> no duplicates', () => {
  test('second run creates 0 and reports already existing', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const second = await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    assert.equal(second.data.created, 0);
    assert.equal(second.data.alreadyExisting, 16);
    assert.equal(slot.dump().length, 16);
  });
});

describe('TEST 3: Schedule contains break -> break slots not created', () => {
  test('no 13:00 / 13:30 slots', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const times = slot.dump().map((s) => s.startTime);
    assert.ok(!times.includes('13:00'));
    assert.ok(!times.includes('13:30'));
    assert.ok(times.includes('14:00'));
  });
});

describe('TEST 4: Doctor has leave -> no slots during leave', () => {
  test('full-day leave Monday -> zero slots', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({ leaves: [{ leaveType: 'full_day', startDate: MON, endDate: MON, reason: 'Medical' }] });
    const res = await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    assert.equal(res.data.created, 0);
    assert.equal(res.data.skippedLeave, 1);
    assert.equal(slot.dump().length, 0);
  });

  test('partial-day leave 14:00-17:00 -> only morning slots', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({ leaves: [{ leaveType: 'partial_day', startDate: MON, startTime: '14:00', endTime: '17:00' }] });
    const res = await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const times = slot.dump().map((s) => s.startTime);
    assert.equal(res.data.created, 10); // 8 morning + 17:00,17:30 (leave window 14:00-17:00)
    assert.ok(!times.some((t) => t >= '14:00' && t < '17:00'));
  });
});

describe('TEST 5: Date override -> override schedule used', () => {
  test('override Monday to 10:00-14:00 -> only 10:00..13:30', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({ dateOverrides: [{ date: MON, startTime: '10:00', endTime: '14:00', reason: 'Event' }] });
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const times = slot.dump().map((s) => s.startTime).sort();
    assert.equal(times.length, 8);
    assert.equal(times[0], '10:00');
    assert.equal(times[7], '13:30');
    assert.ok(!times.includes('09:00'));
  });

  test('closed override -> zero slots', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({ dateOverrides: [{ date: MON, isClosed: true, reason: 'Closed' }] });
    const res = await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    assert.equal(res.data.created, 0);
    assert.equal(res.data.skippedOverride, 1);
  });
});

describe('TEST 6: Holiday -> no slots generated', () => {
  test('blockedHolidays on Monday -> zero slots', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({ blockedHolidays: [{ date: MON, reason: 'Public holiday' }] });
    const res = await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    assert.equal(res.data.created, 0);
    assert.equal(res.data.skippedHoliday, 1);
  });
});

describe('TEST 7: Block available slot -> patient cannot book it', () => {
  test('blocked slot is not available for booking', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const blocked = await slotService.blockSlot(slot, fakeDoctorWith(doctor), doctor._id, MON, '10:00', { reason: 'Doctor Meeting' });
    assert.equal(blocked.data.status, 'blocked');
    assert.equal(blocked.data.blockReason, 'Doctor Meeting');
    const available = slot.dump().filter((s) => s.status === 'available').map((s) => s.startTime);
    assert.ok(!available.includes('10:00'));
  });
});

describe('TEST 8: Block booked slot -> MUST FAIL', () => {
  test('blocking an appointment-held slot returns 409', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const claimed = await slotService.claimSlotAtomic(slot, 'hosp-1', doctor._id, MON, '10:30', 'appt-xyz');
    assert.ok(claimed !== null, 'claimed');
    let failed = false;
    try {
      await slotService.blockSlot(slot, fakeDoctorWith(doctor), doctor._id, MON, '10:30', { reason: 'nope' });
    } catch (err) {
      failed = true;
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /appointment/);
    }
    assert.ok(failed, 'block on booked slot must throw');
  });
});

describe('TEST 9: Regenerate with booked slots -> booked preserved', () => {
  test('regeneration keeps booked slots, releases stale available', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const c = await slotService.claimSlotAtomic(slot, 'hosp-1', doctor._id, MON, '09:30', 'appt-keep');
    assert.ok(c !== null, 'slot claimed');
    const narrow = doctorOverrides({ weeklySchedule: [{ day: 'Monday', enabled: true, startTime: '09:00', endTime: '10:00' }] });
    const res = await slotService.regenerateDates(slot, fakeDoctorWith(narrow), doctor._id, [MON], { now: NOW });
    assert.equal(res.data.preservedBooked, 1, 'booked preserved count');
    const bookedSlot = slot.dump().find((s) => s.startTime === '09:30');
    assert.ok(bookedSlot, '09:30 still present');
    assert.equal(bookedSlot.status, 'booked');
    assert.equal(bookedSlot.appointmentId, 'appt-keep');
  });
});

describe('TEST 10: Two generation requests simultaneously -> no duplicates', () => {
  test('concurrent generation yields exactly 16 unique slots', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    const p1 = slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const p2 = slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(slot.dump().length, 16);
    assert.equal(r1.data.created + r2.data.created, 16);
  });
});

describe('TEST 11: Two booking requests for same slot -> only one succeeds', () => {
  test('only one atomic claim wins', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const c1 = await slotService.claimSlotAtomic(slot, 'hosp-1', doctor._id, MON, '11:00', 'appt-A');
    const c2 = await slotService.claimSlotAtomic(slot, 'hosp-1', doctor._id, MON, '11:00', 'appt-B');
    assert.ok(c1 !== null);
    assert.ok(c2 === null);
    const doc = slot.dump().find((s) => s.startTime === '11:00');
    assert.equal(doc.appointmentId, 'appt-A');
  });
});

describe('TEST 12: Hospital A accesses Hospital B slot -> MUST FAIL', () => {
  test('controller: same-hospital ok, cross-hospital 403', async () => {
    const controller = require('../controllers/slotController')();
    const doctorA = { _id: 'docA', hospitalId: 'hospA', name: 'Dr A', weeklySchedule: [], slotDurationMinutes: 30 };
    const slot = new FakeSlot();

    const reqA = {
      params: { doctorId: 'docA' },
      query: {},
      body: {},
      user: { _id: 'adminA' },
      hospitalId: 'hospA',
      models: {
        Doctor: { findById: async () => ({ ...doctorA }) },
        Slot: slot,
      },
    };
    const resA = okRes();
    await controller.calendar(reqA, resA);
    assert.equal(resA.statusCode(), 200, 'same-hospital access allowed');
    assert.equal(resA.body().success, true);

    const reqB = {
      params: { doctorId: 'docA' },
      query: {},
      body: {},
      user: { _id: 'adminB' },
      hospitalId: 'hospB',
      models: {
        Doctor: { findById: async () => ({ ...doctorA }) },
        Slot: slot,
      },
    };
    const resB = okRes();
    await controller.calendar(reqB, resB);
    assert.equal(resB.statusCode(), 403, 'cross-hospital must be denied');
    assert.equal(resB.body().success, false);
  });
});

describe('TEST 15: Bulk preview -> no writes, real numbers', () => {
  test('preview reports expected/new without inserting', async () => {
    const bulk = require('../services/bulkService');
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    const preview = await bulk.planBulkScheduling(
      slot, fakeDoctorWith(doctor), doctor._id,
      { fromDate: MON, toDate: MON, daysOfWeek: [], behavior: 'generate_missing' },
      { now: NOW }, null,
    );
    assert.equal(preview.success, true);
    assert.equal(preview.data.totals.datesAffected, 1);
    assert.equal(preview.data.totals.expectedSlots, 16);
    assert.equal(preview.data.totals.newSlots, 16);
    assert.equal(slot.dump().length, 0);
  });
});

describe('TEST 16: Bulk apply twice -> idempotent', () => {
  test('second apply creates 0, reports alreadyExisting', async () => {
    const bulk = require('../services/bulkService');
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    const payload = { fromDate: MON, toDate: MON, daysOfWeek: [], behavior: 'generate_missing' };
    const first = await bulk.applyBulkScheduling(slot, fakeDoctorWith(doctor), doctor._id, payload, { now: NOW });
    const second = await bulk.applyBulkScheduling(slot, fakeDoctorWith(doctor), doctor._id, payload, { now: NOW });
    assert.equal(first.data.created, 16);
    assert.equal(second.data.created, 0);
    assert.equal(slot.dump().length, 16);
  });
});

describe('TEST 17: Conflict detection -> real schedule conflicts', () => {
  test('overlapping sessions + holiday detected', async () => {
    const bulk = require('../services/bulkService');
    const slot = new FakeSlot();
    const doctor = doctorOverrides({
      weeklySchedule: [
        {
          day: 'Monday', enabled: true,
          sessions: [
            { startTime: '09:00', endTime: '12:00' },
            { startTime: '11:00', endTime: '14:00' },
          ],
        },
      ],
      blockedHolidays: [{ date: MON, reason: 'Test holiday' }],
    });
    const out = await bulk.detectConflicts(
      slot, fakeDoctorWith(doctor), doctor._id, MON, MON, { now: NOW }, null,
    );
    const types = out.data.conflicts.map((c) => c.type);
    assert.ok(types.includes('overlapping_sessions'));
    assert.ok(types.includes('holiday_with_active_schedule'));
    assert.ok(out.data.summary.critical + out.data.summary.warning > 0);
  });
});

describe('TEST 18: Bulk block protects booked slots', () => {
  test('booked counted as protected, available blocked', async () => {
    const bulk = require('../services/bulkService');
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    await slotService.claimSlotAtomic(slot, 'hosp-1', doctor._id, MON, '09:00', 'appt-1');
    const out = await bulk.bulkBlockSlots(
      slot, fakeDoctorWith(doctor), doctor._id,
      [{ date: MON, startTime: '09:00' }, { date: MON, startTime: '09:30' }],
      {},
    );
    assert.equal(out.data.blocked, 1);
    assert.equal(out.data.protected, 1);
  });
});

describe('TEST 19: Clear removes only unbooked slots', () => {
  test('booked survives clear', async () => {
    const bulk = require('../services/bulkService');
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    await slotService.claimSlotAtomic(slot, 'hosp-1', doctor._id, MON, '09:00', 'appt-1');
    const out = await bulk.clearUnbookedSlots(slot, fakeDoctorWith(doctor), doctor._id, MON, MON, { now: NOW });
    assert.equal(out.data.cleared, 15);
    assert.equal(out.data.remaining, 1);
  });
});

describe('TEST 20: Bulk hospital isolation -> cross-hospital 403', () => {
  test('bulk preview for foreign doctor denied', async () => {
    const controller = require('../controllers/slotController')();
    const doctorB = { _id: 'docB', hospitalId: 'hospB', name: 'Dr B', weeklySchedule: [], slotDurationMinutes: 30 };
    const req = {
      params: { doctorId: 'docB' },
      query: {}, body: { fromDate: MON, toDate: MON, daysOfWeek: [] },
      user: { _id: 'adminA' }, hospitalId: 'hospA',
      models: { Doctor: { findById: async () => ({ ...doctorB }) }, Slot: new FakeSlot() },
    };
    const res = okRes();
    await controller.bulkPreview(req, res);
    assert.equal(res.statusCode(), 403);
  });
});

describe('TEST 13: Patient booking -> slot status updates correctly', () => {
  test('claim transitions available to booked', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    const claimed = await slotService.claimSlotAtomic(slot, 'hosp-1', doctor._id, MON, '09:00', 'appt-1');
    assert.ok(claimed);
    const doc = slot.dump().find((s) => s.startTime === '09:00');
    assert.equal(doc.status, 'booked');
    assert.equal(doc.appointmentId, 'appt-1');
  });
});

describe('TEST 14: Doctor Portal -> slot state matches', () => {
  test('calendar returns persisted state (available/booked/blocked)', async () => {
    const slot = new FakeSlot();
    const doctor = doctorOverrides({});
    await slotService.generateForDates(slot, fakeDoctorWith(doctor), doctor._id, [MON], { now: NOW });
    await slotService.blockSlot(slot, fakeDoctorWith(doctor), doctor._id, MON, '10:00', { reason: 'Meeting' });
    await slotService.claimSlotAtomic(slot, 'hosp-1', doctor._id, MON, '09:30', 'appt-p');
    const cal = await slotService.getCalendar(slot, fakeDoctorWith(doctor), doctor._id, MON, MON, { now: NOW });
    assert.equal(cal.data.counts.available, 14);
    assert.equal(cal.data.counts.booked, 1);
    assert.equal(cal.data.counts.blocked, 1);
  });
});
