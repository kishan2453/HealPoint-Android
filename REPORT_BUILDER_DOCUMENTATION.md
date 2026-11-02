# HealPoint – Advanced Report Builder Documentation (Part 19)

## 1. Overview
The Advanced Report Builder allows hospital administrators to run flexible operational reports, preview aggregated datasets with summary metrics, and export to CSV.

## 2. Report Modules
1. **Appointments Master**: Complete appointment records, statuses, patient names, departments, and amounts.
2. **Revenue & Collected Billing**: Verified revenue, transaction identifiers, payment methods, and average ticket size.
3. **Cancellations & Missed Pacing**: Cancellation reasons, dates, and non-attendance statistics.
4. **Waitlist Conversion**: Waitlisted patient records, priority rankings, and slot conversion rates.

## 3. Date Presets & Formats
- Presets: `today`, `last_7_days`, `last_30_days`, `this_month`, `custom`.
- Formats: JSON for live dashboard preview, CSV for downloadable spreadsheets.

## 4. API Endpoints
- `POST /api/v1/report-builder/generate`: Run report (accepts `format: "json"` or `format: "csv"`).
- `GET /api/v1/report-builder/configs`: Fetch saved report configurations.
- `POST /api/v1/report-builder/configs`: Save custom report configuration.
