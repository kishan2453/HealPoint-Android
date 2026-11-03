import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseDateString,
  normalizeDateDDMMYYYY,
  parseHourFromSlot,
  formatHourLabel,
  generateDoctorSlotsForDate,
} from "../helpers/slotHelper.js";

describe("Appointment Slot Helper & Calendar Date Normalization Suite", () => {
  describe("parseDateString Safe Parsing", () => {
    it("parses DD-MM-YYYY strings into valid Date objects", () => {
      const d = parseDateString("25-08-2026");
      assert.ok(d instanceof Date);
      assert.equal(d.getDate(), 25);
      assert.equal(d.getMonth(), 7); // 0-indexed August
      assert.equal(d.getFullYear(), 2026);
    });

    it("parses DD/MM/YYYY strings into valid Date objects", () => {
      const d = parseDateString("05/11/2026");
      assert.ok(d instanceof Date);
      assert.equal(d.getDate(), 5);
      assert.equal(d.getMonth(), 10); // November
      assert.equal(d.getFullYear(), 2026);
    });

    it("parses YYYY-MM-DD strings into valid Date objects", () => {
      const d = parseDateString("2026-11-04");
      assert.ok(d instanceof Date);
      assert.equal(d.getDate(), 4);
      assert.equal(d.getMonth(), 10);
      assert.equal(d.getFullYear(), 2026);
    });

    it("returns the Date object itself if a valid Date is provided", () => {
      const now = new Date(2026, 10, 4);
      const res = parseDateString(now);
      assert.equal(res, now);
      assert.equal(res.getDate(), 4);
    });

    it("parses numeric timestamp into a valid Date object", () => {
      const time = new Date(2026, 5, 15).getTime();
      const res = parseDateString(time);
      assert.ok(res instanceof Date);
      assert.equal(res.getDate(), 15);
      assert.equal(res.getMonth(), 5);
      assert.equal(res.getFullYear(), 2026);
    });

    it("returns null safely for null, undefined, or empty string", () => {
      assert.equal(parseDateString(null), null);
      assert.equal(parseDateString(undefined), null);
      assert.equal(parseDateString(""), null);
      assert.equal(parseDateString("invalid-date-string-xyz"), null);
    });
  });

  describe("normalizeDateDDMMYYYY Robustness (Prevention of dateObj.getDate crash)", () => {
    it("normalizes a valid JS Date object to DD-MM-YYYY", () => {
      const d = new Date(2026, 10, 3); // Nov 3, 2026
      const res = normalizeDateDDMMYYYY(d);
      assert.equal(res, "03-11-2026");
    });

    it("normalizes a string formatted as YYYY-MM-DD to DD-MM-YYYY without throwing dateObj.getDate is not a function", () => {
      const res = normalizeDateDDMMYYYY("2026-11-03");
      assert.equal(res, "03-11-2026");
    });

    it("normalizes a string already formatted as DD-MM-YYYY safely", () => {
      const res = normalizeDateDDMMYYYY("03-11-2026");
      assert.equal(res, "03-11-2026");
    });

    it("normalizes a numeric timestamp safely", () => {
      const timestamp = new Date(2026, 0, 15).getTime(); // Jan 15, 2026
      const res = normalizeDateDDMMYYYY(timestamp);
      assert.equal(res, "15-01-2026");
    });

    it("returns empty string for null, undefined, or empty inputs without throwing", () => {
      assert.equal(normalizeDateDDMMYYYY(null), "");
      assert.equal(normalizeDateDDMMYYYY(undefined), "");
      assert.equal(normalizeDateDDMMYYYY(""), "");
    });
  });

  describe("Time Slot & Hour Parsing", () => {
    it("parses 12-hour AM/PM string to 24-hour integer", () => {
      assert.equal(parseHourFromSlot("09:00 AM"), 9);
      assert.equal(parseHourFromSlot("12:00 PM"), 12);
      assert.equal(parseHourFromSlot("02:30 PM"), 14);
      assert.equal(parseHourFromSlot("12:00 AM"), 0);
      assert.equal(parseHourFromSlot("11:45 PM"), 23);
    });

    it("formats 24-hour number to human-readable slot range label", () => {
      assert.equal(formatHourLabel(9), "09:00 AM - 10:00 AM");
      assert.equal(formatHourLabel(12), "12:00 PM - 01:00 PM");
      assert.equal(formatHourLabel(17), "05:00 PM - 06:00 PM");
    });
  });

  describe("Doctor Slot Generation with Leaves & Availability", () => {
    const mockDoctor = {
      _id: "660f1b2c4f1a2b3c4d5e6f70",
      name: "Dr. Joshua Miller",
      isActive: true,
      available: true,
      slotDurationMinutes: 30,
      weeklySchedule: [
        { day: "Monday", enabled: true, startTime: "09:00 AM", endTime: "12:00 PM" },
        { day: "Tuesday", enabled: true, startTime: "09:00 AM", endTime: "12:00 PM" },
        { day: "Wednesday", enabled: true, startTime: "09:00 AM", endTime: "12:00 PM" },
        { day: "Thursday", enabled: true, startTime: "09:00 AM", endTime: "12:00 PM" },
        { day: "Friday", enabled: true, startTime: "09:00 AM", endTime: "12:00 PM" },
        { day: "Saturday", enabled: true, startTime: "09:00 AM", endTime: "12:00 PM" },
        { day: "Sunday", enabled: false },
      ],
      blockedSlots: [
        { date: "25-12-2026", slotTime: "All Day", reason: "Christmas Holiday" },
      ],
    };

    it("rejects slot generation when doctor is globally unavailable", async () => {
      const res = await generateDoctorSlotsForDate({ ...mockDoctor, available: false }, "10-11-2026");
      assert.equal(res.availableSlots.length, 0);
      assert.match(res.reason, /not available/i);
    });

    it("handles doctor leave date accurately", async () => {
      const res = await generateDoctorSlotsForDate(mockDoctor, "25-12-2026");
      assert.equal(res.availableSlots.length, 0);
      assert.match(res.reason, /on leave/i);
    });

    it("handles doctor day-off accurately", async () => {
      // 06-12-2026 is a Sunday
      const res = await generateDoctorSlotsForDate(mockDoctor, "06-12-2026");
      assert.equal(res.availableSlots.length, 0);
      assert.match(res.reason, /does not practice on sundays/i);
    });
  });
});
