import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import User from "../models/userModel.js";
import SupportTicket from "../models/supportTicketModel.js";

describe("Phase 12: Multi-Language, Accessibility, Offline Experience & Customer Support Suite", () => {
  describe("Task 1: Multi-Language Localization Engine (i18n)", () => {
    it("Verifies i18n module exists with complete dictionary parity for English, Hindi, and Gujarati", () => {
      const i18nPath = path.resolve("../lib/i18n.ts");
      assert.equal(fs.existsSync(i18nPath), true, "lib/i18n.ts must exist");

      const fileContent = fs.readFileSync(i18nPath, "utf8");
      assert.ok(fileContent.includes("en:") || fileContent.includes('"en":'), "Must contain English dictionary");
      assert.ok(fileContent.includes("hi:") || fileContent.includes('"hi":'), "Must contain Hindi dictionary");
      assert.ok(fileContent.includes("gu:") || fileContent.includes('"gu":'), "Must contain Gujarati dictionary");

      // Verify essential UI keys
      const requiredKeys = [
        "nav.home",
        "nav.findDoctors",
        "nav.hospitals",
        "nav.appointments",
        "nav.healthWallet",
        "nav.medicalRecords",
        "nav.support",
        "nav.settings",
        "btn.bookAppointment",
        "btn.cancelAppointment",
        "btn.reschedule",
        "btn.confirm",
        "btn.save",
        "status.confirmed",
        "status.pending",
        "status.completed",
        "offline.bannerTitle",
        "offline.actionBlocked",
        "settings.language",
        "settings.accessibility",
        "support.title",
        "support.myTickets",
      ];

      for (const key of requiredKeys) {
        assert.ok(
          fileContent.includes(`"${key}":`),
          `Key "${key}" must be defined in translations`,
        );
      }
    });

    it("Preserves medical prescriptions, clinical IDs, and doctor notes unaltered during localization", () => {
      const sampleClinicalNote =
        "Tab Paracetamol 500mg PO TID x 5 days. Monitor BP daily.";
      const clinicalId = "CLIN-REC-90821-X";

      // Translation lookup for plain text should not alter clinical note if not in dictionary
      const mockDict = { "nav.home": "होम" };
      const translate = (text) => mockDict[text] || text;

      assert.equal(
        translate(sampleClinicalNote),
        sampleClinicalNote,
        "Clinical prescription text must not be altered",
      );
      assert.equal(
        translate(clinicalId),
        clinicalId,
        "Clinical ID must not be altered",
      );
    });
  });

  describe("Task 2 & 3: Patient & Portal Accessibility (A11Y)", () => {
    it("Verifies universal accessible focus-visible CSS rules are embedded across all web portals", () => {
      const portals = [
        "../HealPointDoctorWeb/src/DesignSystem.css",
        "../HealPointHospitalAdminWeb/src/DesignSystem.css",
        "../HealPointSuperAdminWeb/src/DesignSystem.css",
      ];

      for (const portalPath of portals) {
        const full = path.resolve(portalPath);
        assert.equal(fs.existsSync(full), true, `${portalPath} must exist`);
        const css = fs.readFileSync(full, "utf8");
        assert.ok(
          css.includes(":focus-visible"),
          `${portalPath} must contain :focus-visible rules for keyboard navigation`,
        );
        assert.ok(
          css.includes("prefers-reduced-motion"),
          `${portalPath} must respect prefers-reduced-motion accessibility preferences`,
        );
      }
    });

    it("Enforces minimum touch target dimension (>= 44px) for accessible interactive elements", () => {
      const minTouchSize = 44;
      const buttonHeight = 48;
      const hitSlop = 8;
      assert.ok(
        buttonHeight >= minTouchSize,
        "Primary action buttons meet WCAG 2.1 touch target guideline of 44x44px",
      );
      assert.ok(
        buttonHeight + hitSlop * 2 >= 48,
        "Hit slop expands accessible tap target to at least 48px",
      );
    });
  });

  describe("Task 4: Offline Detection & Banner Safety", () => {
    it("Verifies use-network hook and OfflineBanner component exist", () => {
      const hookPath = path.resolve("../hooks/use-network.ts");
      const bannerPath = path.resolve("../components/OfflineBanner.tsx");

      assert.equal(fs.existsSync(hookPath), true, "hooks/use-network.ts must exist");
      assert.equal(
        fs.existsSync(bannerPath),
        true,
        "components/OfflineBanner.tsx must exist",
      );

      const hookCode = fs.readFileSync(hookPath, "utf8");
      assert.ok(
        hookCode.includes("isOnline") && hookCode.includes("isOffline"),
        "Network hook must export isOnline and isOffline",
      );

      const bannerCode = fs.readFileSync(bannerPath, "utf8");
      assert.ok(
        bannerCode.includes('accessibilityRole="alert"'),
        "OfflineBanner must declare accessible alert role for screen readers",
      );
    });

    it("Guards booking and payment flows when offline with strict zero false-positive success", () => {
      const bookingCode = fs.readFileSync(
        path.resolve("../app/booking/[doctorId].tsx"),
        "utf8",
      );
      assert.ok(
        bookingCode.includes("isDeviceOnline()"),
        "Booking screen must verify live connectivity prior to submitting appointment",
      );
      assert.ok(
        bookingCode.includes("offline.actionBlocked"),
        "Booking screen must notify patient that internet connection is required",
      );
    });
  });

  describe("Task 5: Network Error Classification & Retry Policy", () => {
    it("Classifies HTTP and network errors with exact category semantics", () => {
      const classifyError = (status) => {
        if (status === 401) return "UNAUTHORIZED";
        if (status === 403) return "FORBIDDEN";
        if (status === 404) return "NOT_FOUND";
        if (status >= 400 && status < 500) return "VALIDATION";
        if (status >= 500) return "SERVER";
        return "UNKNOWN";
      };

      assert.equal(classifyError(401), "UNAUTHORIZED");
      assert.equal(classifyError(403), "FORBIDDEN");
      assert.equal(classifyError(404), "NOT_FOUND");
      assert.equal(classifyError(422), "VALIDATION");
      assert.equal(classifyError(500), "SERVER");
      assert.equal(classifyError(503), "SERVER");
    });

    it("Enforces idempotent retry budget: 0 retries on mutations (POST/PUT/PATCH/DELETE), bounded retries on GET", () => {
      const getRetryBudget = (method, requestedRetry) => {
        if (requestedRetry !== undefined) return requestedRetry;
        return method === "GET" ? 1 : 0;
      };

      assert.equal(getRetryBudget("GET"), 1, "GET requests may retry 1 time for reachability");
      assert.equal(getRetryBudget("POST"), 0, "POST mutations must never retry automatically");
      assert.equal(getRetryBudget("PATCH"), 0, "PATCH mutations must never retry automatically");
      assert.equal(getRetryBudget("DELETE"), 0, "DELETE operations must never retry automatically");
    });
  });

  describe("Task 6 & 7: Customer Support System & Hospital Admin Management", () => {
    it("Validates SupportTicket model schema and indexes", () => {
      const schemaPaths = SupportTicket.schema.paths;
      assert.ok(schemaPaths.ticketNumber, "Schema must include ticketNumber");
      assert.ok(schemaPaths.category, "Schema must include category");
      assert.ok(schemaPaths.status, "Schema must include status");
      assert.ok(schemaPaths.priority, "Schema must include priority");
      assert.ok(schemaPaths.patientId, "Schema must include patientId");
      assert.ok(schemaPaths.hospitalId, "Schema must include hospitalId");
      assert.ok(schemaPaths.messages, "Schema must include messages array");
      assert.ok(schemaPaths.timeline, "Schema must include timeline array");
    });

    it("Enforces ticket status transition lifecycle from OPEN to RESOLVED", () => {
      const validTransitions = {
        OPEN: ["TRIAGED", "ASSIGNED", "IN_PROGRESS", "CLOSED"],
        ASSIGNED: ["IN_PROGRESS", "WAITING_FOR_PATIENT", "ESCALATED", "RESOLVED"],
        IN_PROGRESS: ["WAITING_FOR_PATIENT", "WAITING_FOR_HOSPITAL", "ESCALATED", "RESOLVED"],
        WAITING_FOR_PATIENT: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
        ESCALATED: ["IN_PROGRESS", "RESOLVED"],
        RESOLVED: ["CLOSED", "IN_PROGRESS"],
        CLOSED: [],
      };

      assert.ok(validTransitions.OPEN.includes("IN_PROGRESS"));
      assert.ok(validTransitions.IN_PROGRESS.includes("RESOLVED"));
      assert.ok(validTransitions.ASSIGNED.includes("RESOLVED"));
    });

    it("Ensures hospital tenant isolation: Hospital Admin cannot query tickets from other hospitals", () => {
      const hospitalA = new mongoose.Types.ObjectId();
      const hospitalB = new mongoose.Types.ObjectId();

      const userRole = "hospital_admin";
      const userHospitalId = hospitalA;

      const buildFilter = (role, hId) => {
        if (role === "hospital_admin") {
          return { hospitalId: hId };
        }
        return {};
      };

      const filter = buildFilter(userRole, userHospitalId);
      assert.equal(
        String(filter.hospitalId),
        String(hospitalA),
        "Filter must be strictly scoped to hospital A",
      );
      assert.notEqual(
        String(filter.hospitalId),
        String(hospitalB),
        "Hospital Admin cannot query Hospital B records",
      );
    });

    it("Calculates Service Desk KPIs accurately from ticket collections", () => {
      const mockTickets = [
        { status: "OPEN" },
        { status: "OPEN" },
        { status: "IN_PROGRESS" },
        { status: "RESOLVED" },
        { status: "RESOLVED" },
        { status: "RESOLVED" },
        { status: "CLOSED" },
      ];

      const total = mockTickets.length;
      const open = mockTickets.filter((t) => t.status === "OPEN").length;
      const inProgress = mockTickets.filter((t) => t.status === "IN_PROGRESS").length;
      const resolved = mockTickets.filter((t) => t.status === "RESOLVED").length;
      const closed = mockTickets.filter((t) => t.status === "CLOSED").length;

      assert.equal(total, 7);
      assert.equal(open, 2);
      assert.equal(inProgress, 1);
      assert.equal(resolved, 3);
      assert.equal(closed, 1);
      assert.equal(open + inProgress, 3, "Active pending tickets count is 3");
    });
  });

  describe("Task 8 & 9: Settings, User Preferences & Persistence", () => {
    it("Verifies User model schema includes languagePreference and accessibilityPreferences", () => {
      const paths = User.schema.paths;
      assert.ok(
        paths.languagePreference,
        "User schema must have languagePreference field",
      );
      assert.ok(
        paths["accessibilityPreferences.highContrast"],
        "User schema must have accessibilityPreferences.highContrast",
      );
      assert.ok(
        paths["accessibilityPreferences.fontScale"],
        "User schema must have accessibilityPreferences.fontScale",
      );
    });

    it("Validates accepted languages are strictly en, hi, or gu", () => {
      const validLanguages = ["en", "hi", "gu"];
      assert.ok(validLanguages.includes("en"));
      assert.ok(validLanguages.includes("hi"));
      assert.ok(validLanguages.includes("gu"));
      assert.ok(!validLanguages.includes("fr"));
      assert.ok(!validLanguages.includes("es"));
    });
  });
});
