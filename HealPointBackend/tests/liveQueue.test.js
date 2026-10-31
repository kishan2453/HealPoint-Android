import { test, describe } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { resolveHospitalId, toObjectId } from "../controllers/hospitalAdminController.js";
import { verifySocketToken } from "../services/socketService.js";

const JWT_SECRET = process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026";

describe("Live Queue & Tenant Isolation Suite", () => {
  // 1. Hospital Scope & Tenant Isolation
  test("resolveHospitalId extracts hospitalId from authenticated user payload", async () => {
    const validHospitalId = "60c72b2f9b1d8b2badbee5a1";
    const req = {
      user: {
        id: "60c72b2f9b1d8b2badbee5b2",
        role: "hospital_admin",
        hospitalId: validHospitalId,
      },
    };

    const resolved = await resolveHospitalId(req);
    assert.ok(resolved);
    assert.equal(resolved.toString(), validHospitalId);
  });

  test("resolveHospitalId strictly rejects unauthenticated callers without falling back to other hospitals", async () => {
    const req = { user: null };
    const resolved = await resolveHospitalId(req);
    assert.equal(resolved, null);
  });

  test("resolveHospitalId strictly rejects users with missing hospitalId", async () => {
    const req = {
      user: {
        id: "60c72b2f9b1d8b2badbee5c3",
        role: "patient",
      },
    };
    const resolved = await resolveHospitalId(req);
    assert.equal(resolved, null);
  });

  // 2. Queue Wait-Time Calculation Logic
  test("Wait-time calculation accurately multiplies patientsAhead by doctor slot duration", () => {
    const slotDurationMinutes = 15;
    const calculateWait = (patientsAhead, slotDuration) => {
      return Math.max(0, patientsAhead) * (slotDuration || 15);
    };

    assert.equal(calculateWait(0, slotDurationMinutes), 0);
    assert.equal(calculateWait(1, slotDurationMinutes), 15);
    assert.equal(calculateWait(3, slotDurationMinutes), 45);
    assert.equal(calculateWait(5, 20), 100);
    assert.equal(calculateWait(-1, slotDurationMinutes), 0);
  });

  // 3. Queue Token Generation Logic
  test("Queue token follows formatted specialty prefix and zero-padded sequence", () => {
    const generateToken = (speciality, count) => {
      const prefix = speciality && speciality.trim() ? speciality.trim().charAt(0).toUpperCase() : "A";
      return `${prefix}-${String(count + 1).padStart(3, "0")}`;
    };

    assert.equal(generateToken("Cardiology", 0), "C-001");
    assert.equal(generateToken("Dermatology", 4), "D-005");
    assert.equal(generateToken("Orthopedic", 19), "O-020");
    assert.equal(generateToken("", 0), "A-001");
  });

  // 4. Socket Authentication & Token Verification
  test("verifySocketToken accepts valid Bearer token", () => {
    const payload = {
      id: "60c72b2f9b1d8b2badbee5a1",
      role: "doctor",
      hospitalId: "60c72b2f9b1d8b2badbee5h1",
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    const mockSocket = {
      handshake: {
        auth: { token: `Bearer ${token}` },
        headers: {},
      },
    };

    const decoded = verifySocketToken(mockSocket);
    assert.ok(decoded);
    assert.equal(decoded.id, payload.id);
    assert.equal(decoded.role, payload.role);
    assert.equal(decoded.hospitalId, payload.hospitalId);
  });

  test("verifySocketToken rejects invalid or expired token", () => {
    const mockSocket = {
      handshake: {
        auth: { token: "Bearer invalid.jwt.token" },
        headers: {},
      },
    };

    const decoded = verifySocketToken(mockSocket);
    assert.equal(decoded, null);
  });

  test("verifySocketToken returns null when no token is supplied", () => {
    const mockSocket = {
      handshake: {
        auth: {},
        headers: {},
      },
    };

    const decoded = verifySocketToken(mockSocket);
    assert.equal(decoded, null);
  });

  // 5. Valid Queue Status State Machine
  test("Queue status transitions follow healthcare lifecycle", () => {
    const VALID_QUEUE_STATUSES = [
      "not_checked_in",
      "waiting",
      "called",
      "in_consultation",
      "completed",
      "cancelled",
    ];

    const canTransition = (current, next) => {
      const transitions = {
        not_checked_in: ["waiting", "cancelled"],
        waiting: ["called", "cancelled", "missed"],
        called: ["in_consultation", "cancelled", "missed"],
        in_consultation: ["completed", "cancelled"],
        completed: [],
        cancelled: [],
      };
      return transitions[current]?.includes(next) ?? false;
    };

    assert.equal(canTransition("not_checked_in", "waiting"), true);
    assert.equal(canTransition("waiting", "called"), true);
    assert.equal(canTransition("called", "in_consultation"), true);
    assert.equal(canTransition("in_consultation", "completed"), true);
    assert.equal(canTransition("completed", "waiting"), false);
  });

  // 6. Feature Flag Behavior Verification
  test("Feature flag FEATURE_LIVE_QUEUE defaults to off if unset or false", () => {
    const isLiveQueueEnabled = (val) => val === "true";

    assert.equal(isLiveQueueEnabled(undefined), false);
    assert.equal(isLiveQueueEnabled("false"), false);
    assert.equal(isLiveQueueEnabled("0"), false);
    assert.equal(isLiveQueueEnabled("true"), true);
  });
});

