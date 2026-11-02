# HealPoint — Demo Data Migration & Anonymization Plan

## 1. Executive Summary & Safety Preconditions
- **Verified Full Database Backup:** Created on November 2, 2026 at `backups/pre-part-15-standalone-backup/` (Includes all 7 collections, verified manifest, and 0 data loss).
- **Goal:** Replace all real-world or real-sounding entities (e.g., Apollo Hospital, Sterling Hospital, Anand Hospital, and real-looking doctor/patient emails/phones) with 100% fictional, educational demo identities marked with `isDemo: true`.
- **Preservation Guarantee:** All MongoDB `_id` values, foreign keys, doctor-hospital linkages, user logins, and tenant isolation scopes will be preserved so all 4 portals (Patient, Doctor, Hospital Admin, Super Admin) continue working without broken references.

---

## 2. Hospital Mapping Specification

| Current Hospital Name in DB | Proposed Fictional Demo Name | Fictional Address | Demo Contact | Demo Email |
|---|---|---|---|---|
| **City Care Hospital** | **HealPoint Demo Hospital 01 (Central)** | 101 Innovation Blvd, Demo Tech City, Ahmedabad | +91 00000 11001 | `hospital01@demo.healpoint.example.com` |
| **Apollo Hospital** | **HealPoint Demo Hospital 02 (North Campus)** | 202 Academic Ring Road, Demo Health Park, Ahmedabad | +91 00000 11002 | `hospital02@demo.healpoint.example.com` |
| **Anand Hospital** | **HealPoint Demo Hospital 03 (East Care)** | 303 Healthcare Avenue, Simulation Zone, Ahmedabad | +91 00000 11003 | `hospital03@demo.healpoint.example.com` |
| **Sunshine Hospital** | **HealPoint Demo Hospital 04 (South Pavilion)** | 404 Vitality Way, Medical Demo Center, Ahmedabad | +91 00000 11004 | `hospital04@demo.healpoint.example.com` |
| **Sterling Hospital** | **HealPoint Demo Hospital 05 (West Wing)** | 505 Discovery Drive, Demo Wellness Park, Ahmedabad | +91 00000 11005 | `hospital05@demo.healpoint.example.com` |
| **Metro Hospital** | **HealPoint Demo Hospital 06 (Metro Clinical)** | 606 Metropolitan Blvd, Educational Complex, Ahmedabad | +91 00000 11006 | `hospital06@demo.healpoint.example.com` |
| **CarePlus Hospital** | **HealPoint Demo Hospital 07 (Care Institute)** | 707 University Enclave, Simulation Medical City, Ahmedabad | +91 00000 11007 | `hospital07@demo.healpoint.example.com` |

Every hospital record will have:
- `isDemo: true`
- Fictional emergency phone: `+91 00000 99999` (non-routable test placeholder)
- Fictional website: `https://demo.healpoint.example.com`

---

## 3. Doctor Anonymization Specification
- **Names:** Kept clinical and professional for portfolio demonstration (e.g. Dr. Aanya Mehta, Dr. Dev Vyas, Dr. Aryan Grover, etc.) while replacing any private personal identifiers.
- **Emails:** Transformed from personal domains to `@doctor.healpoint.example.com` (e.g., `dr.aanya.mehta@doctor.healpoint.example.com`).
- **Phones:** Standardized to non-functional test numbers starting with `+91 00000 12...` or `+91 99999 00...`.
- **Hospital References:** `hospitalName` and `hospitalId` updated to reflect the new fictional demo hospital names.
- **Demo Flag:** `isDemo: true` added to all doctor records.

---

## 4. Patient & User Anonymization Specification
- **Patients:** Converted to test accounts with emails ending in `@patient.healpoint.example.com`.
- **Phones:** Replaced with test series `+91 00000 00...` (non-routable).
- **Emergency Contacts:** Anonymized to "Demo Family Contact" with number `+91 00000 91100`.
- **Passwords:** Kept bcrypt-hashed or dev fallback (`password123`) so all existing test logins continue to work.
- **Demo Flag:** `isDemo: true` added to all user records.

---

## 5. Migration Execution Strategy
1. **Approval Gate:** Run only after user review and confirmation.
2. **Atomic In-Place Update:** Use MongoDB `$set` operators on existing documents without deleting or changing `_id`s, preserving all 333 appointments and related records.
3. **Rollback Safety:** If any issue arises, the pre-migration backup (`backups/pre-part-15-standalone-backup/`) can be restored in seconds via a single script (`scripts/restore-db.cjs`).

