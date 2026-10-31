# HealPoint 2.0 — Changelog

All notable changes across HealPoint 2.0 development phases are documented in this file.

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

