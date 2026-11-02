# Changelog

## [Part 19] - AI-Powered Hospital Operations & Workflow Automation

### Added
- **Booking Calendar Enhancement**:
  - Maintained existing 7-day horizontal date cards.
  - Added expandable full month interactive calendar date picker with month navigation.
  - Eliminated duplicate "Book Appointment" title and subtitle overlap in `app/booking/[doctorId].tsx`.
- **Centralized Workflow Automation Engine**:
  - `Workflow` & `WorkflowExecution` MongoDB collections.
  - Execution engine with condition evaluator, trigger handlers, loop recursion prevention, and action executors.
  - Hospital Admin `WorkflowsAutomation.jsx` with trigger simulation.
- **Advanced Task & Work Management**:
  - `Task` collection with status workflow (`New`, `Assigned`, `In Progress`, `Under Review`, `Completed`, `Cancelled`).
  - Hospital Admin `TaskManagement.jsx` with department workload analytics.
  - Doctor Portal `DoctorTasksView.jsx` with status transitions and clinical comments.
- **AI-Powered Administrative Operations Assistant**:
  - Natural language query answering on authentic live MongoDB collections.
  - Key operational metrics, actionable recommendations, and strict non-clinical disclaimers.
- **Configurable Business Rule Engine**:
  - Server-side policies for cancellation notice, rescheduling limits, advance booking window, queue grace period.
  - Version history with rollback capability.
- **Advanced Support & Complaints**:
  - Complaint categorization, team routing (Tier 1/2, Clinical, Billing, Escalations), internal notes, and reopening.
- **Advanced Report Builder**:
  - Configurable reports for appointments, revenue, cancellations, waitlist with CSV export.
- **Smart Alert & Notification Center**:
  - Severity-graded operational alert stream with read tracking and resolution logging.
- **Global Search & Command Center**:
  - Instant permission-aware search across doctors, appointments, tasks, tickets, resources.
- **Data Import & Export Tool**:
  - CSV bulk import for synthetic staff, resources, tasks with row validation, duplicate check, and rollback.
- **System Configuration Center**:
  - Super Admin platform policy manager with simulation safety locks permanently disabling real emergency calls and live payments.
