# Smart Appointment Scheduling Engine Documentation
**HealPoint Multi-Hospital Healthcare Platform · Part 18**

---

## 1. Overview
The Smart Appointment Scheduling Engine intelligently manages doctor consultation capacity, prevents double-booking race conditions atomically, generates alternative slot recommendations when preferred slots are full, and provides an integrated waitlist registration mechanism.

---

## 2. Core Architecture & Features

### 2.1 Atomic Double-Booking Prevention
In `HealPointBackend/controllers/appointmentController.js`:
- Prior to booking creation, an exact slot match is queried:
  ```javascript
  const existingBooking = await appointmentModel.findOne({
    doctorId: doctor._id,
    $or: [{ slotDate }, { slotDate: normalizeDateDDMMYYYY(slotDate) }],
    slotTime,
    status: { $nin: ["cancel", "cancelled", "missed"] },
  });
  ```
- If an existing active appointment exists, the server rejects the request with HTTP `409 Conflict`, code `"SLOT_ALREADY_BOOKED"`, and automatically provides smart alternative slot suggestions.

### 2.2 Doctor Daily Capacity & Custom Slot Duration
- Doctors can configure `slotDurationMinutes` (15, 30, 45 mins), `maxAppointmentsPerDay` (default 30, customizable up to 60), and `breakTimes` (e.g., lunch breaks).
- When a doctor hits daily capacity, the API responds with HTTP `409` (`DOCTOR_DAILY_CAPACITY_REACHED`) and allows the patient to join the waitlist.

### 2.3 Smart Slot Suggestions Engine
- Endpoint: `GET /api/v1/appointment/slots/smart-suggestions/:doctorId?date=YYYY-MM-DD`
- If the requested date is fully booked, the algorithm scans the next 5 days and returns alternative available dates:
  ```json
  {
    "targetDate": "2026-11-05",
    "availableSlots": [],
    "alternativeSuggestions": [
      {
        "date": "06-11-2026",
        "dayName": "Friday",
        "availableCount": 8,
        "sampleSlots": ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM"]
      }
    ]
  }
  ```

### 2.4 Waitlist Registration & Slot Release Notification
- Model: `HealPointBackend/models/waitlistModel.js`
- When an appointment is cancelled via `cancelAppointment`, the system queries active waitlist entries for that doctor & date:
  - Updates the top entry to status `"notified"`.
  - Sets `notifiedSlot = cancelledSlot.slotTime`.
  - Sends an in-app socket notification to the patient.

---

## 3. Endpoints
- `GET /api/v1/appointment/slots/smart-suggestions/:doctorId`
- `POST /api/v1/appointment/waitlist` (Patient joins waitlist)
- `GET /api/v1/appointment/waitlist/my-waitlist` (Patient's active waitlists)
- `DELETE /api/v1/appointment/waitlist/:id` (Cancel waitlist entry)
- `GET /api/v1/appointment/waitlist/doctor/:doctorId` (Doctor/Hospital overview)
