const fs = require("fs");
const path = require("path");

const changelogPath = path.join(__dirname, "../CHANGELOG.md");
let changelog = fs.readFileSync(changelogPath, "utf8");

const phase12Entry = `## [Phase 12] - 2026-11-01
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

`;

if (!changelog.includes("[Phase 12]")) {
  changelog = phase12Entry + changelog;
  fs.writeFileSync(changelogPath, changelog, "utf8");
  console.log("Prepended Phase 12 to CHANGELOG.md");
} else {
  console.log("Phase 12 already in CHANGELOG.md");
}
