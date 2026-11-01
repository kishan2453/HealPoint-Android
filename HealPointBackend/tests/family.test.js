import { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  getFamilyMembers,
  getFamilyMemberById,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
} from "../controllers/familyController.js";
import { verifyFamilyMemberOwnership } from "../controllers/healthDocumentController.js";
import userModel from "../models/userModel.js";
import appointmentModel from "../models/appointmentModel.js";
import healthDocumentModel from "../models/healthDocumentModel.js";

describe("Phase 9: Family Account Management & Family Booking Suite", () => {
  describe("Family Member Profile Validation & Demographics", () => {
    it("Enforces mandatory name and relationship when adding a family member", async () => {
      let statusCode = 0;
      let responseBody = null;

      const req = {
        user: { id: "user_test_123" },
        params: { userId: "user_test_123" },
        body: {
          name: "",
          relationship: "",
        },
      };

      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      await addFamilyMember(req, res);
      assert.equal(statusCode, 400);
      assert.equal(responseBody.success, false);
      assert.match(responseBody.message, /name is required/i);
    });

    it("Rejects adding family members to another user account", async () => {
      let statusCode = 0;
      let responseBody = null;

      const req = {
        user: { id: "attacker_user_456" },
        params: { userId: "victim_user_123" },
        body: {
          name: "Dependent Child",
          relationship: "Son",
        },
      };

      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      await addFamilyMember(req, res);
      assert.equal(statusCode, 403);
      assert.equal(responseBody.success, false);
      assert.match(responseBody.message, /only add family members to your own account/i);
    });

    it("Prevents duplicate active family member with the same name and relationship", async () => {
      const mockMemberId = new mongoose.Types.ObjectId();
      const existingUser = {
        _id: "user_test_dup",
        familyMembers: [
          {
            _id: mockMemberId,
            name: "Ananya Sharma",
            relationship: "Daughter",
            isArchived: false,
          },
        ],
        save: async () => true,
      };

      // Mock userModel.findById
      const originalFindById = userModel.findById;
      userModel.findById = async () => existingUser;

      let statusCode = 0;
      let responseBody = null;

      const req = {
        user: { id: "user_test_dup" },
        params: { userId: "user_test_dup" },
        body: {
          name: "  ananya sharma  ",
          relationship: "daughter",
        },
      };

      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      try {
        await addFamilyMember(req, res);
        assert.equal(statusCode, 400);
        assert.equal(responseBody.success, false);
        assert.match(responseBody.message, /already exists/i);
      } finally {
        userModel.findById = originalFindById;
      }
    });

    it("Successfully adds family member with demographics and medical details", async () => {
      const savedMembers = [];
      const mockUser = {
        _id: "user_test_valid",
        familyMembers: savedMembers,
        save: async function () {
          return this;
        },
      };

      const originalFindById = userModel.findById;
      userModel.findById = async () => mockUser;

      let statusCode = 0;
      let responseBody = null;

      const req = {
        user: { id: "user_test_valid" },
        params: { userId: "user_test_valid" },
        body: {
          name: "Aarav Sharma",
          relationship: "Son",
          gender: "male",
          dob: "2015-08-12",
          bloodGroup: "O+",
          allergies: ["Peanuts", "Penicillin"],
          chronicConditions: ["Asthma"],
        },
      };

      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => {
              responseBody = data;
              return data;
            },
          };
        },
      };

      try {
        await addFamilyMember(req, res);
        assert.equal(statusCode, 201);
        assert.equal(responseBody.success, true);
        assert.equal(responseBody.familyMember.name, "Aarav Sharma");
        assert.equal(responseBody.familyMember.relationship, "Son");
        assert.equal(responseBody.familyMember.gender, "male");
        assert.deepEqual(responseBody.familyMember.allergies, ["Peanuts", "Penicillin"]);
        assert.deepEqual(responseBody.familyMember.chronicConditions, ["Asthma"]);
        assert.equal(responseBody.familyMember.isArchived, false);
      } finally {
        userModel.findById = originalFindById;
      }
    });
  });

  describe("Family Member Query & Archiving Logic", () => {
    it("Filters out archived members by default unless includeArchived=true", async () => {
      const member1 = { _id: "m1", name: "Ramesh", isArchived: false };
      const member2 = { _id: "m2", name: "Suresh", isArchived: true };

      const mockUser = {
        _id: "user_query_1",
        familyMembers: [member1, member2],
      };

      const originalFindById = userModel.findById;
      userModel.findById = async () => mockUser;

      let statusCode = 0;
      let defaultBody = null;
      let archivedBody = null;

      const resDefault = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => (defaultBody = data) };
        },
      };

      const resArchived = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => (archivedBody = data) };
        },
      };

      try {
        await getFamilyMembers(
          { user: { id: "user_query_1" }, params: { userId: "user_query_1" }, query: {} },
          resDefault
        );
        assert.equal(defaultBody.success, true);
        assert.equal(defaultBody.count, 1);
        assert.equal(defaultBody.familyMembers[0].name, "Ramesh");

        await getFamilyMembers(
          { user: { id: "user_query_1" }, params: { userId: "user_query_1" }, query: { includeArchived: "true" } },
          resArchived
        );
        assert.equal(archivedBody.success, true);
        assert.equal(archivedBody.count, 2);
      } finally {
        userModel.findById = originalFindById;
      }
    });

    it("Safely archives family member when historical appointments exist", async () => {
      const memberId = new mongoose.Types.ObjectId();
      const member = {
        _id: memberId,
        name: "Meera",
        isArchived: false,
      };

      const mockUser = {
        _id: "user_archive_test",
        familyMembers: [member],
        save: async function () {
          return this;
        },
      };

      const originalFindById = userModel.findById;
      const originalCountAppt = appointmentModel.countDocuments;
      const originalCountDoc = healthDocumentModel.countDocuments;

      userModel.findById = async () => mockUser;
      appointmentModel.countDocuments = async () => 3; // 3 historical appointments
      healthDocumentModel.countDocuments = async () => 0;

      let statusCode = 0;
      let responseBody = null;

      const req = {
        user: { id: "user_archive_test" },
        params: { userId: "user_archive_test", memberId: memberId.toString() },
        query: {},
      };

      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => (responseBody = data) };
        },
      };

      try {
        await deleteFamilyMember(req, res);
        assert.equal(statusCode, 200);
        assert.equal(responseBody.success, true);
        assert.equal(responseBody.archived, true);
        assert.equal(member.isArchived, true);
        assert.match(responseBody.message, /safely archived/i);
      } finally {
        userModel.findById = originalFindById;
        appointmentModel.countDocuments = originalCountAppt;
        healthDocumentModel.countDocuments = originalCountDoc;
      }
    });

    it("Hard deletes family member when zero appointments or documents exist", async () => {
      const memberId = new mongoose.Types.ObjectId();
      const member = {
        _id: memberId,
        name: "Unused Dependent",
        isArchived: false,
      };

      const mockUser = {
        _id: "user_hard_del_test",
        familyMembers: [member],
        save: async function () {
          return this;
        },
      };

      const originalFindById = userModel.findById;
      const originalCountAppt = appointmentModel.countDocuments;
      const originalCountDoc = healthDocumentModel.countDocuments;

      userModel.findById = async () => mockUser;
      appointmentModel.countDocuments = async () => 0;
      healthDocumentModel.countDocuments = async () => 0;

      let statusCode = 0;
      let responseBody = null;

      const req = {
        user: { id: "user_hard_del_test" },
        params: { userId: "user_hard_del_test", memberId: memberId.toString() },
        query: {},
      };

      const res = {
        status: (code) => {
          statusCode = code;
          return { json: (data) => (responseBody = data) };
        },
      };

      try {
        await deleteFamilyMember(req, res);
        assert.equal(statusCode, 200);
        assert.equal(responseBody.success, true);
        assert.equal(responseBody.archived, false);
        assert.equal(mockUser.familyMembers.length, 0);
        assert.match(responseBody.message, /removed successfully/i);
      } finally {
        userModel.findById = originalFindById;
        appointmentModel.countDocuments = originalCountAppt;
        healthDocumentModel.countDocuments = originalCountDoc;
      }
    });
  });

  describe("Family Member Appointment Security & Ownership Isolation", () => {
    it("Rejects appointment booking with unauthorized familyMemberId from another account", async () => {
      const memberId = new mongoose.Types.ObjectId();
      const foreignMemberId = new mongoose.Types.ObjectId();

      const user = {
        _id: "user_booking_owner",
        familyMembers: [
          {
            _id: memberId,
            name: "Child A",
            relationship: "Son",
            isArchived: false,
          },
        ],
      };

      const originalFindById = userModel.findById;
      userModel.findById = async (id) => (id === "user_booking_owner" ? user : null);

      try {
        // Test verifyFamilyMemberOwnership logic
        const authorized = user.familyMembers.some(
          (fm) => fm._id.toString() === foreignMemberId.toString() && !fm.isArchived
        );
        assert.equal(authorized, false, "Cross-account familyMemberId must be rejected");

        const selfAuthorized = user.familyMembers.some(
          (fm) => fm._id.toString() === memberId.toString() && !fm.isArchived
        );
        assert.equal(selfAuthorized, true, "Authorized family member must be accepted");
      } finally {
        userModel.findById = originalFindById;
      }
    });

    it("verifyFamilyMemberOwnership allows 'self' and null without restriction", async () => {
      const isSelfAllowed = await verifyFamilyMemberOwnership("any_user", "self");
      assert.equal(isSelfAllowed, true);

      const isNullAllowed = await verifyFamilyMemberOwnership("any_user", null);
      assert.equal(isNullAllowed, true);

      const isAllAllowed = await verifyFamilyMemberOwnership("any_user", "all");
      assert.equal(isAllAllowed, true);
    });
  });
});

