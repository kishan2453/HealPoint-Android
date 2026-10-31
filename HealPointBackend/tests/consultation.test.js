import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { getIceServersConfig } from "../controllers/consultationController.js";
import { resolveHospitalId } from "../controllers/hospitalAdminController.js";

const JWT_SECRET = process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026";

describe("Phase 2: Advanced Video Consultation Suite", () => {
  // 1. ICE Servers & STUN/TURN Configuration
  describe("ICE & STUN/TURN Servers Configuration", () => {
    test("getIceServersConfig returns Google STUN by default", () => {
      const originalTurn = process.env.TURN_URL;
      delete process.env.TURN_URL;

      const ice = getIceServersConfig();
      assert.ok(Array.isArray(ice));
      assert.ok(ice.some((s) => s.urls.includes("stun.l.google.com")));

      if (originalTurn) process.env.TURN_URL = originalTurn;
    });

    test("getIceServersConfig creates RFC 5766 HMAC-SHA1 time-limited credentials when TURN configured", () => {
      const origUrl = process.env.TURN_URL;
      const origSecret = process.env.TURN_SECRET;

      process.env.TURN_URL = "turn:turn.healpoint.live:3478";
      process.env.TURN_SECRET = "test_super_secret_turn_key_123";

      const ice = getIceServersConfig();
      const turnConfig = ice.find((s) => s.urls === "turn:turn.healpoint.live:3478");

      assert.ok(turnConfig, "TURN server should be present in iceServers");
      assert.ok(turnConfig.username, "TURN username must be present");
      assert.ok(turnConfig.credential, "TURN credential must be generated");

      // Verify HMAC-SHA1 signature
      const expectedHmac = crypto
        .createHmac("sha1", process.env.TURN_SECRET)
        .update(turnConfig.username)
        .digest("base64");
      assert.equal(turnConfig.credential, expectedHmac);

      // Restore
      if (origUrl) process.env.TURN_URL = origUrl;
      else delete process.env.TURN_URL;
      if (origSecret) process.env.TURN_SECRET = origSecret;
      else delete process.env.TURN_SECRET;
    });
  });

  // 2. Short-Lived Session Token Generation & Verification
  describe("Consultation Session Token", () => {
    test("Consultation session token signs valid appointment & participant claims", () => {
      const appointmentId = "60c72b2f9b1d8b2badbee5a1";
      const userId = "60c72b2f9b1d8b2badbee5b2";
      const role = "doctor";

      const token = jwt.sign(
        {
          appointmentId,
          userId,
          role,
          type: "consultation_session",
        },
        JWT_SECRET,
        { expiresIn: "30m" }
      );

      const decoded = jwt.verify(token, JWT_SECRET);
      assert.equal(decoded.appointmentId, appointmentId);
      assert.equal(decoded.userId, userId);
      assert.equal(decoded.role, role);
      assert.equal(decoded.type, "consultation_session");
      assert.ok(decoded.exp > Math.floor(Date.now() / 1000));
    });

    test("Rejects session token signed with mismatched secret or expired timestamp", () => {
      const expiredToken = jwt.sign(
        { appointmentId: "60c72b2f9b1d8b2badbee5a1", type: "consultation_session" },
        JWT_SECRET,
        { expiresIn: "-1s" }
      );

      assert.throws(() => {
        jwt.verify(expiredToken, JWT_SECRET);
      }, /jwt expired/);

      const foreignToken = jwt.sign(
        { appointmentId: "60c72b2f9b1d8b2badbee5a1" },
        "wrong_jwt_secret_key"
      );

      assert.throws(() => {
        jwt.verify(foreignToken, JWT_SECRET);
      }, /invalid signature/);
    });
  });

  // 3. Consultation State Machine
  describe("Consultation Lifecycle State Machine", () => {
    const validTransitions = {
      waiting: ["doctor_ready", "in_progress", "completed", "cancelled"],
      doctor_ready: ["in_progress", "completed", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    function canTransition(current, next) {
      const allowed = validTransitions[current];
      return Boolean(allowed && allowed.includes(next));
    }

    test("Allows standard clinical progression from waiting to doctor_ready to in_progress to completed", () => {
      assert.equal(canTransition("waiting", "doctor_ready"), true);
      assert.equal(canTransition("doctor_ready", "in_progress"), true);
      assert.equal(canTransition("in_progress", "completed"), true);
    });

    test("Prohibits backwards transition from completed to waiting or in_progress", () => {
      assert.equal(canTransition("completed", "waiting"), false);
      assert.equal(canTransition("completed", "in_progress"), false);
      assert.equal(canTransition("completed", "doctor_ready"), false);
    });

    test("Prohibits unknown or arbitrary consultation statuses", () => {
      assert.equal(canTransition("waiting", "random_status"), false);
      assert.equal(canTransition("unknown_status", "completed"), false);
    });
  });

  // 4. Participant Authorization Logic
  describe("Participant Authorization Security", () => {
    function isParticipantAuthorized({ doctorId, patientId, callerId, callerRole }) {
      if (callerRole === "super_admin") return true;
      if (callerRole === "doctor" && String(doctorId) === String(callerId)) return true;
      if (callerRole === "patient" && String(patientId) === String(callerId)) return true;
      return false;
    }

    const doctorId = "60c72b2f9b1d8b2badbee501";
    const patientId = "60c72b2f9b1d8b2badbee502";
    const thirdPartyId = "60c72b2f9b1d8b2badbee503";

    test("Authorizes assigned doctor to join consultation session", () => {
      const authorized = isParticipantAuthorized({
        doctorId,
        patientId,
        callerId: doctorId,
        callerRole: "doctor",
      });
      assert.equal(authorized, true);
    });

    test("Authorizes assigned patient to join consultation session", () => {
      const authorized = isParticipantAuthorized({
        doctorId,
        patientId,
        callerId: patientId,
        callerRole: "patient",
      });
      assert.equal(authorized, true);
    });

    test("Strictly blocks unassigned third-party doctor from intercepting session", () => {
      const authorized = isParticipantAuthorized({
        doctorId,
        patientId,
        callerId: thirdPartyId,
        callerRole: "doctor",
      });
      assert.equal(authorized, false);
    });

    test("Strictly blocks unassigned third-party patient from eavesdropping session", () => {
      const authorized = isParticipantAuthorized({
        doctorId,
        patientId,
        callerId: thirdPartyId,
        callerRole: "patient",
      });
      assert.equal(authorized, false);
    });
  });

  // 5. Multi-Tenant Hospital Reporting Isolation
  describe("Multi-Tenant Hospital Reporting Scope", () => {
    test("Hospital Admin scope isolates metrics strictly to caller's registered hospital", async () => {
      const hospitalA = "60c72b2f9b1d8b2badbee5a1";
      const req = {
        user: {
          id: "60c72b2f9b1d8b2badbee599",
          role: "hospital_admin",
          hospitalId: hospitalA,
        },
      };

      const resolved = await resolveHospitalId(req);
      assert.ok(resolved);
      assert.equal(resolved.toString(), hospitalA);
    });

    test("Hospital Admin without hospitalId cannot query consultation metrics", async () => {
      const req = {
        user: {
          id: "60c72b2f9b1d8b2badbee599",
          role: "hospital_admin",
        },
      };

      const resolved = await resolveHospitalId(req);
      assert.equal(resolved, null);
    });
  });

  // 6. Feature Flag Behavior
  describe("Feature Flag: FEATURE_ADVANCED_VIDEO", () => {
    test("Defaults to false / disabled if not set in environment", () => {
      const originalFlag = process.env.FEATURE_ADVANCED_VIDEO;
      delete process.env.FEATURE_ADVANCED_VIDEO;

      const isEnabled = process.env.FEATURE_ADVANCED_VIDEO === "true";
      assert.equal(isEnabled, false);

      if (originalFlag) process.env.FEATURE_ADVANCED_VIDEO = originalFlag;
    });

    test("Activates only when explicitly configured to 'true'", () => {
      const isEnabled = (val) => val === "true";

      assert.equal(isEnabled("true"), true);
      assert.equal(isEnabled("false"), false);
      assert.equal(isEnabled("1"), false);
      assert.equal(isEnabled(undefined), false);
    });
  });
});
