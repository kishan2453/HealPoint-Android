# HealPoint Deployment Notes – Part 19

## Build & Deployment Verification
- **Patient Web App (`HealPointMobile`)**:
  - `npx expo export -p web`: 186 static routes bundled.
  - Full interactive calendar date picker integrated alongside 7-day cards.
  - Header duplicate title fixed.
- **Doctor Web (`HealPointDoctorWeb`)**:
  - `npm run build`: Vite build completed in 4.60s.
  - `DoctorTasksView` mounted under `/tasks`.
- **Hospital Admin (`HealPointHospitalAdminWeb`)**:
  - `npm run build`: Vite build completed in 6.67s.
  - 9 new operational dashboards mounted under "Intelligent Operations".
- **Super Admin (`HealPointSuperAdminWeb`)**:
  - `npm run build`: Vite build completed in 5.60s.
  - `SystemConfiguration` mounted under `/system-configuration`.
- **Backend API (`HealPointBackend`)**:
  - 10 new REST controllers & route modules mounted under `/api/v1`.
  - 248 unit/integration tests passing.
  - Live health check returns HTTP 200 OK.
