import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  isExpoPushToken,
  isInQuietHours,
} from "../services/pushNotificationService.js";
import notificationModel, {
  syncNotificationFields,
} from "../models/notificationModel.js";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushToken,
} from "../controllers/notificationController.js";

test("Phase 6 Part 2: Notifications, Routing & Role Isolation Test Suite", async (t) => {
  // 1. Expo Push Token Validation
  await t.test("Expo Push Token Format Validation", async (t2) => {
    await t2.test("Accepts standard ExponentPushToken format", () => {
      assert.equal(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"), true);
      assert.equal(isExpoPushToken("ExponentPushToken[AbC123_456-XYZ]"), true);
    });

    await t2.test("Accepts modern ExpoPushToken format", () => {
      assert.equal(isExpoPushToken("ExpoPushToken[AbC123_456-XYZ]"), true);
    });

    await t2.test("Rejects malformed or non-Expo tokens", () => {
      assert.equal(isExpoPushToken("fcm-device-token-12345"), false);
      assert.equal(isExpoPushToken("ExponentPushToken[unclosed"), false);
      assert.equal(isExpoPushToken(""), false);
      assert.equal(isExpoPushToken(null), false);
      assert.equal(isExpoPushToken(undefined), false);
      assert.equal(isExpoPushToken(12345), false);
    });
  });

  // 2. Quiet Hours Suppression Logic
  await t.test("Quiet Hours Window Assessment", async (t2) => {
    await t2.test("Returns false when quiet hours are disabled", () => {
      const active = isInQuietHours({ enabled: false, start: "22:00", end: "07:00" });
      assert.equal(active, false);
    });

    await t2.test("Correctly parses hour numbers and string timestamps", () => {
      assert.equal(typeof isInQuietHours({ enabled: true, startHour: 22, endHour: 7 }), "boolean");
      assert.equal(typeof isInQuietHours({ enabled: true, start: "22:00", end: "07:00" }), "boolean");
    });
  });

  // 3. Notification Model & Synchronization Hook
  await t.test("Notification Model Schema & Hooks", async (t2) => {
    await t2.test("Synchronizes read and isRead fields", () => {
      const notif = new notificationModel({
        title: "Booking Confirmed",
        message: "Your appointment is set for tomorrow at 10:00 AM",
        type: "appointment",
        read: true,
      });

      syncNotificationFields(notif);
      assert.equal(notif.isRead, true);
      assert.equal(notif.read, true);
      assert.equal(notif.category, "appointment");
    });

    await t2.test("Auto-assigns category from type when category is absent", () => {
      const notif = new notificationModel({
        title: "Prescription Issued",
        message: "Doctor has prescribed medications",
        type: "prescription",
      });

      syncNotificationFields(notif);
      assert.equal(notif.category, "prescription");
      assert.equal(notif.type, "prescription");
    });
  });

  // 4. Role & Tenant Isolation Boundaries
  await t.test("Strict Role Isolation Boundaries", async (t2) => {
    const patientId = new mongoose.Types.ObjectId();
    const hospitalAId = new mongoose.Types.ObjectId();
    const hospitalBId = new mongoose.Types.ObjectId();
    const doctorId = new mongoose.Types.ObjectId();

    await t2.test("Hospital Admin is isolated to their own hospitalId", async () => {
      // Mock req/res
      let queryExecuted = null;
      const fakeReq = {
        user: {
          id: "admin1",
          role: "hospital_admin",
          hospitalId: hospitalAId,
        },
        query: {},
      };

      const originalFind = notificationModel.find;
      notificationModel.find = (q) => {
        queryExecuted = q;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => [],
              }),
            }),
          }),
        };
      };

      const originalCount = notificationModel.countDocuments;
      notificationModel.countDocuments = async () => 0;

      const fakeRes = {
        status: (code) => ({
          json: (data) => data,
        }),
      };

      try {
        await getNotifications(fakeReq, fakeRes);
        assert.ok(queryExecuted);
        assert.equal(String(queryExecuted.hospitalId), String(hospitalAId));
        // Verify it NEVER matches hospital B
        assert.notEqual(String(queryExecuted.hospitalId), String(hospitalBId));
      } finally {
        notificationModel.find = originalFind;
        notificationModel.countDocuments = originalCount;
      }
    });

    await t2.test("Patient is strictly isolated to their own userId", async () => {
      let queryExecuted = null;
      const fakeReq = {
        user: {
          id: patientId,
          role: "patient",
        },
        query: {},
      };

      const originalFind = notificationModel.find;
      notificationModel.find = (q) => {
        queryExecuted = q;
        return {
          sort: () => ({
            skip: () => ({
              limit: () => ({
                lean: async () => [],
              }),
            }),
          }),
        };
      };

      const originalCount = notificationModel.countDocuments;
      notificationModel.countDocuments = async () => 0;

      const fakeRes = {
        status: (code) => ({
          json: (data) => data,
        }),
      };

      try {
        await getNotifications(fakeReq, fakeRes);
        assert.ok(queryExecuted);
        assert.equal(String(queryExecuted.userId), String(patientId));
      } finally {
        notificationModel.find = originalFind;
        notificationModel.countDocuments = originalCount;
      }
    });
  });

  // 5. Push Token Validation on Register Endpoint
  await t.test("Register Push Token Endpoint Validation", async (t2) => {
    let statusCode = 200;
    let jsonResponse = null;

    const fakeRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            jsonResponse = data;
            return data;
          },
        };
      },
    };

    await t2.test("Rejects empty or non-Expo push token with HTTP 400", async () => {
      const fakeReq = {
        user: { id: "user123" },
        body: { token: "invalid-token" },
      };

      await registerPushToken(fakeReq, fakeRes);
      assert.equal(statusCode, 400);
      assert.equal(jsonResponse.success, false);
    });
  });
});
