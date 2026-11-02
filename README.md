# Anand HealPoint — Multi-Hospital Healthcare Ecosystem
## Modern Healthcare Appointment Platform, Digital Prescriptions & Multi-Tenant Management

Anand HealPoint is an enterprise-grade, multi-tenant healthcare appointment booking and telemedicine platform. It connects patients with accredited multi-specialty hospitals and verified medical practitioners through a mobile application and three dedicated administrative web portals.

---

## 1. System Components & Portals

| Portal / Component | Platform / Technology | Purpose | Production URL |
|---|---|---|---|
| **Patient Mobile & Web** | React Native, Expo SDK 54 | Appointment booking, Health Wallet, tri-lingual localization, Pre-Consultation Center | https://heal-point-mauve.vercel.app |
| **Doctor Portal** | React 18, Vite 5 | Appointment schedule, patient history, WebRTC video consultation, digital prescriptions | https://heal-point-doctor-web.vercel.app |
| **Hospital Admin Portal** | React 18, Vite 5 | Hospital profile, doctor onboarding, appointment management, department analytics | https://heal-point-hospital-admin.vercel.app |
| **Super Admin Portal** | React 18, Vite 7 | Platform telemetry, hospital creation, platform analytics, system reliability | https://heal-point-super-admin.vercel.app |
| **Backend API** | Node.js, Express.js (ESM), Socket.IO | Central REST API, real-time WebSockets, PDF generation, Razorpay simulation | https://heal-point-backend.vercel.app |

---

## 2. Key Features

- **Multi-Tenant Healthcare Architecture**: Multiple hospital franchises operate independently with strict data isolation.
- **Tri-Lingual Localization**: Instant toggle between English (`en`), Hindi (`hi`), and Gujarati (`gu`) with clinical prescription integrity.
- **Pre-Consultation Center**: Dedicated questionnaire and preparation checklist per appointment.
- **Health Wallet & Medical Records**: Encrypted document vault for prescriptions, lab reports, and medication reminders.
- **Offline Resilience**: Automatic network state detection and persistent local cache without blocking user navigation.
- **Emergency Help Directory**: Rapid access to registered hospital emergency desks and national helpline information.
- **Digital Prescriptions**: Version-controlled prescription authoring with cryptographic digital signing and automated PDF export.

---

## 3. Quick Start & Local Development

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- MongoDB (local or Atlas)

### 1. Backend Setup
```bash
cd HealPointBackend
npm install
npm run dev # Starts server on http://localhost:8080
```

### 2. Patient Mobile App
```bash
# In project root
npm install
npx expo start
```

### 3. Web Portals Setup
```bash
# Doctor Portal
cd HealPointDoctorWeb
npm install
npm run dev

# Hospital Admin Portal
cd ../HealPointHospitalAdminWeb
npm install
npm run dev

# Super Admin Portal
cd ../HealPointSuperAdminWeb
npm install
npm run dev
```

---

## 4. Testing & Verification

```bash
# Run all backend unit and integration tests
cd HealPointBackend
npm test

# Run TypeScript type check on mobile app
cd ..
npx tsc --noEmit
```

---

## 5. College Presentation & Viva Guide
For detailed system architecture, ER diagrams, data flow diagrams, and evaluation Q&A, refer to **[COLLEGE_PRESENTATION_GUIDE.md](file:///d:/HealPoint/HealpointMobile/COLLEGE_PRESENTATION_GUIDE.md)**.
