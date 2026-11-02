# Complete API Documentation – Anand HealPoint Platform
**Updated for Part 18: 7 Advanced Features**

---

## 1. Feature 1: Smart Scheduling & Waitlist Engine
- `GET /api/v1/appointment/slots/smart-suggestions/:doctorId?date=DD-MM-YYYY`
  - Generates real available slots for date.
  - Returns `alternativeSuggestions` with next 3-5 practicing days when target date is fully booked.
- `POST /api/v1/appointment/waitlist`
  - Body: `{ doctorId, preferredDate, preferredTimeSlot, notes }`
  - Enrolls patient on active doctor waitlist.
- `GET /api/v1/appointment/waitlist/my-waitlist`
  - Returns patient's registered waitlist positions.
- `DELETE /api/v1/appointment/waitlist/:id`
  - Cancels waitlist position.
- `GET /api/v1/appointment/waitlist/doctor/:doctorId`
  - Doctor & Hospital Admin view of pending waitlist entries.

---

## 2. Feature 2: Digital Queue & Token Management
- `GET /api/v1/checkin/live-queue/:appointmentId`
  - Returns live queue token, `patientsAhead`, `estimatedWaitMinutes`, current serving token, and status.
- `GET /api/v1/doctor/panel/:id/queue`
  - Returns doctor OPD queue partitioned into `waiting`, `checkedIn`, `inConsultation`, `completed`, `cancelled`.
- `PATCH /api/v1/doctor/panel/:id/queue/:appointmentId/action`
  - Actions: `call_patient`, `start_consultation`, `complete_consultation`, `mark_noshow`, `cancel`.
- `POST /api/v1/doctor/panel/:id/queue/toggle-pause`
  - Body: `{ paused: boolean, reason?: string }`
  - Pauses or resumes the live queue.
- `GET /api/v1/checkin/hospital/overview`
  - Hospital-wide OPD queue load and patient throughput.

---

## 3. Feature 3: Patient Journey Timeline
- `GET /api/v1/patient-journey/my-journey`
  - Returns chronological aggregated events for the logged-in patient.
  - Filters: `category` (`account`, `appointments`, `consultations`, `prescriptions`, `records`, `billing`), `startDate`, `endDate`, `page`, `limit`.
- `GET /api/v1/patient-journey/patient/:patientId`
  - Authorized doctor clinical access for assigned patients.

---

## 4. Feature 4: Hospital Resource & Capacity Management
- `GET /api/v1/resources`
  - Query: `category`, `department`, `status`, `search`, `page`, `limit`.
- `POST /api/v1/resources`
  - Body: `{ hospitalId, name, identifier, category, department, capacity, location }`.
- `PUT /api/v1/resources/:id`
  - Update resource parameters or maintenance status.
- `POST /api/v1/resources/:id/assign`
  - Body: `{ assignedName, notes }`.
- `POST /api/v1/resources/:id/release`
  - Releases resource back to available status.
- `GET /api/v1/resources/analytics`
  - Hospital capacity utilization % and category breakdown.
- `GET /api/v1/resources/global-overview`
  - Super Admin cross-facility capacity overview.

---

## 5. Feature 5: Staff & Duty Roster Management
- `GET /api/v1/roster/dashboard-stats`
  - KPIs: Total staff, active staff, on leave, pending leaves, today's shifts.
- `GET /api/v1/roster/staff`, `POST /api/v1/roster/staff`, `PUT /api/v1/roster/staff/:id`
  - Staff directory management.
- `GET /api/v1/roster/shifts`, `POST /api/v1/roster/shifts`
  - Shift template definitions.
- `GET /api/v1/roster/roster?date=YYYY-MM-DD`
  - Daily/weekly roster schedule.
- `POST /api/v1/roster/roster`
  - Body: `{ staffId, shiftId, date, notes }`.
  - Performs real-time shift conflict & approved leave detection.
- `GET /api/v1/roster/leaves`, `POST /api/v1/roster/leaves`, `PATCH /api/v1/roster/leaves/:id/review`
  - Leave requests & administrative approval.

---

## 6. Feature 6: Advanced Analytics & Forecasting
- `GET /api/v1/analytics/forecast`
  - Returns 7-day and 30-day projected demand, peak booking hours, busy days, and moving average estimates.
  - Returns mandatory estimation metadata and non-clinical disclaimers.

---

## 7. Feature 7: Hospital Subscriptions & SaaS
- `GET /api/v1/hospital-subscriptions/plans`
  - Returns Starter, Professional, and Enterprise plan tiers.
- `GET /api/v1/hospital-subscriptions/current`
  - Hospital Admin view of assigned plan, usage meter, and days to renewal.
- `POST /api/v1/hospital-subscriptions/assign`
  - Super Admin assigns a subscription plan to a hospital.
- `GET /api/v1/hospital-subscriptions/invoices`
  - Returns simulated billing invoices (`INV-HOSP-YYYY-XXXX`).
- `GET /api/v1/hospital-subscriptions/overview`
  - Super Admin platform SaaS overview.
