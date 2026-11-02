# Hospital Resource & Capacity Management Documentation
**HealPoint Multi-Hospital Healthcare Platform · Part 18**

---

## 1. Overview
The Hospital Resource & Capacity Management module enables internal resource planning for fictional hospitals. It tracks rooms, beds, diagnostic equipment, and medical transport vehicles without external hardware dependencies.

---

## 2. Models & Data Structures
- **Collection**: `resources` (`HealPointBackend/models/resourceModel.js`)
- **Key Fields**:
  - `hospitalId`: Reference to Hospital
  - `name`: Resource title (e.g. "GE Digital Ultrasound Scanner", "ICU Bed 04")
  - `identifier`: Unique serial/code within hospital (e.g. `EQ-US-02`, `BED-ICU-04`)
  - `category`: `room`, `bed`, `equipment`, `facility`, `vehicle`
  - `department`: Clinical department (e.g. `Radiology`, `Cardiology`, `ICU`)
  - `status`: `available`, `occupied`, `under_maintenance`, `reserved`, `retired`
  - `capacity`: Numeric capacity
  - `assignedName`: Current clinical allocation / patient note
  - `lastMaintenanceDate`, `nextMaintenanceDate`: Maintenance tracking

---

## 3. Hospital Admin & Super Admin Capabilities
- **Hospital Admin**:
  - Live capacity & inventory dashboard (`ResourcesCapacity.jsx`)
  - Utilization rate metrics (`occupied / total * 100%`)
  - Resource assignment and release workflow
  - Maintenance status toggle and low-availability warnings
- **Super Admin**:
  - Cross-hospital capacity overview (`GlobalResourceCapacity.jsx`)
  - Facility-level equipment benchmarking and comparisons

---

## 4. Endpoints
- `GET /api/v1/resources` (Filters: category, department, status, search)
- `POST /api/v1/resources` (Register new resource)
- `PUT /api/v1/resources/:id` (Update resource details)
- `DELETE /api/v1/resources/:id` (Retire resource)
- `POST /api/v1/resources/:id/assign` (Assign resource)
- `POST /api/v1/resources/:id/release` (Release resource to available status)
- `GET /api/v1/resources/analytics` (Hospital-specific KPI breakdown)
- `GET /api/v1/resources/global-overview` (Super Admin global aggregation)
