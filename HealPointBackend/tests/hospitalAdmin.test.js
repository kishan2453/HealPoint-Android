import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseSlotDate,
  isSameDay,
  toObjectId,
} from "../controllers/hospitalAdminController.js";

describe("Hospital Admin Helper Functions", () => {
  test("parseSlotDate parses DD-MM-YYYY format", () => {
    const d = parseSlotDate("16-05-2026");
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 4); // 0-indexed: May is 4
    assert.equal(d.getDate(), 16);
  });

  test("parseSlotDate parses D/M/YYYY format", () => {
    const d = parseSlotDate("14/08/2026");
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 7); // August is 7
    assert.equal(d.getDate(), 14);
  });

  test("parseSlotDate parses single digit day and month", () => {
    const d = parseSlotDate("5-6-2026");
    assert.ok(d instanceof Date);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 5); // June is 5
    assert.equal(d.getDate(), 5);
  });

  test("parseSlotDate returns null for invalid string", () => {
    assert.equal(parseSlotDate(""), null);
    assert.equal(parseSlotDate(null), null);
    assert.equal(parseSlotDate("invalid-date-string"), null);
  });

  test("isSameDay accurately matches calendar day", () => {
    const d1 = new Date(2026, 9, 29, 10, 30);
    const d2 = new Date(2026, 9, 29, 23, 59);
    const d3 = new Date(2026, 9, 30, 0, 1);

    assert.equal(isSameDay(d1, d2), true);
    assert.equal(isSameDay(d1, d3), false);
  });

  test("toObjectId safely converts valid hex string to ObjectId", () => {
    const hex = "6a75591239e18c787b99fbfd";
    const objId = toObjectId(hex);
    assert.ok(objId);
    assert.equal(objId.toString(), hex);
  });

  test("toObjectId returns null on invalid hex", () => {
    assert.equal(toObjectId("invalid-id"), null);
    assert.equal(toObjectId(null), null);
  });
});

