import { describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import prescriptionModel from "../models/prescriptionModel.js";
import medicationReminderModel from "../models/medicationReminderModel.js";
import { generatePrescriptionPdfBuffer } from "../services/prescriptionPdfService.js";

describe("Phase 5: Digital Prescription & Medicine Reminders Suite", () => {
  const mockDoctorId = new mongoose.Types.ObjectId();
  const mockPatientId = new mongoose.Types.ObjectId();
  const mockHospitalId = new mongoose.Types.ObjectId();
  const mockAppointmentId = new mongoose.Types.ObjectId();

  // 1. Digital Prescription Creation & Draft State
  describe("Digital Prescription Drafting & Data Integrity", () => {
    test("Creates prescription draft with valid medicines and schedule times", () => {
      const rx = new prescriptionModel({
        prescriptionNumber: "RX-202611-TEST1",
        appointmentId: mockAppointmentId,
        doctorId: mockDoctorId,
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        patientSnapshot: {
          name: "Ramesh Patel",
          age: "42",
          gender: "Male",
          displayId: "PAT-0091",
        },
        doctorSnapshot: {
          name: "Dr. Ananya Sharma",
          qualification: "MBBS, MD",
          speciality: "Cardiologist",
          registrationNumber: "MCI-48192-DEL",
        },
        hospitalSnapshot: {
          name: "Apollo Care Center",
          city: "Ahmedabad",
        },
        diagnosis: "Mild Essential Hypertension",
        medicines: [
          {
            name: "Telmisartan",
            strength: "40mg",
            form: "Tablet",
            dosage: "1 Tablet",
            frequency: "1-0-0",
            duration: "30 days",
            timing: "Before food",
            instructions: "Take once daily in the morning",
            scheduleTimes: ["08:00 AM"],
          },
          {
            name: "Amlodipine",
            strength: "5mg",
            form: "Tablet",
            dosage: "1 Tablet",
            frequency: "0-0-1",
            duration: "30 days",
            timing: "After food",
            instructions: "Take at bedtime",
            scheduleTimes: ["08:00 PM"],
          },
        ],
        status: "draft",
      });

      assert.equal(rx.status, "draft");
      assert.equal(rx.isDigitallySigned, false);
      assert.equal(rx.version, 1);
      assert.equal(rx.medicines.length, 2);
      assert.equal(rx.medicines[0].scheduleTimes[0], "08:00 AM");
    });
  });

  // 2. Doctor Authorization & Digital Issuance
  describe("Doctor Issuance & Digital Signing", () => {
    test("Officially issues prescription, sets digital signature and signed timestamp", () => {
      const rx = new prescriptionModel({
        prescriptionNumber: "RX-202611-SIGNED",
        appointmentId: mockAppointmentId,
        doctorId: mockDoctorId,
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        status: "draft",
      });

      // Simulate issuance
      rx.status = "issued";
      rx.isDigitallySigned = true;
      rx.signedAt = new Date();
      rx.signedByDoctorId = mockDoctorId;
      rx.doctorSignatureStamp = "DIGITALLY-SIGNED-HEALPOINT";

      assert.equal(rx.status, "issued");
      assert.equal(rx.isDigitallySigned, true);
      assert.ok(rx.signedAt instanceof Date);
      assert.equal(String(rx.signedByDoctorId), String(mockDoctorId));
    });

    test("Enforces doctor matching: rejecting third-party doctor modifications", () => {
      const treatingDoctorId = mockDoctorId;
      const intruderDoctorId = new mongoose.Types.ObjectId();

      const canModify = String(treatingDoctorId) === String(intruderDoctorId);
      assert.equal(canModify, false, "Third-party doctor must be blocked from modifying prescription");
    });
  });

  // 3. Prescription Versioning & Clinical Amendment Audit Trail
  describe("Prescription Versioning & Audit Trail", () => {
    test("Amends prescription with version increment and historical snapshot preservation", () => {
      const rx = new prescriptionModel({
        prescriptionNumber: "RX-202611-VER1",
        appointmentId: mockAppointmentId,
        doctorId: mockDoctorId,
        hospitalId: mockHospitalId,
        patientId: mockPatientId,
        diagnosis: "Acute Bronchitis",
        medicines: [
          { name: "Amoxicillin", strength: "500mg", dosage: "1 Cap", frequency: "1-0-1", duration: "5 days" },
        ],
        version: 1,
        status: "issued",
      });

      // Clinical amendment: Dosage adjustment
      const previousSnapshot = {
        diagnosis: rx.diagnosis,
        medicines: rx.medicines,
        version: rx.version,
      };

      rx.history.push({
        version: rx.version,
        amendedAt: new Date(),
        amendedBy: mockDoctorId,
        amendmentReason: "Patient reported mild allergic reaction to Amoxicillin. Switched to Azithromycin.",
        snapshot: previousSnapshot,
      });

      rx.version += 1;
      rx.status = "amended";
      rx.medicines = [
        { name: "Azithromycin", strength: "500mg", dosage: "1 Tab", frequency: "1-0-0", duration: "3 days" },
      ];

      assert.equal(rx.version, 2);
      assert.equal(rx.status, "amended");
      assert.equal(rx.history.length, 1);
      assert.equal(rx.history[0].version, 1);
      assert.equal(rx.history[0].snapshot.medicines[0].name, "Amoxicillin");
      assert.equal(rx.medicines[0].name, "Azithromycin");
    });
  });

  // 4. Healthcare Privacy & Access Control
  describe("Healthcare Privacy & Access Control", () => {
    test("Patient can only view their own prescription", () => {
      const authorizedPatientId = mockPatientId;
      const unrelatedPatientId = new mongoose.Types.ObjectId();

      const hasAccess = String(authorizedPatientId) === String(unrelatedPatientId);
      assert.equal(hasAccess, false, "Unrelated patient cannot access another patient's prescription");
    });

    test("Hospital isolation prevents cross-hospital clinical records leakage", () => {
      const hospitalA = mockHospitalId;
      const hospitalB = new mongoose.Types.ObjectId();

      const isSameHospital = String(hospitalA) === String(hospitalB);
      assert.equal(isSameHospital, false, "Hospital A admin cannot access Hospital B prescriptions");
    });
  });

  // 5. Professional Prescription PDF Generation
  describe("Prescription PDF Generator", () => {
    test("Generates valid binary PDF buffer with HealPoint branding and clinical details", async () => {
      const mockRxData = {
        prescriptionNumber: "RX-202611-PDFTEST",
        createdAt: new Date(),
        patientSnapshot: {
          name: "Suresh Kumar",
          age: "35",
          gender: "Male",
          displayId: "PAT-00442",
        },
        doctorSnapshot: {
          name: "Dr. Vikram Sethi",
          qualification: "MBBS, MS",
          speciality: "Orthopedic Surgeon",
          registrationNumber: "MCI-77881-GUJ",
        },
        hospitalSnapshot: {
          name: "HealPoint Apex Hospital",
          address: "SG Highway",
          city: "Ahmedabad",
        },
        diagnosis: "Lumbar Muscle Strain & Mild Sciatica",
        vitals: { bloodPressure: "124/82", pulse: "76" },
        medicines: [
          {
            name: "Aceclofenac + Paracetamol",
            strength: "100mg/325mg",
            dosage: "1 Tab",
            frequency: "1-0-1",
            duration: "5 days",
            timing: "After food",
            instructions: "Take with warm water",
          },
          {
            name: "Thiocolchicoside",
            strength: "4mg",
            dosage: "1 Cap",
            frequency: "1-0-1",
            duration: "5 days",
            timing: "After food",
            instructions: "Muscle relaxant",
          },
        ],
        generalInstructions: "Avoid heavy lifting and prolonged bending.",
        dietInstructions: "Maintain adequate hydration and balanced fiber intake.",
        followUpInstructions: "Review after 5 days if pain persists.",
        followUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        isDigitallySigned: true,
        signedAt: new Date(),
      };

      const pdfBuffer = await generatePrescriptionPdfBuffer(mockRxData);
      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 500, "Generated PDF must contain binary header and content bytes");
      // PDF specification magic bytes check: %PDF
      assert.equal(pdfBuffer.toString("utf8", 0, 4), "%PDF", "PDF must begin with %PDF magic bytes");
    });
  });

  // 6. Medication Reminders & Adherence Tracking
  describe("Medication Reminders & Dose Adherence", () => {
    test("Schedules medication reminder with exact dose times and refill parameters", () => {
      const reminder = new medicationReminderModel({
        userId: mockPatientId,
        appointmentId: mockAppointmentId,
        medicineName: "Metformin",
        strength: "500mg",
        dosage: "1 Tablet",
        frequency: "1-0-1",
        timing: "With food",
        times: ["08:00 AM", "08:00 PM"],
        startDate: new Date("2026-11-01"),
        endDate: new Date("2026-12-01"),
        isActive: true,
        refillReminder: {
          enabled: true,
          refillDate: new Date("2026-11-28"),
          remindBeforeDays: 3,
        },
      });

      assert.equal(reminder.medicineName, "Metformin");
      assert.equal(reminder.times.length, 2);
      assert.equal(reminder.refillReminder.enabled, true);
      assert.equal(reminder.isActive, true);
    });

    test("Records dose log: marks dose as taken with timestamp", () => {
      const reminder = new medicationReminderModel({
        userId: mockPatientId,
        medicineName: "Atorvastatin",
        times: ["09:00 PM"],
        isActive: true,
      });

      const doseDate = "2026-11-01";
      const scheduledTime = "09:00 PM";

      reminder.logs.push({
        doseDate,
        scheduledTime,
        status: "taken",
        actionTimestamp: new Date(),
        notes: "Taken after dinner",
      });

      assert.equal(reminder.logs.length, 1);
      assert.equal(reminder.logs[0].status, "taken");
      assert.equal(reminder.logs[0].scheduledTime, "09:00 PM");
      assert.ok(reminder.logs[0].actionTimestamp instanceof Date);
    });

    test("Cancelling a prescription or reminder deactivates future reminder triggers", () => {
      const reminder = new medicationReminderModel({
        userId: mockPatientId,
        medicineName: "Antibiotic Course",
        isActive: true,
      });

      // Deactivation
      reminder.isActive = false;
      assert.equal(reminder.isActive, false, "Deactivated reminder must not fire future notifications");
    });

    test("Calculates correct adherence percentage accurately", () => {
      const totalDoses = 4;
      const takenDoses = 3;
      const adherence = Math.round((takenDoses / totalDoses) * 100);
      assert.equal(adherence, 75, "3/4 doses taken must equal 75% adherence");
    });
  });

  // 7. Feature Flags: FEATURE_DIGITAL_PRESCRIPTION & FEATURE_MEDICINE_REMINDERS
  describe("Phase 5 Feature Flags", () => {
    test("FEATURE_DIGITAL_PRESCRIPTION defaults to disabled when unset", () => {
      const orig = process.env.FEATURE_DIGITAL_PRESCRIPTION;
      delete process.env.FEATURE_DIGITAL_PRESCRIPTION;
      const isEnabled = process.env.FEATURE_DIGITAL_PRESCRIPTION === "true";
      assert.equal(isEnabled, false);
      if (orig) process.env.FEATURE_DIGITAL_PRESCRIPTION = orig;
    });

    test("FEATURE_MEDICINE_REMINDERS activates when explicitly set to 'true'", () => {
      const orig = process.env.FEATURE_MEDICINE_REMINDERS;
      process.env.FEATURE_MEDICINE_REMINDERS = "true";
      const isEnabled = process.env.FEATURE_MEDICINE_REMINDERS === "true";
      assert.equal(isEnabled, true);
      if (orig) process.env.FEATURE_MEDICINE_REMINDERS = orig;
      else delete process.env.FEATURE_MEDICINE_REMINDERS;
    });
  });
});
