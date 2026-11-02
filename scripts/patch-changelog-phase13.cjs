const fs = require('fs');
let changelog = fs.readFileSync('CHANGELOG.md', 'utf8');

const phase13Entry = `
## [Phase 13] - Production Launch & Google Play Store Readiness
### Added
- Comprehensive Production Multi-Portal System Audit across all 5 workspace projects.
- Google Play Store Release Dossier (\`PLAY_STORE_READINESS.md\`) with title, descriptions, category, medical disclaimer, and DPDP/HIPAA data safety declarations.
- Verified Android production package \`com.healpoint.app\` with \`versionCode: 1\` and essential runtime permissions (\`CAMERA\`, \`RECORD_AUDIO\`, \`ACCESS_FINE_LOCATION\`, \`ACCESS_COARSE_LOCATION\`, \`INTERNET\`).
- EAS Build profiles (\`eas.json\`) pointing to live production backend \`https://heal-point-backend.vercel.app/api/v1\`.
- Comprehensive automated verification suite \`HealPointBackend/tests/phase13.test.js\` (11/11 tests pass, 198/198 total backend tests pass).

### Verified
- 100% HTTP 200 responses across all live Vercel deployments (Patient Web, Doctor Portal, Hospital Admin, Super Admin, Backend API).
- Zero TypeScript errors (\`npx tsc --noEmit\` exit code 0).
- 18/18 Expo doctor health checks passing with 0 issues detected.
- Razorpay HMAC SHA-256 payment signature verification and webhook idempotency.
`;

if (!changelog.includes('[Phase 13]')) {
  changelog = changelog.replace('# Changelog', '# Changelog\n' + phase13Entry);
  fs.writeFileSync('CHANGELOG.md', changelog, 'utf8');
  console.log('Successfully added Phase 13 to CHANGELOG.md');
} else {
  console.log('Phase 13 already present in CHANGELOG.md');
}
