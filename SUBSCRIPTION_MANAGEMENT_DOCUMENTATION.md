# Hospital Subscription & Platform Plan Management Documentation
**HealPoint Multi-Hospital Healthcare Platform · Part 18**

---

## 1. Overview
The Hospital Subscription module provides platform-level SaaS governance for hospital facilities on Anand HealPoint. It manages subscription plan tiers, enforces doctor/appointment usage limits, tracks feature entitlements, and generates simulated billing invoices with zero live payments.

---

## 2. Plan Tiers & Capabilities
Super Admin manages three standard configurable plan tiers:
1. **Starter Clinic Plan**:
   - Simulated Fee: ₹2,999/month (₹29,990/year)
   - Max Active Doctors: 5
   - Max Monthly Appointments: 300
   - Features: Queue Management, Basic Roster, Smart Scheduling
2. **Professional Hospital Plan**:
   - Simulated Fee: ₹7,999/month (₹79,990/year)
   - Max Active Doctors: 25
   - Max Monthly Appointments: 2,000
   - Features: Digital Queue, Resource Inventory, Staff Duty Roster, Smart Scheduling, Standard Analytics
3. **Enterprise Multi-Facility Suite**:
   - Simulated Fee: ₹15,999/month (₹159,990/year)
   - Max Active Doctors: 100
   - Max Monthly Appointments: 10,000
   - Features: Digital Queue, Hospital Capacity & Equipment, Staff Duty Roster, Predictive Analytics, Unlimited Patient Journey

---

## 3. Server-Side Entitlement & Usage Meter
- In `hospitalSubscriptionController.js`:
  - `usageMeter.doctors.percentage`: Live count of active doctors vs. assigned plan limit.
  - `usageMeter.appointments.percentage`: Count of appointments booked this month vs. plan limit.
  - `daysUntilExpiry`: Countdown to subscription renewal.
  - `renewalNotice`: Alert displayed when $\le 30$ days remain.

---

## 4. Simulated Invoices & Financial Safety
- Models: `hospitalSubscriptionModel.js`, `simulatedInvoiceModel.js`
- **Zero Real Payments**: Invoices are generated internally with format `INV-HOSP-YYYY-XXXX` and status `paid_simulated`. No real payment gateway credentials, Razorpay charges, or bank APIs are invoked.

---

## 5. Endpoints
- `GET /api/v1/hospital-subscriptions/plans` (List available plan tiers)
- `POST /api/v1/hospital-subscriptions/plans` (Create new plan tier)
- `PUT /api/v1/hospital-subscriptions/plans/:id` (Update plan configuration)
- `GET /api/v1/hospital-subscriptions/current` (Hospital Admin view of current subscription & usage meter)
- `POST /api/v1/hospital-subscriptions/assign` (Super Admin assigns plan to hospital)
- `GET /api/v1/hospital-subscriptions/invoices` (List simulated invoices)
- `GET /api/v1/hospital-subscriptions/overview` (Super Admin platform subscription dashboard)
