# Advanced Staff & Duty Roster Management Documentation
**HealPoint Multi-Hospital Healthcare Platform · Part 18**

---

## 1. Overview
The Staff & Duty Roster module organizes clinical and support staff across hospital departments. It manages shifts, duty assignments, shift conflict detection, and staff leave approvals.

---

## 2. Models & Data Structures
- `staffModel.js`: Staff directory (employeeId, name, role: `doctor`, `nurse`, `technician`, `pharmacist`, `receptionist`, `admin_staff`, `support`, department, shiftPreference, status).
- `shiftModel.js`: Shift configuration (name: Morning, Evening, Night, Emergency; startTime, endTime, maxStaff, department, colorCode).
- `rosterModel.js`: Duty schedule assignments (staffId, shiftId, date: `YYYY-MM-DD`, status: `scheduled`, `in_progress`, `completed`, `absent`, `swapped`).
- `leaveModel.js`: Staff leave requests (staffId, leaveType: `casual`, `sick`, `emergency`, `vacation`, startDate, endDate, reason, status: `pending`, `approved`, `rejected`).

---

## 3. Shift Conflict Detection Engine
When assigning a shift in `staffRosterController.js`:
1. **Overlap Prevention**: The engine verifies whether the staff member is already assigned to an active shift on that date:
   ```javascript
   const existingRoster = await rosterModel.findOne({
     hospitalId,
     staffId,
     date,
     status: { $ne: "absent" },
   });
   if (existingRoster) {
     return res.status(409).json({
       code: "SHIFT_CONFLICT_DETECTED",
       message: `Shift Conflict: ${staff.name} is already assigned on ${date}. Overlapping assignments are prohibited.`,
     });
   }
   ```
2. **Approved Leave Verification**: The engine checks if the staff member has an approved leave overlapping that date:
   ```javascript
   const onLeave = await leaveModel.findOne({
     staffId,
     status: "approved",
     startDate: { $lte: date },
     endDate: { $gte: date },
   });
   ```

---

## 4. Endpoints
- `GET /api/v1/roster/dashboard-stats`
- `GET /api/v1/roster/staff`, `POST /api/v1/roster/staff`
- `GET /api/v1/roster/shifts`, `POST /api/v1/roster/shifts`
- `GET /api/v1/roster/roster`, `POST /api/v1/roster/roster` (Assign with conflict check)
- `GET /api/v1/roster/leaves`, `POST /api/v1/roster/leaves`, `PATCH /api/v1/roster/leaves/:id/review`
- `GET /api/v1/roster/doctor/:id` (Doctor view of upcoming shifts and leaves)
