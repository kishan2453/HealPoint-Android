# Digital Queue & Token Management Documentation
**HealPoint Multi-Hospital Healthcare Platform · Part 18**

---

## 1. Overview
The Digital Queue & Token Management module provides real-time OPD queue visibility across all portals. It eliminates physical waiting room congestion with digital token issuance, estimated wait calculations, and live doctor consultation lifecycle controls.

---

## 2. Capabilities

### 2.1 Patient Real-Time Token & Position
- **Token Format**: Sequential per doctor daily (e.g. `T-01`, `T-02`, etc.).
- **Live Metrics**:
  - `patientsAhead`: Count of checked-in patients awaiting consultation before this patient.
  - `estimatedWaitMinutes`: Calculated dynamically based on doctor's `slotDurationMinutes` $\times$ patients ahead.
  - `currentServingToken`: Active token inside consultation room.
  - `queueStatus`: `not_checked_in` $\to$ `waiting` $\to$ `called` $\to$ `in_consultation` $\to$ `completed` / `no_show`.

### 2.2 Doctor Queue Controls
- In `DoctorPortal.jsx` & `doctorController.js`:
  - **Call Next Patient**: Sets queue status to `called`, issues audio-visual bell, marks patient checked-in.
  - **Start Consultation**: Transitions appointment to `in_consultation`, starts consultation timer.
  - **Complete Consultation**: Saves medical notes, closes timer, sets status to `completed`.
  - **Mark No-Show**: Marks patient `missed`, releases queue position to next patient.
  - **Pause / Resume Queue**: Allows doctor to pause queue with a reason (e.g. "Emergency Round") and broadcast sync.

### 2.3 Hospital Admin Queue Overview
- In `CheckInScannerView.jsx` & `checkInController.js`:
  - Department-wise and doctor-wise queue volume.
  - Average wait time and OPD throughput.
  - QR barcode scanner integration for fast patient check-in at reception.

---

## 3. Endpoints
- `GET /api/v1/checkin/live-queue/:appointmentId` (Patient live queue view)
- `GET /api/v1/doctor/panel/:id/queue` (Doctor queue overview)
- `PATCH /api/v1/doctor/panel/:id/queue/:appointmentId/action` (Doctor action: call/start/complete/noshow)
- `POST /api/v1/doctor/panel/:id/queue/toggle-pause` (Doctor pause/resume queue)
- `GET /api/v1/checkin/hospital/overview` (Hospital Admin OPD queue load)
