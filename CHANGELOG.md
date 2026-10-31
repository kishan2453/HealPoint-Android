# HealPoint 2.0 — Changelog

All notable changes across HealPoint 2.0 development phases are documented in this file.

---

## [Phase 5: Digital Prescription & Medicine Reminders] - 2026-11-01

### Branch: `phase-5-digital-prescriptions`
### Feature Flags: `FEATURE_DIGITAL_PRESCRIPTION` (Default: `false`), `FEATURE_MEDICINE_REMINDERS` (Default: `false`)

### Added
- **Digital Prescription Management Architecture** (`HealPointBackend/models/prescriptionModel.js`):
  - Digital prescription lifecycle: `draft` -> `issued` -> `amended` -> `cancelled`.
  - Comprehensive clinical schema: Patient snapshot, doctor snapshot, hospital snapshot, diagnosis, symptoms, vitals, medicines array, dietary and general advice, follow-up schedule, and digital signature.
  - Immutability & Audit Trail: Historical snapshots recorded in `history` array on every amendment with version numbering and reason.
  - Doctor matching authorization: Strict server-side verification that only the treating doctor can draft, issue, or amend.
- **Medication Reminders & Dose Adherence Engine** (`HealPointBackend/models/medicationReminderModel.js`):
  - Timezone-aware scheduling (`Asia/Kolkata`) with automatic schedule parsing from frequencies (`1-0-1`, `1-1-1`, etc.).
  - Daily schedule calculation and dose logging (`taken`, `skipped`, `snoozed`, `missed`) with action timestamps.
  - Mathematical adherence percentage calculation for patient and doctor review.
  - Refill reminders with automatic threshold calculations (courses >= 10 days).
  - Soft deactivation and reminder cancellation triggers.
- **Professional PDF Generation Service** (`HealPointBackend/services/prescriptionPdfService.js`):
  - High-fidelity PDF creation via `pdfkit` styled in Teal `#0D9488`, Royal Blue `#2563EB`, and Slate `#0F172A`.
  - Header with HealPoint logo, hospital contact info, doctor credentials & registration number.
  - Standardized Rx section, tabular medicine layout (dosage, frequency, duration, route, instructions), advice, and digital signature stamp with verification hash.
- **REST Endpoints & Controllers** (`HealPointBackend/controllers/prescriptionController.js`, `medicationReminderController.js`, `routes/prescriptionRoutes.js`, `routes/medicationReminderRoutes.js`):
  - Save draft, finalize & issue, amend, fetch by ID/appointmentId/prescriptionNumber.
  - Direct PDF binary streaming endpoint (`GET /api/v1/prescription/:id/pdf`) supporting Bearer and query token auth.
  - Seamless two-way integration with `healthDocumentModel` in the patient's Health Wallet under category `"prescription"`.
- **Doctor Portal Prescription Studio** (`HealPointDoctorWeb/src/pages/DoctorPortal.jsx`):
  - Connected 1-click "Download Official PDF" button directly in prescription table actions and preview modal.
  - Automatic synchronization of EMR prescriptions with reminders and Health Wallet.
- **Patient Mobile App Enhancements** (`app/(drawer)/health/prescriptions.tsx`, `services/appointments.ts`):
  - Integrated 1-click "Download PDF" button in prescription cards with authenticated file streaming.
  - Dose adherence tracker and modal for customized reminder schedules.
- **Automated Test Suite** (`HealPointBackend/tests/prescriptionAndReminders.test.js`):
  - 13 comprehensive backend unit and integration tests covering draft, issue, authorization checks, amendment version history, patient privacy, hospital isolation, PDF binary buffer, dose actions, adherence math, and feature flags. All 83 backend tests passing.

### Preserved
- All Phase 1 Live Queue, Phase 2 Video Consultation, Phase 3 AI Assistant, and Phase 4 Health Wallet functionality.
- Existing Razorpay payments, billing receipts, and QR check-in functionality.
- Existing patient, doctor, hospital admin, and super admin authentication flows.

---

## [Phase 4: Advanced Health Wallet Enhancements] - 2026-10-31

### Branch: `phase-4-health-wallet`
### Feature Flag: `FEATURE_HEALTH_WALLET` (Default: `false`)

### Added
- **Unified Health Document Architecture** (`HealPointBackend/models/healthDocumentModel.js`):
  - Additive fields: `hospitalId`, `hospitalName`, `doctorId`, `doctorName`, `appointmentId`, `fileUrl`, `fileName`, `fileSize`, `tags`, `isArchived`, `processingStatus`, `confidence`, `extractedMetadata`, `userCorrections`, `doctorSummary`.
  - 8 Standard healthcare categories: Prescriptions, Lab Reports, Diagnostic Reports, Consultation History, Medical Documents, Billing Receipts, Appointment Records, Other (retaining full backward compatibility with legacy categories).
  - Multi-tenant compound indexes on `{ userId: 1, category: 1, createdAt: -1 }`, `{ userId: 1, familyMemberId: 1, createdAt: -1 }`, and `{ userId: 1, isArchived: 1 }`.
- **Enhanced Document Controller & REST Endpoints** (`HealPointBackend/controllers/healthDocumentController.js`, `routes/healthDocumentRoutes.js`):
  - File upload validation with strict MIME type whitelist (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`) and 10MB size ceiling.
  - Multi-tenant patient isolation and family dependent authorization checking (`verifyFamilyMemberOwnership`).
  - Search across titles, doctor names, facility names, notes, and tags with pagination (`page`, `limit`).
  - Date-range query filtering (`startDate`, `endDate`).
  - Chronological timeline grouping endpoint (`GET /api/v1/document/timeline`).
  - Category statistics endpoint (`GET /api/v1/document/stats`).
  - Secure in-app viewing and streaming download (`GET /api/v1/document/:id/view`).
  - Doctor access sharing and revocation (`POST /api/v1/document/:id/share`, `DELETE /api/v1/document/:id/share/:doctorId`).
  - Human-in-the-loop metadata verification with audit stamp (`PATCH /api/v1/document/:id/metadata`).
- **Unified Appointment & Document Wallet Integration** (`HealPointBackend/controllers/appointmentController.js`):
  - Enhanced `getHealthWallet` endpoint to seamlessly aggregate appointment records AND patient-uploaded digital health documents in a unified vault.
  - Added support for `startDate`, `endDate`, and sort options (`newest`, `oldest`).
- **Upgraded Digital Health Wallet Screen** (`app/(drawer)/health-wallet.tsx`, `services/health-documents.ts`, `services/wallet.ts`):
  - View mode switcher: "Cards View" vs "Chronological Timeline View".
  - Chronological timeline node visualization with vertical connector, status dots, date badges, and 1-click preview.
  - Date range filter chips: "All Time", "30 Days", "6 Months", "1 Year".
  - In-app secure medical document viewer modal for image and PDF preview.
  - Upload modal upgraded with 8 standard categories, validation, and progress indicators.
  - Metrics cards with real counts for Prescriptions, Lab Reports, Bills, Consultations, EMR Records, Passes, and Total.
  - Official HealPoint design tokens (Royal Blue `#2563EB`, Sky Blue `#60A5FA`, Light Gray `#F8FAFC`, Dark Navy `#0F172A`).
- **Automated Backend Test Suite** (`HealPointBackend/tests/healthWallet.test.js`):
  - 18 unit tests covering upload validation, MIME whitelisting, size limits, category normalization, multi-tenant & family isolation, chronological sorting, date range filtering, and feature flag behavior.

### Preserved
- All Phase 1 Live Queue, Phase 2 Video Consultation, and Phase 3 AI Health Assistant functionality.
- Existing Razorpay payments, billing receipts, and QR check-in functionality.
- Existing patient, doctor, hospital admin, and super admin authentication.

---

