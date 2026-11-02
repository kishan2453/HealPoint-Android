# HealPoint – Data Import & Export Documentation (Part 19)

## 1. Overview
Secure data management tool allowing authorized administrators to import synthetic records (staff, beds, equipment, operational tasks) via CSV with validation, duplicate detection, and safe rollback.

## 2. Supported Entities
1. **Hospital Staff & Clinicians**: `employeeId`, `name`, `email`, `phone`, `role`, `department`, `designation`.
2. **Facility Resources & Beds**: `identifier`, `name`, `category`, `department`, `status`, `capacity`, `location`.
3. **Operational Tasks**: `title`, `description`, `department`, `priority`, `dueDate`, `assigneeName`, `assigneeRole`.

## 3. Safety Controls
- **Client & Server-side Validation**: Verifies mandatory fields before writing to MongoDB.
- **Duplicate Prevention**: Checks uniqueness of employee IDs and resource identifiers.
- **Audit History**: Logs total rows, imported count, failed count, and errors in `ImportHistory` collection.
- **Rollback Capability**: Reverts any batch import by removing inserted records and updating history status to `rolled_back`.

## 4. API Endpoints
- `GET /api/v1/import-export/template?entityType={staff|resources|tasks}`: Download CSV template.
- `POST /api/v1/import-export/execute`: Execute bulk import with duplicate detection.
- `GET /api/v1/import-export/history`: Audit trail of past imports.
- `POST /api/v1/import-export/rollback/:id`: Roll back previous import batch.
