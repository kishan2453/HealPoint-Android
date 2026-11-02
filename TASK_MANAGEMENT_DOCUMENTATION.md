# HealPoint – Task & Work Management Documentation (Part 19)

## 1. Overview
A centralized task coordination system enabling hospital administrators, department leads, and clinicians to assign, track, and complete operational work with deadline tracking and internal comment threads.

## 2. Capabilities
- **Hospital Admin**:
  - Assign tasks to clinical staff, nurses, and operational leads.
  - Set priorities (`low`, `medium`, `high`, `urgent`).
  - Configure due dates and monitor overdue tasks.
  - Track department-wise workload analytics.
- **Doctor Portal**:
  - View tasks assigned to the doctor.
  - Transition statuses (`New`, `Assigned`, `In Progress`, `Under Review`, `Completed`, `Cancelled`).
  - Add internal clinical and operational notes.
- **Super Admin**:
  - Platform-wide task monitoring and cross-hospital workload tracking.

## 3. MongoDB Schema
- `Task` (`models/taskModel.js`):
  - `hospitalId`, `title`, `description`, `department`, `priority`, `status`, `assignedTo`, `assignedBy`, `dueDate`, `completedAt`, `comments`.

## 4. API Endpoints
- `GET /api/v1/tasks`: Filter tasks by status, department, priority, and overdue state.
- `POST /api/v1/tasks`: Create task.
- `PATCH /api/v1/tasks/:id/status`: Update status with completion notes.
- `PATCH /api/v1/tasks/:id/assign`: Reassign task to another staff member.
- `POST /api/v1/tasks/:id/comments`: Add internal discussion comments.
- `GET /api/v1/tasks/analytics/workload`: Aggregate department workload KPIs.
