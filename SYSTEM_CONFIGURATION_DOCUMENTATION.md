# HealPoint – System Configuration Center Documentation (Part 19)

## 1. Overview
The System Configuration Center is a Super Admin centralized control panel for managing platform settings, appointment policies, feature flags, and simulation safety locks.

## 2. Configuration Domains
1. **Simulation Safety**:
   - `enableRealSOS`: Strictly `false` (LOCKED).
   - `enableExternalEmergencyDispatch`: Strictly `false` (LOCKED).
   - `enableRealPaymentGateways`: Strictly `false` (LOCKED).
   - `enforceStrictIsolation`: `true`.
2. **Appointment Policies**:
   - `maxAdvanceBookingDays`: 90 days.
   - `minCancellationNoticeHours`: 2 hours.
   - `maxRescheduleCount`: 3 attempts.
   - `slotBufferMinutes`: 5 minutes.
3. **Portal Feature Flags**:
   - `enableWorkflows`, `enableTaskManagement`, `enableAiAssistant`, `enableReportBuilder`, `enableDigitalQueue`, `enableStaffRoster`, `enableWaitlist`.
4. **Workflow Defaults**:
   - `maxRecursionDepth`: 3.
   - `defaultMaxRetries`: 3.

## 3. Mandatory Safety Guardrails
Server-side logic actively intercepts any attempt to set `enableRealSOS` or `enableRealPaymentGateways` to `true`, returning HTTP 403 Forbidden with:
> "Safety Violation: Real SOS, emergency dispatch, and live payment processing are strictly forbidden on this platform."

## 4. API Endpoints
- `GET /api/v1/system-config`: List system configs.
- `PUT /api/v1/system-config/:configKey`: Update policy configuration with audit reason.
