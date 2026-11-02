# Database Changes & Schema Upgrades
**HealPoint Multi-Hospital Healthcare Platform · Part 18**

---

## 1. New MongoDB Collections & Schemas

### 1.1 `waitlists` (`models/waitlistModel.js`)
- `userId`: `ObjectId` (ref `User`, required)
- `patientName`: `String`
- `patientPhone`: `String`
- `doctorId`: `ObjectId` (ref `Doctor`, required)
- `doctorName`: `String`
- `hospitalId`: `ObjectId` (ref `Hospital`, required)
- `hospitalName`: `String`
- `department`: `String`
- `preferredDate`: `String`
- `preferredTimeSlot`: `String` (default `"any"`)
- `status`: `String` (`"active"`, `"notified"`, `"booked"`, `"expired"`, `"cancelled"`)
- `notifiedSlot`: `String`
- `notifiedAt`: `Date`
- `notificationExpiresAt`: `Date`
- `priority`: `Number` (default 1)
- `notes`: `String`
- **Indexes**:
  - `{ doctorId: 1, preferredDate: 1, status: 1 }`
  - `{ userId: 1, status: 1 }`
  - `{ hospitalId: 1, preferredDate: 1 }`

### 1.2 `resources` (`models/resourceModel.js`)
- `hospitalId`: `ObjectId` (ref `Hospital`, required)
- `hospitalName`: `String`
- `name`: `String` (required)
- `identifier`: `String` (required, unique per hospital)
- `category`: `String` (`"room"`, `"bed"`, `"equipment"`, `"facility"`, `"vehicle"`)
- `department`: `String`
- `status`: `String` (`"available"`, `"occupied"`, `"under_maintenance"`, `"reserved"`, `"retired"`)
- `capacity`: `Number`
- `assignedTo`: `ObjectId` (ref `User`)
- `assignedName`: `String`
- `lastMaintenanceDate`, `nextMaintenanceDate`: `Date`
- **Indexes**:
  - `{ hospitalId: 1, category: 1, status: 1 }`
  - `{ hospitalId: 1, department: 1 }`
  - `{ hospitalId: 1, identifier: 1 }` (unique)

### 1.3 `staff` (`models/staffModel.js`)
- `hospitalId`: `ObjectId` (ref `Hospital`, required)
- `name`: `String`
- `email`: `String`
- `phone`: `String`
- `employeeId`: `String` (unique per hospital)
- `role`: `String` (`"doctor"`, `"nurse"`, `"technician"`, `"pharmacist"`, `"receptionist"`, `"admin_staff"`, `"support"`)
- `department`: `String`
- `doctorId`: `ObjectId` (ref `Doctor`)
- `status`: `String` (`"active"`, `"on_leave"`, `"inactive"`)
- `shiftPreference`: `String`
- **Indexes**:
  - `{ hospitalId: 1, department: 1, status: 1 }`
  - `{ hospitalId: 1, employeeId: 1 }` (unique)

### 1.4 `shifts` (`models/shiftModel.js`)
- `hospitalId`: `ObjectId` (ref `Hospital`, required)
- `name`: `String` (e.g. `"Morning General"`)
- `startTime`: `String`
- `endTime`: `String`
- `department`: `String`
- `colorCode`: `String`
- `maxStaff`: `Number`

### 1.5 `rosters` (`models/rosterModel.js`)
- `hospitalId`: `ObjectId`
- `staffId`: `ObjectId` (ref `Staff`)
- `shiftId`: `ObjectId` (ref `Shift`)
- `shiftName`: `String`
- `date`: `String` (`YYYY-MM-DD`)
- `startTime`, `endTime`: `String`
- `status`: `String` (`"scheduled"`, `"in_progress"`, `"completed"`, `"absent"`, `"swapped"`)
- **Indexes**:
  - `{ hospitalId: 1, staffId: 1, date: 1 }`
  - `{ hospitalId: 1, date: 1, department: 1 }`

### 1.6 `leaves` (`models/leaveModel.js`)
- `hospitalId`: `ObjectId`
- `staffId`: `ObjectId`
- `doctorId`: `ObjectId`
- `leaveType`: `String` (`"casual"`, `"sick"`, `"emergency"`, `"vacation"`, `"maternity"`)
- `startDate`, `endDate`: `String`
- `reason`: `String`
- `status`: `String` (`"pending"`, `"approved"`, `"rejected"`)
- **Indexes**:
  - `{ hospitalId: 1, status: 1 }`
  - `{ staffId: 1, startDate: 1 }`

### 1.7 `hospitalsubscriptionplans` (`models/hospitalSubscriptionPlanModel.js`)
- `name`: `String`
- `code`: `String` (unique, lowercase)
- `monthlyPriceSimulated`: `Number`
- `yearlyPriceSimulated`: `Number`
- `maxDoctors`: `Number`
- `maxAppointmentsPerMonth`: `Number`
- `features`: `[String]`
- `hasQueueManagement`, `hasResourceManagement`, `hasStaffRoster`, `hasAdvancedAnalytics`: `Boolean`

### 1.8 `hospitalsubscriptions` (`models/hospitalSubscriptionModel.js`)
- `hospitalId`: `ObjectId` (unique)
- `planId`: `ObjectId`
- `planCode`: `String`
- `planName`: `String`
- `status`: `String` (`"active"`, `"trial"`, `"past_due"`, `"cancelled"`)
- `billingCycle`: `String`
- `simulatedFee`: `Number`
- `expiryDate`: `Date`
- `limits`: `{ maxDoctors, maxAppointmentsPerMonth, allowedFeatures }`

### 1.9 `simulatedinvoices` (`models/simulatedInvoiceModel.js`)
- `invoiceNumber`: `String` (unique, e.g. `INV-HOSP-2026-0001`)
- `hospitalId`: `ObjectId`
- `hospitalName`: `String`
- `planName`: `String`
- `amount`: `Number`
- `status`: `String` (`"paid_simulated"`, `"pending_simulated"`)
- `issueDate`: `Date`
- `dueDate`: `Date`

---

## 2. Updated Models
- `models/doctorModel.js`:
  - Added `maxAppointmentsPerDay` (Number, default 30)
  - Added `queuePaused` (Boolean, default false)
  - Added `queuePauseReason` (String, default "")
