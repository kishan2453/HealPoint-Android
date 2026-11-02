import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import EmergencyRequest from "../models/emergencyRequestModel.js";
import appointmentModel from "../models/appointmentModel.js";
import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";
import userModel from "../models/userModel.js";
import { verifyPaymentSignature, createRazorpayOrder } from "../services/razorpayService.js";
import { sendAppointmentReminderEmail } from "../services/emailService.js";
import { sendExpoPushNotification } from "../services/pushNotificationService.js";

describe("Part 15: 100% Standalone Educational Demo & Simulation Suite", () => {
  describe("Task 1 & 12: External Integration Audit & Server-Side Demo Security", () => {
    it("Verifies EXTERNAL_INTEGRATIONS_AUDIT.md exists and documents all transmission vectors", () => {
      const auditPath = path.resolve("../EXTERNAL_INTEGRATIONS_AUDIT.md");
      assert.equal(fs.existsSync(auditPath), true, "EXTERNAL_INTEGRATIONS_AUDIT.md must exist");

      const content = fs.readFileSync(auditPath, "utf8");
      assert.ok(content.includes("Emergency SOS Dispatch"), "Audit must cover Emergency SOS");
      assert.ok(content.includes("Payment Gateway"), "Audit must cover payments");
      assert.ok(content.includes("GPS / Location Tracking"), "Audit must cover GPS");
      assert.ok(content.includes("Nodemailer"), "Audit must cover email reminders");
    });

    it("Verifies DEMO_MODE_POLICY.md exists with strict educational guidelines", () => {
      const policyPath = path.resolve("../DEMO_MODE_POLICY.md");
      assert.equal(fs.existsSync(policyPath), true, "DEMO_MODE_POLICY.md must exist");

      const content = fs.readFileSync(policyPath, "utf8");
      assert.ok(content.includes("educational college demonstration"), "Must emphasize educational nature");
      assert.ok(content.toLowerCase().includes("simulation only"), "Must specify simulation only");
    });
  });

  describe("Task 5 & 6: SOS Simulation & Zero Real-World Contact", () => {
    it("Verifies EmergencyRequest schema has isDemo and isSimulation defaults", () => {
      const schema = EmergencyRequest.schema;
      assert.ok(schema.path("isDemo"), "isDemo path must exist");
      assert.equal(schema.path("isDemo").defaultValue, true, "isDemo must default to true");
      assert.ok(schema.path("isSimulation"), "isSimulation path must exist");
      assert.equal(schema.path("isSimulation").defaultValue, true, "isSimulation must default to true");
    });

    it("Verifies emergencyController enforces mandatory DEMO MODE disclaimer", () => {
      const controllerPath = path.resolve("./controllers/emergencyController.js");
      const content = fs.readFileSync(controllerPath, "utf8");
      assert.ok(
        content.includes("DEMO MODE: This is a simulated emergency request. No real hospital, ambulance or emergency service has been contacted."),
        "Must contain the exact mandatory emergency disclaimer text"
      );
      assert.ok(
        content.includes("DEMO MODE: Ambulance dispatch simulated"),
        "Ambulance dispatch must be flagged as demo simulation"
      );
    });

    it("Verifies mobile app emergency screen call handler is disabled and shows demo alert", () => {
      const emergencyScreenPath = path.resolve("../app/(drawer)/emergency.tsx");
      const content = fs.readFileSync(emergencyScreenPath, "utf8");
      assert.ok(
        content.includes("Calling is disabled in Demo Mode"),
        "Emergency phone calling must be disabled in mobile app"
      );
      assert.ok(
        content.includes("Educational simulation only. This is not a real healthcare provider"),
        "Emergency screen must render top demo warning banner"
      );
    });
  });

  describe("Task 8: Disabling External SOS Notifications & Emails", () => {
    it("Verifies emailService completely bypasses live SMTP when in demo mode", async () => {
      const result = await sendAppointmentReminderEmail({
        to: "demo.student@example.com",
        patientName: "Demo Student",
        doctorName: "Dr. Demo Specialist",
        hospitalName: "HealPoint Demo Hospital 01",
        date: "2026-11-05",
        time: "10:00 AM",
        consultationType: "clinic",
        reminderType: "24h",
        appointmentId: "demo_appt_123",
      });

      assert.equal(result.simulated, true, "Email must be simulated");
      assert.equal(result.isDemo, true, "Must flag email as isDemo: true");
    });

    it("Verifies pushNotificationService suppresses external push for emergency alerts", async () => {
      const dummyUser = {
        _id: "60c72b2f9b1d8b2badbee5a1",
        pushTokens: [{ token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }],
        notificationPreferences: { channels: { push: true } },
      };

      const result = await sendExpoPushNotification({
        recipientUserId: "60c72b2f9b1d8b2badbee5a1",
        title: "Test Emergency Alert",
        body: "Test Emergency Body",
        data: { category: "emergency" },
      });

      assert.equal(result.simulated, true, "Emergency push must be simulated/suppressed externally");
    });
  });

  describe("Task 9: Location & GPS Anonymization", () => {
    it("Verifies use-emergency hook returns static simulated coordinates", () => {
      const hookPath = path.resolve("../hooks/use-emergency.ts");
      const content = fs.readFileSync(hookPath, "utf8");
      assert.ok(
        content.includes("HealPoint Demo Healthcare Hub, Ahmedabad (Simulated Coordinates)"),
        "Must return static demo coordinates"
      );
    });
  });

  describe("Task 10: Payment Simulation & Razorpay Sandbox Mode", () => {
    it("Verifies Razorpay service supports simulated demo signatures", () => {
      const isValid = verifyPaymentSignature({
        orderId: "order_demo_12345",
        paymentId: "pay_demo_67890",
        signature: "simulated_demo_signature",
      });
      assert.equal(isValid, true, "Simulated demo signatures must verify successfully");
    });

    it("Verifies createRazorpayOrder marks orders with demo metadata", async () => {
      const order = await createRazorpayOrder({
        amount: 500,
        receipt: "rcpt_demo_test",
      });
      assert.ok(order.id, "Order ID must exist");
      assert.equal(order.isDemo, true, "Order must be flagged with isDemo: true");
    });
  });

  describe("Task 11: Database Backup Verification", () => {
    it("Verifies pre-migration database backup and manifest exist", () => {
      const backupDir = path.resolve("../backups/pre-part-15-standalone-backup");
      assert.equal(fs.existsSync(backupDir), true, "Backup directory must exist");

      const manifestPath = path.join(backupDir, "manifest.json");
      assert.equal(fs.existsSync(manifestPath), true, "Backup manifest must exist");

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      assert.ok(manifest.collections.hospitals.count >= 7, "Hospitals backup must have at least 7 records");
      assert.ok(manifest.collections.doctors.count >= 79, "Doctors backup must have at least 79 records");
      assert.ok(manifest.collections.users.count >= 98, "Users backup must have at least 98 records");
    });
  });

  describe("Task 14: Demo Mode UI Indicators Across All Portals", () => {
    it("Verifies mobile app root layout includes DemoModeBanner", () => {
      const rootLayout = fs.readFileSync(path.resolve("../app/_layout.tsx"), "utf8");
      assert.ok(rootLayout.includes("DemoModeBanner"), "Mobile root layout must include DemoModeBanner");
    });

    it("Verifies Doctor Web includes DEMO MODE top banner", () => {
      const app = fs.readFileSync(path.resolve("../HealPointDoctorWeb/src/App.jsx"), "utf8");
      assert.ok(app.includes("Educational simulation only"), "Doctor Web App.jsx must include simulation banner");
    });

    it("Verifies Hospital Admin Web includes DEMO MODE top banner", () => {
      const app = fs.readFileSync(path.resolve("../HealPointHospitalAdminWeb/src/App.jsx"), "utf8");
      assert.ok(app.includes("Educational simulation only"), "Hospital Admin App.jsx must include simulation banner");
    });

    it("Verifies Super Admin Web includes DEMO MODE top banner", () => {
      const app = fs.readFileSync(path.resolve("../HealPointSuperAdminWeb/src/App.jsx"), "utf8");
      assert.ok(app.includes("Educational simulation platform"), "Super Admin App.jsx must include simulation banner");
    });
  });
});
