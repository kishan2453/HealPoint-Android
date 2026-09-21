# HealPoint - Smart Slot Generation Engine (drop-in module)
## Database connection

The slot module ships its own MongoDB wiring so the `Slot` collection and the
unique `(hospitalId, doctorId, date, startTime)` index can be provisioned and
verified independently of the main backend repo.

```bash
cd server-slots
npm install          # installs mongoose
cp .env.example .env # adjust MONGO_URI / DB_NAME if needed
npm run db:verify    # connect -> build indexes -> insert/read/delete roundtrip
```

`.env` (git-ignored by the repo root):

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017
DB_NAME=healpoint_slots
```

What the probe verifies (all real, against your actual MongoDB):

1. mongoose connects using `MONGO_URI` + `DB_NAME`.
2. `Slot.syncIndexes()` creates the unique sparse index.
3. A probe slot document inserts and reads back.
4. Inserting the SAME `(hospital, doctor, date, startTime)` again is rejected
   with a Mongo `E11000` duplicate-key error (the idempotency/TEST-10 contract
   proven at the DB level).
5. The probe document is cleaned up.

When deployed inside the main backend, mongoose is already connected there;
the slot models attach to that same shared mongoose instance, so no second
connection is opened.

Complete implementation of the slot generation + management backend for the
HealPoint Express/MongoDB server (which lives in a separate repo,
`Doctor-apppointment/server-with-client`). Copy this folder into that repo,
wire it in, and the Hospital Admin slot module works end to end.

No fake slots. No parallel system. No duplicated booking flow. This module
MATERIALIZES the doctor's existing schedule (the same `weeklySchedule`,
`dateOverrides`, `blockedHolidays`, `leaves` and `slotDurationMinutes` that the
current `get-available-slots` already computes on the fly) into a persisted
`Slot` collection, while preserving the legacy schedule-derived availability.

## What's inside

```
server-slots/
├─ services/slotEngine.js      # pure generation engine (no DB, unit-tested)
├─ services/slotService.js     # preview/generate/regenerate/calendar/block/unblock/claim
├─ controllers/slotController.js # Hospital Admin API + hospital isolation + audit
├─ routes/slotRoutes.js        # mounting + role gating
├─ models/slotModel.js         # Mongoose Slot model + unique index
└─ tests/                      # TEST MATRIX 1-14 (node --test)
```

## 1. Copy into the backend

| From this repo | To (in `Doctor-apppointment/server-with-client`) |
|---|---|
| `server-slots/models/slotModel.js` | `models/slotModel.js` |
| `server-slots/services/slotEngine.js` | `services/slotEngine.js` |
| `server-slots/services/slotService.js` | `services/slotService.js` |
| `server-slots/controllers/slotController.js` | `controllers/slotController.js` |
| `server-slots/routes/slotRoutes.js` | `routes/slotRoutes.js` |

Optional: install the module's tests + fake model if you want to run the
backend test matrix locally (`npm test`):
`server-slots/tests/_` -> `test/` and run `node --test test/slots.test.js`.

Also mount the patient + doctor readers (same inventory, own auth scopes):

```js
const {
  mountSlotPatientRoutes,
  mountSlotDoctorRoutes,
} = require('./routes/slotRoutes');

// Patient booking reads the same generated inventory (falls back to legacy
// /appointment/get-available-slots when unmounted).
mountSlotPatientRoutes(app, {
  authMiddleware: patientAuthMiddleware, // existing patient JWT verify
  slotModel: require('./models/slotModel'),
  doctorModel: require('./models/doctorModel'),
  appointmentModel: require('./models/appointmentModel'), // optional
});

// Doctor Portal reads ONLY its own slots (id resolved from the doctor JWT).
mountSlotDoctorRoutes(app, {
  authMiddleware: doctorAuthMiddleware, // existing doctor JWT verify
  slotModel: require('./models/slotModel'),
  doctorModel: require('./models/doctorModel'),
  appointmentModel: require('./models/appointmentModel'), // optional
});
```

## 2. Mount the routes (in app.js / server.js)

Patient + doctor mounts live here too (same inventory, own auth scopes) —
see the snippet at the end of §1. Mount them alongside the admin routes:

```js
const createSlotRoutes = require('./routes/slotRoutes');

// Behind the backend's EXISTING auth + role middleware:
app.use(
  '/api/v1/admin/slots',
  authMiddleware,                 // existing JWT verify
  roleMiddleware('admin'),        // existing role gate (admin / super_admin)
  createSlotRoutes({
    slotModel: require('./models/slotModel'),
    doctorModel: require('./models/doctorModel'),
    auditModel: require('./models/auditModel'), // optional - skip for none
  }),
);
```

Or use the convenience helper (it also double-checks the role when no role
middleware is supplied):

```js
const { mountSlotRoutes } = require('./routes/slotRoutes');
mountSlotRoutes(app, {
  authMiddleware,
  roleMiddleware, // optional
  slotModel: require('./models/slotModel'),
  doctorModel: require('./models/doctorModel'),
});
```

## 3. API contract

| Scope | Method/Path | Body / Query | Response |
|---|---|---|---|
| Admin | `GET /api/v1/admin/slots/:doctorId/preview` | `?fromDate=DD-MM-YYYY&toDate=DD-MM-YYYY` (default today..+14d) | `{success,data:{doctorId,hospitalId,range,totals,perDate}}` |
| Admin | `POST /api/v1/admin/slots/:doctorId/generate` | `{fromDate,toDate}` | `{success,data:{created,alreadyExisting,skippedLeave,skippedHoliday,skippedOverride,skippedPast,skippedUnavailable,conflicts,perDate}}` |
| Admin | `POST /api/v1/admin/slots/:doctorId/regenerate` | `{fromDate,toDate}` | `{success,data:{created,alreadyExisting,released,expiredClosed,preservedBooked,preservedBlocked,perDate}}` |
| Admin | `GET /api/v1/admin/slots/:doctorId/calendar` | `?fromDate&toDate` | `{success,data:{perDate:[{date,slots:[{startTime,endTime,status,...}]}],counts}}` |
| Admin | `POST /api/v1/admin/slots/:doctorId/bulk/preview` | `{fromDate,toDate,daysOfWeek?,behavior?,slotDurationMinutes?}` | `{success,data:{totals:{datesAffected,expectedSlots,newSlots,existingSlots,bookedSlots,leaveDates,holidayDates,overrideDates,conflicts},perDate}}` — never writes |
| Admin | `POST /api/v1/admin/slots/:doctorId/bulk/apply` | `{fromDate,toDate,daysOfWeek?,behavior?,slotDurationMinutes?,confirm:true}` | `{success,data:{created,skipped,alreadyExisting,bookedProtected,blocked,leaveConflicts,holidayConflicts,overrideConflicts,otherConflicts,failed}}` — idempotent; booked/paid never touched |
| Admin | `POST /api/v1/admin/slots/:doctorId/bulk/block` | `{slots:[{date,startTime}],reason?}` | `{success,data:{blocked,alreadyBlocked,protected,failed}}` |
| Admin | `POST /api/v1/admin/slots/:doctorId/bulk/unblock` | `{slots:[{date,startTime}]}` | `{success,data:{unblocked,skipped,failed}}` |
| Admin | `POST /api/v1/admin/slots/:doctorId/clear-unbooked` | `{fromDate,toDate,confirm:true}` | `{success,data:{cleared,remaining}}` — deletes ONLY available/expired unbooked rows |
| Admin | `GET /api/v1/admin/slots/:doctorId/conflicts` | `?fromDate&toDate` | `{success,data:{summary:{total,critical,warning,info,byType},conflicts:[{severity,type,title,detail,existingRecord,conflictingRecord,recommendedAction,...}],dateMarkers}}` |
| Admin | `GET /api/v1/admin/slots/hospital/calendar` | `?doctorIds=a,b&fromDate&toDate&department?` | `{success,data:{range,perDoctor:[{doctorId,doctorName,counts,perDate}],perDate:[{date,available,booked,blocked,leave,holiday,override,doctors}]}}` — multi-doctor aggregate (all hospital-scoped) |
| Admin | `POST /api/v1/admin/slots/:doctorId/block` | `{date,startTime,reason}` | `{success,data:{status:'blocked',blockReason,...}}` or `409 "already has an appointment"` |
| Admin | `POST /api/v1/admin/slots/:doctorId/unblock` | `{date,startTime}` | `{success,data:{status:'available'|'blocked'|'expired',note}}` |
| Patient | `GET /api/v1/slots/availability/:doctorId` | `?date=DD-MM-YYYY` (patient JWT) | `{success,data:{doctorId,date,slots,source,reason}}` — same inventory; blocked/booked never listed |
| Doctor | `GET /api/v1/doctor/slots/calendar` | `?fromDate&toDate` (doctor JWT, own slots only) | `{success,data:{perDate,counts,...}}` — same inventory the admin manages |
| Doctor | `GET /api/v1/doctor/slots/availability` | `?date=DD-MM-YYYY` (doctor JWT, own slots only) | `{success,data:{doctorId,date,slots,source,reason}}` |

Times are `HH:mm` (24h); dates `DD-MM-YYYY` (both match the app's existing
slot format). The mobile admin UI (`app/admin/slots.tsx`) posts the admin
shapes; patient booking (`services/appointments.ts` → `GET
/slots/availability/:doctorId`) reads the SAME inventory with legacy
`/appointment/get-available-slots/:doctorId` kept as fallback; the Doctor
Portal (`app/doctor/availability.tsx` → `GET /doctor/slots/calendar` +
`/availability`) reads the same persisted slots for the signed-in doctor only.

## 4. Wire the atomic booking claim into /appointment/create

To make patient booking race-safe (TEST 11), replace the existing check in the
appointment create controller:

```js
const slotService = require('../services/slotService');
const Slot = require('../models/slotModel');

// inside POST /appointment/create, before inserting the appointment:
const claimed = await slotService.claimSlotAtomic(
  Slot,
  appointment.hospitalId,
  req.body.doctorId,
  req.body.slotDate,      // DD-MM-YYYY
  req.body.slotTime,      // HH:mm - convert from "09:00 AM" if the client sends 12h
  appointment._id,
);
if (!claimed) {
  return res.status(409).json({ success: false, message: 'This time slot was just booked. Please select another.' });
}
```

The appointment is created FIRST (with a pending/confirmed status), then the
slot is claimed. If the claim fails the appointment is rolled back. Legacy
`validate-slot` remains a fast pre-check (non-authoritative).

## 5. Security model (TEST 12)

- Every route requires an authenticated Hospital Admin (backend auth + role).
- `loadDoctorForAdmin` resolves the admin's OWN hospital from `req.hospitalId`
  and compares `doctor.hospitalId`. A Hospital A admin calling with Hospital B's
  doctorId gets `403`.
- All Slot queries are additionally scoped `{hospitalId, doctorId}`.
- Frontend filtering is never trusted; the 403 happens even for direct API calls.

## 6. Idempotency + concurrency (TEST 2 / TEST 10)

- Unique sparse index on `(hospitalId, doctorId, date, startTime)`.
- `generate`/`regenerate` use `bulkWrite` upserts; an `E11000` from a racing
  request is treated as "already existing" (never a duplicate, never a 500).

## 7. Slot statuses

`available` - `booked` - `blocked` - `cancelled` - `expired`.
These match the existing booking/status vocabulary; nothing new is invented.

## 8. Audit

When `auditModel` is injected, mutations append `{actorType:'admin',actorId,
action,summary,createdAt}` (e.g. `slot_generate`, `slot_block`,
`slot_unblock`). Passwords/tokens/secrets are never recorded.

## 9. Run the tests

```
cd server-slots
npm test     # or: node --test tests/slots.test.js
```

Covers TEST MATRIX 1-14 (valid schedule, idempotency, breaks, leave, override,
holiday, block available, block booked, regeneration with booked preserved,
concurrent generation, double-booking race, hospital isolation, patient booking,
doctor portal state).
