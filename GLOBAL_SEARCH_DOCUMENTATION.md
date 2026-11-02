# HealPoint – Global Search & Command Center Documentation (Part 19)

## 1. Overview
The Global Search & Command Center delivers unified search across doctors, appointments, operational tasks, support tickets, and hospital resources with permission-aware filtering and tenant isolation.

## 2. Search Scope
- **Doctors**: Name, clinical specialty, email, availability.
- **Appointments**: Patient name, doctor name, appointment ID, slot date.
- **Tasks**: Task title, department, priority, assignee.
- **Support Tickets**: Ticket number, subject, category, patient.
- **Resources**: Equipment identifier, room/bed name, category, department.
- **Hospitals**: Platform-wide hospital directory (super admin only).

## 3. Security & Permission Guardrails
- Automatically enforces tenant isolation based on user credentials. Hospital Admins only view records matching their hospital.
- Patients and unauthorized third parties cannot access cross-hospital clinical records.

## 4. API Endpoints
- `GET /api/v1/global-search?query={keyword}&category={all|doctors|appointments|tasks|support|resources}`: Fast unified search results with metadata and direct navigation links.
