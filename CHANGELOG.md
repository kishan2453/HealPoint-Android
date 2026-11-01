# HealPoint 2.0 — Changelog

All notable changes across HealPoint 2.0 development phases are documented in this file.

---

## [Phase 8: Favorites System Fix & Patient Experience Enhancements] - 2026-11-01

### Branch: `phase-8-favorites-system`
### Status: Fully Implemented, Tested & Verified Across Mobile & All Portals

### Root Cause Analysis
- **Missing Backend Endpoints**: The mobile app was attempting to call `/user/favorites`, `/user/favorites/:doctorId`, `/user/favorites/hospitals`, etc., but `userRoutes.js` and `userController.js` never implemented any favorite routes. Express was returning HTTP 404 for all favorite requests.
- **Immediate Optimistic Rollback**: Because the API call failed with 404, `hooks/use-favorites.tsx` caught the error and rolled back the optimistic update immediately, turning off the heart icon.
- **Refresh/Restart Wipe**: On app reload or refresh, `refresh()` called `getFavorites()` and `getFavoriteHospitals()`, which also received HTTP 404, wiping all local state and leaving the Favorites page completely blank.

### Added & Enhanced
- **Backend Favorite Controller & Persistence Engine** (`HealPointBackend/controllers/favoriteController.js`):
  - `getFavoriteDoctors`: Retrieves patient's saved doctors with full Mongoose `.populate()` of doctor and hospital details, filtering out deleted records.
  - `addFavoriteDoctor`: Validates doctor existence & ObjectId, prevents duplicates using memory deduplication, and atomically persists to MongoDB.
  - `removeFavoriteDoctor`: Removes doctor by ID from `favorites` array and saves to database.
  - `getFavoriteHospitals`: Retrieves patient's saved hospitals with `.populate()` of facilities, bed counts, rating, and location.
  - `addFavoriteHospital`: Validates hospital ID, prevents duplicates, and saves to MongoDB.
  - `removeFavoriteHospital`: Removes hospital from `favoriteHospitals` array.
  - `getFavoriteCounts`: Fast aggregate count query (`doctorCount`, `hospitalCount`, `total`).
  - `checkFavoriteStatus`: Checks if a specific doctor or hospital is favorited by query parameters.
- **Backend Routing Dual Mounting** (`HealPointBackend/routes/userRoutes.js`, `routes/favoriteRoutes.js`, `app.js`):
  - Mounted routes both under `/api/v1/user/favorites*` and `/api/v1/favorites*` for absolute API resilience across all clients.
- **Universal Storage Synchronous Caching & Zero-Flicker Hydration** (`hooks/use-favorites.tsx`):
  - Implemented synchronous local caching (`healpoint.favorites.doctors`, `healpoint.favorites.hospitals`).
  - Restores saved state on tick 0 without render delay or icon flickering.
  - Guarded against premature state wiping during `authLoading` startup.
  - Clean state wiping on genuine logout.
- **Favorites Screen Complete Upgrade** (`app/(drawer)/favorites.tsx`):
  - Interactive dual tabs with live badge counters (`doctorList.length`, `hospitalList.length`).
  - Live search bar for saved doctors and hospitals with instant clear button.
  - Horizontal scrolling specialty filter chips (`All`, `Cardiologist`, `Dermatologist`, etc.).
  - Sort switcher (`Recently Saved` vs `Top Rated`).
  - Direct appointment booking: "Book Visit" CTA on doctor cards navigates directly to `/booking/[doctorId]`.
  - Distinct empty states: Genuine empty state ("No favorite doctors yet") vs search empty state ("No doctors matching search").
- **Automated Test Suite** (`HealPointBackend/tests/favorites.test.js`):
  - 7 new automated test assertions covering duplicate prevention, string ID comparisons, ObjectId validation, count arithmetic, and null-safety.
  - Total backend tests increased from 134 to 141 (141/141 PASS, 0 failures).

---

## [Phase 7: Emergency SOS, Emergency Services & Authentication Session Fix] - 2026-11-01

### Branch: `phase-7-emergency-sos-auth-fix`
### Status: Fully Implemented, Tested & Verified Across All 4 Portals & Mobile

### Added & Enhanced
- **Root-Cause Session Persistence & Expiration Fix (Task 1 - Top Priority)**:
  - `lib/storage.ts`: Implemented synchronous local storage accessor (`getStorageItemSync`, `setStorageItemSync`, `deleteStorageItemSync`) to eliminate asynchronous React startup delays during web app hydration and browser page refreshes.
  - `services/api.ts`: Implemented `setAuthReady()` and `waitForAuth(maxMs)` barrier to ensure initial requests during refresh wait for auth state restoration rather than firing unauthenticated requests. Enforced client-side auth barrier (`auth: true` throwing `ApiClientError("Please sign in to view your account details.")` rather than sending doomed requests that returned HTTP 401).
  - `hooks/use-auth.tsx`: Added `isJwtExpired(token)` helper to mathematically calculate JWT expiration before attempting refresh or wiping credentials. Synchronously initialized token state on web. Session is retained during transient network or backend offline states.
  - `hooks/use-appointments.ts`, `hooks/use-health-overview.ts`, `hooks/use-notifications.ts`: Added state guards to wait for `authLoading` completion before dispatching requests.
  - `HealPointDoctorWeb/src/services/api.js` & `HealPointSuperAdminWeb/src/Api/API.jsx`: Added mathematical JWT expiration verification before wiping sessions on HTTP 401.
- **Emergency SOS Command Center & Mobile Experience (Tasks 2, 3, 8)**:
  - `components/emergency/EmergencySosModal.tsx`: Created 5-second countdown confirmation modal with cancel button to prevent accidental SOS triggers. Includes emergency nature selector (Cardiac, Accident, Respiratory, Pregnancy, Severe Pain, Other).
  - `components/emergency/ActiveEmergencyBanner.tsx`: Live real-time emergency tracker with 4-step progress stepper (`pending` -> `accepted` -> `in_progress` -> `resolved`), live ETA badge, ambulance vehicle number, driver contact, and cancel trigger.
  - `components/emergency/EmergencyContactsModal.tsx`: Full emergency contacts management modal (add, edit, delete, primary toggle, 10-digit Indian phone number validation).
  - `components/emergency/EmergencyFloatingButton.tsx`: Floating 1-tap SOS trigger button.
  - `app/(drawer)/emergency.tsx`: Transformed into a full Emergency SOS Command Center with SOS trigger, active case tracker, Patient Medical Passport (blood group, allergies, chronic conditions), emergency contacts management, emergency history timeline, and national helpline direct dialers (112, 108, 102).
  - `hooks/use-emergency.ts`: Complete React hook managing SOS dispatch, GPS location fetching via `expo-location`, contacts, history, and real-time Socket.IO synchronization.
  - `services/emergency.ts`: Full typed API client for emergency endpoints.
- **Emergency Backend Workflow & Model (Task 4)**:
  - `HealPointBackend/models/emergencyRequestModel.js`: Complete schema with `emergencyCode` (e.g. `EMG-1730448000000-A1B2`), `patientId`, `hospitalId`, `assignedDoctorId`, `status` (`pending`, `accepted`, `in_progress`, `resolved`, `cancelled`), `emergencyType`, `severity`, `notes`, `location` (latitude, longitude, address), `patientSnapshot` (name, phone, bloodGroup, allergies), `emergencyContacts`, `ambulance` (vehicleNumber, driverName, driverPhone, etaMinutes, status), `statusHistory`, and audit resolution details.
  - `HealPointBackend/models/userModel.js`: Added structured `emergencyContacts` subdocument array with 10-digit phone validation and primary contact flag.
  - `HealPointBackend/controllers/emergencyController.js`: Full emergency lifecycle management controller (`createEmergencyRequest`, `getActivePatientEmergency`, `getPatientEmergencyHistory`, `cancelEmergencyRequest`, `getHospitalEmergencies`, `updateEmergencyStatus`, `dispatchAmbulance`, `getEmergencyContacts`, `saveEmergencyContact`, `deleteEmergencyContact`, `getSuperAdminEmergencyOverview`).
  - `HealPointBackend/routes/emergencyRoutes.js`: Mounted at `/api/v1/emergency`.
  - `HealPointBackend/services/socketService.js`: Added `broadcastEmergencyAlert` and `broadcastEmergencyStatus` to emit to `hospital:<id>`, `doctor:<id>`, `user:<id>`, and `room:super_admin`.
- **Hospital Admin Emergency Dashboard (Task 5)**:
  - `HealPointHospitalAdminWeb/src/components/HospitalEmergencyManager.jsx`: Full real-time Emergency SOS Queue dashboard with live active alerts, accept SOS, ambulance dispatch modal (vehicle number, driver name, phone, ETA), resolution modal with clinical outcomes, and auto-polling + real-time sync.
  - `HealPointHospitalAdminWeb/src/App.jsx`: Added Emergency Queue navigation item under Operations.
- **Doctor Web Real-Time Emergency Alerts (Task 6)**:
  - `HealPointDoctorWeb/src/services/socket.js`: Integrated `onEmergencyAlert` and `onEmergencyStatus` events.
  - `HealPointDoctorWeb/src/pages/DoctorPortal.jsx`: Added real-time Emergency SOS alert banner at the top of the Doctor Command Center with patient details, GPS link, and urgent toast notification.
- **Super Admin Central Emergency Monitoring (Task 7)**:
  - `HealPointSuperAdminWeb/src/pages/EmergencyMonitoring.jsx`: Platform-wide emergency telemetry dashboard with KPI summary cards (Total SOS, Active Critical, Resolved, Cancelled), distribution charts (by clinical category and hospital), and real-time emergency feed table with live GPS maps.
  - `HealPointSuperAdminWeb/src/App.jsx` & `Menus.jsx`: Mounted `/emergencies` route with sidebar navigation.
- **Automated Test Suite & Verification (Task 10)**:
  - `HealPointBackend/tests/emergency.test.js`: 11 new comprehensive automated tests covering emergency lifecycle, ambulance dispatch, contact validation, and JWT persistence. Total backend test count increased to 134/134 PASS (0 failures).
  - TypeScript validation (`tsc --noEmit`): PASSED with 0 errors.
  - Web builds for Doctor Web, Hospital Admin Web, and Super Admin Web: All PASSED.
  - Expo web export (`npx expo export -p web`): PASSED (183 static routes exported).

---

## [Phase 6 Part 2: Notifications, Routing, Refresh Fix & Final Testing] - 2026-11-01

### Branch: `phase-6-part-2-notifications-routing`
### Status: Fully Implemented, Tested & Deployed Across All 4 Portals

### Added & Enhanced
- **Smart Notification Architecture** (`HealPointBackend/models/notificationModel.js`, `controllers/notificationController.js`, `routes/notificationRoutes.js`):
  - Role-based and tenant-isolated notifications for Patient, Doctor, Hospital Admin, and Super Admin.
  - Endpoints added: `GET /get-all`, `GET /unread-count`, `PATCH /read/:id`, `PATCH /mark-all`, `DELETE /delete/:id`, `GET /preferences`, `PUT /preferences`, `POST /register-push-token`, `DELETE /device-token`.
  - Automatic `read` <-> `isRead` and `type` <-> `category` synchronization.
  - Pagination, full-text live search, and filters by status (`read`, `unread`), category, and priority.
- **Expo Push Notification Service** (`HealPointBackend/services/pushNotificationService.js`, `models/userModel.js`):
  - Official Expo Push API dispatch (`https://exp.host/--/api/v2/push/send`).
  - Validation of `ExponentPushToken[...]` and `ExpoPushToken[...]`.
  - Quiet hours enforcement (suppresses non-urgent alerts during user-configured quiet hours).
  - Dead token pruning (`DeviceNotRegistered` tickets automatically removed from database).
- **Socket.IO Real-Time Dispatch** (`HealPointBackend/services/socketService.js`):
  - Added `dispatchNotification` helper: persists notification to MongoDB and emits `notification:new` and `notification:sync` to recipient rooms (`user:id`, `doctor:id`, `hospital:id`, `room:super_admin`).
  - Automatically triggers background Expo push notifications for patient users.
  - Super admin socket room join logic (`room:super_admin`) for platform alerts.
- **Patient Mobile App Notifications** (`app/notification/index.tsx`, `services/pushNotifications.ts`, `hooks/use-push-notifications.ts`):
  - Native Expo SDK 54 device push token registration on user login.
  - Android notification channel setup (`healpoint_alerts`).
  - Deep-link routing on notification tap (`Notifications.addNotificationResponseReceivedListener`).
  - Synchronized unread badges in drawer and header.
- **Doctor Portal Notifications** (`HealPointDoctorWeb/src/pages/DoctorPortal.jsx`):
  - Filter tabs: All, Unread, Appointments, Security & System.
  - Added delete notification functionality (`api.delete('/api/v1/notification/delete/:id')`).
  - Live count updates and Mark All as Read action.
- **Hospital Admin Portal Notifications** (`HealPointHospitalAdminWeb/src/App.jsx`, `controllers/hospitalAdminController.js`):
  - Strict hospital isolation: notifications strictly filtered by `hospitalId` (zero cross-hospital leakage).
  - Interactive NotificationsView: Mark as Read, Mark All as Read, Delete Notification, and category filter tabs.
- **Super Admin Notifications** (`HealPointSuperAdminWeb/src/pages/NotificationsPage.jsx`):
  - Full support for system, security, and hospital registration alerts.
- **Multi-Portal SPA Routing & Deep-Linking Verification** (`scripts/test-deployments.js`):
  - Verified SPA fallback on browser refresh across all 4 deployed portals.
  - 100% of tested routes returned HTTP 200 OK without 404 errors.
- **Test Suite** (`HealPointBackend/tests/notificationsAndRouting.test.js`):
  - 16 new automated unit and integration tests.
  - Total backend test count increased from 107 to 123 (123/123 PASS).

---

## [Phase 6 Part 1: Advanced Analytics Dashboard & Reporting System] - 2026-11-01

### Branch: `phase-6-analytics-part-1`
### Feature Flags: `FEATURE_ADVANCED_ANALYTICS` (Default: `false`), `FEATURE_ADVANCED_REPORTS` (Default: `false`)

### Added
- **Financial & Clinical Analytics Engine** (`HealPointBackend/services/analyticsService.js`):
  - Verified collected revenue arithmetic: counts strictly confirmed successful payments (`paymentStatus === "SUCCESS" || isPaid`) and rejects pending, failed, or completed-without-payment bookings.
  - Refund accounting: accurately aggregates and deducts refunds (`paymentStatus === "REFUNDED"`) from net collected revenue.
  - Multi-tenant hospital isolation: Hospital Admins strictly restricted to their own hospital's patients, doctors, and financial receipts via `resolveHospitalId`.
  - Doctor isolation: Doctors can only view their own appointments, patients, and earned fees.
  - Patient dashboard statistics: Authenticated patients view exact counts of appointments, Health Wallet documents, and active prescriptions.
  - Date-range filtering: Precision IST date boundaries for `Today`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Last Month`, `This Year`, and `Custom Range`.
- **Multi-Format Report Export Engine** (`HealPointBackend/services/reportExportService.js`):
  - PDF Reports: Generated dynamically with `pdfkit` featuring HealPoint header branding, report metadata, date range, tabular data rows, and compliance footers.
  - CSV Reports: UTF-8 BOM encoded RFC 4180 CSV generation with header metadata.
  - Excel Reports: XML Spreadsheet format compatible with all versions of Microsoft Excel.
- **REST Endpoints & Mounts** (`HealPointBackend/controllers/analyticsController.js`, `routes/analyticsRoutes.js`):
  - `GET /api/v1/analytics/superadmin/overview`: Platform KPIs, appointment status distributions, and time-series trends.
  - `GET /api/v1/analytics/superadmin/hospitals-performance`: Hospital-wise comparisons (appointments, verified revenue, completion rate).
  - `GET /api/v1/analytics/superadmin/doctors-performance`: Doctor-wise performance rankings across all hospitals.
  - `GET /api/v1/analytics/hospital/overview`: Hospital-isolated analytics with doctor performance breakdown.
  - `GET /api/v1/analytics/doctor/:id`: Doctor-isolated consultations, earnings, and trends.
  - `GET /api/v1/analytics/patient/stats`: Patient dashboard summary.
  - `GET /api/v1/analytics/export`: Role-based report downloads in PDF, CSV, or Excel formats.
- **Legacy Controller Financial Hardening** (`HealPointBackend/controllers/userController.js`, `doctorController.js`, `hospitalAdminController.js`):
  - Upgraded `/user/analytics` to return verified platform revenue, status counts, and charts for Super Admin dashboards.
  - Fixed `getDoctorEarnings` to eliminate the bug where `status === "completed"` was erroneously counted as revenue even when unpaid or refunded.
  - Hardened hospital admin dashboard revenue accounting to deduct refunds and exclude failed payments.
- **Automated Backend Test Suite** (`HealPointBackend/tests/analyticsAndReporting.test.js`):
  - 24 comprehensive unit and integration tests covering date resolution, verified revenue arithmetic, refund deductions, hospital isolation, doctor isolation, CSV export, Excel export, PDF binary buffer, and feature flags. All 107 backend tests passing.

### Preserved
- All Phase 1 Live Queue, Phase 2 Video Consultation, Phase 3 AI Assistant, Phase 4 Health Wallet, and Phase 5 Digital Prescriptions & Reminders.
- Razorpay payment webhooks and payment verification logic.
- Existing patient, doctor, hospital admin, and super admin portals.

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

