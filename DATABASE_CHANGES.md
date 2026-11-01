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

---

## Phase 5: Digital Prescription & Medicine Reminders

- **New Collection: `prescriptions` (`prescriptionModel`)**:
  - `prescriptionNumber`: `{ type: String, unique: true, index: true }` (Format: `RX-YYYY-XXXXXX`)
  - `appointmentId`: `{ type: ObjectId, ref: 'Appointment', required: true, index: true }`
  - `doctorId`: `{ type: ObjectId, ref: 'Doctor', required: true, index: true }`
  - `patientId`: `{ type: ObjectId, ref: 'User', required: true, index: true }`
  - `hospitalId`: `{ type: ObjectId, ref: 'Hospital', index: true }`
  - `familyMemberId`: `{ type: ObjectId, default: null, index: true }`
  - `patientSnapshot`: Embedded snapshot `{ name, age, gender, phone, displayId }`
  - `doctorSnapshot`: Embedded snapshot `{ name, qualification, speciality, registrationNumber, phone }`
  - `hospitalSnapshot`: Embedded snapshot `{ name, address, city, phone }`
  - `diagnosis`: `{ type: String, trim: true, default: "" }`
  - `symptoms`: `[{ type: String }]`
  - `vitals`: `{ bloodPressure, heartRate, temperature, weight, oxygenLevel }`
  - `medicines`: Array of `{ name, strength, form, dosage, frequency, duration, durationDays, route, timing, instructions, scheduleTimes, startDate, endDate }`
  - `generalInstructions`: `{ type: String, default: "" }`
  - `dietInstructions`: `{ type: String, default: "" }`
  - `followUpDate`: `{ type: Date, default: null }`
  - `followUpInstructions`: `{ type: String, default: "" }`
  - `status`: `{ type: String, enum: ['draft', 'issued', 'amended', 'cancelled'], default: 'draft', index: true }`
  - `version`: `{ type: Number, default: 1 }`
  - `history`: Array of previous versions `{ version, amendedAt, amendedBy, amendmentReason, snapshot }`
  - `isDigitallySigned`: `{ type: Boolean, default: false }`
  - `signedAt`: `{ type: Date, default: null }`
  - `signedByDoctorId`: `{ type: ObjectId, ref: 'Doctor', default: null }`
  - `doctorSignatureStamp`: `{ type: String, default: "" }`
  - `pdfUrl`: `{ type: String, default: "" }`

- **New Collection: `medicationreminders` (`medicationReminderModel`)**:
  - `userId`: `{ type: ObjectId, ref: 'User', required: true, index: true }`
  - `familyMemberId`: `{ type: ObjectId, default: null, index: true }`
  - `prescriptionId`: `{ type: ObjectId, ref: 'Prescription', default: null, index: true }`
  - `appointmentId`: `{ type: ObjectId, ref: 'Appointment', default: null, index: true }`
  - `doctorId`: `{ type: ObjectId, ref: 'Doctor', default: null }`
  - `hospitalId`: `{ type: ObjectId, ref: 'Hospital', default: null }`
  - `medicineName`: `{ type: String, required: true, trim: true }`
  - `strength`: `{ type: String, default: "" }`
  - `dosage`: `{ type: String, default: "" }`
  - `frequency`: `{ type: String, default: "1-0-1" }`
  - `timing`: `{ type: String, default: "After food" }`
  - `instructions`: `{ type: String, default: "" }`
  - `startDate`: `{ type: Date, default: Date.now }`
  - `endDate`: `{ type: Date, default: null }`
  - `times`: `[{ type: String }]` (e.g. `["08:00 AM", "08:00 PM"]`)
  - `timezone`: `{ type: String, default: "Asia/Kolkata" }`
  - `isActive`: `{ type: Boolean, default: true, index: true }`
  - `refillReminder`: `{ enabled, refillDate, remindBeforeDays, isNotified }`
  - `followUpReminder`: `{ enabled, followUpDate, remindBeforeDays, isNotified }`
  - `notificationPreferences`: `{ push, sms, whatsapp }`
  - `logs`: Array of dose records `{ doseDate, scheduledTime, status: ['pending', 'taken', 'skipped', 'snoozed', 'missed'], actionTimestamp, notes }`

- **Indexes Created**:
  - `prescriptions`: `{ patientId: 1, createdAt: -1 }`, `{ doctorId: 1, createdAt: -1 }`, `{ hospitalId: 1, createdAt: -1 }`, `{ appointmentId: 1 }`
  - `medicationreminders`: `{ userId: 1, isActive: 1 }`, `{ userId: 1, familyMemberId: 1, isActive: 1 }`, `{ appointmentId: 1, medicineName: 1 }`

- **Rollback Procedure**:
  ```javascript
  // Drop Phase 5 collections if rollback is required
  db.prescriptions.drop();
  db.medicationreminders.drop();
  ```

---

## Phase 6 Part 1: Advanced Analytics & Reporting System

- **Database Approach: Non-Destructive Aggregations on Existing Collections**:
  - Phase 6 Part 1 relies on non-destructive MongoDB aggregation queries over existing collections (`appointments`, `doctors`, `hospitals`, `users`, `subscriptions`).
  - No existing database fields, collections, or indexes were deleted or altered.
- **Optimized Compound Indexes Recommended/Verified**:
  - `appointments`: Compound index on `{ hospitalId: 1, createdAt: -1 }` (for fast hospital-isolated time-range filtering)
  - `appointments`: Compound index on `{ doctorId: 1, createdAt: -1 }` (for doctor-specific earnings & performance lookups)
  - `appointments`: Compound index on `{ paymentStatus: 1, createdAt: -1 }` (for verified financial aggregation)
- **Rollback Procedure**:
  - No database migration rollback required. The analytics engine is read-only and uses stateless aggregation pipelines.

---

## Phase 6 Part 2: Notifications, Routing & Device Tokens

- **Additive Fields on `users` collection (`HealPointBackend/models/userModel.js`)**:
  - `pushTokens`: Array of `{ token: String, platform: String, updatedAt: Date }` (Expo device push tokens)
  - `deviceTokens`: Array of `{ token: String, platform: String, lastUsedAt: Date }` (backward compatibility alias)
  - `pushToken`: `String` (single token fallback)
  - `notificationPreferences`:
    - `channels`: `{ push: Boolean, email: Boolean, sms: Boolean, inApp: Boolean }`
    - `categories`: `{ appointments: Boolean, payments: Boolean, consultations: Boolean, prescriptions: Boolean, reports: Boolean, referrals: Boolean, consent: Boolean, documents: Boolean, subscriptions: Boolean, security: Boolean, queue: Boolean, system: Boolean }`
    - `quietHours`: `{ enabled: Boolean, startHour: Number, endHour: Number, start: String, end: String }`

- **Additive Fields & Hooks on `notifications` collection (`HealPointBackend/models/notificationModel.js`)**:
  - `recipientRole`: `String` enum (`["patient", "doctor", "hospital_admin", "super_admin", "all"]`, default: `"patient"`, indexed)
  - `category`: `String` (default: `"general"`, indexed)
  - `priority`: `String` enum (`["low", "normal", "medium", "high", "urgent"]`, default: `"normal"`, indexed)
  - `isRead`: `Boolean` (default: `false`, indexed, synced with `read`)
  - `actorName`: `String` (sender or triggered entity name)
  - `actorRole`: `String`
  - `refId`: `String`
  - `refModel`: `String`
  - Pre-save and pre-validate synchronization hook ensuring `read` and `isRead` are identically mirrored.

- **Indexes Created on `notifications`**:
  - `{ userId: 1, read: 1, createdAt: -1 }` (for patient notification center & unread count)
  - `{ doctorId: 1, read: 1, createdAt: -1 }` (for doctor portal notifications)
  - `{ hospitalId: 1, read: 1, createdAt: -1 }` (for strictly isolated hospital admin operational feed)
  - `{ recipientRole: 1, read: 1, createdAt: -1 }` (for super admin system & security alerts)

- **Rollback Procedure**:
  ```javascript
  // Remove Phase 6 Part 2 indexes if rollback is needed
  db.notifications.dropIndex("userId_1_read_1_createdAt_-1");
  db.notifications.dropIndex("doctorId_1_read_1_createdAt_-1");
  db.notifications.dropIndex("hospitalId_1_read_1_createdAt_-1");
  db.notifications.dropIndex("recipientRole_1_read_1_createdAt_-1");

  // Remove pushTokens and preferences fields from users
  db.users.updateMany({}, {
    $unset: { pushTokens: "", deviceTokens: "", pushToken: "", notificationPreferences: "" }
  });
  ```
