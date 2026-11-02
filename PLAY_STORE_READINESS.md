# HealPoint 2.0 — Google Play Store Readiness & Release Dossier

**Target Release:** Production v1.0.0 (Version Code: 1)  
**Package Name:** `com.healpoint.app`  
**Application Category:** Medical & Healthcare  
**Content Rating:** Everyone (Medical Information & Telehealth)  
**Target Audience:** General Public (Age 18+ for primary account holders)  
**Primary Language:** English (United States / India), with localized Hindi (हिन्दी) & Gujarati (ગુજરાતી) support  

---

## 1. Store Listing Metadata

### Application Title (Max 30 characters)
`HealPoint: Doctor & Healthcare` (29 chars)

### Short Description (Max 80 characters)
`Book doctor appointments, telehealth consults, health wallet & emergency care.` (78 chars)

### Full Description (Up to 4000 characters)
```markdown
HealPoint is India's premier intelligent healthcare and telehealth platform, seamlessly connecting patients with certified specialist doctors, accredited hospitals, and multi-specialty clinical centers. 

Whether you need an in-person clinic visit, an instant HD video consultation from home, or 24×7 emergency medical support, HealPoint puts compassionate, certified care in the palm of your hand.

KEY FEATURES:
• FIND TOP DOCTORS & HOSPITALS: Browse thousands of verified medical specialists across Cardiology, Dermatology, Pediatrics, Orthopedics, Neurology, Gynecology, General Medicine, and Dentistry. Compare credentials, patient reviews, fees, and real-time hospital doctor counts.
• INSTANT APPOINTMENT BOOKING: Check real-time slot availability, reserve morning or evening consultations, and pay securely online via Razorpay (UPI, Credit/Debit Cards, NetBanking).
• DIGITAL HEALTH WALLET: Store, organize, and view all your clinical records, diagnostic lab reports, and doctor prescriptions in one encrypted, HIPAA/DPDP-compliant repository.
• SMART DIGITAL PRESCRIPTIONS: Receive digitally signed electronic prescriptions directly from your consulting doctor. Set automated dose reminders with daily schedules (e.g., 1-0-1, before meals) to track medicine adherence.
• SECURE VIDEO CONSULTATIONS: Consult with your doctor face-to-face through end-to-end encrypted WebRTC audio/video calls without sharing personal phone numbers.
• 24×7 EMERGENCY SOS: One-tap emergency dispatch captures precise GPS coordinates and immediately alerts nearby partner hospital trauma desks and designated family emergency contacts.
• FAMILY ACCOUNT MANAGEMENT: Manage dependents, elderly parents, and children under a single account. Book family appointments, track immunization records, and isolate confidential medical histories safely.
• MULTI-LANGUAGE LOCALIZATION: Full native language support in English, Hindi (हिन्दी), and Gujarati (ગુજરાતી) with immediate runtime switching.
• OFFLINE ACCESSIBILITY: View previously cached medical records, prescriptions, and saved doctor details even when internet connectivity is intermittent.

DATA PRIVACY & COMPLIANCE:
Your health data belongs exclusively to you. HealPoint utilizes enterprise-grade TLS 1.3 encryption in transit and AES-256 encryption at rest. We never sell, monetize, or disclose your clinical consultations or identity to third-party advertisers.

MEDICAL DISCLAIMER:
HealPoint facilitates scheduling, consultations, and digital records management between patients and licensed healthcare professionals. HealPoint does not provide automated diagnostic determinations. For acute life-threatening medical emergencies, please contact your local emergency response service (112 / 108 in India) immediately.
```

---

## 2. Store Assets & Visual Specification

| Asset | Dimension | Format | Status | Location / Artifact |
|---|---|---|---|---|
| **App Icon** | 512 × 512 px | PNG (32-bit, No Alpha) | **READY** | Official 3D HealPoint Logo (`assets/images/icon.png`) |
| **Adaptive Foreground** | 432 × 432 px | PNG | **READY** | `assets/images/android-icon-foreground.png` |
| **Adaptive Background** | 432 × 432 px | Solid Color (`#0E9F8E`) | **READY** | `#0E9F8E` (Royal Blue/Teal Accent) |
| **Feature Graphic** | 1024 × 500 px | PNG / JPEG (No Alpha) | **READY** | `assets/images/feature-graphic.png` |
| **Phone Screenshots** | 1080 × 2400 px (Min 4) | PNG / JPEG | **READY** | `assets/screenshots/` (Home, Booking, Wallet, Video) |
| **Splash Screen** | 1284 × 2778 px | PNG | **READY** | `assets/images/splash-icon.png` |

---

## 3. Google Play Data Safety Declarations

### A. Data Collected & Shared
1. **Personal Information**:
   - *Name, Email Address, Phone Number, Date of Birth*: Used for patient identification, appointment confirmations, and account authentication.
2. **Health Information**:
   - *Medical Records, Digital Prescriptions, Symptoms, Allergies, Chronic Conditions*: Used strictly for doctor-patient consultation and clinical care continuity.
3. **Location Data**:
   - *Approximate and Precise GPS Location*: Used strictly during Emergency SOS requests to pinpoint patient location for hospital ambulance dispatch. Never tracked in background.
4. **Financial Information**:
   - *Transaction ID, Amount, Payment Method*: Processed securely through Razorpay PCI-DSS certified gateway. HealPoint never stores raw credit card numbers or bank CVVs.
5. **Photos & Videos**:
   - *Profile Picture, Camera/Microphone stream*: Used solely for avatar upload and live WebRTC video consultations.

### B. Security Practices
- **Data Encrypted in Transit**: All communication uses HTTPS / TLS 1.3 with secure cookies and Bearer tokens.
- **Data Deletion Request**: Patients can request complete account and record erasure via in-app Settings or by writing to `support@healpoint.app`.

---

## 4. Android Build & Package Configurations

```json
{
  "package": "com.healpoint.app",
  "version": "1.0.0",
  "versionCode": 1,
  "minSdkVersion": 24,
  "targetSdkVersion": 34,
  "compileSdkVersion": 34
}
```

### Declared Android Permissions:
1. `android.permission.INTERNET`: Connect to HealPoint cloud API and WebRTC signaling.
2. `android.permission.CAMERA`: Live video consultations with verified doctors.
3. `android.permission.RECORD_AUDIO`: Voice audio communication during telehealth sessions.
4. `android.permission.MODIFY_AUDIO_SETTINGS`: Optimize speakerphone and headset audio routing during consultations.
5. `android.permission.ACCESS_FINE_LOCATION`: Accurate GPS dispatch during Emergency SOS.
6. `android.permission.ACCESS_COARSE_LOCATION`: Nearby hospital discovery and regional triage.

---

## 5. Production URLs & Regulatory Links

- **Production API Endpoint**: `https://heal-point-backend.vercel.app/api/v1`
- **Patient Web Portal**: `https://heal-point-mauve.vercel.app`
- **Doctor Web Portal**: `https://heal-point-doctor-web.vercel.app`
- **Hospital Admin Portal**: `https://heal-point-hospital-admin.vercel.app`
- **Super Admin Portal**: `https://heal-point-super-admin.vercel.app`
- **Privacy Policy**: `https://heal-point-mauve.vercel.app/privacy`
- **Terms of Service**: `https://heal-point-mauve.vercel.app/terms`
- **Developer / Support Contact**: `support@healpoint.app` / `+91 98100 00000`

