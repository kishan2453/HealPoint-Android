# HealPoint – Configurable Business Rule Engine Documentation (Part 19)

## 1. Overview
A server-side policy enforcement engine that enables authorized hospital administrators to configure operational parameters with version history and instant rollback.

## 2. Core Policies Managed
1. **Cancellation Policy** (`CANCELLATION_MIN_HOURS`): Enforces minimum advance notice required for appointment cancellation.
2. **Rescheduling Policy** (`RESCHEDULE_MAX_LIMIT`): Limits maximum reschedule attempts allowed per booking.
3. **Booking Limits** (`MAX_ADVANCE_BOOKING_DAYS`): Configures advance booking window (e.g. 90 days).
4. **Queue Rules** (`QUEUE_GRACE_PERIOD_MINS`): Token grace period before absent patients are marked as no-show.
5. **Staff Scheduling** (`MAX_CONSECUTIVE_SHIFTS`): Maximum consecutive shifts before mandatory rest.

## 3. Versioning & Rollback Architecture
- Every parameter change creates an immutable snapshot in `history` with previous values, timestamp, and reason.
- Admins can instantly rollback to any prior version.

## 4. API Endpoints
- `GET /api/v1/business-rules`: List hospital rules (seeds defaults if none present).
- `PUT /api/v1/business-rules/:id`: Update configuration values with audit reason.
- `PATCH /api/v1/business-rules/:id/toggle`: Toggle active/inactive state.
- `POST /api/v1/business-rules/:id/rollback`: Roll back to specified historical version.
