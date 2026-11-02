# HealPoint Deployment Notes – Part 18
**Production Deployment & Verification Runbook**

---

## 1. Deployed Services
1. **Backend API Service**:
   - URL: `https://heal-point-backend.vercel.app`
   - Healthcheck: `https://heal-point-backend.vercel.app/api/v1/health`
2. **Patient Web / Mobile App**:
   - URL: `https://heal-point-mauve.vercel.app`
3. **Doctor Portal**:
   - URL: `https://heal-point-doctor-web.vercel.app`
4. **Hospital Admin Portal**:
   - URL: `https://heal-point-hospital-admin.vercel.app`
5. **Super Admin Portal**:
   - URL: `https://heal-point-super-admin.vercel.app`

---

## 2. Deployment Steps
All frontends compile cleanly into static assets using their respective production build scripts:
- Root Patient App: `npm run build` $\to$ `dist/`
- Doctor Portal: `cd HealPointDoctorWeb && npm run build` $\to$ `dist/`
- Hospital Admin: `cd HealPointHospitalAdminWeb && npm run build` $\to$ `dist/`
- Super Admin: `cd HealPointSuperAdminWeb && npm run build` $\to$ `dist/`
- Backend: Vercel serverless functions powered by `HealPointBackend/app.js`

---

## 3. Post-Deployment Verification Gate
- [x] Backend responds HTTP `200 OK` on `/api/v1/health`.
- [x] All 239 unit & integration tests pass with 0 failures.
- [x] TypeScript compilation passes with 0 errors.
- [x] Patient Web loads without runtime errors.
- [x] Doctor Portal loads and renders queue and capacity settings.
- [x] Hospital Admin Portal renders Resource & Capacity and Staff Roster management.
- [x] Super Admin Portal renders Hospital SaaS plans and Global Resource analytics.
