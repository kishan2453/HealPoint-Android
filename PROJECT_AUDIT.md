# HealPoint 2.0 — Comprehensive Project Audit (Phase 0)

**Date:** 2026-10-31  
**Auditor:** Senior Full-Stack MERN Architect, Healthcare Software & Security Engineer  
**Workspace Root:** `d:\HealPoint\HealpointMobile`  
**Git Branch:** `main` (clean working tree)  
**Status:** Phase 0 Complete — Audit Only (Zero Destructive Code Changes)

---

## 1. Executive Summary

HealPoint is a multi-tier healthcare ecosystem with:
1. **Patient Mobile & Web Application**: Expo SDK 54 (`expo@~54.0.37`, `react-native@0.81.5`, `react@19.1.0`, `expo-router@~6.0.24`, `react-native-razorpay@^3.0.0`).
2. **Unified Healthcare Backend API**: Express 5 (`express@^5.1.0`), Node.js ES Modules, Mongoose 8 (`mongoose@^8.17.0`), Razorpay SDK (`razorpay@^2.9.8`), Nodemailer, Multer, Helmet, CORS.
3. **Doctor Web Workspace**: Vite 5 (`vite@^5.0.0`), React 18 (`react@^18.2.0`), React Router v6, jsPDF, Axios, Socket.IO Client.
4. **Hospital Admin Web Portal**: Vite 5, React 18, React Router v6, jsQR (QR scanner), jsPDF, Axios, Socket.IO Client.
5. **Super Admin Web Portal**: Vite 7 (`vite@^7.1.7`), React 19 (`react@^19.1.1`), Redux Toolkit (`@reduxjs/toolkit@^2.9.1`), Recharts, Framer Motion, Axios, Socket.IO Client.

The project already possesses foundational implementations of almost every requested module. **Nothing should be deleted or rewritten from scratch.** Instead, existing modules will be enhanced, hardened with multi-tenant hospital isolation, backed with persistent distributed state, and placed behind feature flags.

---

## 2. Technology Stack & Component Inventory

| Component | Path | Core Framework / Version | State / Routing | Build & Test Tooling |
|---|---|---|---|---|
| **Patient App (Mobile + Web)** | `.` (root) | Expo SDK `~54.0.37`, React Native `0.81.5`, React `19.1.0` | `expo-router ~6.0.24`, React Context (`useAuth`) | `tsc --noEmit` (0 errors), Metro, Web Export |
| **API Backend** | `HealPointBackend/` | Node.js (ESM), Express `^5.1.0`, Mongoose `^8.17.0` | Stateless JWT + Express Middleware | Node native test runner (`node --test`), 7 passing tests |
| **Doctor Portal** | `HealPointDoctorWeb/` | Vite `^5.0.0`, React `^18.2.0` | React Router v6, Local State | Vite Build (Port 5175) |
| **Hospital Admin Portal** | `HealPointHospitalAdminWeb/` | Vite `^5.0.0`, React `^18.2.0` | React Router v6, Local State | Vite Build (Port 5176) |
| **Super Admin Portal** | `HealPointSuperAdminWeb/` | Vite `^7.1.7`, React `^19.1.1` | Redux Toolkit `^2.9.1`, React Router v7 | Vite Build (Port 5173) |

---

## 3. Database Architecture & Model Audit

The database runs MongoDB via Mongoose. All models reside in `HealPointBackend/models/`:

1. **`userModel.js`**:
   - Roles supported: `patient`, `doctor`, `hospital_admin`, `admin`, `super_admin`.
   - Fields: `hospitalId` (ref Hospital), `hospitalName`, `familyMembers` array (with demographics, allergies, chronic conditions), `emergencyContact` (`name`, `phone`, `relation`), `currentSubscription`, `appointmentStats`, `favorites`, `googleId`.
   - **Isolation Status**: Users have individual IDs; hospital administrators are linked to a single `hospitalId`.

2. **`doctorModel.js`**:
   - Fields: `hospitalId` (ref Hospital), `hospitalName`, `fees`, `slotDurationMinutes`, `weeklySchedule` (days, sessions, breaks), `timeSlots`, `blockedSlots`, `leaves`, `dateOverrides`, `onlineConsultationEnabled`, `instantConsultationEnabled`, `rating`, `reviewCount`.
   - **Isolation Status**: Doctors are strictly scoped to a parent `hospitalId`.

3. **`hospitalModel.js`**:
   - Fields: `name`, `slug` (unique), `location` (`address`, `city`, `state`, `pincode`, `lat`, `lng`, `mapsUrl`), `contact` (`emergency`, `reception`, `phone`), `departments`, `services`, `beds`, `icuBeds`, `facilitiesInfo`, `consultationFee`, `isActive`.

4. **`appointmentModel.js`**:
   - Fields: `appointmentId`, `displayAppointmentId`, `userId` (ref User), `doctorId` (ref Doctor), `hospitalId` (ref Hospital), `slotDate`, `slotTime`, `patientName`, `patientPhone`, `familyMemberId`, `familyRelationship`, `isFamilyBooking`, `amount`, `billing` (breakdown: consultationFee, platformFee, discount, subscriptionBenefit, totalAmount), `consultationType` (`clinic`, `video`), `consultationMode`, `meetingUrl`, `meetingStatus`, `consultationStatus`, `status` (`pending`, `confirmed`, `completed`, `cancel`, `rescheduled`, `missed`), `payment`, `paymentMethod`, `paymentStatus`, `razorpayOrderId`, `razorpayPaymentId`, `prescription`, `medicines` array, `medicalReports` array, `checkedIn`, `checkInAt`, `queueToken`, `queueStatus` (`not_checked_in`, `waiting`, `called`, `in_consultation`, `completed`, `cancelled`), `calledAt`, `vitals`, `reminder24hSent`, `reminder1hSent`.
   - **Isolation Status**: Contains both `userId` and `hospitalId`.

5. **`healthDocumentModel.js`**:
   - Fields: `userId`, `familyMemberId`, `title`, `category` (`prescription`, `lab_report`, `radiology`, `discharge_summary`, `vaccination`, `other`), `documentDate`, `fileData` (Base64 / URL), `mimeType`, `size`, `sharedWithDoctorIds`, `notes`.
   - **Isolation Status**: Scoped to patient `userId` and optional `familyMemberId`. Currently permits sharing only with specific `sharedWithDoctorIds`.

6. **`subscriptionModel.js` & `subscriptionPlanModel.js`**:
   - Models user subscription tiers (`free`, `silver`, `gold`, `platinum`), video quotas, expiration dates, and Razorpay transaction IDs.

7. **`auditLogModel.js`**:
   - Tracks audit records per `hospitalId` with actor, action, category, severity, client IP/device.

8. **`notificationModel.js` & `reviewModel.js`**:
   - Stores user/doctor/hospital notifications and verified doctor reviews.

---

## 4. Authentication, Authorization & Tenant Isolation Audit

### A. Authentication Flows
- **JWT Authentication** (`middlewares/authMiddlewares.js`):
  - `authenticate`: Extracts Bearer token, verifies via `process.env.JWT_SECRET`, attaches decoded payload to `req.user`.
  - `optionalAuth`: Gracefully decodes token if present without rejecting unauthenticated requests.
  - `authorizeRoles`: Validates `req.user.role`.
  - `enforceHospitalScope`: Automatically attaches `req.hospitalId = req.user.hospitalId` for `hospital_admin`.

### B. Hospital-Level Data Isolation (Critical Finding)
- **Current Status in `hospitalAdminController.js`**:
  - `resolveHospitalId(req)` safely extracts `req.user.hospitalId`.
  - **Issue identified in Dev Mode**: Lines 40-44 currently fall back to the first hospital in the database (`hospitalModel.findOne({})`) if in development mode. In production, this fallback is disabled.
  - **Enhancement required**: Enforce strict validation that every Hospital Admin endpoint explicitly filters queries with `{ hospitalId: resolvedHospitalId }` and disallows access if `resolvedHospitalId` is null, even in development, to prevent accidental cross-tenant data leakage.

### C. Portal Roles Matrix
| Role | Portal | Access Scope |
|---|---|---|
| `patient` | Mobile & Web (`app/(drawer)`) | Own profile, family members, own bookings, own Health Wallet, own notifications |
| `doctor` | Doctor Web (`HealPointDoctorWeb`) | Assigned hospital's appointments, own patient EMR, own schedule, own queue |
| `hospital_admin` | Hospital Web (`HealPointHospitalAdminWeb`) | Strictly own hospital's doctors, appointments, scheduling, and compliance logs |
| `super_admin` | Super Admin Web (`HealPointSuperAdminWeb`) | Global hospital management, subscriptions, platform analytics, system health |

---

## 5. Razorpay & Billing System Audit

- **SDK**: `razorpay@^2.9.8` configured in `HealPointBackend/services/razorpayService.js`.
- **Order Generation**: `createRazorpayOrder({ amount, receipt, notes })` converts amount to paise (INR).
- **Signature Verification**: `verifyPaymentSignature({ orderId, paymentId, signature })` using HMAC-SHA256 with `process.env.RAZORPAY_KEY_SECRET`.
- **Concurrency & Re-payment Guard**:
  - `createPaymentOrder` in `appointmentController.js` verifies if `appointment.payment === true` or `paymentStatus === 'SUCCESS'`, rejecting duplicate payments.
- **Client Integrations**:
  - Mobile: `react-native-razorpay` in native Android/iOS and web fallback.
  - Verification: `POST /api/v1/appointment/verify-payment`.

---

## 6. Real-Time Socket.IO Audit

- **Clients**: All three web portals and the mobile app already include `socket.io-client@^4.8.3` and have implemented socket service wrappers (`services/socket.js` / `services/socket.ts`).
- **Backend**: `server.js` in `HealPointBackend` currently initializes only an HTTP server (`http.createServer(app)`), but has **not yet bound Socket.IO**.
- **Requirement for Phase 1**:
  - Initialize Socket.IO on the existing HTTP server in `HealPointBackend`.
  - Support multi-instance scaling via Redis adapter (`@socket.io/redis-adapter` or redis-backed fallback).
  - Scope rooms to `hospital:${hospitalId}`, `doctor:${doctorId}`, and `user:${userId}` to ensure strict tenant isolation.

---

## 7. Baseline Test Execution Results

1. **Backend Tests (`HealPointBackend/tests/hospitalAdmin.test.js`)**:
   - Command: `npm test --prefix HealPointBackend`
   - Result: **7 passed, 0 failed** (Date parsing, ObjectId validation, Day matching).
2. **Patient App Typecheck**:
   - Command: `npm run typecheck` (`tsc --noEmit`)
   - Result: **0 errors, passed cleanly**.

