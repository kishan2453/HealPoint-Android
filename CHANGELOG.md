# HealPoint 2.0 — Changelog

All notable changes across HealPoint 2.0 development phases are documented in this file.

---

## [Phase 3: AI Health Assistant] - 2026-10-31

### Branch: `phase-3-ai-assistant`
### Feature Flag: `FEATURE_AI_HEALTH_ASSISTANT` (Default: `false`)

### Added
- **Multilingual Clinical Triage & AI Service** (`HealPointBackend/controllers/aiController.js`):
  - In-memory rate limiting (max 10 requests / minute per IP or authenticated user).
  - Multilingual emergency triage (English, Hindi, Gujarati) with immediate 112 / 108 escalation and emergency room advisories.
  - Specialty symptom triage mapping (Cardiology, Dermatology, Dentistry, Orthopedics, Pediatrics, Neurology, Gynecology, Ophthalmology, ENT, Psychiatry, General Medicine).
  - Real doctor data querying from MongoDB (`doctorModel`) matching specialty and availability.
  - Native Google Gemini API integration with timeout abort controller and structured medical safety prompts.
  - Zero-dependency clinical fallback engine guaranteeing 100% uptime when Gemini API keys are unconfigured.
- **Persistent Patient Conversation History Model** (`HealPointBackend/models/aiConversationModel.js`):
  - Strictly patient-scoped conversation storage with compound index `{ userId: 1, createdAt: -1 }`.
  - DPDP-compliant instant chat clearing endpoint (`DELETE /api/v1/ai/history`).
- **Doctor Consultation AI Summary Endpoint** (`HealPointBackend/controllers/aiController.js`):
  - `POST /api/v1/ai/consultation-summary/:appointmentId`: Authorized doctor endpoint producing structured draft summaries for physician review.
  - Integration into Doctor Web [VideoConsultationRoom.jsx](file:///d:/HealPoint/HealpointMobile/HealPointDoctorWeb/src/components/VideoConsultationRoom.jsx) with a 1-click draft button.
- **Multilingual Patient Mobile UI** (`app/ai-assistant.tsx`, `services/ai.ts`):
  - Language selector strip (`English`, `हिन्दी`, `ગુજરાતી`) with real-time backend language parameter propagation.
  - Persistent history loading on mount and privacy-compliant chat deletion.
  - Official HealPoint design tokens (Royal Blue `#2563EB`, Light Gray `#F8FAFC`, Dark Navy `#0F172A`).
  - Emergency 112 call CTA buttons, doctor recommendation cards, and suggested symptom chips.
- **Automated Backend Test Suite** (`HealPointBackend/tests/aiAssistant.test.js`):
  - 20 unit tests covering rate limiting, multilingual emergencies, language auto-detection, clinical triage, medical safety guardrails, and feature flag behavior.

### Preserved
- All Phase 1 Live Queue and Phase 2 Video Consultation functionality.
- Existing patient, doctor, hospital admin, and super admin authentication.
- Existing Razorpay payments, billing, and Health Wallet features.

---

## [Phase 2: Advanced Video Consultation] - 2026-10-31

### Branch: `phase-2-video-consultation`
### Feature Flag: `FEATURE_ADVANCED_VIDEO` (Default: `false`)

### Added
- **WebRTC In-App Video Consultation Room for Doctor Web** (`HealPointDoctorWeb/src/components/VideoConsultationRoom.jsx`):
  - In-app WebRTC client with local video preview and fullscreen remote stream.
  - Microphone mute/unmute, camera enable/disable.
  - Live consultation elapsed timer.
  - Embedded clinical notes editor with persistent saving to MongoDB during/after consultation.
  - Security indicator ("End-to-End P2P Encrypted").
  - Clean modal integration into `OnlineConsultations.jsx` with direct fallback to Google Meet.
- **WebRTC In-App Video Consultation Room for Mobile App** (`components/InAppVideoConsultationModal.tsx`):
  - Fullscreen native modal housing an HTML5 WebRTC client via `react-native-webview`.
  - Token-authorized Socket.IO signaling with backend ICE/STUN/TURN.
  - Dynamic local PiP camera preview with front/back camera flipping.
  - Micro-controls: mic mute, camera toggle, duration timer, automatic reconnection banner.
  - Native bridging via `postMessage`: logs duration upon completion and routes to review/prescription view.
  - Direct Google Meet fallback available anytime.
- **Backend Consultation Controller & Session Routes** (`HealPointBackend/controllers/consultationController.js`, `routes/consultationRoutes.js`):
  - `getIceServersConfig`: Configurable STUN (`stun:stun.l.google.com:19302`) + RFC 5766 HMAC-SHA1 time-limited TURN credentials.
  - `createConsultationSession`: Enforces participant identity (doctor or patient only), appointment status validation, and generates a 30-minute short-lived session token.
  - `getConsultationSessionStatus`: Waiting room state and doctor readiness polling.
  - `updateConsultationStatus`: State machine (`waiting` → `doctor_ready` → `in_progress` → `completed`).
  - `saveConsultationNotes`: Saves doctor's clinical notes to the appointment.
  - `getHospitalConsultationStats`: Multi-tenant hospital analytics with strict hospital isolation.
- **Backend Socket Signaling Handlers** (`HealPointBackend/services/socketService.js`):
  - Handlers for `consultation:join-room`, `consultation:signal` (SDP Offer/Answer & ICE candidate relay), `consultation:waiting`, `consultation:doctor_ready`, `consultation:leave`, and `disconnecting` cleanup.
- **Automated Backend Test Suite** (`HealPointBackend/tests/consultation.test.js`):
  - 15 automated unit tests verifying ICE configuration, session token signing and expiration, state machine progression, participant authorization, hospital isolation, and feature flag defaults.
- **Additive Database Fields** (`HealPointBackend/models/appointmentModel.js`):
  - `consultationSessionId`, `consultationDurationSeconds`, `consultationNotes`, `consultationReconnectionCount`.
- **Permissions** (`app.json`):
  - Added Android `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` and iOS `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`.

### Preserved
- Existing Google Meet links and external meeting launcher workflow preserved as a 1-click fallback.
- Existing appointment booking, cancellation, and rescheduling logic untouched.
- Existing Razorpay payment and billing systems untouched.
- Existing Health Wallet and documents untouched.
- Existing hospital admin consultation statistics view verified and functional.

---

## [Phase 1: Live Queue Management] - 2026-10-31

### Branch: `phase-1-live-queue`
### Feature Flag: `FEATURE_LIVE_QUEUE` (Default: `false`)

### Added
- **Backend Socket Server** (`HealPointBackend/services/socketService.js`):
  - Initialized Socket.IO singleton attached to existing Express HTTP server on port 8080.
  - JWT authentication handshake middleware verifying token, identity, and role.
  - Strict room authorization:
    - `hospital:${hospitalId}`: Strictly restricted to verified hospital admins of that specific hospital or super admins.
    - `doctor:${doctorId}`: Strictly restricted to the authenticated doctor or their hospital admin.
    - `user:${userId}`: Strictly restricted to the authenticated patient.
  - Optional Redis adapter integration (`@socket.io/redis-adapter` + `ioredis`) for multi-instance cluster synchronization via `REDIS_URL` / `REDIS_HOST`, with seamless in-memory fallback for local single-node development.
  - Sanitized broadcast helpers: `broadcastQueueSync` and `broadcastAppointmentSync` (zero exposure of passwords, payment credentials, phone numbers, or private medical records).
- **Backend Live Queue Test Suite** (`HealPointBackend/tests/liveQueue.test.js`):
  - 10 automated unit tests verifying hospital scope isolation, wait-time formula, token sequencing, socket authentication, state machine transitions, and feature flag behavior.
- **Estimated Wait Time Calculation**:
  - Live wait time dynamically derived from `patientsAhead * (doctor.slotDurationMinutes || 15)`.
- **Additive Appointment Schema Fields** (`HealPointBackend/models/appointmentModel.js`):
  - `consultationStartedAt`: Timestamp recorded when doctor begins consultation.
  - `consultationEndedAt`: Timestamp recorded when consultation completes.
  - `estimatedWaitMinutes`: Cached estimation metric.

### Modified
- **`HealPointBackend/server.js`**:
  - Integrated `initSocketServer(server)` without touching existing HTTP routing, middleware, or server startup.
- **`HealPointBackend/controllers/checkInController.js`**:
  - `processCheckIn`: Added atomic `findOneAndUpdate` lock preventing duplicate check-in race conditions. Dispatches `broadcastQueueSync` when `FEATURE_LIVE_QUEUE === "true"`.
  - `getAppointmentLiveQueueStatus`: Returns `estimatedWaitMinutes`, `averageConsultationMinutes`, and `featureLiveQueueEnabled`.
  - `processScanCheckIn`: Dispatches `broadcastQueueSync` to doctor, hospital, and patient rooms upon reception QR check-in.
- **`HealPointBackend/controllers/doctorController.js`**:
  - `handleDoctorQueueAction`: Added doctor ownership validation (prevents Doctor A from altering Doctor B's queue), supports `start_consultation` action, records timestamps, and dispatches real-time `queue:sync` updates.
  - `startDoctorConsultation`: Added ownership check and real-time broadcast.
- **`HealPointBackend/controllers/hospitalAdminController.js`**:
  - `resolveHospitalId`: Removed insecure development mode fallback to the first hospital. Enforces strict hospitalId presence on every hospital admin query.
- **Patient Mobile App**:
  - `services/checkin.ts`: Added `estimatedWaitMinutes` and `averageConsultationMinutes` to `PatientQueueStatusResponse`.
  - `app/appointment/[id].tsx`: Added live `EST. WAIT` indicator in appointment queue details.
  - `app/appointment/pass/[id].tsx`: Added live `EST. WAIT` metric in hospital check-in pass.

### Preserved
- Existing authentication, registration, and Google OAuth flows.
- Existing Razorpay payment generation and HMAC-SHA256 signature verification.
- Existing Health Wallet and medical document vault.
- Existing appointment booking and slot capacity limits (15/hr).

