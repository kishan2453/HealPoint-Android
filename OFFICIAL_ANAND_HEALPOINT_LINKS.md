# Official Anand HealPoint — Link Management & Infrastructure Matrix

**Project:** Anand HealPoint (Healthcare Appointment System – Educational Simulation Project)  
**Date:** November 2, 2026  
**Status:** All 5 Production Services Live & Verified (100% HTTP 200 OK)

---

## 1. Verified Live Production URLs (Active & Operating)

These URLs are fully deployed, verified with live HTTP probes, and currently powering the Anand HealPoint ecosystem:

| Portal / Service | Current Verified Production URL | HTTP Status | SSL / Protocol | Purpose |
|---|---|---|---|---|
| **Patient Mobile Web** | `https://heal-point-mauve.vercel.app` | **200 OK** | TLS 1.3 / HTTPS | Flagship Patient Portal: Doctor search, appointment booking, Health Wallet, Prescriptions, Follow-ups, Support. |
| **Doctor Portal Web** | `https://heal-point-doctor-web.vercel.app` | **200 OK** | TLS 1.3 / HTTPS | Licensed practitioner dashboard, consultation queues, appointment management, patient history. |
| **Hospital Admin Web** | `https://heal-point-hospital-admin.vercel.app` | **200 OK** | TLS 1.3 / HTTPS | Hospital administrator management, department scheduling, doctor verifications, patient triage. |
| **Super Admin Web** | `https://heal-point-super-admin.vercel.app` | **200 OK** | TLS 1.3 / HTTPS | Platform executive oversight, system metrics, audit logs, backup management, global configuration. |
| **Backend REST API** | `https://heal-point-backend.vercel.app/api/v1` | **200 OK** | TLS 1.3 / HTTPS | Central Express + MongoDB API engine, JWT authentication, and isolated simulation sandbox. |
| **Backend Health Probe**| `https://heal-point-backend.vercel.app/api/v1/health` | **200 OK** | TLS 1.3 / HTTPS | Real-time system heartbeat & simulation isolation status. |

---

## 2. Proposed Custom Domain Architecture (`anandhealpoint.com`)

*Domain Status Check:* DNS probe for `anandhealpoint.com` returned `ENOTFOUND` (Available for registration; awaiting user authorization).

| Target Hostname | Purpose / Route | Recommended Vercel CNAME Target | Status |
|---|---|---|---|
| `www.anandhealpoint.com` | Official Project Landing & Web App | `cname.vercel-dns.com` | Pending Domain Purchase Approval |
| `patient.anandhealpoint.com` | Patient Portal (Expo Web SPA) | `cname.vercel-dns.com` | Pending Domain Purchase Approval |
| `doctor.anandhealpoint.com` | Doctor Web Portal (Vite React) | `cname.vercel-dns.com` | Pending Domain Purchase Approval |
| `hospital.anandhealpoint.com` | Hospital Admin Web Portal (Vite React) | `cname.vercel-dns.com` | Pending Domain Purchase Approval |
| `admin.anandhealpoint.com` | Super Admin Web Portal (Vite React) | `cname.vercel-dns.com` | Pending Domain Purchase Approval |
| `api.anandhealpoint.com` | Backend REST API (`/api/v1`) | `cname.vercel-dns.com` | Pending Domain Purchase Approval |

---

## 3. Legal, Support & Public Resource Links

| Resource | Live Production Path | Proposed Custom Domain Path |
|---|---|---|
| **Privacy Policy** | `https://heal-point-mauve.vercel.app/privacy` | `https://www.anandhealpoint.com/privacy` |
| **Terms & Conditions** | `https://heal-point-mauve.vercel.app/terms` | `https://www.anandhealpoint.com/terms` |
| **Help & Support** | `https://heal-point-mauve.vercel.app/support` | `https://www.anandhealpoint.com/support` |
| **XML Sitemap** | `https://heal-point-mauve.vercel.app/sitemap.xml` | `https://www.anandhealpoint.com/sitemap.xml` |
| **Robots.txt** | `https://heal-point-mauve.vercel.app/robots.txt` | `https://www.anandhealpoint.com/robots.txt` |

---

## 4. Android Native Application Distribution

- **Android Package Identifier:** `com.healpoint.app` (Strictly preserved)
- **EAS Build Profile:** `preview` (Generates standalone APK for student testing & evaluation)
- **Google Play Store Policy:** In accordance with user rules, **NO build has been published to the Google Play Store**. The app remains in release-ready simulation mode for portfolio demonstration.

---

## 5. Security & Isolation Safeguards
1. **Zero Secret API Exposure**: Production environment variables (`JWT_SECRET`, `MONGO_URI`, `RAZORPAY_KEY_SECRET`) remain encrypted on Vercel Secret store and are never leaked in client bundles.
2. **Backward Compatibility**: All existing Vercel deployment URLs remain permanently functional with automatic HTTPS redirects.
3. **Simulation Boundaries**: Healthcare records, Emergency Practice dispatches, and payments remain strictly contained within the Anand HealPoint sandbox.
