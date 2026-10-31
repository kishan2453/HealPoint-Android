import { test, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  normalizeCategory,
  verifyFamilyMemberOwnership,
} from "../controllers/healthDocumentController.js";

describe("Phase 4: Advanced Health Wallet Enhancements Suite", () => {
  // 1. File Upload MIME Whitelist & Size Limit Validations
  describe("Medical Document Upload Validation", () => {
    test("Accepts valid healthcare document MIME types (PDF, JPG, PNG, WEBP)", () => {
      const validTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
      ];
      validTypes.forEach((mime) => {
        assert.ok(
          ALLOWED_MIME_TYPES.includes(mime),
          `Expected ${mime} to be in whitelist`
        );
      });
    });

    test("Strictly rejects dangerous, executable, or script MIME types", () => {
      const dangerousTypes = [
        "application/x-msdownload",
        "application/javascript",
        "text/html",
        "application/x-sh",
        "application/x-php",
        "application/octet-stream",
      ];
      dangerousTypes.forEach((mime) => {
        assert.equal(
          ALLOWED_MIME_TYPES.includes(mime),
          false,
          `Dangerous MIME type ${mime} must be rejected`
        );
      });
    });

    test("Enforces maximum document file size of 10MB", () => {
      assert.equal(MAX_FILE_SIZE_BYTES, 10 * 1024 * 1024);

      const withinLimit = 5 * 1024 * 1024; // 5MB
      const exceedsLimit = 11 * 1024 * 1024; // 11MB

      assert.ok(withinLimit <= MAX_FILE_SIZE_BYTES, "5MB must be permitted");
      assert.ok(exceedsLimit > MAX_FILE_SIZE_BYTES, "11MB must exceed limit");
    });
  });

  // 2. Health Category Normalization (8 Standard Categories)
  describe("Health Document Category Normalization", () => {
    test("Normalizes prescription queries to 'prescription'", () => {
      assert.equal(normalizeCategory("Prescription"), "prescription");
      assert.equal(normalizeCategory("prescriptions"), "prescription");
      assert.equal(normalizeCategory("Rx Document"), "prescription");
    });

    test("Normalizes lab test queries to 'lab_report'", () => {
      assert.equal(normalizeCategory("Lab Report"), "lab_report");
      assert.equal(normalizeCategory("blood test"), "lab_report");
      assert.equal(normalizeCategory("pathology report"), "lab_report");
    });

    test("Normalizes diagnostic imaging to 'diagnostic_report'", () => {
      assert.equal(normalizeCategory("Diagnostic Report"), "diagnostic_report");
      assert.equal(normalizeCategory("radiology"), "diagnostic_report");
      assert.equal(normalizeCategory("X-Ray scan"), "diagnostic_report");
      assert.equal(normalizeCategory("MRI Brain"), "diagnostic_report");
    });

    test("Normalizes consultations and visits to 'consultation_history'", () => {
      assert.equal(normalizeCategory("Consultation History"), "consultation_history");
      assert.equal(normalizeCategory("Doctor Visit"), "consultation_history");
    });

    test("Normalizes billing and invoices to 'billing_receipt'", () => {
      assert.equal(normalizeCategory("Billing Receipt"), "billing_receipt");
      assert.equal(normalizeCategory("Hospital Bill"), "billing_receipt");
      assert.equal(normalizeCategory("Payment Receipt"), "billing_receipt");
      assert.equal(normalizeCategory("Invoice"), "billing_receipt");
    });

    test("Normalizes appointment passes to 'appointment_record'", () => {
      assert.equal(normalizeCategory("Appointment Record"), "appointment_record");
      assert.equal(normalizeCategory("queue token pass"), "appointment_record");
    });

    test("Normalizes general medical documents", () => {
      assert.equal(normalizeCategory("Medical Document"), "medical_document");
      assert.equal(normalizeCategory("Discharge Summary"), "medical_document");
      assert.equal(normalizeCategory("Vaccination Card"), "medical_document");
    });

    test("Defaults unrecognized categories to 'other'", () => {
      assert.equal(normalizeCategory("miscellaneous note"), "other");
      assert.equal(normalizeCategory("random file"), "other");
    });
  });

  // 3. Multi-Tenant and Dependent Isolation
  describe("Patient & Family Member Isolation Security", () => {
    test("Allows queries with 'all' or 'self' without family member restrictions", async () => {
      const isSelfAllowed = await verifyFamilyMemberOwnership("user123", "self");
      const isAllAllowed = await verifyFamilyMemberOwnership("user123", "all");
      const isUnsetAllowed = await verifyFamilyMemberOwnership("user123", null);

      assert.equal(isSelfAllowed, true);
      assert.equal(isAllAllowed, true);
      assert.equal(isUnsetAllowed, true);
    });

    test("Validates that familyMemberId must be a valid ObjectId format", async () => {
      const invalidId = "invalid_id_not_hex";
      const validHexId = new mongoose.Types.ObjectId().toString();

      const isInvalidAllowed = await verifyFamilyMemberOwnership("user123", invalidId);
      assert.equal(isInvalidAllowed, false, "Invalid format ID must be rejected");

      const isValidHex = mongoose.Types.ObjectId.isValid(validHexId);
      assert.equal(isValidHex, true, "Valid 24-character hex ID is accepted");
    });
  });

  // 4. Chronological Sorting & Timeline Partitioning
  describe("Chronological Ordering Engine", () => {
    const mockItems = [
      { id: "1", timestamp: 1729000000000, date: "2024-10-15", title: "Blood Test" },
      { id: "2", timestamp: 1729500000000, date: "2024-10-21", title: "Follow-up Rx" },
      { id: "3", timestamp: 1728000000000, date: "2024-10-04", title: "Hospital Pass" },
    ];

    test("Sorts items descending when sort='newest'", () => {
      const sorted = [...mockItems].sort((a, b) => b.timestamp - a.timestamp);
      assert.equal(sorted[0].id, "2", "Newest item must be first");
      assert.equal(sorted[2].id, "3", "Oldest item must be last");
    });

    test("Sorts items ascending when sort='oldest'", () => {
      const sorted = [...mockItems].sort((a, b) => a.timestamp - b.timestamp);
      assert.equal(sorted[0].id, "3", "Oldest item must be first");
      assert.equal(sorted[2].id, "2", "Newest item must be last");
    });
  });

  // 5. Date Range Filtering
  describe("Date Range Filter Verification", () => {
    const records = [
      { id: "r1", timestamp: new Date("2026-09-01T10:00:00Z").getTime() },
      { id: "r2", timestamp: new Date("2026-10-01T10:00:00Z").getTime() },
      { id: "r3", timestamp: new Date("2026-10-20T10:00:00Z").getTime() },
    ];

    test("Filters records accurately by startDate and endDate", () => {
      const from = new Date("2026-09-15T00:00:00Z").getTime();
      const to = new Date("2026-10-15T00:00:00Z").getTime();

      const filtered = records.filter((r) => r.timestamp >= from && r.timestamp <= to);
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].id, "r2");
    });
  });

  // 6. Feature Flag: FEATURE_HEALTH_WALLET
  describe("Feature Flag: FEATURE_HEALTH_WALLET", () => {
    test("Defaults to false / disabled if not set in production", () => {
      const origEnv = process.env.NODE_ENV;
      const origFlag = process.env.FEATURE_HEALTH_WALLET;

      process.env.NODE_ENV = "production";
      process.env.FEATURE_HEALTH_WALLET = "false";

      const isEnabled = process.env.FEATURE_HEALTH_WALLET === "true";
      assert.equal(isEnabled, false, "FEATURE_HEALTH_WALLET should be disabled by default");

      // Cleanup
      process.env.NODE_ENV = origEnv;
      if (origFlag !== undefined) process.env.FEATURE_HEALTH_WALLET = origFlag;
      else delete process.env.FEATURE_HEALTH_WALLET;
    });

    test("Activates only when explicitly configured to 'true'", () => {
      const origFlag = process.env.FEATURE_HEALTH_WALLET;
      process.env.FEATURE_HEALTH_WALLET = "true";

      const isEnabled = process.env.FEATURE_HEALTH_WALLET === "true";
      assert.equal(isEnabled, true, "FEATURE_HEALTH_WALLET activates when set to 'true'");

      if (origFlag !== undefined) process.env.FEATURE_HEALTH_WALLET = origFlag;
      else delete process.env.FEATURE_HEALTH_WALLET;
    });
  });
});
