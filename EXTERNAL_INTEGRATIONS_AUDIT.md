# HealPoint — External Integration & Real-World Connection Audit
**Audit Date:** November 2026  
**Project Mode:** 100% Standalone Educational Demo & Portfolio System  
**Objective:** Identify every external connection, third-party service, and data transmission vector to convert HealPoint into a completely isolated, simulated demonstration environment.

---

## 1. External Integration Audit Matrix

| Feature Name | File & API Location | External Service | Data Transmitted | Current Connection Status | Required Action for Standalone Demo |
|---|---|---|---|---|---|
| **Emergency SOS Dispatch** | `HealPointBackend/controllers/emergencyController.js` (`POST /api/v1/emergency/sos`) | Real hospital ER desks & internal socket dispatch | Patient name, medical conditions, GPS coordinates, phone | Active server route; internal Socket.IO & notification | Enforce `SOS_SIMULATION_ONLY=true`. Mark all records with `isDemo: true`, `isSimulation: true`. Return explicit simulation disclaimer. Do not dispatch to any real recipient. |
| **Emergency Phone Dialing** | `app/(drawer)/emergency.tsx` (`Linking.openURL('tel:...')`) | Mobile Telephony dialer (calls 112, 108, hospital lines) | User phone dialer trigger | Active button triggers device call intent | Disable real `tel:` launching for emergency services. Show in-app demo modal: *"DEMO MODE: Calling disabled. This is a fictional educational platform."* |
| **GPS / Location Tracking** | `app/(drawer)/emergency.tsx` & `hooks/use-emergency.ts` (`expo-location`) | Device GPS hardware & reverse geocoding | Live device latitude/longitude & street address | Requests device coordinates | Anonymize GPS coordinates. Replace with static demo location (Ahmedabad Demo Healthcare Hub: `23.0225, 72.5714`). Never transmit real user coordinates. |
| **Push Notifications** | `HealPointBackend/services/pushNotificationService.js` | Expo Push API (`https://exp.host/--/api/v2/push/send`) | Notification title, message, device token | Active outbound HTTP `POST` fetch to Expo push servers | Add server-side guard `EXTERNAL_SOS_NOTIFICATIONS_ENABLED=false`. For emergency alerts, suppress external HTTP dispatch and keep purely in-app. |
| **Appointment Email Reminders** | `HealPointBackend/services/emailService.js` | Nodemailer / External SMTP servers | Patient name, appointment time, doctor, recipient email | Fallback simulated mode active when `SMTP_HOST` unset | Permanently enforce simulation mode. When `DEMO_MODE=true`, bypass `transporter.sendMail()` entirely. Return simulated log `{ success: true, simulated: true }`. |
| **SMS / WhatsApp Alerts** | `HealPointBackend/models/userModel.js`, `controllers/appointmentController.js` | Placeholder notification channels | Recipient phone numbers, appointment text | No active third-party SMS SDK (Twilio/Gupshup) connected | Retain channel flags for UI demonstration only. Guarantee 0 external gateway calls. |
| **Payment Gateway** | `HealPointBackend/services/razorpayService.js` & `controllers/appointmentController.js` | Razorpay Payment Gateway (`api.razorpay.com`) | Order amounts, customer contact, receipt IDs | Configured with Razorpay Test Mode Sandbox keys (`rzp_test_...`) | Enforce `LIVE_PAYMENTS_ENABLED=false`. Display `DEMO TRANSACTION – No real money is charged.` Provide one-click simulated payment for test flows. |
| **AI Symptom Checker** | `HealPointBackend/controllers/aiController.js` (`POST /api/v1/ai/triage`) | Google Gemini Generative AI API | Patient symptom text queries | Active via `GEMINI_API_KEY` with local fallback rule engine | Display mandatory demo disclaimer: *"DEMO HEALTH ASSISTANT: Educational simulation only. Not medical advice."* |
| **WebRTC Video Signaling** | `HealPointBackend/services/consultationSocket.js` | Socket.IO signaling & Google public STUN server (`stun:stun.l.google.com:19302`) | ICE candidate IP addresses & SDP offers | Google public STUN server used for NAT traversal | Safe for browser-to-browser P2P demo. Mark consultation rooms with `DEMO CONSULTATION` watermarks. |

---

## 2. Server-Side Demo Security Architecture

The backend will enforce strict demo mode configuration via `.env` and `app.js` middleware:

```env
DEMO_MODE=true
SOS_SIMULATION_ONLY=true
REAL_EMERGENCY_SERVICES_ENABLED=false
EXTERNAL_SOS_NOTIFICATIONS_ENABLED=false
SOS_LOCATION_SHARING_ENABLED=false
LIVE_PAYMENTS_ENABLED=false
```

### Server-Side Fail-Closed Enforcement
1. **SOS Emergency Requests:** Whenever `REAL_EMERGENCY_SERVICES_ENABLED !== "true"` (default), any emergency request is tagged `isDemo: true`, `isSimulation: true`, and the response explicitly states:
   > *"DEMO MODE: This is a simulated emergency request. No real hospital, ambulance or emergency service has been contacted."*
2. **Location Anonymization:** Inbound GPS coordinates are sanitized. Real hardware coordinates are replaced with static simulated coordinates (`23.0225, 72.5714`).
3. **Outbound Communications Blocked:** Email and external push for emergency events are completely halted. Internal DB notifications and Socket.IO local room broadcasts are maintained so all 4 portals (Patient, Doctor, Hospital Admin, Super Admin) function seamlessly in the demo environment.

