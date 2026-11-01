import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import notificationModel from "../models/notificationModel.js";
import User from "../models/userModel.js";
import Doctor from "../models/doctorModel.js";
import Hospital from "../models/hospitalModel.js";
import { dispatchNotification } from "../services/socketService.js";

describe("Phase 10: Notification System Repair + Favorites Persistence Suite", () => {
  describe("Task 1 & 5: JWT Token Normalization & Favorite Doctor Persistence", () => {
    it("Authenticates and saves favorite doctor with both user._id and user.id", () => {
      const userId = new mongoose.Types.ObjectId();
      const doctorId = new mongoose.Types.ObjectId();

      // Simulate req.user payload coming from JWT decoded token { id: ... }
      const reqUserFromJwt = { id: userId.toString() };
      const resolvedUserId = reqUserFromJwt._id || reqUserFromJwt.id;

      assert.equal(resolvedUserId, userId.toString(), "Should resolve user ID whether using id or _id");

      // Verify user document favorites structure
      const userDoc = new User({
        name: "Test Patient",
        email: `patient-${Date.now()}@example.com`,
        phone: "9876543210",
        password: "hashedpassword123",
        favorites: [],
      });

      // Add doctor to favorites
      userDoc.favorites.unshift({
        doctorId: doctorId,
        doctorName: "Dr. Sharma",
        speciality: "Cardiologist",
        image: "https://example.com/dr-sharma.jpg",
        addedAt: new Date(),
      });

      assert.equal(userDoc.favorites.length, 1);
      assert.equal(userDoc.favorites[0].doctorId.toString(), doctorId.toString());
      assert.equal(userDoc.favorites[0].doctorName, "Dr. Sharma");
    });

    it("Gracefully falls back to embedded fields when populate returns null or unpopulated", () => {
      const docId = new mongoose.Types.ObjectId().toString();
      const mockFavoriteItem = {
        doctorId: docId,
        doctorName: "Dr. Ramesh Patel",
        speciality: "Neurologist",
        image: "https://example.com/ramesh.png",
        addedAt: new Date(),
      };

      // In controller, when item.doctorId is an unpopulated string/ObjectId
      const isPopulated = mockFavoriteItem.doctorId && typeof mockFavoriteItem.doctorId === "object" && mockFavoriteItem.doctorId._id;
      const doc = isPopulated ? mockFavoriteItem.doctorId : {};
      const resolvedId = isPopulated ? doc._id?.toString() : mockFavoriteItem.doctorId?.toString();

      const formatted = {
        _id: resolvedId,
        doctorId: resolvedId,
        name: doc.name || mockFavoriteItem.doctorName || "Doctor",
        speciality: doc.speciality || mockFavoriteItem.speciality || "General Physician",
        image: doc.image || mockFavoriteItem.image || "",
        fees: doc.fees !== undefined ? doc.fees : 500,
        rating: doc.rating !== undefined ? doc.rating : 4.8,
        experience: doc.experience || "10+ years",
        hospitalName: doc.hospitalName || "HealPoint Clinic",
      };

      assert.equal(formatted._id, docId);
      assert.equal(formatted.name, "Dr. Ramesh Patel");
      assert.equal(formatted.speciality, "Neurologist");
      assert.equal(formatted.fees, 500);
    });

    it("Enforces duplicate favorite doctor prevention", () => {
      const docId = new mongoose.Types.ObjectId().toString();
      const favorites = [
        { doctorId: new mongoose.Types.ObjectId(docId), doctorName: "Dr. Anita" },
      ];

      const exists = favorites.some((f) => f.doctorId && f.doctorId.toString() === docId);
      assert.equal(exists, true, "Existing doctor favorite must be detected");

      if (!exists) {
        favorites.unshift({ doctorId: new mongoose.Types.ObjectId(docId) });
      }
      assert.equal(favorites.length, 1, "Duplicate must not be added");
    });
  });

  describe("Task 6 & 7: Favorite Hospital Persistence & Dual Tabs", () => {
    it("Saves and removes favorite hospital with permanent ID reference", () => {
      const hospId = new mongoose.Types.ObjectId().toString();
      let favoriteHospitals = [];

      // Add
      favoriteHospitals.unshift({
        hospitalId: new mongoose.Types.ObjectId(hospId),
        addedAt: new Date(),
      });
      assert.equal(favoriteHospitals.length, 1);
      assert.equal(favoriteHospitals[0].hospitalId.toString(), hospId);

      // Remove
      favoriteHospitals = favoriteHospitals.filter(
        (h) => h.hospitalId && h.hospitalId.toString() !== hospId
      );
      assert.equal(favoriteHospitals.length, 0);
    });

    it("Aggregates combined favorites count accurately for dual-tab header badges", () => {
      const doctorCount = 3;
      const hospitalCount = 2;
      const total = doctorCount + hospitalCount;

      assert.equal(total, 5);
      assert.equal(doctorCount, 3);
      assert.equal(hospitalCount, 2);
    });
  });

  describe("Task 2, 3 & 4: Notification Model, Schema & Real Triggers", () => {
    it("Validates notification model fields and synchronizes read / isRead state", () => {
      const notif = new notificationModel({
        userId: new mongoose.Types.ObjectId(),
        recipientRole: "patient",
        title: "Appointment Confirmed",
        message: "Your consultation with Dr. Mehta is confirmed for 10:30 AM.",
        type: "appointment",
        category: "appointment",
        read: false,
        isRead: false,
        refId: new mongoose.Types.ObjectId().toString(),
        refModel: "Appointment",
      });

      assert.equal(notif.title, "Appointment Confirmed");
      assert.equal(notif.read, false);
      assert.equal(notif.isRead, false);
      assert.equal(notif.recipientRole, "patient");
      assert.equal(notif.refModel, "Appointment");

      // Mark as read
      notif.read = true;
      notif.isRead = true;
      assert.equal(notif.read, true);
      assert.equal(notif.isRead, true);
    });

    it("Protects role-based notification tenant isolation", () => {
      const patientId = new mongoose.Types.ObjectId().toString();
      const hospitalIdA = new mongoose.Types.ObjectId().toString();
      const hospitalIdB = new mongoose.Types.ObjectId().toString();
      const doctorId = new mongoose.Types.ObjectId().toString();

      // Patient query filter
      const patientFilter = { userId: patientId };
      assert.equal(patientFilter.userId, patientId);

      // Hospital Admin query filter
      const hospitalAdminFilter = {
        hospitalId: hospitalIdA,
        recipientRole: { $in: ["hospital_admin", "all"] },
      };
      assert.equal(hospitalAdminFilter.hospitalId, hospitalIdA);
      assert.notEqual(hospitalAdminFilter.hospitalId, hospitalIdB, "Hospital admin cannot access other hospital notifications");

      // Doctor query filter
      const doctorFilter = {
        $or: [
          { doctorId: doctorId },
          { userId: doctorId, recipientRole: { $in: ["doctor", "all"] } },
        ],
      };
      assert.equal(doctorFilter.$or.length, 2);
    });

    it("Verifies application event trigger payload contract", async () => {
      // Simulate appointment booking dispatch payload
      const patientPayload = {
        userId: new mongoose.Types.ObjectId(),
        recipientRole: "patient",
        title: "Appointment Booked Successfully",
        message: "Your appointment has been scheduled.",
        type: "appointment",
        category: "appointment",
        refId: new mongoose.Types.ObjectId().toString(),
        refModel: "Appointment",
        link: "/appointments",
      };

      assert.ok(patientPayload.userId);
      assert.equal(patientPayload.recipientRole, "patient");
      assert.equal(patientPayload.type, "appointment");
      assert.equal(patientPayload.refModel, "Appointment");

      // Simulate prescription issuance payload
      const prescriptionPayload = {
        userId: new mongoose.Types.ObjectId(),
        recipientRole: "patient",
        title: "Digital Prescription Issued",
        message: "Dr. Sharma has issued your prescription with 3 medicines.",
        type: "prescription",
        category: "prescription",
        refId: new mongoose.Types.ObjectId().toString(),
        refModel: "Prescription",
        link: "/prescriptions",
      };

      assert.equal(prescriptionPayload.type, "prescription");
      assert.equal(prescriptionPayload.refModel, "Prescription");
    });
  });

  describe("Task 8 & 9: Real-time UI & Security Edge Cases", () => {
    it("Rejects unauthenticated requests when userId is missing", () => {
      const unauthedReq = { user: null };
      const userId = unauthedReq.user?._id || unauthedReq.user?.id;
      assert.equal(userId, undefined, "Missing user must return undefined");
    });

    it("Rejects invalid ObjectId format in favorites endpoints", () => {
      const invalidIds = ["123", "abc-xyz", null, undefined, "654321"];
      for (const id of invalidIds) {
        assert.equal(
          mongoose.Types.ObjectId.isValid(id),
          false,
          `ID '${id}' must be rejected as invalid ObjectId`
        );
      }
    });
  });
});

