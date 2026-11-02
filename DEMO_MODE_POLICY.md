# HealPoint — Standalone Demo Mode Policy & Ethical Guidelines

## 1. Core Principle & Purpose
**HealPoint is strictly an educational college demonstration, developer portfolio, and technological prototype.** It does not operate as an actual hospital, healthcare provider, ambulance dispatch, medical clinic, or real-time emergency response service.

Under no circumstances should HealPoint be connected to real-world healthcare entities, hospital management systems (HMS), government emergency dispatch centers (e.g. 112 / 108), or live patient registries.

---

## 2. Standalone Simulation Guarantees

### A. SOS & Emergency Operations
- **Simulation Only:** All SOS triggers are strictly simulated internally.
- **Zero Real-World Contact:** Absolutely no external calls, SMS, WhatsApp messages, emails, or emergency broadcast messages are dispatched to real hospitals, ambulances, police, or emergency response agencies.
- **Prominent Disclaimers:** Every emergency view displays:
  > *"DEMO MODE: This is a simulated emergency request. No real hospital, ambulance or emergency service has been contacted."*
- **Telephone / Dialing Restriction:** Interactive telephone links (`tel:`) to real emergency services (112 / 108) are disabled in the app and replaced with an educational simulation warning modal.

### B. Location & GPS Privacy
- **Static Anonymized Coordinates:** Device hardware GPS coordinates are never transmitted to external servers or third-party mapping APIs.
- **Fictional Landmarks:** All location displays in the demo use static, simulated coordinates (e.g., Ahmedabad Demo Healthcare Hub).

### C. Healthcare Entity & Identity Anonymization
- **Fictional Hospitals:** All hospitals are designated as fictional institutions (e.g., *HealPoint Demo Hospital 01*). No real hospital trademarks, phone numbers, or physical clinical desks are referenced.
- **Synthetic Personnel Data:** All doctor and patient profiles use synthetic, non-routable placeholder emails (`@demo.healpoint.example.com`) and dummy contact numbers (`+91 00000 XXXXX`).
- **Demo Flags:** All database records carry `isDemo: true` to prevent any unintended processing by external or production workflows.

### D. Financial Transactions & Payments
- **Zero Real Charges:** All payment interactions run in simulated sandbox mode or offline simulated transaction mode.
- **Explicit Labeling:** Every checkout or billing modal displays:
  > *"DEMO TRANSACTION – No real money is charged."*

---

## 3. Server-Side Enforcement (Fail-Closed)
Server-side business logic strictly respects the following feature flags:
- `DEMO_MODE=true`
- `SOS_SIMULATION_ONLY=true`
- `REAL_EMERGENCY_SERVICES_ENABLED=false`
- `EXTERNAL_SOS_NOTIFICATIONS_ENABLED=false`
- `SOS_LOCATION_SHARING_ENABLED=false`
- `LIVE_PAYMENTS_ENABLED=false`

If any request attempts to bypass these constraints, the backend rejects it or clamps it into simulated demo mode automatically.
