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

---

## 3. Phase 2: Advanced Video Consultation API & Signaling Specification

### REST Endpoints

#### A. Session Token & ICE Configuration
- **POST** `/api/v1/consultation/session/:appointmentId/create`
  - **Auth**: Bearer Token (Assigned Patient or Assigned Doctor)
  - **Description**: Verifies caller participant identity, appointment eligibility, and issues a 30-minute short-lived session token along with STUN/TURN ICE configurations.
  - **Response (200)**:
    ```json
    {
      "success": true,
      "appointmentId": "60c72b2f9b1d8b2badbee5a1",
      "sessionToken": "<JWT_SESSION_TOKEN>",
      "role": "patient",
      "roomName": "consultation:60c72b2f9b1d8b2badbee5a1",
      "iceServers": [
        { "urls": "stun:stun.l.google.com:19302" }
      ],
      "doctor": {
        "id": "60c72b2f9b1d8b2badbee501",
        "name": "Dr. Sharma",
        "speciality": "Cardiology"
      },
      "patient": {
        "id": "60c72b2f9b1d8b2badbee502",
        "name": "Ananya Patel"
      },
      "consultationStatus": "waiting",
      "meetingUrl": "https://meet.google.com/abc-defg-hij"
    }
    ```

#### B. Consultation Status Check
- **GET** `/api/v1/consultation/session/:appointmentId/status`
  - **Auth**: Bearer Token
  - **Response (200)**:
    ```json
    {
      "success": true,
      "appointmentId": "60c72b2f9b1d8b2badbee5a1",
      "consultationStatus": "doctor_ready",
      "meetingStatus": "ready",
      "meetingUrl": "https://meet.google.com/abc-defg-hij",
      "doctorReady": true,
      "notes": "Patient reports mild chest tightness.",
      "durationSeconds": 0
    }
    ```

#### C. Status Transition
- **PATCH** `/api/v1/consultation/session/:appointmentId/status`
  - **Auth**: Bearer Token
  - **Body**: `{ "consultationStatus": "doctor_ready" | "in_progress" | "completed", "durationSeconds": 720 }`
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Consultation status updated to completed",
      "consultationStatus": "completed"
    }
    ```

#### D. Clinical Notes
- **POST** `/api/v1/consultation/session/:appointmentId/notes`
  - **Auth**: Bearer Token (Doctor)
  - **Body**: `{ "notes": "Prescribed Atorvastatin 10mg once daily at bedtime." }`
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Consultation notes saved successfully"
    }
    ```

#### E. Hospital Consultation Analytics
- **GET** `/api/v1/consultation/hospital/stats`
  - **Auth**: Bearer Token (Hospital Admin with resolved `hospitalId`)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "stats": {
        "total": 45,
        "upcoming": 12,
        "completed": 28,
        "activeOnlineDoctors": 4,
        "revenue": 33600
      },
      "doctors": [ ... ],
      "recent": [ ... ]
    }
    ```

### Socket.IO WebRTC Signaling Protocol

- **Join Consultation Room:**
  - Client emits: `consultation:join-room` with `{ "appointmentId": "<id>", "sessionToken": "<token>" }`
  - Server joins client to room `consultation:${appointmentId}` and emits `consultation:peer-joined`.

- **WebRTC SDP Offer / Answer & ICE Candidate Relay:**
  - Client emits: `consultation:signal` with `{ "appointmentId": "<id>", "signalData": <SDP_OR_ICE_OBJECT> }`
  - Server broadcasts `consultation:signal` to all other participants in `consultation:${appointmentId}`.

- **Doctor Readiness & Waiting Announcements:**
  - Doctor emits: `consultation:doctor_ready` with `{ "appointmentId": "<id>" }`
  - Patient emits: `consultation:waiting` with `{ "appointmentId": "<id>" }`

- **Leave / Teardown:**
  - Participant emits: `consultation:leave` with `{ "appointmentId": "<id>" }`
  - Server notifies peer: `consultation:peer-left`.

---

## 4. Phase 3: AI Health Assistant API Specification

### A. Patient Chat & Triage
- **POST** `/api/v1/ai/chat`
  - **Auth**: Optional / Bearer Token (Authenticated sessions persist history; guest sessions receive instant triage)
  - **Body**:
    ```json
    {
      "message": "I have been experiencing a sharp chest pain for 20 minutes",
      "language": "en" | "hi" | "gu"
    }
    ```
  - **Response (200 - Emergency)**:
    ```json
    {
      "success": true,
      "reply": "🚨 **CRITICAL MEDICAL EMERGENCY ALERT**\n\nImmediate Actions Required: Call 112 / 108 immediately...",
      "disclaimer": "HealPoint AI provides healthcare navigation and triage guidance only...",
      "language": "en",
      "isEmergency": true,
      "suggestedSpeciality": "Cardiologist",
      "cards": [
        {
          "type": "emergency",
          "data": {
            "title": "Emergency Care",
            "description": "National Emergency Helpline 112 / Ambulance 108",
            "hotline": "112"
          }
        }
      ],
      "actions": [
        { "label": "Call 112 Emergency", "route": "tel:112", "icon": "call", "variant": "danger" },
        { "label": "Find Nearest Hospitals", "route": "/hospitals", "icon": "business", "variant": "secondary" }
      ]
    }
    ```
  - **Response (200 - General Triage with Real Doctors)**:
    ```json
    {
      "success": true,
      "reply": "Based on the symptoms you described, a consultation with a qualified **Dermatologist** is recommended...",
      "disclaimer": "HealPoint AI provides healthcare navigation...",
      "language": "en",
      "isEmergency": false,
      "suggestedSpeciality": "Dermatologist",
      "cards": [
        {
          "type": "doctor",
          "data": {
            "_id": "60c72b2f9b1d8b2badbee5a1",
            "name": "Dr. Kavita Verma",
            "degree": "MD - Dermatology",
            "speciality": "Dermatologist",
            "fees": 600,
            "rating": 4.9,
            "experience": 8,
            "image": "https://...",
            "hospitalName": "HealPoint Apex Hospital"
          }
        }
      ],
      "actions": [
        { "label": "View Dermatologists", "route": "/doctors?speciality=Dermatologist", "icon": "search", "variant": "primary" },
        { "label": "Book Appointment", "route": "/doctors", "icon": "calendar", "variant": "secondary" }
      ]
    }
    ```
  - **Response (429 - Rate Limited)**:
    ```json
    {
      "success": false,
      "message": "Too many AI requests. Please wait 45 seconds before sending another message.",
      "retryAfter": 45
    }
    ```

### B. Patient Conversation History
- **GET** `/api/v1/ai/history`
  - **Auth**: Bearer Token (Patient)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "count": 6,
      "history": [
        {
          "id": "60c72b2f9b1d8b2badbee5b1",
          "sender": "user",
          "text": "What does a cardiologist treat?",
          "language": "en",
          "timestamp": "2026-10-31T15:20:00.000Z"
        },
        {
          "id": "60c72b2f9b1d8b2badbee5b2",
          "sender": "ai",
          "text": "Cardiologists are medical doctors specializing in the diagnosis and treatment of conditions related to the heart and blood vessels...",
          "language": "en",
          "timestamp": "2026-10-31T15:20:02.000Z"
        }
      ]
    }
    ```

- **DELETE** `/api/v1/ai/history`
  - **Auth**: Bearer Token (Patient)
  - **Description**: Permanently purges all AI conversation documents belonging to the authenticated patient (DPDP Act 2023 compliance).
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Chat history cleared successfully.",
      "deletedCount": 6
    }
    ```

### C. Doctor Consultation AI Summary
- **POST** `/api/v1/ai/consultation-summary/:appointmentId`
  - **Auth**: Bearer Token (Assigned Doctor, Hospital Admin, or Super Admin)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "appointmentId": "60c72b2f9b1d8b2badbee5a1",
      "summary": "### AI-Generated Consultation Summary (Review Required)\n- **Patient**: Rahul Mehta\n- **Chief Observations**: ...\n> [!NOTE]\n> Requires doctor verification.",
      "generatedAt": "2026-10-31T15:30:00.000Z",
      "label": "AI-Generated Draft — Requires Doctor Review & Sign-off"
    }
    ```

### D. Multi-Tenant Aggregated Analytics
- **GET** `/api/v1/ai/hospital-stats`
  - **Auth**: Bearer Token (Hospital Admin with resolved `hospitalId`)
  - **Response (200)**: Aggregated triage counts and emergency escalations for the hospital (zero private patient texts).

- **GET** `/api/v1/ai/platform-stats`
  - **Auth**: Bearer Token (Super Admin)
  - **Response (200)**: Platform-wide language distribution and referral rates.


