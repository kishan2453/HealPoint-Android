import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";

import userModel from "../models/userModel.js";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import hospitalModel from "../models/hospitalModel.js";
import reviewModel from "../models/reviewModel.js";
import supportTicketModel from "../models/supportTicketModel.js";
import emergencyRequestModel from "../models/emergencyRequestModel.js";
import { verifyPaymentSignature } from "../services/razorpayService.js";
import { enforceHospitalScope } from "../middlewares/authMiddlewares.js";

describe("Phase 13: Complete Production Launch, Play Store Readiness & Final Verification Suite", () => {
  describe("Task 1: Project Architecture & Multi-Workspace Audit", () => {
    it("Verifies all 5 authorized HealPoint workspace project folders exist", () => {
      const rootDir = path.resolve("..");
      const requiredProjects = [
        "HealPointBackend",
        "HealPointDoctorWeb",
        "HealPointHospitalAdminWeb",
        "HealPointSuperAdminWeb",
      ];

      for (const proj of requiredProjects) {
        const projPath = path.join(rootDir, proj);
        assert.equal(fs.existsSync(projPath), true, `Project folder ${proj} must exist`);
      }
      // Also verify root workspace represents HealPointMobile
      assert.equal(fs.existsSync(path.join(rootDir, "app.json")), true, "HealPointMobile app.json must exist in root");
    });

    it("Verifies production backend app.js contains proper CORS and security configurations", () => {
      const appJsPath = path.resolve("./app.js");
      assert.equal(fs.existsSync(appJsPath), true, "app.js must exist");

      const content = fs.readFileSync(appJsPath, "utf8");
      assert.ok(content.includes("https://heal-point-mauve.vercel.app"), "Must whitelist patient mobile web");
      assert.ok(content.includes("https://heal-point-doctor-web.vercel.app"), "Must whitelist doctor web");
      assert.ok(content.includes("https://heal-point-hospital-admin.vercel.app"), "Must whitelist hospital admin web");
      assert.ok(content.includes("https://heal-point-super-admin.vercel.app"), "Must whitelist super admin web");
      assert.ok(content.includes("no-store"), "Must set Cache-Control: no-store for healthcare privacy");
    });
  });

  describe("Task 2: Patient Application Core Readiness", () => {
    it("Verifies patient app localization, offline detection and logo integration exist", () => {
      const logoPath = path.resolve("../assets/images/logo.png");
      const i18nPath = path.resolve("../lib/i18n.ts");
      const offlineBannerPath = path.resolve("../components/OfflineBanner.tsx");
      const useNetworkPath = path.resolve("../hooks/use-network.ts");

      assert.equal(fs.existsSync(logoPath), true, "Official 3D brand logo must exist");
      assert.equal(fs.existsSync(i18nPath), true, "Trilingual i18n module must exist");
      assert.equal(fs.existsSync(offlineBannerPath), true, "Offline banner component must exist");
      assert.equal(fs.existsSync(useNetworkPath), true, "useNetwork hook must exist");
    });
  });

  describe("Task 3 & 4: Doctor & Hospital Admin Scoped Authorization", () => {
    it("Verifies enforceHospitalScope middleware properly isolates hospital tenants", () => {
      assert.equal(typeof enforceHospitalScope, "function", "enforceHospitalScope must be an exported function");

      // Super admin bypasses hospital scoping
      let nextCalled = false;
      const mockReqSuperAdmin = {
        user: { role: "super_admin" },
        query: {},
        body: {},
      };
      enforceHospitalScope(mockReqSuperAdmin, {}, () => {
        nextCalled = true;
      });
      assert.equal(nextCalled, true, "Super admin must bypass hospital scoping");

      // Hospital admin without hospitalId is rejected
      let rejectedStatus = null;
      let rejectedJson = null;
      const mockRes = {
        status(code) {
          rejectedStatus = code;
          return {
            json(payload) {
              rejectedJson = payload;
            },
          };
        },
      };
      const mockReqNoHospital = {
        user: { role: "hospital_admin" },
        query: {},
        body: {},
      };
      enforceHospitalScope(mockReqNoHospital, mockRes, () => {});
      assert.equal(rejectedStatus, 403, "Hospital admin without hospital context must receive HTTP 403");
      assert.equal(rejectedJson?.success, false);
    });
  });

  describe("Task 5: Super Admin Platform Oversight & System Health", () => {
    it("Verifies emergency overview controller and route are registered", () => {
      const emergencyRoutesPath = path.resolve("./routes/emergencyRoutes.js");
      assert.equal(fs.existsSync(emergencyRoutesPath), true, "emergencyRoutes.js must exist");

      const content = fs.readFileSync(emergencyRoutesPath, "utf8");
      assert.ok(content.includes("/superadmin/overview"), "Must have superadmin emergency overview route");
      assert.ok(content.includes("getSuperAdminEmergencyOverview"), "Must bind getSuperAdminEmergencyOverview handler");
    });
  });

  describe("Task 6: Backend, Database & Razorpay Security Verification", () => {
    it("Verifies Razorpay HMAC SHA-256 signature verification logic", () => {
      const orderId = "order_phase13_test_001";
      const paymentId = "pay_phase13_test_002";
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
      assert.equal(isVerified, true, "Valid HMAC signature must verify successfully");

      const isTampered = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: "tampered_signature_999",
      });
      assert.equal(isTampered, false, "Tampered HMAC signature must fail verification");
    });

    it("Verifies critical compound indexes are defined on MongoDB schemas", () => {
      const appointmentIndexes = appointmentModel.schema.indexes();
      assert.ok(
        appointmentIndexes.some(([idx]) => idx.userId !== undefined || idx.doctorId !== undefined),
        "Appointment schema must define indexing for query performance"
      );

      const doctorIndexes = doctorModel.schema.indexes();
      assert.ok(
        doctorIndexes.length > 0,
        "Doctor schema must define indexing"
      );

      const hospitalIndexes = hospitalModel.schema.indexes();
      assert.ok(
        hospitalIndexes.length > 0,
        "Hospital schema must define indexing"
      );

      const emergencyIndexes = emergencyRequestModel.schema.indexes();
      assert.ok(
        emergencyIndexes.some(([idx]) => idx.hospitalId !== undefined || idx.patientId !== undefined),
        "EmergencyRequest schema must define compound indexing on hospitalId and patientId"
      );
    });
  });

  describe("Task 7: Android Production Manifest & Build Configuration", () => {
    it("Verifies app.json meets Google Play Store and Android Production standards", () => {
      const appJsonPath = path.resolve("../app.json");
      assert.equal(fs.existsSync(appJsonPath), true, "app.json must exist");

      const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      const expo = appJson.expo;

      assert.equal(expo.name, "HealPoint", "App name must be HealPoint");
      assert.equal(expo.slug, "healpoint", "App slug must be healpoint");
      assert.equal(expo.version, "1.0.0", "Version must be 1.0.0");
      assert.equal(expo.android.package, "com.healpoint.app", "Package name must be com.healpoint.app");
      assert.equal(typeof expo.android.versionCode, "number", "versionCode must be a number");
      assert.ok(expo.android.versionCode >= 1, "versionCode must be >= 1");

      const requiredPermissions = [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.INTERNET",
      ];
      for (const perm of requiredPermissions) {
        assert.ok(
          expo.android.permissions.includes(perm),
          `Must declare permission ${perm}`
        );
      }
    });

    it("Verifies eas.json contains production and preview build profiles with production backend URL", () => {
      const easJsonPath = path.resolve("../eas.json");
      assert.equal(fs.existsSync(easJsonPath), true, "eas.json must exist");

      const easJson = JSON.parse(fs.readFileSync(easJsonPath, "utf8"));
      assert.ok(easJson.build.preview, "Preview profile must exist");
      assert.equal(easJson.build.preview.android.buildType, "apk", "Preview buildType must be apk");
      assert.ok(easJson.build.production, "Production profile must exist");
      assert.equal(
        easJson.build.production.env.EXPO_PUBLIC_API_URL,
        "https://heal-point-backend.vercel.app/api/v1",
        "Production profile must point to live backend"
      );
    });
  });

  describe("Task 8: Google Play Store Documentation & Release Metadata", () => {
    it("Verifies PLAY_STORE_READINESS.md contains title, description, disclaimers, and data safety", () => {
      const docPath = path.resolve("../PLAY_STORE_READINESS.md");
      assert.equal(fs.existsSync(docPath), true, "PLAY_STORE_READINESS.md must exist");

      const content = fs.readFileSync(docPath, "utf8");
      assert.ok(content.includes("HealPoint: Doctor & Healthcare"), "Must include app title");
      assert.ok(content.includes("Short Description"), "Must include short description");
      assert.ok(content.includes("Full Description"), "Must include full description");
      assert.ok(content.includes("MEDICAL DISCLAIMER"), "Must include medical disclaimer");
      assert.ok(content.includes("Data Safety Declarations"), "Must include data safety section");
      assert.ok(content.includes("Target Audience"), "Must specify target audience");
    });
  });

  describe("Task 9: Security, Performance & Final Regression", () => {
    it("Verifies user passwords are required and encrypted via bcrypt hashing", () => {
      const userSchema = userModel.schema;
      assert.ok(userSchema.path("password"), "Password path exists");
      assert.equal(userSchema.path("password").isRequired, true, "User password must be required");

      const userControllerContent = fs.readFileSync(path.resolve("./controllers/userController.js"), "utf8");
      assert.ok(userControllerContent.includes("bcrypt.hash"), "Must use bcrypt.hash for storing passwords securely");
      assert.ok(userControllerContent.includes("-password"), "Must omit password when querying user profile");
    });
  });
});
