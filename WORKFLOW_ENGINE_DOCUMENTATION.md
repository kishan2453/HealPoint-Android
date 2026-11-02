# HealPoint – Centralized Workflow Automation Engine Documentation (Part 19)

## 1. Overview
The Centralized Workflow Automation Engine provides an event-driven framework for hospitals to automate routine operations, staff assignments, status transitions, and internal notifications with zero external dependencies.

## 2. Core Architecture
- **Trigger Listeners**: Monitors events (`appointment_booked`, `appointment_cancelled`, `doctor_approved`, `support_ticket_created`, `leave_approved`, `subscription_expiry_warning`, `task_overdue`, `resource_maintenance_due`).
- **Condition Evaluator**: Evaluates criteria (`equals`, `not_equals`, `contains`, `greater_than`, `less_than`, `in`) with dynamic variable interpolation.
- **Action Executors**:
  - `internal_notification`: Dispatches internal notifications to the alert center.
  - `create_task`: Creates an assigned task in the departmental queue.
  - `update_status`: Updates status flags for rooms/beds/appointments.
  - `send_reminder`: Logs internal staff reminders.
- **Recursion & Loop Guards**: Enforces maximum stack depth of 3 and idempotency token deduplication.
- **Audit & History**: Every run creates a `WorkflowExecution` record with duration, step outcomes, and error logs.

## 3. Supported MongoDB Models
- `Workflow` (`models/workflowModel.js`): Schema for trigger configuration, conditions, actions, and retry policies.
- `WorkflowExecution` (`models/workflowExecutionModel.js`): Historical logs of step executions, execution times, and status.

## 4. API Endpoints
- `GET /api/v1/workflows`: List hospital workflows.
- `POST /api/v1/workflows`: Create workflow rule.
- `PUT /api/v1/workflows/:id`: Update workflow parameters.
- `PATCH /api/v1/workflows/:id/toggle`: Toggle active/inactive state.
- `DELETE /api/v1/workflows/:id`: Delete workflow.
- `GET /api/v1/workflows/executions`: View execution history and error logs.
- `POST /api/v1/workflows/test-trigger`: Manually simulate a trigger event.
