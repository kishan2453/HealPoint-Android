# Complete Patient Journey Timeline Documentation
**HealPoint Multi-Hospital Healthcare Platform · Part 18**

---

## 1. Overview
The Patient Journey Timeline synthesizes a patient's complete healthcare lifecycle chronologically from account creation to follow-up consultations. It dynamically aggregates existing MongoDB collections (`users`, `appointments`, `prescriptions`, `healthdocuments`, `auditlogs`) without creating redundant data duplicates.

---

## 2. Event Aggregation Categories
1. **Account Registration**: Profile creation, initial verification.
2. **Appointments**: Booking, confirmations, rescheduling, and cancellations with doctor and hospital metadata.
3. **Clinical Consultations**: Completed consultations, duration, doctor notes, and recorded vitals (BP, pulse, SpO2, temp).
4. **Digital Prescriptions**: Issued medicines, dosages, instructions, and cryptographic digital signature status.
5. **Medical Records & Reports**: Lab tests, discharge summaries, and vaccine records uploaded to Health Wallet.
6. **Billing & Invoices**: Consultation fees, payment breakdown, and simulated invoice statuses.

---

## 3. Privacy & Access Controls
- **Patient Access**: A patient can query only their own timeline via `/api/v1/patient-journey/my-journey`.
- **Doctor Access**: A doctor can only access the journey of patients who have booked or completed consultations with them (`appointmentModel.exists({ doctorId, userId })`).
- **Hospital Admin Access**: Access is restricted to operational, non-sensitive hospital logs.

---

## 4. Endpoints
- `GET /api/v1/patient-journey/my-journey`
- `GET /api/v1/patient-journey/patient/:patientId` (Authorized doctor/staff access)
- Query parameters:
  - `category`: `all`, `appointments`, `consultations`, `prescriptions`, `records`, `billing`
  - `startDate`, `endDate`: Date range filters
  - `page`, `limit`: Server-side pagination
