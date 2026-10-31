# HealPoint 2.0 — Changelog

All notable changes across HealPoint 2.0 development phases are documented in this file.

---

## [Phase 4: Advanced Health Wallet Enhancements] - 2026-10-31

### Branch: `phase-4-health-wallet`
### Feature Flag: `FEATURE_HEALTH_WALLET` (Default: `false`)

### Added
- **Unified Health Document Architecture** (`HealPointBackend/models/healthDocumentModel.js`):
  - Additive fields: `hospitalId`, `hospitalName`, `doctorId`, `doctorName`, `appointmentId`, `fileUrl`, `fileName`, `fileSize`, `tags`, `isArchived`, `processingStatus`, `confidence`, `extractedMetadata`, `userCorrections`, `doctorSummary`.
  - 8 Standard healthcare categories: Prescriptions, Lab Reports, Diagnostic Reports, Consultation History, Medical Documents, Billing Receipts, Appointment Records, Other (retaining full backward compatibility with legacy categories).
  - Multi-tenant compound indexes on `{ userId: 1, category: 1, createdAt: -1 }`, `{ userId: 1, familyMemberId: 1, createdAt: -1 }`, and `{ userId: 1, isArchived: 1 }`.
- **Enhanced Document Controller & REST Endpoints** (`HealPointBackend/controllers/healthDocumentController.js`, `routes/healthDocumentRoutes.js`):
  - File upload validation with strict MIME type whitelist (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`) and 10MB size ceiling.
  - Multi-tenant patient isolation and family dependent authorization checking (`verifyFamilyMemberOwnership`).
  - Search across titles, doctor names, facility names, notes, and tags with pagination (`page`, `limit`).
  - Date-range query filtering (`startDate`, `endDate`).
  - Chronological timeline grouping endpoint (`GET /api/v1/document/timeline`).
  - Category statistics endpoint (`GET /api/v1/document/stats`).
  - Secure in-app viewing and streaming download (`GET /api/v1/document/:id/view`).
  - Doctor access sharing and revocation (`POST /api/v1/document/:id/share`, `DELETE /api/v1/document/:id/share/:doctorId`).
  - Human-in-the-loop metadata verification with audit stamp (`PATCH /api/v1/document/:id/metadata`).
- **Unified Appointment & Document Wallet Integration** (`HealPointBackend/controllers/appointmentController.js`):
  - Enhanced `getHealthWallet` endpoint to seamlessly aggregate appointment records AND patient-uploaded digital health documents in a unified vault.
  - Added support for `startDate`, `endDate`, and sort options (`newest`, `oldest`).
- **Upgraded Digital Health Wallet Screen** (`app/(drawer)/health-wallet.tsx`, `services/health-documents.ts`, `services/wallet.ts`):
  - View mode switcher: "Cards View" vs "Chronological Timeline View".
  - Chronological timeline node visualization with vertical connector, status dots, date badges, and 1-click preview.
  - Date range filter chips: "All Time", "30 Days", "6 Months", "1 Year".
  - In-app secure medical document viewer modal for image and PDF preview.
  - Upload modal upgraded with 8 standard categories, validation, and progress indicators.
  - Metrics cards with real counts for Prescriptions, Lab Reports, Bills, Consultations, EMR Records, Passes, and Total.
  - Official HealPoint design tokens (Royal Blue `#2563EB`, Sky Blue `#60A5FA`, Light Gray `#F8FAFC`, Dark Navy `#0F172A`).
- **Automated Backend Test Suite** (`HealPointBackend/tests/healthWallet.test.js`):
  - 18 unit tests covering upload validation, MIME whitelisting, size limits, category normalization, multi-tenant & family isolation, chronological sorting, date range filtering, and feature flag behavior.

### Preserved
- All Phase 1 Live Queue, Phase 2 Video Consultation, and Phase 3 AI Health Assistant functionality.
- Existing Razorpay payments, billing receipts, and QR check-in functionality.
- Existing patient, doctor, hospital admin, and super admin authentication.

---

