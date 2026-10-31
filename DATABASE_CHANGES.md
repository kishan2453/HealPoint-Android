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

---

## Phase 3: AI Health Assistant
- **New Additive Collection**: `aiconversations` (`aiConversationModel.js`)
  - `userId`: `{ type: ObjectId, ref: 'User', required: true, index: true }`
  - `sender`: `{ type: String, enum: ['user', 'ai'], required: true }`
  - `text`: `{ type: String, required: true }`
  - `language`: `{ type: String, enum: ['en', 'hi', 'gu'], default: 'en' }`
  - `isEmergency`: `{ type: Boolean, default: false }`
  - `suggestedSpeciality`: `{ type: String, default: null }`
  - `disclaimer`: `{ type: String, default: null }`
  - `cards`: `[{ type: Object }]`
  - `actions`: `[{ type: Object }]`
  - `createdAt`, `updatedAt`: `{ type: Date }`
- **Indexes**:
  - Compound index: `{ userId: 1, createdAt: -1 }` (for fast chronological query and user data deletion).
- **Zero Impact on Existing Data**:
  - Completely additive collection. Existing collections (`users`, `doctors`, `appointments`, `hospitals`) are unmodified.
- **Rollback Procedure**:
  ```javascript
  // Drop the newly introduced collection
  db.aiconversations.drop();
  ```


---

## Phase 4: Advanced Health Wallet Enhancements
- **Additive Fields on `HealthDocument` (`healthDocumentModel.js`)**:
  - `category`: Extended enum with 8 standard categories (`prescription`, `lab_report`, `diagnostic_report`, `consultation_history`, `medical_document`, `billing_receipt`, `appointment_record`, `other`) + legacy compatibility (`radiology`, `discharge_summary`, `vaccination`).
  - `hospitalId`: `{ type: ObjectId, ref: 'Hospital', default: null }`
  - `hospitalName`: `{ type: String, default: "" }`
  - `doctorId`: `{ type: ObjectId, ref: 'Doctor', default: null }`
  - `doctorName`: `{ type: String, default: "" }`
  - `appointmentId`: `{ type: String, default: "" }`
  - `fileUrl`: `{ type: String, default: "" }`
  - `fileName`: `{ type: String, default: "" }`
  - `fileSize`: `{ type: Number, default: 0 }`
  - `tags`: `[{ type: String }]`
  - `isArchived`: `{ type: Boolean, default: false, index: true }`
  - `processingStatus`: `{ type: String, enum: ['pending', 'processing', 'processed', 'partially_processed', 'failed'], default: 'processed' }`
  - `confidence`: `{ type: Number, default: 100 }`
  - `extractedMetadata`: Schema with `documentType`, `doctorName`, `hospitalName`, `referenceNumber`, `patientName`, `testResults`.
  - `userCorrections`: Schema with `isCorrected`, `correctedAt`, `correctedBy`.
  - `doctorSummary`: `{ type: String, default: "" }`
  - `contentHash`: `{ type: String, default: "" }`
- **Indexes Added**:
  - Compound index: `{ userId: 1, category: 1, createdAt: -1 }` (for filtered lists)
  - Compound index: `{ userId: 1, familyMemberId: 1, createdAt: -1 }` (for family profile isolation)
  - Compound index: `{ userId: 1, isArchived: 1 }` (for active vault queries)
- **Rollback Procedure**:
  ```javascript
  // Remove Phase 4 additive fields
  db.healthdocuments.updateMany(
    {},
    {
      $unset: {
        hospitalId: "",
        hospitalName: "",
        doctorId: "",
        doctorName: "",
        appointmentId: "",
        fileUrl: "",
        fileName: "",
        fileSize: "",
        tags: "",
        isArchived: "",
        processingStatus: "",
        confidence: "",
        extractedMetadata: "",
        userCorrections: "",
        doctorSummary: "",
        contentHash: "",
      },
    }
  );
  // Drop compound indexes
  db.healthdocuments.dropIndex("userId_1_category_1_createdAt_-1");
  db.healthdocuments.dropIndex("userId_1_familyMemberId_1_createdAt_-1");
  db.healthdocuments.dropIndex("userId_1_isArchived_1");
  ```
