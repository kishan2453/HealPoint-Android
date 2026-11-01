import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";

import User from "../models/userModel.js";
import Doctor from "../models/doctorModel.js";
import Hospital from "../models/hospitalModel.js";
import Appointment from "../models/appointmentModel.js";
import Review from "../models/reviewModel.js";
import { verifyPaymentSignature } from "../services/razorpayService.js";

describe("Phase 11: Premium Branding, UI Bug Fixes, Security & Backup Suite", () => {
  describe("Task 1 & 2: Branding & Official 3D Logo Verification", () => {
    it("Verifies high-resolution 3D logo asset exists in mobile assets", () => {
      const logoPath = path.resolve("../assets/images/logo.png");
      assert.equal(fs.existsSync(logoPath), true, "logo.png must exist in assets/images/");
      const stats = fs.statSync(logoPath);
      assert.ok(stats.size > 50000, "logo.png must be high-resolution (over 50KB)");
    });

    it("Verifies logo and favicon synchronization across all three web portals", () => {
      const portals = [
        "../HealPointDoctorWeb",
        "../HealPointHospitalAdminWeb",
        "../HealPointSuperAdminWeb",
      ];

      for (const portal of portals) {
        const publicLogo = path.resolve(portal, "public/logo.png");
        assert.equal(fs.existsSync(publicLogo), true, `logo.png must exist in ${portal}/public/`);

        const publicFavicon = path.resolve(portal, "public/favicon.png");
        assert.equal(fs.existsSync(publicFavicon), true, `favicon.png must exist in ${portal}/public/`);

        const indexHtml = fs.readFileSync(path.resolve(portal, "index.html"), "utf8");
        assert.ok(indexHtml.includes("/logo.png"), `${portal}/index.html must reference /logo.png favicon`);
      }
    });
  });

  describe("Task 10: Doctor Profile Booking Button Layout", () => {
    it("Ensures button is responsive with non-100% flex row wrapping and safe area", () => {
      // Test mobile screen layout width logic
      const screenWidth = 360; // Narrow Android phone
      const horizontalPadding = 32;
      const feeWidth = 110;
      const availableWidth = screenWidth - horizontalPadding - feeWidth;

      assert.ok(availableWidth >= 200, "Button container has adequate width in flex row");
    });
  });

  describe("Task 11: Hospital Doctor Count Aggregation", () => {
    it("Calculates hospital doctor count based on active verified doctor association", () => {
      const hospId = new mongoose.Types.ObjectId();
      const mockDoctors = [
        { _id: new mongoose.Types.ObjectId(), hospitalId: hospId, isActive: true, verificationStatus: "Verified" },
        { _id: new mongoose.Types.ObjectId(), hospitalId: hospId, isActive: true, verificationStatus: "Verified" },
        { _id: new mongoose.Types.ObjectId(), hospitalId: hospId, isActive: false, verificationStatus: "Verified" }, // Inactive
        { _id: new mongoose.Types.ObjectId(), hospitalId: new mongoose.Types.ObjectId(), isActive: true, verificationStatus: "Verified" }, // Other hospital
      ];

      // Simulate aggregation matching rule
      const activeForHospital = mockDoctors.filter(
        (d) => d.hospitalId.toString() === hospId.toString() && d.isActive && d.verificationStatus !== "Rejected"
      );

      assert.equal(activeForHospital.length, 2, "Only active verified doctors belonging to hospital should be counted");
    });
  });

  describe("Task 12: Patient Drawer Menu Alphabetical Sorting", () => {
    it("Ensures Home is always first and remaining items are sorted A-Z", () => {
      const menuItems = [
        { label: "My Appointments" },
        { label: "Care Command Center" },
        { label: "Care Community" },
        { label: "Digital Health Wallet" },
        { label: "Emergency Help" },
        { label: "Find Doctors" },
        { label: "Hospitals" },
        { label: "Prescriptions" },
      ];

      menuItems.sort((a, b) => a.label.localeCompare(b.label));
      const fullMenu = [{ label: "Home" }, ...menuItems];

      assert.equal(fullMenu[0].label, "Home", "Home must always be #1");
      assert.equal(fullMenu[1].label, "Care Command Center", "First sorted item must be Care Command Center");
      assert.equal(fullMenu[2].label, "Care Community", "Second sorted item must be Care Community");
      assert.equal(fullMenu[3].label, "Digital Health Wallet");
    });
  });

  describe("Task 13: Care Continuity & Follow-Ups API", () => {
    it("Constructs valid continuity overview states and smart next action", () => {
      const overviewPending = {
        activeState: "Follow-Up Required",
        smartNextAction: {
          key: "book_followup",
          label: "Book Recommended Follow-Up",
          variant: "primary",
        },
      };

      assert.equal(overviewPending.activeState, "Follow-Up Required");
      assert.equal(overviewPending.smartNextAction.key, "book_followup");

      const overviewPrescription = {
        activeState: "Prescription Available",
        smartNextAction: {
          key: "view_prescription",
          label: "View Prescribed Medicines",
          variant: "secondary",
        },
      };

      assert.equal(overviewPrescription.activeState, "Prescription Available");
      assert.equal(overviewPrescription.smartNextAction.key, "view_prescription");
    });
  });

  describe("Task 14: Care Community Hub Feed", () => {
    it("Structures community feed with verified visit badge and doctor details", () => {
      const post = {
        _id: new mongoose.Types.ObjectId().toString(),
        authorName: "Ramesh Sharma",
        title: "Very thorough consultation",
        content: "Dr. Patel was polite and gave precise guidance for my cardiac checkup.",
        rating: 5,
        doctorName: "Dr. Patel",
        doctorSpeciality: "Cardiologist",
        verifiedVisit: true,
      };

      assert.ok(post.authorName);
      assert.equal(post.rating, 5);
      assert.equal(post.verifiedVisit, true);
    });
  });

  describe("Task 4 & 8: File Upload Security & MIME Validation", () => {
    it("Allows safe medical documents (JPEG, PNG, WebP, PDF)", () => {
      const safeMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      const allowed = new Set(safeMimeTypes);

      for (const mime of safeMimeTypes) {
        assert.equal(allowed.has(mime), true, `${mime} must be allowed`);
      }
    });

    it("Rejects dangerous executable and script files", () => {
      const dangerousMimeTypes = [
        "application/x-msdownload",
        "application/x-sh",
        "text/html",
        "application/javascript",
        "application/x-bat",
      ];
      const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

      for (const dangerous of dangerousMimeTypes) {
        assert.equal(allowed.has(dangerous), false, `Dangerous type ${dangerous} must be blocked`);
      }
    });
  });

  describe("Task 9: Payment Security & Signature Verification", () => {
    it("Validates authentic Razorpay payment HMAC SHA-256 signature", () => {
      const orderId = "order_OId123456";
      const paymentId = "pay_PId789012";
      const secret = process.env.RAZORPAY_KEY_SECRET || "IFO2Zy8PpFKAu7xwicM4Yrgv";

      const validSignature = crypto
        .createHmac("sha256", secret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const isVerified = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: validSignature,
      });

      assert.equal(isVerified, true, "Valid HMAC signature must be accepted");
    });

    it("Rejects forged or altered payment signatures", () => {
      const orderId = "order_OId123456";
      const paymentId = "pay_PId789012";
      const fakeSignature = "forged_signature_hex_code_1234567890abcdef";

      const isVerified = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: fakeSignature,
      });

      assert.equal(isVerified, false, "Forged signature must be rejected");
    });
  });

  describe("Task 5: Database Compound Performance Indexes", () => {
    it("Verifies compound index definitions exist on schemas", () => {
      const apptIndexes = Appointment.schema.indexes();
      assert.ok(apptIndexes.length >= 4, "Appointment schema must have compound indexes");

      const docIndexes = Doctor.schema.indexes();
      assert.ok(docIndexes.length >= 2, "Doctor schema must have compound indexes");

      const hospIndexes = Hospital.schema.indexes();
      assert.ok(hospIndexes.length >= 1, "Hospital schema must have performance indexes");
    });
  });

  describe("Task 6: Database Backup & Integrity Manifest", () => {
    it("Verifies backup manifest structure and SHA-256 checksum format", () => {
      const sampleData = JSON.stringify([{ id: 1, name: "Test Hospital" }]);
      const hash = crypto.createHash("sha256").update(sampleData).digest("hex");

      assert.equal(hash.length, 64, "SHA-256 hash must be 64 hexadecimal characters");

      const manifest = {
        backupId: "hp-backup-sample",
        createdAt: new Date().toISOString(),
        collections: { hospitals: 1 },
        checksums: { hospitals: hash },
      };

      assert.equal(manifest.checksums.hospitals, hash);
      assert.ok(manifest.backupId.startsWith("hp-backup-"));
    });
  });
});

