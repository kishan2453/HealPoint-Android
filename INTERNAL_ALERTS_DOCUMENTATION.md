# HealPoint – Smart Alert & Notification Center Documentation (Part 19)

## 1. Overview
The Smart Alert Center streams real-time operational notifications, threshold warnings, and scheduling conflicts to hospital administrators and clinical staff. All alerts are internal to the platform, with zero external emergency service calls.

## 2. Alert Severities & Categories
- **Severities**: `critical`, `high`, `warning`, `info`.
- **Categories**: `scheduling`, `operations`, `staff`, `billing`, `resource`, `support`, `system`.
- **Sources**: `workflow_engine`, `rule_engine`, `system_monitor`, `manual`.

## 3. Operations & Resolution
- Mark individual alert as read or mark all alerts as read.
- Resolve alerts with documented operational actions taken.
- Broadcast manual notices across departmental leads.

## 4. API Endpoints
- `GET /api/v1/internal-alerts`: List alerts with severity, category, and resolution filters.
- `POST /api/v1/internal-alerts`: Broadcast manual alert notice.
- `PATCH /api/v1/internal-alerts/:id/read`: Mark alert as read.
- `POST /api/v1/internal-alerts/mark-all-read`: Mark all alerts as read.
- `PATCH /api/v1/internal-alerts/:id/resolve`: Resolve alert with resolution summary.
