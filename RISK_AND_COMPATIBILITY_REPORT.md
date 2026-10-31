# HealPoint 2.0 — Risk & Compatibility Report

**Date:** 2026-10-31  
**Classification:** Architecture, Security & Production Readiness  
**Workspace:** `d:\HealPoint\HealpointMobile`

---

## 1. High-Priority Architectural & Security Risks

### Risk 1: Multi-Tenant Data Isolation (Hospital Isolation)
- **Current State**:
  - `HealPointBackend/controllers/hospitalAdminController.js` has `resolveHospitalId(req)`.
  - In development mode (`process.env.NODE_ENV !== "production"`), lines 40-44 currently fall back to the first hospital in the database (`hospitalModel.findOne({})`) if `req.user.hospitalId` is not present.
- **Risk**:
  - If a hospital administrator token lacks `hospitalId` in a non-production or staging test environment, queries might accidentally default to another hospital's records.
- **Remediation**:
  - Explicitly mandate `hospitalId` in the JWT payload for all `hospital_admin` roles.
  - Reject requests with HTTP 403 `FORBIDDEN_HOSPITAL_SCOPE` if `hospitalId` cannot be verified from the authenticated user token.
  - Implement automated tenant-isolation unit tests proving that Hospital A's admin receives 403 or empty sets when attempting to query Hospital B's data.

---

### Risk 2: Real-Time Sockets Missing on Backend
- **Current State**:
  - Patient Mobile (`services/socket.ts`), Doctor Web (`HealPointDoctorWeb/src/services/socket.js`), Hospital Admin Web (`HealPointHospitalAdminWeb/src/services/socket.js`), and Super Admin Web (`HealPointSuperAdminWeb/src/services/socket.js`) are all already configured to connect to `http://localhost:8080` / backend URL via `socket.io-client`.
  - `HealPointBackend/server.js` only creates standard HTTP server without attaching `socket.io`.
- **Risk**:
  - Client socket connection attempts currently fail or receive HTTP 404 on `/socket.io/`.
- **Remediation**:
  - In Phase 1, attach `socket.io` to the existing `http.Server` in `HealPointBackend/server.js`.
  - Enforce room-based tenant scoping (`hospital:${hospitalId}`, `doctor:${doctorId}`, `user:${userId}`) so real-time queue events never broadcast cross-hospital.
  - Provide multi-instance scalability via Redis adapter or an in-process adapter fallback when Redis is unconfigured.

---

### Risk 3: Appointment Booking Concurrency & Race Conditions
- **Current State**:
  - `appointmentController.js` performs check-then-insert: checks `getHourlyBookingCount(doctor._id, slotDate, slotTime)` then calls `appointmentModel.create()`.
- **Risk**:
  - Under high concurrent load, two simultaneous requests for the same doctor at the same slot time could bypass the check before either write completes, exceeding hourly capacity.
- **Remediation**:
  - Add a MongoDB compound unique index or an atomic reservation mechanism (`findOneAndUpdate` with version check or atomic slot booking table) to make slot reservations completely race-condition-safe.
  - Document rollback procedures in `DATABASE_CHANGES.md`.

---

### Risk 4: In-Memory Background Schedulers
- **Current State**:
  - `reminderScheduler.js` executes via `setInterval(processAppointmentReminders, intervalMinutes * 60 * 1000)`.
- **Risk**:
  - In a clustered or multi-instance deployment (e.g., Docker, Kubernetes, PM2 cluster, or Vercel Serverless), `setInterval` either doesn't run reliably in serverless environments, or runs duplicated across instances, firing duplicate reminder emails.
- **Remediation**:
  - Use atomic database locking (`findOneAndUpdate` on appointment reminder flags `reminder24hSent` with timestamp and status) so only one instance ever processes a given reminder.
  - Support a persistent job queue (e.g. BullMQ / Agenda) when Redis/MongoDB job storage is configured.

---

### Risk 5: Patient Health Data & AI Safeguards
- **Current State**:
  - `aiController.js` provides keyword-based triage with a disclaimer and 108/112 emergency routing.
- **Risk**:
  - When upgrading to modern LLM APIs (Gemini 2.5 / 1.5 Flash), user health information could accidentally be forwarded to external systems without explicit consent, or the model might generate unauthorized medical advice.
- **Remediation**:
  - Enforce strict system instructions: AI must never provide definitive medical diagnosis, prescribe drugs or dosages, or recommend stopping medications.
  - Redact identifiable patient information (name, phone, Aadhaar, ABHA, hospital ID) before sending prompts to the Gemini API.
  - Always surface Indian emergency contact **112** for critical symptoms.

---

## 2. Backward Compatibility Matrix

| Component | Target Version | Breaking Change Protection | Verification Strategy |
|---|---|---|---|
| **Expo Client** | Expo SDK 54 (`expo@~54.0.37`) | Strictly adhere to Expo 54 docs (`https://docs.expo.dev/versions/v54.0.0/`). Preserve `expo-router ~6.0.24` file routes. | `npm run typecheck` (`tsc --noEmit`) must remain 0 errors. |
| **Backend API** | Express 5 / Node ESM | Never modify existing route signatures: preserve `/api/v1/user`, `/api/v1/doctor`, `/api/v1/appointment`, etc. | Run Node test suite (`node --test`) before and after each phase. |
| **Database Models** | MongoDB / Mongoose 8 | Only additive schema fields with safe defaults. Never delete collections or drop non-legacy indexes. | Document all changes and rollbacks in `DATABASE_CHANGES.md`. |
| **Payments** | Razorpay SDK 2.9.8 | Preserve `createRazorpayOrder` and `verifyPaymentSignature` exactly as implemented. | Verify existing Razorpay order generation and signature verification with test keys. |

