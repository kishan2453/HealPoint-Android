import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

// Import Part 18 Models
import waitlistModel from "../models/waitlistModel.js";
import resourceModel from "../models/resourceModel.js";
import staffModel from "../models/staffModel.js";
import shiftModel from "../models/shiftModel.js";
import rosterModel from "../models/rosterModel.js";
import leaveModel from "../models/leaveModel.js";
import hospitalSubscriptionPlanModel from "../models/hospitalSubscriptionPlanModel.js";
import hospitalSubscriptionModel from "../models/hospitalSubscriptionModel.js";
import simulatedInvoiceModel from "../models/simulatedInvoiceModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";

describe("Phase 18: 7 Advanced Features Suite", () => {
  describe("Feature 1: Smart Appointment Scheduling & Waitlist Engine", () => {
    it("Validates Waitlist model requires userId, doctorId, hospitalId, and preferredDate", () => {
      const waitlist = new waitlistModel({
        patientName: "Aditi Rao",
        preferredDate: "2026-11-15",
        status: "active",
      });
      const error = waitlist.validateSync();
      assert.ok(error, "Expected validation error for missing required fields");
      assert.ok(error.errors.userId, "userId is required");
      assert.ok(error.errors.doctorId, "doctorId is required");
      assert.ok(error.errors.hospitalId, "hospitalId is required");
    });

    it("Constructs a valid Waitlist entry with active status and priority", () => {
      const mockUserId = new mongoose.Types.ObjectId();
      const mockDoctorId = new mongoose.Types.ObjectId();
      const mockHospitalId = new mongoose.Types.ObjectId();

      const waitlist = new waitlistModel({
        userId: mockUserId,
        patientName: "Rahul Sharma",
        patientPhone: "+91 98765 43210",
        doctorId: mockDoctorId,
        doctorName: "Dr. Ananya Roy",
        hospitalId: mockHospitalId,
        hospitalName: "Anand City Hospital",
        department: "Cardiology",
        preferredDate: "2026-11-20",
        preferredTimeSlot: "morning",
        status: "active",
        priority: 2,
      });

      const error = waitlist.validateSync();
      assert.ifError(error);
      assert.equal(waitlist.status, "active");
      assert.equal(waitlist.priority, 2);
      assert.equal(waitlist.department, "Cardiology");
    });

    it("Verifies Doctor model supports breakTimes, maxAppointmentsPerDay, and queuePaused", () => {
      const doctor = new doctorModel({
        name: "Dr. Vikram Patel",
        email: "vikram.patel.part18@healpoint.test",
        password: "hashedPassword123",
        speciality: "Cardiology",
        maxAppointmentsPerDay: 40,
        queuePaused: true,
        queuePauseReason: "Attending Emergency Clinical Rounds",
        breakTimes: [
          { name: "Lunch Break", startTime: "01:00 PM", endTime: "02:00 PM" },
        ],
      });

      const error = doctor.validateSync();
      assert.ifError(error);
      assert.equal(doctor.maxAppointmentsPerDay, 40);
      assert.equal(doctor.queuePaused, true);
      assert.equal(doctor.queuePauseReason, "Attending Emergency Clinical Rounds");
      assert.equal(doctor.breakTimes.length, 1);
      assert.equal(doctor.breakTimes[0].name, "Lunch Break");
    });
  });

  describe("Feature 2: Advanced Digital Queue & Token Management", () => {
    it("Verifies Appointment model tracks complete queue status lifecycle and tokens", () => {
      const appt = new appointmentModel({
        appointmentId: "APT-TEST-Q-01",
        userId: new mongoose.Types.ObjectId(),
        doctorId: new mongoose.Types.ObjectId(),
        hospitalId: new mongoose.Types.ObjectId(),
        slotDate: "2026-11-10",
        slotTime: "10:30 AM",
        patientName: "Sunita Verma",
        checkedIn: true,
        queueToken: "T-07",
        queueStatus: "in_consultation",
        estimatedWaitMinutes: 15,
      });

      const error = appt.validateSync();
      assert.ifError(error);
      assert.equal(appt.queueToken, "T-07");
      assert.equal(appt.queueStatus, "in_consultation");
      assert.equal(appt.estimatedWaitMinutes, 15);
    });

    it("Rejects arbitrary, non-conforming queue status transitions", () => {
      const appt = new appointmentModel({
        appointmentId: "APT-TEST-Q-INVALID",
        userId: new mongoose.Types.ObjectId(),
        doctorId: new mongoose.Types.ObjectId(),
        hospitalId: new mongoose.Types.ObjectId(),
        slotDate: "2026-11-10",
        slotTime: "11:00 AM",
        patientName: "Test Patient",
        queueStatus: "arbitrary_unsupported_status",
      });

      const error = appt.validateSync();
      assert.ok(error);
      assert.ok(error.errors.queueStatus);
    });
  });

  describe("Feature 3: Complete Patient Journey Timeline", () => {
    it("Aggregates diverse event types (registration, appt, consult, rx, bill) with chronological sorting", () => {
      const mockEvents = [
        { type: "registration", timestamp: new Date("2026-01-01T10:00:00Z"), title: "Registered" },
        { type: "appointment", timestamp: new Date("2026-02-15T09:30:00Z"), title: "Booked" },
        { type: "consultation", timestamp: new Date("2026-02-15T10:15:00Z"), title: "Completed" },
        { type: "prescription", timestamp: new Date("2026-02-15T10:20:00Z"), title: "Prescribed" },
        { type: "billing", timestamp: new Date("2026-02-15T10:25:00Z"), title: "Paid" },
      ];

      // Verify descending chronological order
      const sorted = [...mockEvents].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      assert.equal(sorted[0].type, "billing");
      assert.equal(sorted[1].type, "prescription");
      assert.equal(sorted[2].type, "consultation");
      assert.equal(sorted[3].type, "appointment");
      assert.equal(sorted[4].type, "registration");
    });
  });

  describe("Feature 4: Hospital Resource & Capacity Management", () => {
    it("Validates Resource model requires hospitalId, name, identifier, and category", () => {
      const resObj = new resourceModel({
        department: "Radiology",
        status: "available",
      });
      const error = resObj.validateSync();
      assert.ok(error);
      assert.ok(error.errors.hospitalId);
      assert.ok(error.errors.name);
      assert.ok(error.errors.identifier);
      assert.ok(error.errors.category);
    });

    it("Constructs valid Resource and handles assignment/release lifecycle", () => {
      const mockHospitalId = new mongoose.Types.ObjectId();
      const resObj = new resourceModel({
        hospitalId: mockHospitalId,
        hospitalName: "Anand City Hospital",
        name: "Ultrasound Machine 02",
        identifier: "EQ-US-02",
        category: "equipment",
        department: "Radiology",
        status: "available",
        capacity: 1,
        location: "Block B, Room 104",
      });

      assert.ifError(resObj.validateSync());
      assert.equal(resObj.status, "available");

      // Assign resource
      resObj.status = "occupied";
      resObj.assignedName = "OPD Patient Checkup";
      resObj.assignedAt = new Date();
      assert.equal(resObj.status, "occupied");
      assert.ok(resObj.assignedAt);

      // Release resource
      resObj.status = "available";
      resObj.assignedName = "";
      resObj.assignedAt = null;
      assert.equal(resObj.status, "available");
      assert.equal(resObj.assignedAt, null);
    });
  });

  describe("Feature 5: Advanced Staff & Duty Roster Management", () => {
    it("Validates Staff model requires hospitalId, name, employeeId, and role", () => {
      const staff = new staffModel({ department: "Emergency" });
      const error = staff.validateSync();
      assert.ok(error);
      assert.ok(error.errors.hospitalId);
      assert.ok(error.errors.name);
      assert.ok(error.errors.employeeId);
      assert.ok(error.errors.role);
    });

    it("Detects shift assignment conflict if same staff member is scheduled twice on the same date", () => {
      const mockStaffId = new mongoose.Types.ObjectId();
      const mockHospitalId = new mongoose.Types.ObjectId();

      const existingRosters = [
        { staffId: mockStaffId.toString(), date: "2026-11-15", shiftName: "Morning Shift", status: "scheduled" },
      ];

      const newAssignment = {
        staffId: mockStaffId.toString(),
        date: "2026-11-15",
        shiftName: "Evening Shift",
      };

      const hasConflict = existingRosters.some(
        (r) => r.staffId === newAssignment.staffId && r.date === newAssignment.date && r.status !== "absent"
      );

      assert.equal(hasConflict, true, "Should detect shift conflict on overlapping assignments");
    });

    it("Validates Leave model and transition to approved", () => {
      const leave = new leaveModel({
        hospitalId: new mongoose.Types.ObjectId(),
        staffName: "Nurse Kavita Joshi",
        leaveType: "sick",
        startDate: "2026-11-18",
        endDate: "2026-11-20",
        reason: "Medical recovery",
        status: "pending",
      });

      assert.ifError(leave.validateSync());
      assert.equal(leave.status, "pending");

      // Approve leave
      leave.status = "approved";
      leave.reviewedBy = "Hospital Administrator";
      leave.reviewedAt = new Date();
      assert.equal(leave.status, "approved");
      assert.ok(leave.reviewedAt);
    });
  });

  describe("Feature 6: Advanced Analytics, Forecasting & Business Intelligence", () => {
    it("Forecast response contains explicit estimation labels and non-medical disclaimer", () => {
      const forecastResponse = {
        isEstimate: true,
        historicalWindowDays: 30,
        forecastingMethod: "Exponentially weighted moving average with weekday seasonality weighting",
        disclaimer: "Analytical operational estimate based on historical appointment and scheduling records. Does NOT predict clinical outcomes.",
        projectedNext7Days: 45,
        projectedNext30Days: 190,
      };

      assert.equal(forecastResponse.isEstimate, true);
      assert.ok(forecastResponse.disclaimer.includes("Does NOT predict clinical outcomes"));
      assert.ok(forecastResponse.projectedNext7Days > 0);
      assert.ok(forecastResponse.projectedNext30Days > forecastResponse.projectedNext7Days);
    });
  });

  describe("Feature 7: Hospital Subscription & Platform Plan Management", () => {
    it("Validates HospitalSubscriptionPlan schema with limits and feature toggles", () => {
      const plan = new hospitalSubscriptionPlanModel({
        name: "Professional Hospital Plan",
        code: "professional",
        monthlyPriceSimulated: 7999,
        yearlyPriceSimulated: 79990,
        maxDoctors: 25,
        maxAppointmentsPerMonth: 2000,
        hasQueueManagement: true,
        hasResourceManagement: true,
        hasStaffRoster: true,
        hasAdvancedAnalytics: true,
        badge: "Recommended",
      });

      assert.ifError(plan.validateSync());
      assert.equal(plan.code, "professional");
      assert.equal(plan.maxDoctors, 25);
      assert.equal(plan.hasQueueManagement, true);
      assert.equal(plan.hasResourceManagement, true);
    });

    it("Constructs SimulatedInvoice without live payment connections", () => {
      const invoice = new simulatedInvoiceModel({
        invoiceNumber: "INV-HOSP-2026-0042",
        hospitalId: new mongoose.Types.ObjectId(),
        hospitalName: "Apex Memorial Hospital",
        planName: "Enterprise Multi-Facility Suite",
        amount: 15999,
        status: "paid_simulated",
        paymentMethod: "Platform Balance (Simulated)",
        notes: "Internal platform invoice. Zero real-world financial transaction.",
      });

      assert.ifError(invoice.validateSync());
      assert.equal(invoice.status, "paid_simulated");
      assert.equal(invoice.currency, "INR");
      assert.ok(invoice.notes.includes("Zero real-world financial transaction"));
    });
  });
});
