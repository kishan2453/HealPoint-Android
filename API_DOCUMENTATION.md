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



---

## Phase 4: Advanced Health Wallet & Digital Vault API Specification

### A. Digital Health Wallet Endpoints
- **GET** `/api/v1/appointment/health-wallet`
  - **Auth**: Bearer Token (Patient)
  - **Query Parameters**:
    - `familyMemberId`: Filter by authorized dependent ObjectId, `"self"`, or `"all"`
    - `category`: Filter by category key (`prescriptions`, `reports`, `bills`, `consultations`, `records`, `passes`, or `"all"`)
    - `search`: Keyword string matching titles, doctors, diagnoses, facilities
    - `startDate`, `endDate`: ISO date strings for date range filtering
    - `sort`: `"newest"` (default) | `"oldest"`
    - `page`, `limit`: Integer pagination
  - **Response (200)**:
    ```json
    {
      "success": true,
      "counts": {
        "prescriptions": 4,
        "reports": 3,
        "bills": 5,
        "consultations": 6,
        "records": 2,
        "passes": 1,
        "appointments": 6,
        "documents": 5,
        "total": 21
      },
      "patient": {
        "_id": "60c72b2f9b1d8b2badbee5a1",
        "name": "Rahul Mehta",
        "phone": "+919876543210",
        "email": "rahul@healpoint.test"
      },
      "items": [ ... ],
      "pagination": { "page": 1, "limit": 50, "totalItems": 21, "totalPages": 1, "hasMore": false }
    }
    ```

### B. Health Document Management Endpoints
- **POST** `/api/v1/document/upload`
  - **Auth**: Bearer Token (Patient)
  - **Body (JSON / Base64 or FormData)**:
    - `title`: String (Required)
    - `fileData`: Base64 encoded document string (or `req.file`)
    - `mimeType`: Permitted whitelist (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`)
    - `category`: One of 8 standard categories (`prescription`, `lab_report`, `diagnostic_report`, `consultation_history`, `medical_document`, `billing_receipt`, `appointment_record`, `other`)
    - `familyMemberId`: Optional dependent ObjectId (verified against profile)
    - `documentDate`: `YYYY-MM-DD`
    - `notes`: Optional String
  - **Response (201)**:
    ```json
    {
      "success": true,
      "message": "Health document uploaded and encrypted securely",
      "document": {
        "_id": "672401f89c...",
        "title": "Thyroid Panel Report",
        "category": "lab_report",
        "documentDate": "2026-10-31",
        "mimeType": "application/pdf",
        "size": 420800,
        "processingStatus": "processed",
        "confidence": 100
      }
    }
    ```

- **GET** `/api/v1/document/my`
  - **Auth**: Bearer Token (Patient)
  - **Query Parameters**: `category`, `familyMemberId`, `search`, `startDate`, `endDate`, `sort`, `page`, `limit`
  - **Response (200)**: `{ "success": true, "documents": [ ... ], "pagination": { ... } }`

- **GET** `/api/v1/document/timeline`
  - **Auth**: Bearer Token (Patient)
  - **Query Parameters**: `familyMemberId`
  - **Response (200)**: Chronologically grouped monthly buckets (`{ period: "2026-10", label: "October 2026", count: 4, items: [ ... ] }`).

- **GET** `/api/v1/document/stats`
  - **Auth**: Bearer Token (Patient)
  - **Response (200)**: Category count breakdown for dashboard cards.

- **GET** `/api/v1/document/:id`
  - **Auth**: Bearer Token (Owner Patient or Explicitly Shared Doctor)
  - **Response (200)**: Full document metadata & verification status.

- **GET** `/api/v1/document/:id/view` or `/download`
  - **Auth**: Bearer Token (Owner Patient or Explicitly Shared Doctor)
  - **Response (Stream)**: Streams file with appropriate `Content-Type` and `Content-Disposition`.

- **PATCH** `/api/v1/document/:id/metadata`
  - **Auth**: Bearer Token (Owner Patient)
  - **Body**: `{ "title": "...", "doctorName": "...", "hospitalName": "..." }`
  - **Response (200)**: Updated document with human-verified audit stamp.

- **POST** `/api/v1/document/:id/share`
  - **Auth**: Bearer Token (Owner Patient)
  - **Body**: `{ "doctorId": "<string>" }`
  - **Response (200)**: `{ "success": true, "message": "Document access successfully shared with doctor" }`

- **DELETE** `/api/v1/document/:id/share/:doctorId`
  - **Auth**: Bearer Token (Owner Patient)
  - **Response (200)**: `{ "success": true, "message": "Doctor access revoked successfully" }`

- **DELETE** `/api/v1/document/:id`
  - **Auth**: Bearer Token (Owner Patient)
  - **Description**: Soft deletes (`isArchived: true`) from patient vault.
  - **Response (200)**: `{ "success": true, "message": "Document removed securely from Health Wallet" }`

---

## Phase 5: Digital Prescription & Medicine Reminders API Specification

### Digital Prescriptions (`/api/v1/prescription` & `/api/v1/prescriptions`)

- **POST** `/api/v1/prescription/draft`
  - **Auth**: Bearer Token (Doctor only)
  - **Body**: `{ "appointmentId": "<ObjectId>", "diagnosis": "...", "medicines": [...], "generalInstructions": "...", "dietInstructions": "...", "followUpDate": "..." }`
  - **Response (200)**: `{ "success": true, "message": "Prescription draft saved successfully", "prescription": { ... } }`

- **POST** `/api/v1/prescription/issue`
  - **Auth**: Bearer Token (Treating Doctor only)
  - **Description**: Issues official prescription with cryptographic digital signature, updates appointment and Health Wallet records, and auto-provisions medication reminders.
  - **Body**: `{ "appointmentId": "<ObjectId>", "diagnosis": "...", "medicines": [...], ... }`
  - **Response (200)**: `{ "success": true, "message": "Prescription officially issued and digitally signed", "prescription": { ... } }`

- **PUT** `/api/v1/prescription/:id/amend`
  - **Auth**: Bearer Token (Treating Doctor only)
  - **Description**: Amends an issued prescription, preserving previous version snapshots in history array.
  - **Body**: `{ "amendmentReason": "Adjusted antibiotic dosage based on tolerance", "diagnosis": "...", "medicines": [...] }`
  - **Response (200)**: `{ "success": true, "message": "Prescription amended successfully. Version history recorded.", "prescription": { ... } }`

- **GET** `/api/v1/prescription/:id`
  - **Auth**: Bearer Token (Patient, Treating Doctor, or Authorized Hospital Admin)
  - **Description**: Returns detailed prescription including version history, medicines, vitals, and doctor signature.

- **GET** `/api/v1/prescription/:id/pdf` (or `?token=<jwt>`)
  - **Auth**: Bearer Header or Query Token
  - **Description**: Streams a generated binary PDF document with HealPoint branding, hospital header, Rx symbol, medicine table, and digital stamp.

- **GET** `/api/v1/prescription/patient/history`
  - **Auth**: Bearer Token (Patient)
  - **Query**: `?familyMemberId=<id>&status=all`
  - **Response (200)**: `{ "success": true, "prescriptions": [...] }`

- **GET** `/api/v1/prescription/hospital/:hospitalId/stats`
  - **Auth**: Bearer Token (Hospital Admin / Super Admin)
  - **Description**: Hospital tenant-isolated aggregate metrics (total, issued, drafts, amended).

- **GET** `/api/v1/prescription/superadmin/stats`
  - **Auth**: Bearer Token (Super Admin only)
  - **Description**: Platform aggregate prescription & reminder health metrics.

---

### Medication Reminders (`/api/v1/medication-reminder` & `/api/v1/medication-reminders`)

- **GET** `/api/v1/medication-reminder`
  - **Auth**: Bearer Token (Patient)
  - **Query**: `?familyMemberId=<id>&date=DD-MM-YYYY`
  - **Response (200)**: `{ "success": true, "todaySchedule": [...], "reminders": [...], "summary": { ... }, "adherenceRate": 92 }`

- **POST** `/api/v1/medication-reminder`
  - **Auth**: Bearer Token (Patient)
  - **Body**: `{ "medicineName": "...", "dosage": "...", "frequency": "1-0-1", "times": ["08:00 AM", "08:00 PM"], ... }`

- **PATCH** `/api/v1/medication-reminder/:id/action`
  - **Auth**: Bearer Token (Patient)
  - **Body**: `{ "action": "taken" | "skipped" | "snoozed" | "missed", "scheduledTime": "08:00 AM", "scheduledDate": "2026-11-01" }`
  - **Response (200)**: `{ "success": true, "message": "Medication action logged", "reminder": { ... } }`

- **DELETE** `/api/v1/medication-reminder/:id`
  - **Auth**: Bearer Token (Patient)
  - **Description**: Soft deactivates reminders (`isActive: false`).

---

## Phase 6 Part 1: Advanced Analytics & Reporting API Specification

### Base Route: `/api/v1/analytics`

#### 1. Super Admin Platform Analytics
- **GET** `/api/v1/analytics/superadmin/overview`
  - **Auth**: Bearer Token (Super Admin only)
  - **Query Parameters**:
    - `range`: `today` | `7d` | `30d` | `this_month` | `last_month` | `this_year` | `custom`
    - `startDate`: ISO date string (when `range=custom`)
    - `endDate`: ISO date string (when `range=custom`)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "filter": { "range": "30d", "rangeLabel": "Last 30 Days", "startDate": "...", "endDate": "..." },
      "hospitals": { "total": 12, "active": 11, "suspended": 1 },
      "users": { "totalPatients": 340, "totalDoctors": 48 },
      "appointments": { "total": 1240, "completed": 950, "cancelled": 80, "pending": 110, "completionRate": 77 },
      "revenue": { "totalRevenue": 950000, "netPlatformRevenue": 942000, "todayRevenue": 32000, "totalRefunds": 8000, "currency": "INR" },
      "charts": { "dailyTrends": [...], "monthlyTrends": [...], "statusDistribution": [...] }
    }
    ```

- **GET** `/api/v1/analytics/superadmin/hospitals-performance`
  - **Auth**: Bearer Token (Super Admin only)
  - **Response (200)**: Array of hospital benchmarking metrics (appointment volume, completion rate, cancellation rate, verified revenue).

- **GET** `/api/v1/analytics/superadmin/doctors-performance`
  - **Auth**: Bearer Token (Super Admin only)
  - **Response (200)**: Array of doctor rankings across all hospitals (consultations, completion rate, rating, revenue).

#### 2. Hospital Admin Analytics (Tenant Isolated)
- **GET** `/api/v1/analytics/hospital/overview`
  - **Auth**: Bearer Token (Hospital Admin / Super Admin)
  - **Description**: Scoped strictly to the caller's registered hospital via `resolveHospitalId`.
  - **Response (200)**:
    ```json
    {
      "success": true,
      "hospital": { "id": "...", "name": "Apollo Care", "city": "Mumbai" },
      "overview": { "totalAppointments": 280, "todayAppointments": 14, "completedAppointments": 210, "totalPatients": 185, "activeDoctors": 12 },
      "revenue": { "totalCollectedRevenue": 240000, "netRevenue": 238000, "todayRevenue": 14000, "totalRefunds": 2000 },
      "doctorPerformance": [...],
      "charts": { "dailyTrends": [...], "statusDistribution": [...] }
    }
    ```

#### 3. Doctor Portal Analytics
- **GET** `/api/v1/analytics/doctor/:id` or `/api/v1/analytics/doctor`
  - **Auth**: Bearer Token (Doctor matching ID or Super Admin)
  - **Response (200)**: Scoped doctor overview (today appointments, upcoming, completed, patient count, earnings, trends).

#### 4. Patient Portal Activity Stats
- **GET** `/api/v1/analytics/patient/stats`
  - **Auth**: Bearer Token (Authenticated Patient)
  - **Response (200)**: Patient's real appointment counts (total, upcoming, completed, cancelled), Health Wallet document count, and active prescription count.

#### 5. Multi-Format Report Export
- **GET** `/api/v1/analytics/export`
  - **Auth**: Bearer Token or Query `?token=<jwt>`
  - **Query Parameters**:
    - `type`: `appointments` | `revenue` | `doctors` | `cancellations`
    - `format`: `pdf` | `csv` | `excel`
    - `range`: `today` | `7d` | `30d` | `this_month` | `last_month` | `this_year` | `custom`
    - `startDate`, `endDate`: ISO date strings (for `custom` range)
  - **Security**: Hospital Admins can only export their own hospital; Doctors can only export their own consultations; Patients only export their own data.
  - **Response**: Streams binary file with `Content-Disposition: attachment; filename="<type>-report-<timestamp>.<ext>"` and exact MIME headers (`application/pdf`, `text/csv; charset=utf-8`, or `application/vnd.ms-excel`).

---

## 7. Smart Notifications & Push Token Specification (Phase 6 Part 2)

### A. Notifications Endpoints (`/api/v1/notification`)

#### 1. Role-Scoped Notifications Feed
- **GET** `/api/v1/notification/get-all` (Aliases: `/my`)
  - **Auth**: Bearer Token (Patient / Doctor / Hospital Admin / Super Admin)
  - **Query Parameters**:
    - `status`: `all` | `read` | `unread`
    - `type` or `category`: Category or type name
    - `priority`: `low` | `normal` | `medium` | `high` | `urgent`
    - `search`: Full-text search string for title or message
    - `page`: Page number (default: 1)
    - `limit`: Items per page (default: 20, max: 100)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "count": 20,
      "total": 45,
      "unreadCount": 3,
      "page": 1,
      "totalPages": 3,
      "notifications": [
        {
          "_id": "6724...",
          "title": "Prescription Ready",
          "message": "Dr. Sharma issued your prescription for Token #C-002",
          "type": "prescription",
          "category": "prescription",
          "priority": "normal",
          "read": false,
          "isRead": false,
          "link": "/health/prescriptions",
          "createdAt": "2026-11-01T06:30:00.000Z"
        }
      ]
    }
    ```

#### 2. Fast Unread Badge Query
- **GET** `/api/v1/notification/unread-count`
  - **Auth**: Bearer Token
  - **Response (200)**: `{ "success": true, "unreadCount": 3 }`

#### 3. Mark As Read / Unread
- **PATCH** `/api/v1/notification/read/:id` (Alias: `/:id/read`)
  - **Auth**: Bearer Token (Owner / Tenant isolated)
  - **Body**: `{ "isRead": true }` (optional, defaults to true)
  - **Response (200)**: `{ "success": true, "message": "Notification marked as read", "notification": { ... }, "unreadCount": 2 }`

#### 4. Mark All As Read
- **PATCH** `/api/v1/notification/mark-all` (Alias: `/read-all`)
  - **Auth**: Bearer Token
  - **Response (200)**: `{ "success": true, "message": "All notifications marked as read", "unreadCount": 0 }`

#### 5. Delete Notification
- **DELETE** `/api/v1/notification/delete/:id` (Alias: `/:id`)
  - **Auth**: Bearer Token (Owner / Tenant isolated)
  - **Response (200)**: `{ "success": true, "message": "Notification deleted", "id": "...", "unreadCount": 2 }`

#### 6. Patient Notification Preferences
- **GET** `/api/v1/notification/preferences`
  - **Auth**: Bearer Token (Patient)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "preferences": {
        "channels": { "inApp": true, "push": true, "email": true, "sms": false },
        "categories": { "appointments": true, "prescriptions": true, "payments": true, "queue": true },
        "quietHours": { "enabled": false, "start": "22:00", "end": "07:00" }
      }
    }
    ```
- **PUT** `/api/v1/notification/preferences`
  - **Auth**: Bearer Token (Patient)
  - **Body**: Partial preferences object

#### 7. Expo Device Push Token Registration
- **POST** `/api/v1/notification/register-push-token` (Alias: `/device-token`)
  - **Auth**: Bearer Token
  - **Body**: `{ "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "platform": "expo" }`
  - **Validation**: Enforces valid Expo token prefix (`ExponentPushToken[` or `ExpoPushToken[`)
  - **Response (200)**: `{ "success": true, "message": "Push token registered successfully", "token": "..." }`
- **DELETE** `/api/v1/notification/device-token`
  - **Auth**: Bearer Token
  - **Body**: `{ "token": "..." }`
  - **Response (200)**: `{ "success": true, "message": "Push token removed successfully" }`

---

## 7. Phase 7: Emergency SOS & Emergency Services API

### A. Patient SOS & Emergency Tracking

#### 1. Trigger Emergency SOS
- **POST** `/api/v1/emergency/sos` (Alias: `/create`)
  - **Auth**: Bearer Token (Patient)
  - **Body**:
    ```json
    {
      "emergencyType": "cardiac",
      "severity": "critical",
      "notes": "Severe chest tightness and breathing difficulty",
      "location": {
        "latitude": 23.0225,
        "longitude": 72.5714,
        "address": "Navrangpura, Ahmedabad, Gujarat"
      },
      "hospitalId": "60c72b2f9b1d8b2badbee5a1"
    }
    ```
  - **Behavior**: If patient already has an active emergency (`pending`, `accepted`, `in_progress`), updates coordinates and returns existing case.
  - **Response (201 / 200)**:
    ```json
    {
      "success": true,
      "message": "Emergency SOS triggered successfully! Help is on the way.",
      "data": {
        "_id": "...",
        "emergencyCode": "EMG-1730448000000-8F9E",
        "status": "pending",
        "emergencyType": "cardiac",
        "severity": "critical",
        "location": { "latitude": 23.0225, "longitude": 72.5714 },
        "patientSnapshot": { "name": "Kishan Patel", "phone": "9876543210", "bloodGroup": "B+" },
        "createdAt": "2026-11-01T10:00:00.000Z"
      }
    }
    ```

#### 2. Get Active Patient Emergency
- **GET** `/api/v1/emergency/active`
  - **Auth**: Bearer Token (Patient)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "active": true,
      "data": {
        "emergencyCode": "EMG-1730448000000-8F9E",
        "status": "accepted",
        "ambulance": {
          "vehicleNumber": "GJ-01-HP-108",
          "driverName": "Ramesh Kumar",
          "driverPhone": "9876500001",
          "etaMinutes": 8,
          "status": "en_route"
        }
      }
    }
    ```

#### 3. Patient Emergency History
- **GET** `/api/v1/emergency/my-history`
  - **Auth**: Bearer Token (Patient)
  - **Response (200)**: `{ "success": true, "data": [ ... ] }`

#### 4. Cancel Emergency Request
- **POST** `/api/v1/emergency/:id/cancel`
  - **Auth**: Bearer Token (Patient / Hospital Staff)
  - **Body**: `{ "reason": "Patient stable / accidental click" }`
  - **Response (200)**: `{ "success": true, "message": "Emergency request cancelled successfully" }`

### B. Emergency Contacts Management

#### 1. Get Emergency Contacts
- **GET** `/api/v1/emergency/contacts`
  - **Auth**: Bearer Token
  - **Response (200)**: `{ "success": true, "data": [ { "name": "Papa", "phone": "9876543211", "relationship": "Father", "isPrimary": true } ] }`

#### 2. Save / Update Emergency Contact
- **POST** `/api/v1/emergency/contacts`
  - **Auth**: Bearer Token
  - **Body**: `{ "name": "Brother", "phone": "9876543212", "relationship": "Brother", "isPrimary": false }`
  - **Response (200)**: `{ "success": true, "message": "Emergency contact saved successfully", "data": [ ... ] }`

#### 3. Delete Emergency Contact
- **DELETE** `/api/v1/emergency/contacts/:contactId`
  - **Auth**: Bearer Token
  - **Response (200)**: `{ "success": true, "message": "Emergency contact removed", "data": [ ... ] }`

### C. Hospital Admin Emergency Operations

#### 1. Get Hospital Emergency Queue
- **GET** `/api/v1/emergency/hospital?status=active`
  - **Auth**: Bearer Token (Hospital Admin / Staff)
  - **Isolation**: Strictly scoped to admin's `hospitalId`.

#### 2. Update Emergency Status
- **PATCH** `/api/v1/emergency/:id/status` (Alias: `POST /:id/status`)
  - **Auth**: Bearer Token (Hospital Staff)
  - **Body**:
    ```json
    {
      "status": "resolved",
      "clinicalNotes": "Patient treated and admitted in ICU Room 204",
      "outcome": "Admitted in Stable Condition"
    }
    ```

#### 3. Dispatch Ambulance
- **POST** `/api/v1/emergency/:id/ambulance`
  - **Auth**: Bearer Token (Hospital Admin)
  - **Body**:
    ```json
    {
      "vehicleNumber": "GJ-01-HP-108",
      "driverName": "Ramesh Kumar",
      "driverPhone": "9876500001",
      "etaMinutes": 10
    }
    ```

### D. Super Admin Platform Emergency Overview

#### 1. Platform-wide Emergency Telemetry
- **GET** `/api/v1/emergency/superadmin/overview`
  - **Auth**: Bearer Token (Super Admin)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "stats": {
        "total": 42,
        "active": 3,
        "resolved": 35,
        "cancelled": 4,
        "byType": [{ "type": "cardiac", "count": 18 }, { "type": "accident", "count": 12 }],
        "byHospital": [{ "hospitalName": "HealPoint Apex Hospital", "count": 22 }]
      },
      "recentEmergencies": [ ... ]
    }
    ```

### E. Socket.IO Real-Time Emergency Events

- **`emergency:alert`**: Broadcast when a new SOS is dispatched or accepted.
  - Broadcast to: `hospital:<hospitalId>`, `room:super_admin`, `doctor:<doctorId>`.
- **`emergency:status`**: Broadcast when emergency status or ambulance coordinates update.
  - Broadcast to: `user:<patientId>`, `hospital:<hospitalId>`, `room:super_admin`.

---

## 8. Phase 8: Favorites System & Patient Experience API

Both `/api/v1/user/favorites*` and `/api/v1/favorites*` are fully supported endpoints.

### A. Favorite Doctors

#### 1. Get Favorite Doctors
- **GET** `/api/v1/user/favorites` (Alias: `GET /api/v1/favorites/doctors`, `GET /api/v1/favorites`)
  - **Auth**: Bearer Token (Patient)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "favorites": [
        {
          "_id": "60c72b2f9b1d8b2badbee5a1",
          "doctorId": "60c72b2f9b1d8b2badbee5a1",
          "name": "Dr. Aarav Sharma",
          "speciality": "Cardiologist",
          "hospitalName": "Apex Multi-Specialty Hospital",
          "fees": 800,
          "rating": 4.9,
          "reviewCount": 42,
          "image": "https://...",
          "addedAt": "2026-11-01T12:00:00.000Z"
        }
      ],
      "totalCount": 1
    }
    ```

#### 2. Add Favorite Doctor
- **POST** `/api/v1/user/favorites/:doctorId` (Alias: `POST /api/v1/favorites/doctors/:doctorId`)
  - **Auth**: Bearer Token (Patient)
  - **Params**: `doctorId` (MongoDB ObjectId)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Doctor saved to favorites successfully",
      "isFavorite": true,
      "doctorId": "60c72b2f9b1d8b2badbee5a1",
      "count": 1
    }
    ```

#### 3. Remove Favorite Doctor
- **DELETE** `/api/v1/user/favorites/:doctorId` (Alias: `DELETE /api/v1/favorites/doctors/:doctorId`)
  - **Auth**: Bearer Token (Patient)
  - **Params**: `doctorId` (MongoDB ObjectId)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Doctor removed from favorites successfully",
      "isFavorite": false,
      "doctorId": "60c72b2f9b1d8b2badbee5a1",
      "count": 0
    }
    ```

### B. Favorite Hospitals

#### 1. Get Favorite Hospitals
- **GET** `/api/v1/user/favorites/hospitals` (Alias: `GET /api/v1/favorites/hospitals`)
  - **Auth**: Bearer Token (Patient)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "favorites": [
        {
          "_id": "60c72b2f9b1d8b2badbee5b1",
          "hospitalId": "60c72b2f9b1d8b2badbee5b1",
          "name": "Apex Multi-Specialty Hospital",
          "location": { "city": "Ahmedabad", "state": "Gujarat" },
          "rating": 4.8,
          "reviewCount": 85,
          "beds": 250,
          "addedAt": "2026-11-01T12:00:00.000Z"
        }
      ],
      "totalCount": 1
    }
    ```

#### 2. Add Favorite Hospital
- **POST** `/api/v1/user/favorites/hospitals/:hospitalId` (Alias: `POST /api/v1/favorites/hospitals/:hospitalId`)
  - **Auth**: Bearer Token (Patient)
  - **Params**: `hospitalId` (MongoDB ObjectId)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Hospital saved to favorites successfully",
      "isFavorite": true,
      "hospitalId": "60c72b2f9b1d8b2badbee5b1",
      "count": 1
    }
    ```

#### 3. Remove Favorite Hospital
- **DELETE** `/api/v1/user/favorites/hospitals/:hospitalId` (Alias: `DELETE /api/v1/favorites/hospitals/:hospitalId`)
  - **Auth**: Bearer Token (Patient)
  - **Params**: `hospitalId` (MongoDB ObjectId)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Hospital removed from favorites successfully",
      "isFavorite": false,
      "hospitalId": "60c72b2f9b1d8b2badbee5b1",
      "count": 0
    }
    ```

### C. Aggregate Counts & Check Status

#### 1. Get Favorite Counts
- **GET** `/api/v1/user/favorites/counts` (Alias: `GET /api/v1/favorites/counts`)
  - **Auth**: Bearer Token
  - **Response (200)**:
    ```json
    {
      "success": true,
      "doctorCount": 3,
      "hospitalCount": 2,
      "total": 5
    }
    ```

#### 2. Check Favorite Status
- **GET** `/api/v1/user/favorites/check?doctorId=...&hospitalId=...`
  - **Auth**: Bearer Token
  - **Query**: `doctorId` and/or `hospitalId`
  - **Response (200)**:
    ```json
    {
      "success": true,
      "isDoctorFavorite": true,
      "isHospitalFavorite": false
    }
    ```

---

## 13. Phase 9: Family Account Management & Family Booking APIs

### A. Family Member Management

#### 1. Get Family Members
- **GET** `/api/v1/user/family-members/:userId`
- **GET** `/api/v1/user/family` (Alias: `GET /api/v1/family`)
  - **Auth**: Bearer Token (Caller must match `:userId` or have admin/doctor permissions)
  - **Query**: `includeArchived=true|false` (default: `false`)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "count": 2,
      "familyMembers": [
        {
          "_id": "6724cf...",
          "name": "Aarav Sharma",
          "relationship": "Son",
          "gender": "male",
          "dob": "2015-08-12",
          "bloodGroup": "O+",
          "allergies": ["Peanuts"],
          "chronicConditions": ["Asthma"],
          "isArchived": false,
          "createdAt": "2026-11-01T10:00:00.000Z"
        }
      ]
    }
    ```

#### 2. Get Single Family Member by ID
- **GET** `/api/v1/user/family-members/:userId/:memberId`
- **GET** `/api/v1/user/family/:memberId`
  - **Auth**: Bearer Token
  - **Response (200)**:
    ```json
    {
      "success": true,
      "familyMember": {
        "_id": "6724cf...",
        "name": "Aarav Sharma",
        "relationship": "Son",
        "bloodGroup": "O+",
        "isArchived": false
      }
    }
    ```

#### 3. Add Family Member
- **POST** `/api/v1/user/family-members/:userId`
- **POST** `/api/v1/user/family`
  - **Auth**: Bearer Token
  - **Body**:
    ```json
    {
      "name": "Aarav Sharma",
      "relationship": "Son",
      "gender": "male",
      "dob": "2015-08-12",
      "phone": "9876543210",
      "bloodGroup": "O+",
      "allergies": ["Peanuts"],
      "chronicConditions": ["Asthma"]
    }
    ```
  - **Response (201)**:
    ```json
    {
      "success": true,
      "message": "Family member added successfully",
      "familyMember": {
        "_id": "6724cf...",
        "name": "Aarav Sharma",
        "relationship": "Son"
      }
    }
    ```

#### 4. Update Family Member
- **PATCH** `/api/v1/user/family-members/:userId/:memberId`
- **PATCH** `/api/v1/user/family/:memberId`
  - **Auth**: Bearer Token
  - **Body**: Partial or complete demographic fields.
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "Family member updated successfully",
      "familyMember": { ... }
    }
    ```

#### 5. Safe Remove or Archive Family Member
- **DELETE** `/api/v1/user/family-members/:userId/:memberId`
- **DELETE** `/api/v1/user/family/:memberId`
  - **Auth**: Bearer Token
  - **Query**: `archive=true` (optional)
  - **Response (200)**:
    ```json
    {
      "success": true,
      "archived": true,
      "message": "Family member has historical health records and was safely archived."
    }
    ```

### B. Family Appointment Booking & Query Filter

#### 1. Book Appointment for Dependent
- **POST** `/api/v1/appointment/book`
  - **Auth**: Bearer Token
  - **Body**:
    ```json
    {
      "doctorId": "60c72b2f9b1d8b2badbee5a1",
      "slotDate": "05-11-2026",
      "slotTime": "10:00 AM",
      "familyMemberId": "6724cf...",
      "consultationType": "clinic",
      "paymentMethod": "cash"
    }
    ```
  - **Security Rule**: Backend validates that `familyMemberId` belongs to `user.familyMembers` and is not archived. Synchronizes `patientName` and `familyRelationship` directly from the verified dependent profile.
  - **Error (403)**:
    ```json
    {
      "success": false,
      "code": "FAMILY_MEMBER_NOT_AUTHORIZED",
      "message": "Family member not authorized or not found for this account"
    }
    ```

#### 2. Get User Appointments by Family Member Filter
- **GET** `/api/v1/appointment/get-user-appointments?familyMemberId=6724cf...`
- **GET** `/api/v1/appointment/get-user-appointments?familyMemberId=self`
  - **Auth**: Bearer Token
  - **Response (200)**:
    ```json
    {
      "success": true,
      "totalCount": 3,
      "appointments": [ ... ]
    }
    ```
