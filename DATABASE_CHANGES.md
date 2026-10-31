# HealPoint 2.0 — Database Changes & Rollback Log

This document records all additive, backward-compatible database modifications across every phase, including explicit rollback procedures.

---

## Migration & Data Safety Rules

1. **Strictly Additive**: No existing fields or collections may be deleted or renamed.
2. **Backward Compatible**: Existing documents lacking new fields must continue to function normally with default values.
3. **Rollback Verification**: Every migration must specify an exact rollback query/script.
4. **Pre-Migration Verification**: Before executing any migration on production-like data, verify a recent restorable backup exists.

---

## Phase 0: Baseline Audit
- **Collections Active**:
  - `users`: User profiles, roles, family members, emergency contact, subscriptions.
  - `doctors`: Doctor profiles, hospitalId, fees, schedules, slots, ratings.
  - `hospitals`: Hospital facilities, departments, contact, location.
  - `appointments`: Bookings, billing, queue fields, consultation status, payments, reminders.
  - `healthdocuments`: Health wallet documents and doctor sharing.
  - `subscriptionplans` & `subscriptions`: Tier definitions and user active subscriptions.
  - `auditlogs`: Administrative action records.
  - `reviews`: Doctor reviews and ratings.
  - `notifications`: User and doctor notifications.
- **Modifications**: None in Phase 0.
- **Rollback**: N/A.

---

## Phase 1: Live Queue Management
- **Additive Fields on `Appointment`**:
  - `queuePosition`: `{ type: Number, default: 0 }` (cached queue rank)
  - `estimatedWaitMinutes`: `{ type: Number, default: 0 }` (dynamic wait time)
  - `consultationStartTime`: `{ type: Date }` (recorded when status changes to in_consultation)
  - `consultationEndTime`: `{ type: Date }` (recorded when consultation completes)
- **Indexes**:
  - Compound index: `{ hospitalId: 1, doctorId: 1, slotDate: 1, queueStatus: 1 }` for ultra-fast queue lookups.
- **Rollback Procedure**:
  ```javascript
  // Remove added fields from collection
  db.appointments.updateMany(
    {},
    {
      $unset: {
        queuePosition: "",
        estimatedWaitMinutes: "",
        consultationStartTime: "",
        consultationEndTime: "",
      },
    }
  );
  // Drop added compound index
  db.appointments.dropIndex("hospitalId_1_doctorId_1_slotDate_1_queueStatus_1");
  ```

---

## Phase 2: Advanced Video Consultation
- **Additive Fields on `Appointment` (`appointmentModel.js`)**:
  - `consultationSessionId`: `{ type: String, default: null }` (UUID / token identifier for WebRTC session)
  - `consultationDurationSeconds`: `{ type: Number, default: 0 }` (Actual call duration logged upon completion)
  - `consultationNotes`: `{ type: String, default: "" }` (Clinical notes taken during or after session)
  - `consultationReconnectionCount`: `{ type: Number, default: 0 }` (Telemetry for call quality & reconnection tracking)
- **Compatibility**:
  - All new fields have defaults (`null`, `0`, `""`). Existing appointments without these fields continue to work without modification.
  - Stored `meetingUrl` and Google Meet workflows remain intact as fallbacks.
- **Rollback Procedure**:
  ```javascript
  // Remove Phase 2 additive fields
  db.appointments.updateMany(
    {},
    {
      $unset: {
        consultationSessionId: "",
        consultationDurationSeconds: "",
        consultationNotes: "",
        consultationReconnectionCount: "",
      },
    }
  );
  ```

