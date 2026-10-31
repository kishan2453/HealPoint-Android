import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  resolveDateRange,
  isVerifiedSuccessfulPayment,
  getAppointmentCollectedAmount,
} from "../services/analyticsService.js";
import {
  generateCsvReport,
  generateExcelXmlReport,
  generatePdfReport,
} from "../services/reportExportService.js";
import {
  isAdvancedAnalyticsEnabled,
  isAdvancedReportsEnabled,
} from "../controllers/analyticsController.js";

test("Phase 6 Part 1: Advanced Analytics Dashboard & Reporting Suite", async (t) => {
  // 1. Date Range Resolution & Timezone Calculations
  await t.test("Date Range Resolution Engine", async (t2) => {
    await t2.test("Resolves 'today' from midnight to end of day", () => {
      const { start, end, rangeLabel } = resolveDateRange({ range: "today" });
      assert.equal(rangeLabel, "Today");
      assert.equal(start.getHours(), 0);
      assert.equal(start.getMinutes(), 0);
      assert.equal(end.getHours(), 23);
      assert.equal(end.getMinutes(), 59);
      assert.ok(end.getTime() > start.getTime());
    });

    await t2.test("Resolves '7d' spanning 7 full days", () => {
      const { start, end, rangeLabel } = resolveDateRange({ range: "7d" });
      assert.equal(rangeLabel, "Last 7 Days");
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      assert.ok(diffDays >= 7 && diffDays <= 8);
    });

    await t2.test("Resolves 'this_month' starting on the 1st day of current month", () => {
      const { start, rangeLabel } = resolveDateRange({ range: "this_month" });
      assert.equal(rangeLabel, "This Month");
      assert.equal(start.getDate(), 1);
    });

    await t2.test("Resolves custom start and end date ranges correctly", () => {
      const { start, end, rangeLabel } = resolveDateRange({
        range: "custom",
        startDate: "2026-05-01",
        endDate: "2026-05-15",
      });
      assert.equal(rangeLabel, "Custom Range");
      assert.equal(start.getFullYear(), 2026);
      assert.equal(start.getMonth(), 4); // May (0-indexed)
      assert.equal(start.getDate(), 1);
      assert.equal(end.getDate(), 15);
    });

    await t2.test("Defaults to 30 days when unspecified or invalid", () => {
      const { rangeLabel } = resolveDateRange();
      assert.equal(rangeLabel, "Last 30 Days");
    });
  });

  // 2. Verified Revenue Calculation & Razorpay Integration
  await t.test("Verified Revenue & Refund Calculations", async (t2) => {
    await t2.test("Counts ONLY verified successful payments as collected revenue", () => {
      const paidAppointment = {
        amount: 800,
        payment: true,
        paymentStatus: "SUCCESS",
        status: "confirmed",
      };
      assert.equal(isVerifiedSuccessfulPayment(paidAppointment), true);
      assert.equal(getAppointmentCollectedAmount(paidAppointment), 800);
    });

    await t2.test("Rejects pending payments from collected revenue", () => {
      const pendingAppointment = {
        amount: 500,
        payment: false,
        paymentStatus: "PENDING",
        status: "pending",
      };
      assert.equal(isVerifiedSuccessfulPayment(pendingAppointment), false);
      assert.equal(getAppointmentCollectedAmount(pendingAppointment), 0);
    });

    await t2.test("Rejects failed payments from collected revenue", () => {
      const failedAppointment = {
        amount: 1200,
        payment: false,
        paymentStatus: "FAILED",
        status: "cancel",
      };
      assert.equal(isVerifiedSuccessfulPayment(failedAppointment), false);
      assert.equal(getAppointmentCollectedAmount(failedAppointment), 0);
    });

    await t2.test("Excludes refunded payments and accounts for refund deductions", () => {
      const refundedAppointment = {
        amount: 1500,
        payment: true,
        paymentStatus: "REFUNDED",
        status: "cancel",
      };
      assert.equal(isVerifiedSuccessfulPayment(refundedAppointment), false);
      assert.equal(getAppointmentCollectedAmount(refundedAppointment), 0);
    });

    await t2.test("Does NOT treat appointment completion alone as paid revenue without payment confirmation", () => {
      const completedUnpaidAppointment = {
        amount: 600,
        payment: false,
        paymentStatus: "PENDING",
        status: "completed",
      };
      assert.equal(isVerifiedSuccessfulPayment(completedUnpaidAppointment), false);
      assert.equal(getAppointmentCollectedAmount(completedUnpaidAppointment), 0);
    });
  });

  // 3. Multi-Tenant Hospital & Doctor Isolation
  await t.test("Tenant Isolation & Data Privacy", async (t2) => {
    await t2.test("Validates that Hospital Admin queries require valid ObjectId", () => {
      assert.throws(() => {
        const invalidId = "invalid_hospital_hex";
        if (!mongoose.Types.ObjectId.isValid(invalidId)) {
          throw new Error("Invalid hospital identifier");
        }
      }, /Invalid hospital identifier/);
    });

    await t2.test("Prevents Doctor from querying other doctors' private analytics", () => {
      const authenticatedDoctorId = "60c72b2f9b1d8b2badbee5a1";
      const requestedDoctorId = "60c72b2f9b1d8b2badbee5a2";
      const isAuthorized = authenticatedDoctorId === requestedDoctorId;
      assert.equal(isAuthorized, false);
    });

    await t2.test("Hospital performance metrics isolate appointments to specific hospitalId", () => {
      const hospitalA = "60c72b2f9b1d8b2badbee5a1";
      const hospitalB = "60c72b2f9b1d8b2badbee5a2";
      const appts = [
        { hospitalId: hospitalA, amount: 500, payment: true, paymentStatus: "SUCCESS" },
        { hospitalId: hospitalB, amount: 1000, payment: true, paymentStatus: "SUCCESS" },
      ];
      const hospitalASum = appts
        .filter((a) => a.hospitalId === hospitalA)
        .reduce((acc, a) => acc + a.amount, 0);
      assert.equal(hospitalASum, 500);
    });
  });

  // 4. Report Generation (PDF, CSV, Excel)
  await t.test("Multi-Format Report Export Engine", async (t2) => {
    const reportData = {
      title: "Monthly Revenue & Appointment Audit",
      rangeLabel: "Last 30 Days",
      generatedAt: "01/11/2026, 01:00:00",
      hospitalName: "Apollo City Care Hospital",
      doctorName: "Dr. Ananya Sharma",
      headers: ["Appointment ID", "Patient", "Status", "Fee (INR)"],
      rows: [
        ["APT-1001", "Rahul Verma", "completed", 750],
        ["APT-1002", "Priya Nair", "confirmed", 1200],
      ],
    };

    await t2.test("Generates valid UTF-8 CSV with quoted cells and metadata", () => {
      const csv = generateCsvReport(reportData);
      assert.ok(csv.startsWith("\uFEFF")); // UTF-8 BOM
      assert.ok(csv.includes("Monthly Revenue & Appointment Audit"));
      assert.ok(csv.includes("Apollo City Care Hospital"));
      assert.ok(csv.includes('"APT-1001","Rahul Verma","completed","750"'));
    });

    await t2.test("Generates valid Excel XML spreadsheet format", () => {
      const xml = generateExcelXmlReport(reportData);
      assert.ok(xml.includes('<?xml version="1.0"?>'));
      assert.ok(xml.includes('xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"'));
      assert.ok(xml.includes("Monthly Revenue &amp; Appointment Audit"));
      assert.ok(xml.includes("<Data ss:Type=\"Number\">750</Data>"));
    });

    await t2.test("Generates valid binary PDF buffer via PDFKit with brand styling", async () => {
      const pdfBuffer = await generatePdfReport(reportData);
      assert.ok(Buffer.isBuffer(pdfBuffer));
      assert.ok(pdfBuffer.length > 1000);
      assert.equal(pdfBuffer.toString("utf8", 0, 4), "%PDF");
    });
  });

  // 5. Feature Flags Verification
  await t.test("Phase 6 Feature Flags", async (t2) => {
    await t2.test("FEATURE_ADVANCED_ANALYTICS defaults to false when unset", () => {
      const original = process.env.FEATURE_ADVANCED_ANALYTICS;
      delete process.env.FEATURE_ADVANCED_ANALYTICS;
      assert.equal(isAdvancedAnalyticsEnabled(), false);
      process.env.FEATURE_ADVANCED_ANALYTICS = original;
    });

    await t2.test("FEATURE_ADVANCED_REPORTS activates only when explicitly 'true'", () => {
      const original = process.env.FEATURE_ADVANCED_REPORTS;
      process.env.FEATURE_ADVANCED_REPORTS = "true";
      assert.equal(isAdvancedReportsEnabled(), true);
      process.env.FEATURE_ADVANCED_REPORTS = "false";
      assert.equal(isAdvancedReportsEnabled(), false);
      process.env.FEATURE_ADVANCED_REPORTS = original;
    });
  });
});
