# HealPoint 2.0 — Feature Flags Configuration Matrix

All new features sit behind feature flags that default to `false` (OFF) until verified in each phase.
Flags can be configured via environment variables or database hospital settings.

---

## Central Feature Flags Reference

| Flag Name | Default | Phase | Description |
|---|---|---|---|
| `FEATURE_LIVE_QUEUE` | `false` | Phase 1 | Real-time queue tokens, live wait-time recalculation, and doctor queue actions. |
| `FEATURE_ADVANCED_VIDEO` | `false` | Phase 2 | WebRTC in-app video consultation with tokenized waiting room. |
| `FEATURE_GEMINI_AI` | `false` | Phase 3 | Gemini Gen AI healthcare assistant with clinical guardrails and 112 escalation. |
| `FEATURE_HEALTH_WALLET` | `false` | Phase 4 | Extended digital health wallet with time-limited doctor sharing and signed URLs. |
| `FEATURE_DIGITAL_PRESCRIPTION`| `false` | Phase 5 | Digital prescription generation and medicine schedule reminders. |
| `FEATURE_ADVANCED_ANALYTICS` | `false` | Phase 6 | Aggregated revenue and doctor performance analytics pipelines. |
| `FEATURE_EMERGENCY_SOS` | `false` | Phase 7 | 112 emergency calling and permitted GPS coordinate sharing. |
| `FEATURE_VERIFIED_REVIEWS` | `false` | Phase 8 | Verified post-consultation doctor reviews and anti-duplicate check. |
| `FEATURE_MULTILINGUAL` | `false` | Phase 9 | Hindi and Gujarati language support across portals. |
| `FEATURE_SMART_NOTIFICATIONS` | `false` | Phase 10 | Persistent queue notification dispatcher with channel preferences. |
| `FEATURE_FAMILY_PROFILES` | `false` | Phase 11 | Separate health wallets and bookings for dependent family members. |
| `FEATURE_HOSPITAL_SUBSCRIPTIONS`| `false` | Phase 12 | Tiered subscription limits (Basic, Pro, Enterprise) for hospital tenants. |
| `FEATURE_SMART_WAITLIST` | `false` | Phase 13 | Automated cancellation waitlist notifications and atomic slot claim. |
| `FEATURE_DPDP_COMPLIANCE` | `false` | Phase 14 | Consent management, medical audit trail, and patient data export. |
| `FEATURE_LAB_TESTS` | `false` | Phase 15 | Hospital lab test booking and automated report ingestion. |
| `FEATURE_ABHA_INTEGRATION` | `false` | Phase 15 | Ayushman Bharat Health Account integration (only when official keys exist). |
| `FEATURE_DARK_MODE` | `false` | Phase 16 | Royal-blue consistent dark theme toggle. |

