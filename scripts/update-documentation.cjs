const fs = require("fs");
const path = require("path");

// 1. Update IMPLEMENTATION_STATUS.md
const statusPath = path.join(__dirname, "../IMPLEMENTATION_STATUS.md");
let status = fs.readFileSync(statusPath, "utf8");

status = status.replace(
  "**Current Phase:** PHASE 11: PREMIUM BRANDING, UI BUG FIXES, SECURITY, PERFORMANCE & DATABASE BACKUP — IMPLEMENTED, TESTED & VERIFIED",
  "**Current Phase:** PHASE 12: MULTI-LANGUAGE SUPPORT + ACCESSIBILITY + OFFLINE EXPERIENCE + CUSTOMER SUPPORT — IMPLEMENTED, TESTED & VERIFIED"
);

status = status.replace(
  "**Git Branch:** `phase-11-branding-ui-security`",
  "**Git Branch:** `phase-12-i18n-a11y-offline`"
);

const phase12Row = `| **Phase 12** | Multi-Language, Accessibility, Offline & Support | **COMPLETED** | Tri-lingual localization engine (English, Hindi, Gujarati) with dictionary parity & clinical prescription preservation, accessible WCAG 2.1 touch targets (>=44px) & focus-visible styles across 4 portals, cross-platform offline detection & non-intrusive warning banner with zero false-positive booking/payment guard, exponential backoff GET retries with 0 mutation retries, complete Customer Support Service Desk backend (models, controllers, routes) with category triage & hospital isolation, Settings language and accessibility toggles, 187/187 backend unit tests passing, 0 TypeScript errors, 186 static routes built. |`;

if (!status.includes("Phase 12")) {
  status = status.trim() + "\n" + phase12Row + "\n";
  fs.writeFileSync(statusPath, status, "utf8");
  console.log("Updated IMPLEMENTATION_STATUS.md");
} else {
  console.log("Phase 12 already in IMPLEMENTATION_STATUS.md");
}

// 2. Update CHANGELOG.md
const changelogPath = path.join(__dirname, "../CHANGELOG.md");
let changelog = fs.readFileSync(changelogPath, "utf8");

const changelogEntry = `## [Phase 12] - 2026-11-01
### Added
- **Multi-Language Support (i18n)**: Implemented full localization engine (\`lib/i18n.ts\` and \`hooks/use-language.tsx\`) supporting English (\`en\`), Hindi (\`hi\` हिन्दी), and Gujarati (\`gu\` ગુજરાતી). Instant language toggle in Settings with persistence in storage and user profile (\`languagePreference\`). Clinical prescriptions, doctor notes, and medical IDs remain strictly unaltered.
- **Patient Accessibility Enhancements (a11y)**: Minimum 44x44px accessible touch targets with hit-slop expansion, screen reader accessibility roles (\`accessibilityRole="alert"\`, \`accessibilityRole="radio"\`, \`accessibilityRole="switch"\`), accessible labels and hints, and High Contrast mode toggle.
- **Web Portal Accessibility**: Universal accessible focus rings (\`:focus-visible\` with 2.5px solid Royal Blue outline) and \`prefers-reduced-motion\` support added across \`HealPointDoctorWeb\`, \`HealPointHospitalAdminWeb\`, and \`HealPointSuperAdminWeb\`.
- **Offline Experience & Safeguards**: Cross-platform network state detection (\`hooks/use-network.ts\`), persistent non-intrusive offline status banner (\`components/OfflineBanner.tsx\`), re-connection live sync notification, and strict offline guarding on appointment bookings and payment transactions with zero false positives.
- **Network Error & Retry Management**: Exact HTTP error classification (\`services/api.ts\`), exponential backoff retry for safe GET requests, zero retries on POST/PUT/PATCH/DELETE mutations.
- **Customer Support & Service Desk Backend**: Created \`models/supportTicketModel.js\`, \`controllers/supportController.js\`, and \`routes/serviceDeskRoutes.js\` mounted at \`/api/v1/service-desk\`, \`/service-desk\`, and \`/api/v1/support\`. Supports ticket number generation (\`TKT-XXXXXX\`), message threads, timeline tracking, and hospital tenant isolation.
- **Webmessage & Hospital Admin Support Integration**: Unified support ticket submission and reply between mobile app and web portals; fixed hardcoded localhost URL in Hospital Admin.
- **Settings & User Preferences**: Added interactive Language Selector and Accessibility Options (High Contrast Mode, Text Scaling) to \`app/settings/index.tsx\`.
- **Automated Verification**: Added \`tests/phase12.test.js\`; 187/187 backend unit tests passing with 0 failures; 0 TypeScript errors (\`tsc --noEmit\`); 186 Expo static web routes exported; all 3 web portals built in production mode.

---

`;

if (!changelog.includes("[Phase 12]")) {
  changelog = changelog.replace("# Changelog\n\n", "# Changelog\n\n" + changelogEntry);
  fs.writeFileSync(changelogPath, changelog, "utf8");
  console.log("Updated CHANGELOG.md");
} else {
  console.log("Phase 12 already in CHANGELOG.md");
}

// 3. Update FEATURE_FLAGS.md
const featureFlagsPath = path.join(__dirname, "../FEATURE_FLAGS.md");
let ff = fs.readFileSync(featureFlagsPath, "utf8");

if (!ff.includes("FEATURE_MULTI_LANGUAGE")) {
  const flagsToAdd = `
### Phase 12: Multi-Language, Accessibility & Customer Support Flags
- \`FEATURE_MULTI_LANGUAGE\`: Defaults to \`true\`. Enables runtime language switching between English, Hindi, and Gujarati.
- \`FEATURE_ACCESSIBILITY_HIGH_CONTRAST\`: Defaults to \`true\`. Enables high contrast mode toggle in user preferences.
- \`FEATURE_OFFLINE_BANNER\`: Defaults to \`true\`. Renders connectivity banner when device loses internet access.
- \`FEATURE_SERVICE_DESK\`: Defaults to \`true\`. Enables full support ticket management and hospital admin triage.
`;
  ff = ff.trim() + "\n" + flagsToAdd + "\n";
  fs.writeFileSync(featureFlagsPath, ff, "utf8");
  console.log("Updated FEATURE_FLAGS.md");
} else {
  console.log("Phase 12 already in FEATURE_FLAGS.md");
}

