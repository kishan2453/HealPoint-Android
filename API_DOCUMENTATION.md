# HealPoint 2.0 — Live Queue API & Socket Specification

**Version:** Phase 1 Live Queue Management  
**Protocol:** REST (JSON) + WebSocket (Socket.IO v4)

---

## 1. REST Endpoints

### A. Patient Check-In & Queue Status
- **POST** `/api/v1/checkin/process`
  - **Auth**: Bearer Token (Patient)
  - **Body**: `{ "appointmentId": "<string>" }`
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Check-in successful! Your digital token has been assigned.",
      "queueToken": "C-002",
      "appointment": { ... }
    }
    ```

- **GET** `/api/v1/checkin/appointment/:appointmentId/queue-status`
  - **Auth**: Optional / Bearer Token
  - **Response (200)**:
    ```json
    {
      "success": true,
      "checkedIn": true,
      "queueToken": "C-002",
      "queueStatus": "waiting",
      "currentServingToken": "C-001",
      "patientsAhead": 1,
      "estimatedWaitMinutes": 15,
      "averageConsultationMinutes": 15,
      "checkInAt": "2026-10-31T14:30:00.000Z",
      "doctorName": "Dr. Sharma",
      "hospitalName": "HealPoint Apex Hospital",
      "slotDate": "31-10-2026",
      "slotTime": "04:30 PM",
      "featureLiveQueueEnabled": true
    }
    ```

### B. Hospital Admin QR Check-In
- **POST** `/api/v1/checkin/scan`
  - **Auth**: Bearer Token (Hospital Admin)
  - **Body**: `{ "token": "<QR_STRING_OR_APPOINTMENT_ID>" }`
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Check-in verified successfully! Queue Token: C-002",
      "token": "C-002",
      "appointment": { ... }
    }
    ```

- **GET** `/api/v1/checkin/hospital/queue-overview`
  - **Auth**: Bearer Token (Hospital Admin with verified `hospitalId`)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "summary": {
        "totalToday": 14,
        "checkedInCount": 8,
        "waitingCount": 5,
        "inConsultationCount": 1,
        "completedCount": 2
      },
      "appointments": [ ... ]
    }
    ```

### C. Doctor OPD Queue
- **GET** `/api/v1/doctor/panel/:doctorId/queue`
  - **Auth**: Bearer Token (Doctor)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "queue": [ ... ],
      "sections": {
        "waiting": [ ... ],
        "checkedIn": [ ... ],
        "inConsultation": [ ... ],
        "completed": [ ... ],
        "cancelled": [ ... ]
      },
      "summary": { ... }
    }
    ```

- **POST** `/api/v1/doctor/panel/:doctorId/queue/:appointmentId/action`
  - **Auth**: Bearer Token (Assigned Doctor)
  - **Body**: `{ "action": "call_patient" | "start_consultation" | "complete_consultation" | "mark_noshow" | "cancel", "notes": "<string>", "reason": "<string>" }`
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Queue action 'call_patient' applied successfully",
      "appointment": { ... }
    }
    ```

---

## 2. Socket.IO Specification

### Handshake & Authentication
- **URL**: `ws://<BACKEND_HOST>:8080` (or `wss://api.healpoint.app`)
- **Path**: `/socket.io/`
- **Auth Payload**: `{ auth: { token: "<JWT_BEARER_TOKEN>" } }`

### Scoped Channels (Rooms)
1. `hospital:${hospitalId}`: Only accessible by authenticated admins of that exact hospital or super admins.
2. `doctor:${doctorId}`: Only accessible by that doctor, their hospital admin, or super admin.
3. `user:${userId}`: Only accessible by that patient.

### Events Emitted by Server
- **Event:** `queue:sync`
  - **Trigger:** Check-in, Doctor calls patient, consultation starts, consultation completes, no-show marked.
  - **Payload:**
    ```json
    {
      "action": "call_patient",
      "appointmentId": "60c72b2f9b1d8b2badbee5a1",
      "queueToken": "C-002",
      "queueStatus": "called",
      "patientsAhead": 0,
      "estimatedWaitMinutes": 0,
      "doctorName": "Dr. Sharma",
      "hospitalName": "HealPoint Apex Hospital",
      "slotDate": "31-10-2026",
      "slotTime": "04:30 PM",
      "timestamp": "2026-10-31T14:35:00.000Z"
    }
    ```

- **Event:** `notification:new`
  - **Trigger:** Doctor calls the patient's token.
  - **Target:** `user:${userId}`
  - **Payload:**
    ```json
    {
      "type": "queue_called",
      "title": "Doctor Calling Now!",
      "message": "Dr. Sharma has called Token #C-002. Please proceed to the consultation room.",
      "appointmentId": "60c72b2f9b1d8b2badbee5a1",
      "queueToken": "C-002",
      "timestamp": "2026-10-31T14:35:00.000Z"
    }
    ```

