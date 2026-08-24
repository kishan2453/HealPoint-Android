# HealPoint — Backend Role & Authorization Implementation Plan

> **Audience:** the engineer/agent implementing the **backend** (`Doctor-apppointment/server-with-client`, Node + Express + MongoDB).
> **Source of truth for API contracts:** the existing HealPoint **mobile app** in this repo. Do **not** change the mobile's existing request/response shapes — they are live contracts. Add new endpoints alongside.
> **Goal:** add a complete four-role system — `patient`, `doctor`, `admin`, `super_admin` — with **server-enforced** authorization, and make email/SMS optional so registration/login never break when SMTP/Twilio is unconfigured.

---

## 1. Hard constraints (from the project)

1. **Roles are decided by the backend, never trusted from the client.** The frontend sends only the JWT; the server reads the role from the database/user document.
2. **Public registration can ONLY create `patient`.** `doctor`, `admin`, `super_admin` are created only by an authorized admin/super-admin or a predefined seed.
3. **Backend must enforce authorization** on every protected route — do not rely on frontend route guards.
4. **No secrets in source.** SMTP/Twilio/MongoDB credentials come from `.env` and are git-ignored.
5. **Email/SMS are OPTIONAL in development.** Missing config must log a warning and continue, never return 500 for a core operation.
6. **No manual edits to the generated `dist/` folder** (that is mobile-web build output, unrelated to the backend).
7. Existing endpoints used by the current mobile app MUST keep working unchanged (see §5 "existing contracts").

---

## 2. Assumed backend layout (create missing files)

Base mount for all routes: `/api/v1` (matches mobile `lib/env.ts`).

```
server-with-client/
├─ .env
├─ server.js                     # app entry, mount routers under /api/v1
├─ config/
│  └─ db.js                      # MongoDB connection
├─ middleware/
│  ├─ authMiddleware.js          # verifyJWT / authenticateUser / optionalAuth
│  ├─ roleMiddleware.js          # requireRole / requireAdmin / requireSuperAdmin / requireDoctor
│  ├─ errorMiddleware.js         # centralized error handler + not-found
│  └─ notificationsMiddleware.js # email/SMS dispatcher (fail-graceful)
├─ models/
│  ├─ userModel.js               # + role field (see §3)
│  ├─ doctorModel.js
│  ├─ hospitalModel.js
│  ├─ appointmentModel.js
│  ├─ notificationModel.js
│  ├─ reviewModel.js
│  ├─ adminModel.js              # admin/super-admin records (or reuse userModel.role)
│  └─ settingsModel.js           # platform settings
├─ controllers/
│  ├─ userController.js          # auth + patient + favorites (EXISTS)
│  ├─ doctorController.js        # public catalog (EXISTS) + doctor-auth actions (NEW split)
│  ├─ doctorAvailabilityController.js  # NEW
│  ├─ hospitalController.js      # public (EXISTS) + admin mgmt (NEW)
│  ├─ appointmentController.js   # patient (EXISTS) + doctor/admin views (NEW)
│  ├─ adminController.js         # NEW
│  ├─ superAdminController.js    # NEW
│  ├─ notificationController.js
│  ├─ reviewController.js
│  └─ settingsController.js
└─ routes/
   ├─ userRoutes.js              # EXISTS
   ├─ doctorRoutes.js            # EXISTS (public) — extend or add role-scoped file
   ├─ doctorAuthRoutes.js        # NEW: doctor profile/availability/appointments
   ├─ hospitalRoutes.js          # EXISTS, split public vs admin
   ├─ appointmentRoutes.js       # EXISTS (patient) — extend with doctor/admin
   ├─ adminRoutes.js             # NEW
   ├─ superAdminRoutes.js        # NEW

---

## 3. Role model & DB schema

Canonical role values (recommended, lowercase for stable string matching):

```
patient  | doctor  | admin  | super_admin
```

In `models/userModel.js` add/normalize:

```js
role: {
  type: String,
  enum: ['patient', 'doctor', 'admin', 'super_admin'],
  default: 'patient',
  index: true,
}
```

**Backward compatibility:** the current mobile `User` type used display strings `Patient | 'Hospital Admin' | 'Super Admin' | 'Administrator' | 'Staff'`. To avoid breaking existing accounts:
- Keep `isAdmin`/`isActive`/`authProvider` fields as-is.
- Add a **migration/seed script** that maps legacy values → canonical: `'Administrator'|'Hospital Admin' → 'admin'`, `'Super Admin' → 'super_admin'`, and existing `doctor` accounts → `'doctor'`, everything else → `'patient'`.
- In auth middleware, normalize the stored role at read time so both legacy and canonical values authorize the same way.

**Never re-save the client-supplied role.** On register/login/update, ignore any `role` sent by the client (or force it to `'patient'` for public registration).

### Seed accounts (for the required login flows)
Provide a seed script (e.g. `npm run seed`) that creates one account per role with env-provided credentials (never hardcoded):
```
PATIENT_EMAIL / PATIENT_PASSWORD
DOCTOR_EMAIL  / DOCTOR_PASSWORD
ADMIN_EMAIL   / ADMIN_PASSWORD
SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
```

---

## 4. Middleware

### `middleware/authMiddleware.js`
- `authenticateUser`: verify `Authorization: Bearer <token>` → load user from DB (so role changes take effect immediately) → attach `req.user`. On 401, respond `{ success:false, message: "Your session has expired. Please login again." }` with HTTP **401** (the mobile app maps 401 → that exact message and can log out).
- `optionalAuth`: verify token if present, else continue with `req.user = null` (used by public doctor/hospital endpoints so favorited/logged-in state is enriched without forcing login).

### `middleware/roleMiddleware.js`
```js
requireRole(...roles)     // only allow listed roles
requirePatient()          // requireRole('patient')
requireDoctor()           // requireRole('doctor')
requireAdmin()            // requireRole('admin','super_admin')
requireSuperAdmin()       // requireRole('super_admin')
```
Order everywhere: `authenticateUser` → `requireX`.

### `middleware/errorMiddleware.js`
Central handler that:
- Detects Mongo `E11000` duplicate key → **HTTP 409** `{ success:false, message:"An account with this email already exists." }`.
- 401/403 → clear messages.
- `ValidationError` → 422.
- Anything else → 500 `{ success:false, message:"Something went wrong. Please try again." }`.

   ├─ notificationRoutes.js      # EXISTS
   ├─ reviewRoutes.js            # EXISTS
   └─ settingsRoutes.js          # EXISTS
```

---

## 5. Existing contracts the mobile app relies on (DO NOT BREAK)

These are called by the current app. Keep signatures/returns unchanged; new role-scoped endpoints go alongside.

| Method & path (all under `/api/v1`) | Auth | Notes |
|---|---|---|
| `POST /user/register` | public | creates **patient only**; body `{name,email,password}` → `{success,user}` |
| `POST /user/login` | public | body `{email,password}` → `{success,token,user,sessionId}` — **include `role` in `user`** |
| `POST /user/google/login` | public | `{code}` → same shape as login |
| `POST /user/forgot-password` | public | `{identifier}` → `{success,message}` |
| `POST /user/verify-otp` | public | `{identifier,otp}` → `{success,resetToken}` |
| `POST /user/reset-password` | public | `{resetToken,newPassword}` → `{success,message}` |
| `POST /user/logout` | patient | `{success,message}` |
| `GET /user/get-login-user/:userId` | patient(own) | `{success,user}` |
| `PATCH /user/update/:userId` | patient(own) | multipart (multer) `{success,user}` |
| `PATCH /user/update-password/:userId` | patient(own) | `{oldPassword,newPassword}` → `{success,message}` |
| `GET /user/favorites` | patient | `{success,favorites,totalCount}` |
| `POST /user/favorites/:doctorId` | patient | `{success,isFavorite,doctorId}` |
| `DELETE /user/favorites/:doctorId` | patient | `{success,isFavorite,doctorId}` |
| `GET /doctor/get-all` | optional | filter query params (search/hospital/speciality/location/fee/rating/availability…) → `{success,totalCount,doctors}` |
| `GET /doctor/get-details/:id` | public/optional | `{success,message,doctor}` |
| `GET /hospital/public/get-all` | public | `{success,totalCount,hospitals}` |
| `GET /hospital/public/get-details/:idOrSlug` | public | `{success,message,hospital}` |
| `GET /appointment/get-available-slots/:doctorId?date=DD-MM-YYYY` | public | `{success,doctorId,slotDate,availableSlots,totalSlots}` |
| `POST /appointment/validate-slot/:doctorId` | patient | `{slotDate,slotTime}` → `{success,available,message}` |
| `POST /appointment/create` | patient | `{doctorId,slotDate,slotTime,paymentMethod,consultationType}` → `{success,appointment,razorpayOrder?,razorpayKey?}` |
| `GET /appointment/get-user-appointments/:userId` | patient(own) | `{success,totalCount,appoinmtent:[…]}` (note the typo is intentional) |
| `GET /appointment/get-user-appointment-details/:appointmentId` | patient(own) | `{success,appointmentDetails}` |
| `POST /appointment/cancel/:appointmentId` | patient(own) | `{success,message}` |
| `PATCH /appointment/reschedule/:appointmentId` | patient(own) | `{slotDate,slotTime,reason}` → `{success,message,appointment}` |
| `POST /appointment/verify-payment` | patient | `{appointmentId,razorpay_order_id,razorpay_payment_id,razorpay_signature}` |
| `GET /notification/get-all` | patient | `?status=&type=&limit=` → `{success,notifications,unreadCount,totalCount}` |
| `PATCH /notification/read/:id` | patient | `{isRead}` |
| `PATCH /notification/mark-all` | patient | `{isRead:true}` |
| `DELETE /notification/delete/:id` | patient | |
| `POST /review/create` | patient | `{doctorId,rating,title?,comment…}` → `{success,message,review}` |
| `GET /review/public` | public | `{success,reviews}` |
| `GET /settings/public` | public | `{success,guideVideoUrl?}` |

> For every patient endpoint, **the `:userId`/`:appointmentId`/`:doctorId` route must verify `req.user._id === param` (or the document's owner equals `req.user._id`)** — a patient must never read/mutate another patient's data by guessing an ID.

---

## 6. Registration & login role behavior

- `register`: after creating the user, log & continue — **do not** require email/SMS. Return the patient.
- `login`: load user, verify password, sign JWT containing `{ id, role }` (payload role is informational; middleware always re-reads the DB), return `{ success, token, user, sessionId }` where `user` includes `_id, name, email, image?, phone?, role, isActive, authProvider`.
  - If `isActive === false` → 403 `{ success:false, message:"This account has been disabled." }`.
- Duplicate email on register: catch `E11000` → **409 + friendly message** (see errorMiddleware).


---

## 7. New role-scoped endpoints

All are ADDITIONS and must be guarded by `authenticateUser` + the role middleware. Response pattern for lists: `{ success, totalCount, <items> }`; for details: `{ success, <item> }` — matching the existing style.

### 7.1 Doctor module  (router → `doctorAuthRoutes.js` / `doctorAvailabilityController.js`)
| Method & path | Role | Purpose |
|---|---|---|
| `GET /doctor/me` | doctor | own profile (from `req.user`) |
| `PATCH /doctor/me` | doctor | update own profile (multipart) |
| `GET/POST/PUT/DELETE /doctor/me/availability` | doctor | weekly schedule + time slots |
| `GET /doctor/me/appointments?status=&date=` | doctor | assigned appointments (today/upcoming/completed/pending filter) |
| `PATCH /doctor/me/appointments/:appointmentId` | doctor | update status → `pending\|confirmed\|completed\|cancelled\|rejected` (validate transition) |
| `GET /doctor/me/patients` | doctor | patients with ≥1 appointment with this doctor (profile subset) |
| `GET /doctor/me/hospital` | doctor | linked hospital info |

Doctor endpoints read the doctor identity from `req.user` (the user doc with role `doctor` + a linked `doctorId`), **not** from a client-supplied id.

### 7.2 Admin module  (`adminRoutes.js` / `adminController.js`) — `requireAdmin`
Admin = roles `admin` **and** `super_admin` (super admin is a superset).

| Path | Purpose |
|---|---|
| `GET /admin/stats` | totals: patients, doctors, hospitals, appointments, today's appointments |
| `GET /admin/patients` `?search=&status=` | list/search patients |
| `PATCH /admin/patients/:id` | activate/deactivate |
| `GET /admin/doctors` `?search=&status=` | list/search doctors |
| `POST /admin/doctors` | create a doctor account (sets role `doctor`) |
| `PATCH /admin/doctors/:id` | edit/approve/disable doctor |
| `GET /admin/hospitals` / `POST /admin/hospitals` / `PATCH /admin/hospitals/:id` | manage hospitals |
| `GET /admin/appointments` `?status=&date=` | platform appointments + status management |

### 7.3 Super Admin module  (`superAdminRoutes.js`) — `requireSuperAdmin` only
| Path | Purpose |
|---|---|
| `GET /super-admin/stats` | patients, doctors, admins, hospitals, appointments, platform activity |
| `GET/POST/PATCH /super-admin/admins` / `PATCH /super-admin/admins/:id` | create/view/update/disable admins (role `admin`) — never `super_admin` |
| `GET /super-admin/doctors` / `PATCH /super-admin/doctors/:id` | manage all doctors |
| `GET /super-admin/patients` / `PATCH /super-admin/patients/:id` | manage all patients |
| `GET/POST/PATCH/DELETE /super-admin/hospitals/:id?` | manage hospitals |
| `GET/POST/PATCH/DELETE /super-admin/specialties` | manage specialties list |
| `GET/PATCH /super-admin/settings` | platform settings |

### 7.4 Hard authorization guarantees (verify with tests)
- `patient` token calling any `requireAdmin`/`requireSuperAdmin`/`requireDoctor` route → **403**.
- `doctor` token calling `requireSuperAdmin` → **403**.
- `admin` token calling a `requireSuperAdmin`-only route → **403**.
- `super_admin` token calling admin routes → **allowed** (superset).

---

## 8. Double-booking prevention (server-enforced)

Do **not** trust frontend slot checks. In `POST /appointment/create` and `PATCH /appointment/reschedule/:id`:

1. Recompute the doctor's availability from the DB (weekly schedule / time slots) for the requested `slotDate`.
2. Inside a **MongoDB transaction** (or an atomic find-and-update on a lock), check no existing **confirmed/pending** appointment exists for `(doctorId, slotDate, slotTime)`.
3. Only then insert/update. On conflict → `409 { success:false, message:"This time slot was just booked. Please select another." }`.
4. Keep `validate-slot` as a fast pre-check but treat it as non-authoritative.


---

## 9. Notifications, email & SMS (fail-graceful)

Create `middleware/notificationsMiddleware.js` / a small `services/notify.js`:

```js
// services/notify.js (pseudo)
const SMTP = { host: process.env.SMTP_HOST, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
const TWILIO = { sid: process.env.TWILIO_ACCOUNT_SID, token: process.env.TWILIO_AUTH_TOKEN, from: process.env.TWILIO_PHONE_NUMBER };

export async function sendEmail(...) {
  if (!SMTP.host || !SMTP.user || !SMTP.pass) {
    console.warn('[notify] Email service not configured; skipping email.');  // never throw
    return { skipped: true };
  }
  // ... actually send, but wrap in try/catch and log on failure
}
export async function sendSms(...) { /* same pattern for Twilio */ }
```

Rules:
- Appointment lifecycle events (booked / confirmed / cancelled / rescheduled / reminder) should **also create an in-app `Notification` document** (this is what the mobile `notification` screens read), independent of email/SMS.
- If SMTP/Twilio env vars are missing or sending throws → `console.warn(...)` + **continue the main operation**. Registration, login and appointment booking must never fail because email/SMS is unconfigured.
- Keep all credential reads from `process.env`; never hardcode.

---

## 10. `.env` additions (values from the server owner; never committed)

```dotenv
# Mongo
MONGO_URI=mongodb://127.0.0.1:27017/healpoint

# Server
PORT=8080
JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=7d

# Optional email (leave blank to disable gracefully)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
SMTP_PORT=587

# Optional Twilio (leave blank to disable gracefully)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Seed accounts (used by npm run seed)
PATIENT_EMAIL=...
PATIENT_PASSWORD=...
DOCTOR_EMAIL=...
DOCTOR_PASSWORD=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
SUPER_ADMIN_EMAIL=...
SUPER_ADMIN_PASSWORD=...
```

Add `/server-with-client/.env` to `.gitignore`. Provide `.env.example` with empty placeholders (never real secrets).

---

## 11. Mobile alignment (small, DEPENDENT on backend — do after backend is live)

The backend must return `role` in the login/`get-login-user` payloads using canonical values. Then the mobile app:
- `types/index.ts` `UserRole` → add `'doctor' | 'admin' | 'super_admin'` (canonical) alongside legacy strings.
- `app/index.tsx` currently sends all authenticated users to `/(tabs)`. After roles land, use a role→route map (e.g. `patient → /(tabs)`, `doctor → /(doctor)`, `admin → /(admin)`, `super_admin → /(super-admin)`), **keeping** the existing guard that never redirects an authenticated user back to `/`.
- `ProtectedRoute` accepts `allowedRoles` and shows an Unauthorized/redirect screen when the role mismatches (no blank screen).

> These mobile changes are intentionally deferred until the backend endpoints exist so the app never points at APIs that don't exist yet.

---

## 12. Verification checklist (backend-first)

Run from `server-with-client`:
1. `npm install`, `npm run seed` (creates one account per role).
2. `npm start` → server listens on `0.0.0.0:8080`.
3. Failure-mode checks:
   - `POST /user/register` with an existing email → **409** `"An account with this email already exists."` (no 500, no duplicate).
   - Start server with SMTP/Twilio env blank → register + login + booking still succeed; console shows `[notify] ... skipping`.
4. Role authz (via curl with each role's token):
   - Patient token on `GET /admin/stats` → 403.
   - Doctor token on `GET /super-admin/stats` → 403.
   - Admin token on `GET /super-admin/stats` → 403.
   - Super-admin token on `GET /admin/stats` → 200.
   - Patient token reading another patient's appointment → 403/404.
5. Double-booking: book the same `(doctor, date, slot)` twice → second returns 409.
6. Login returns `{ success, token, user:{..., role} , sessionId }`; `get-login-user` returns `role`.
7. In-app `Notification` documents are created on appointment lifecycle events even without email/SMS.
8. Confirm the existing mobile endpoints (§5) still return identical shapes.

### Suggested route→file mapping summary
| Module | Router file | Controller file |
|---|---|---|
| Auth / patient | `routes/userRoutes.js` (exists) | `controllers/userController.js` (exists) |
| Doctor self | `routes/doctorAuthRoutes.js` (new) | `controllers/doctorAvailabilityController.js` (new) |
| Admin | `routes/adminRoutes.js` (new) | `controllers/adminController.js` (new) |
| Super Admin | `routes/superAdminRoutes.js` (new) | `controllers/superAdminController.js` (new) |

