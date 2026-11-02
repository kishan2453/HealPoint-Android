# HealPoint Database Changes – Part 19

## New MongoDB Collections Added

### 1. `workflows` (`models/workflowModel.js`)
- `hospitalId`: ObjectId (ref: "Hospital", null for platform workflows)
- `name`: String, required
- `description`: String
- `trigger`: String (`appointment_booked`, `appointment_cancelled`, `doctor_approved`, `support_ticket_created`, `leave_approved`, `subscription_expiry_warning`, `task_overdue`, `resource_maintenance_due`)
- `status`: String (`active`, `inactive`, `draft`)
- `conditions`: Array of `{ field, operator, value }`
- `actions`: Array of `{ type, params, order }`
- `retryPolicy`: `{ maxRetries, retryIntervalMinutes }`
- `executionCount`: Number
- `lastExecutedAt`: Date
- Indexes: `{ hospitalId: 1, trigger: 1, status: 1 }`

### 2. `workflowexecutions` (`models/workflowExecutionModel.js`)
- `workflowId`: ObjectId (ref: "Workflow")
- `workflowName`: String
- `hospitalId`: ObjectId
- `trigger`: String
- `triggerData`: Object
- `idempotencyKey`: String
- `status`: String (`success`, `failed`, `running`, `retrying`)
- `stepsExecuted`: Array of step details
- `durationMs`: Number
- `executedAt`: Date
- Indexes: `{ workflowId: 1, executedAt: -1 }`, `{ hospitalId: 1, executedAt: -1 }`

### 3. `tasks` (`models/taskModel.js`)
- `hospitalId`: ObjectId
- `title`: String
- `description`: String
- `department`: String
- `priority`: String (`low`, `medium`, `high`, `urgent`)
- `status`: String (`New`, `Assigned`, `In Progress`, `Under Review`, `Completed`, `Cancelled`)
- `assignedTo`: `{ id, name, role }`
- `assignedBy`: `{ id, name, role }`
- `dueDate`: Date
- `completedAt`: Date
- `comments`: Array of `{ authorId, authorName, authorRole, text, createdAt }`
- Indexes: `{ hospitalId: 1, status: 1, dueDate: 1 }`, `{ "assignedTo.id": 1, status: 1 }`, `{ department: 1, status: 1 }`

### 4. `businessrules` (`models/businessRuleModel.js`)
- `hospitalId`: ObjectId
- `category`: String
- `ruleCode`: String (unique)
- `name`: String
- `config`: Mixed
- `isActive`: Boolean
- `version`: Number
- `history`: Array of historical snapshots
- Indexes: `{ hospitalId: 1, ruleCode: 1 }` (unique)

### 5. `reportconfigs` (`models/reportConfigModel.js`)
- `hospitalId`: ObjectId
- `name`: String
- `reportType`: String
- `dateRangePreset`: String
- `filters`: Object
- `selectedColumns`: Array of Strings
- `exportFormat`: String (`csv`, `json`, `pdf`)

### 6. `internalalerts` (`models/internalAlertModel.js`)
- `hospitalId`: ObjectId
- `title`: String
- `message`: String
- `severity`: String (`info`, `warning`, `high`, `critical`)
- `category`: String
- `source`: String
- `isRead`: Boolean
- `isResolved`: Boolean
- `resolutionNotes`: String
- Indexes: `{ hospitalId: 1, isResolved: 1, severity: 1, createdAt: -1 }`

### 7. `importhistories` (`models/importHistoryModel.js`)
- `hospitalId`: ObjectId
- `entityType`: String (`staff`, `resources`, `tasks`)
- `fileName`: String
- `totalRows`: Number
- `importedCount`: Number
- `failedCount`: Number
- `errors`: Array of error items
- `importedRecordIds`: Array of ObjectIds
- `status`: String (`completed`, `partially_failed`, `failed`, `rolled_back`)

### 8. `systemconfigs` (`models/systemConfigModel.js`)
- `configKey`: String (unique)
- `category`: String
- `name`: String
- `values`: Mixed
- `isLocked`: Boolean (locks simulation policies)
- `auditTrail`: Array of historical audit updates
