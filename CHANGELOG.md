# Changelog – Anand HealPoint Multi-Hospital Platform

---

## [Part 18] – 2026-11-02
### Added
- **Feature 1 (Smart Scheduling & Waitlist Engine)**:
  - Atomic double-booking prevention in `appointmentController.js`.
  - Smart slot suggestion algorithm scanning subsequent days when preferred dates are full.
  - Waitlist registration (`waitlistModel.js`) and auto-notification trigger when appointments are cancelled.
  - Doctor customization of consultation duration, daily max patient limits, and break schedules.
- **Feature 2 (Digital Queue & Token Management)**:
  - Real-time token number, queue position, and dynamic wait time estimation.
  - Doctor controls: call next patient, start consultation, complete consultation, mark no-show, pause/resume queue.
  - Hospital queue load metrics in `checkInController.js`.
- **Feature 3 (Complete Patient Journey Timeline)**:
  - Dynamically aggregated multi-event timeline combining registration, appointments, clinical consultations, prescriptions, health records, and billing without duplicating database collections.
  - Patient self-service timeline in `timeline.tsx` and authorized doctor clinical review drawer.
- **Feature 4 (Hospital Resource & Capacity Management)**:
  - Hospital room, bed, diagnostic equipment, and vehicle inventory management (`resourceModel.js`).
  - Hospital Admin resource tracking with utilization rates, maintenance alerts, and assignment workflows in `ResourcesCapacity.jsx`.
  - Super Admin global cross-facility capacity benchmarking in `GlobalResourceCapacity.jsx`.
- **Feature 5 (Advanced Staff & Duty Roster Management)**:
  - Staff directory, shift templates, and duty roster schedules (`staffModel.js`, `shiftModel.js`, `rosterModel.js`).
  - Shift conflict detection preventing overlapping assignments for the same staff member on identical dates.
  - Administrative leave request review and approval in `StaffRoster.jsx`.
- **Feature 6 (Advanced Analytics & Demand Forecasting)**:
  - Predictive appointment demand forecasting (`/api/v1/analytics/forecast`) with 7-day and 30-day projections using moving averages and seasonality weighting.
  - Peak consultation hour identification and busy weekday heatmaps with ethical non-clinical estimation labels.
- **Feature 7 (Hospital Subscription & Platform Plan Management)**:
  - Configurable hospital SaaS tiers: Starter Clinic, Professional Hospital, and Enterprise Multi-Facility (`hospitalSubscriptionPlanModel.js`).
  - Server-side usage limits (max doctors, max monthly appointments) with live usage percentage meter.
  - Simulated billing invoices (`INV-HOSP-YYYY-XXXX`) with zero live payment risks in `HospitalSubscriptions.jsx`.
- **Automated Testing Suite**:
  - Added `tests/part18AdvancedFeatures.test.js` bringing total passing test suite count to 239 tests (0 failures).
