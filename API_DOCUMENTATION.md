# HealPoint API Documentation – Part 19 Update

## Part 19: AI-Powered Hospital Operations & Workflow Automation

### 1. Workflows Automation (`/api/v1/workflows`)
- `GET /api/v1/workflows`: List workflows.
- `POST /api/v1/workflows`: Create workflow.
- `PUT /api/v1/workflows/:id`: Update workflow.
- `PATCH /api/v1/workflows/:id/toggle`: Toggle active/inactive.
- `DELETE /api/v1/workflows/:id`: Delete workflow.
- `GET /api/v1/workflows/executions`: Execution audit log.
- `POST /api/v1/workflows/test-trigger`: Manually simulate a trigger event.

### 2. Task Management (`/api/v1/tasks`)
- `GET /api/v1/tasks`: Filter tasks by status, priority, department, overdue.
- `POST /api/v1/tasks`: Create new task.
- `PATCH /api/v1/tasks/:id/status`: Update status (`New` | `Assigned` | `In Progress` | `Under Review` | `Completed` | `Cancelled`).
- `PATCH /api/v1/tasks/:id/assign`: Reassign task.
- `POST /api/v1/tasks/:id/comments`: Add comment.
- `GET /api/v1/tasks/analytics/workload`: Department workload statistics.

### 3. AI Administrative Assistant (`/api/v1/ai-assistant`)
- `POST /api/v1/ai-assistant/query`: Analyzes natural language operational questions over live MongoDB collections with non-clinical disclaimers.

### 4. Configurable Business Rules (`/api/v1/business-rules`)
- `GET /api/v1/business-rules`: Fetch business rules (seeds defaults if empty).
- `PUT /api/v1/business-rules/:id`: Update parameters and increment version.
- `PATCH /api/v1/business-rules/:id/toggle`: Toggle active status.
- `POST /api/v1/business-rules/:id/rollback`: Roll back to specified historical version.

### 5. Advanced Support & Complaints (`/api/v1/advanced-support`)
- `GET /api/v1/advanced-support/dashboard`: Support workload statistics and resolution metrics.
- `PATCH /api/v1/advanced-support/:id/assign`: Assign support team and agent.
- `PATCH /api/v1/advanced-support/:id/escalate`: Escalate ticket.
- `POST /api/v1/advanced-support/:id/internal-notes`: Add private internal note.
- `PATCH /api/v1/advanced-support/:id/reopen`: Reopen resolved ticket.

### 6. Report Builder (`/api/v1/report-builder`)
- `POST /api/v1/report-builder/generate`: Generate JSON or CSV operational report.
- `GET /api/v1/report-builder/configs`: View saved report configurations.
- `POST /api/v1/report-builder/configs`: Save custom report configuration.

### 7. Internal Alert Center (`/api/v1/internal-alerts`)
- `GET /api/v1/internal-alerts`: List alerts by severity, category, resolution.
- `POST /api/v1/internal-alerts`: Broadcast internal notice.
- `PATCH /api/v1/internal-alerts/:id/read`: Mark alert as read.
- `POST /api/v1/internal-alerts/mark-all-read`: Mark all alerts as read.
- `PATCH /api/v1/internal-alerts/:id/resolve`: Resolve alert with notes.

### 8. Global Search (`/api/v1/global-search`)
- `GET /api/v1/global-search`: Permission-aware search across doctors, appointments, tasks, support tickets, and resources.

### 9. Data Import & Export (`/api/v1/import-export`)
- `GET /api/v1/import-export/template`: Download CSV template.
- `POST /api/v1/import-export/execute`: Execute bulk import with duplicate checks.
- `GET /api/v1/import-export/history`: View past import batches.
- `POST /api/v1/import-export/rollback/:id`: Roll back imported records.

### 10. System Configuration Center (`/api/v1/system-config`)
- `GET /api/v1/system-config`: List system configs.
- `PUT /api/v1/system-config/:configKey`: Update policy configuration. Enforces simulation safety locks.
