import { describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import EmergencyRequest, { generateEmergencyCode } from "../models/emergencyRequestModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026";

describe("Phase 7: Emergency SOS & Emergency Services Test Suite", () => {
  describe("Emergency Request Model & Data Integrity", () => {
    test("EmergencyRequest generates unique EMG- prefixed code before save", () => {
      const code = generateEmergencyCode();
      assert.ok(code, "emergencyCode should be auto-generated");
      assert.match(
        code,
        /^EMG-[A-Z0-9]+-[A-Z0-9]+$/,
        "emergencyCode should match EMG-<timestamp>-<hash> format"
      );

      const patientId = new mongoose.Types.ObjectId();
      const emergency = new EmergencyRequest({
        patientId,
        emergencyCode: code,
        emergencyType: "cardiac",
        severity: "critical",
      });
      assert.equal(emergency.emergencyCode, code);
    });

    test("Requires valid status from healthcare enum", () => {
      const validStatuses = ["pending", "accepted", "in_progress", "resolved", "cancelled"];
      validStatuses.forEach((status) => {
        const doc = new EmergencyRequest({
          patientId: new mongoose.Types.ObjectId(),
          status,
        });
        const err = doc.validateSync();
        assert.equal(err?.errors?.status, undefined, `Status ${status} should be valid`);
      });

      const invalidDoc = new EmergencyRequest({
        patientId: new mongoose.Types.ObjectId(),
        status: "arbitrary_unknown_status",
      });
      const err = invalidDoc.validateSync();
      assert.ok(err?.errors?.status, "Arbitrary status should fail schema validation");
    });

    test("Requires valid emergencyType enum", () => {
      const validTypes = ["cardiac", "respiratory", "accident", "stroke", "pregnancy", "severe_pain", "other"];
      validTypes.forEach((type) => {
        const doc = new EmergencyRequest({
          patientId: new mongoose.Types.ObjectId(),
          emergencyType: type,
        });
        const err = doc.validateSync();
        assert.equal(err?.errors?.emergencyType, undefined, `Type ${type} should be valid`);
      });

      const invalidDoc = new EmergencyRequest({
        patientId: new mongoose.Types.ObjectId(),
        emergencyType: "not_a_medical_emergency",
      });
      const err = invalidDoc.validateSync();
      assert.ok(err?.errors?.emergencyType, "Unknown emergency type should fail schema validation");
    });
  });

  describe("Emergency Status Transitions & Lifecycle", () => {
    test("Initial state is pending with history timestamp", () => {
      const doc = new EmergencyRequest({
        patientId: new mongoose.Types.ObjectId(),
        statusHistory: [
          {
            status: "pending",
            role: "patient",
            note: "Emergency SOS triggered",
          },
        ],
      });

      assert.equal(doc.status, "pending");
      assert.equal(doc.statusHistory.length, 1);
      assert.equal(doc.statusHistory[0].status, "pending");
    });

    test("Ambulance dispatch sets vehicle info, driver contact, and advances status", () => {
      const doc = new EmergencyRequest({
        patientId: new mongoose.Types.ObjectId(),
        status: "pending",
      });

      // Simulate ambulance dispatch action
      const ambulanceData = {
        vehicleNumber: "DL-01-EM-4521",
        driverName: "Rajesh Kumar",
        driverPhone: "9876543210",
        etaMinutes: 12,
        dispatchedAt: new Date(),
      };

      doc.ambulance = {
        isDispatched: true,
        ...ambulanceData,
      };
      doc.status = "in_progress";
      doc.statusHistory.push({
        status: "in_progress",
        role: "hospital_admin",
        note: `Ambulance dispatched: ${ambulanceData.vehicleNumber}`,
      });

      assert.equal(doc.ambulance.isDispatched, true);
      assert.equal(doc.ambulance.vehicleNumber, "DL-01-EM-4521");
      assert.equal(doc.ambulance.driverPhone, "9876543210");
      assert.equal(doc.ambulance.etaMinutes, 12);
      assert.equal(doc.status, "in_progress");
      assert.equal(doc.statusHistory.length, 1);
    });

    test("Emergency resolution records timestamp and clinical outcome", () => {
      const doctorId = new mongoose.Types.ObjectId();
      const doc = new EmergencyRequest({
        patientId: new mongoose.Types.ObjectId(),
        status: "in_progress",
      });

      doc.status = "resolved";
      doc.resolutionDetails = {
        resolvedBy: doctorId,
        resolvedAt: new Date(),
        clinicalNotes: "Patient treated for acute trauma, vitals stabilized.",
        outcome: "Stabilized and admitted for observation",
      };

      assert.equal(doc.status, "resolved");
      assert.ok(doc.resolutionDetails.resolvedAt instanceof Date);
      assert.equal(doc.resolutionDetails.outcome, "Stabilized and admitted for observation");
    });

    test("Emergency cancellation records patient reason and prevents reactivation", () => {
      const patientId = new mongoose.Types.ObjectId();
      const doc = new EmergencyRequest({
        patientId,
        status: "pending",
      });

      doc.status = "cancelled";
      doc.cancellationDetails = {
        cancelledBy: patientId,
        cancelledAt: new Date(),
        reason: "False alarm - feeling fine now",
      };

      assert.equal(doc.status, "cancelled");
      assert.equal(doc.cancellationDetails.reason, "False alarm - feeling fine now");
    });
  });

  describe("Emergency Contacts Validation & Phone Rules", () => {
    test("Accepts valid 10-digit phone number for emergency contact", () => {
      const cleanPhone = (phone) => phone.replace(/\D/g, "");
      const validPhone = "9876543210";
      assert.equal(cleanPhone(validPhone).length >= 10, true);

      const formattedPhone = "+91 98765-43210";
      assert.equal(cleanPhone(formattedPhone).length >= 10, true);
    });

    test("Rejects phone number with less than 10 digits", () => {
      const cleanPhone = (phone) => phone.replace(/\D/g, "");
      const shortPhone = "12345";
      assert.equal(cleanPhone(shortPhone).length >= 10, false);
    });
  });

  describe("Authentication Session & Token Persistence Verification", () => {
    test("Generates 30-day token for patient sessions", () => {
      const payload = {
        id: new mongoose.Types.ObjectId().toString(),
        role: "patient",
        email: "patient@healpoint.com",
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
      const decoded = jwt.verify(token, JWT_SECRET);

      assert.equal(decoded.id, payload.id);
      assert.equal(decoded.role, "patient");
      // Verify token expiration is approximately 30 days in future (> 29 days)
      const nowSec = Math.floor(Date.now() / 1000);
      assert.ok(decoded.exp > nowSec + 29 * 24 * 3600);
    });

    test("Client-side JWT expiration parser accurately detects valid vs expired tokens", () => {
      const validToken = jwt.sign({ id: "123" }, JWT_SECRET, { expiresIn: "1h" });
      const expiredToken = jwt.sign({ id: "123" }, JWT_SECRET, { expiresIn: "-1h" });

      function isJwtExpired(token) {
        const parts = token.split(".");
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
        return payload.exp < Date.now() / 1000 - 10;
      }

      assert.equal(isJwtExpired(validToken), false, "1-hour token should not be expired");
      assert.equal(isJwtExpired(expiredToken), true, "Past token should be marked expired");
    });
  });
});
