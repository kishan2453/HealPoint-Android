import mongoose from "mongoose";
import userModel from "../models/userModel.js";
import appointmentModel from "../models/appointmentModel.js";
import healthDocumentModel from "../models/healthDocumentModel.js";

/**
 * Validates whether the authenticated requester has access to targetUserId's family data.
 */
const authorizeUserAccess = (req, targetUserId) => {
  if (!req.user) return false;
  const requesterId = (req.user.id || req.user._id)?.toString();
  const targetId = targetUserId?.toString();
  if (requesterId === targetId) return true;
  // Hospital Admins, Super Admins, and Doctors have clinical/administrative read access
  const role = req.user.role?.toLowerCase();
  return (
    role === "admin" ||
    role === "super_admin" ||
    role === "hospital_admin" ||
    role === "doctor"
  );
};

/**
 * Fetch all family members for a user.
 * Supports query: includeArchived=true|false (default: false)
 */
export const getFamilyMembers = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    if (!authorizeUserAccess(req, targetUserId)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to family members",
      });
    }

    const user = await userModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const includeArchived =
      req.query.includeArchived === "true" || req.query.includeArchived === true;
    const allMembers = user.familyMembers || [];
    const members = includeArchived
      ? allMembers
      : allMembers.filter((m) => !m.isArchived);

    return res.status(200).json({
      success: true,
      count: members.length,
      familyMembers: members,
      data: members,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Fetch a single family member by ID.
 */
export const getFamilyMemberById = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    const { memberId } = req.params;

    if (!authorizeUserAccess(req, targetUserId)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to family member details",
      });
    }

    const user = await userModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const member = user.familyMembers?.find(
      (m) => m._id.toString() === memberId.toString()
    );

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Family member not found",
      });
    }

    return res.status(200).json({
      success: true,
      familyMember: member,
      data: member,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add a new family member to user profile.
 */
export const addFamilyMember = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    const requesterId = (req.user.id || req.user._id)?.toString();

    if (requesterId !== targetUserId?.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only add family members to your own account",
      });
    }

    const {
      name,
      relationship,
      gender,
      dob,
      phone,
      bloodGroup,
      allergies,
      chronicConditions,
      image,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Family member name is required",
      });
    }

    if (!relationship || !relationship.trim()) {
      return res.status(400).json({
        success: false,
        message: "Relationship is required",
      });
    }

    const user = await userModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check duplicate: prevent duplicate active member with identical name & relationship
    const trimmedName = name.trim().toLowerCase();
    const trimmedRel = relationship.trim().toLowerCase();
    const existingDuplicate = user.familyMembers?.find(
      (m) =>
        !m.isArchived &&
        m.name.trim().toLowerCase() === trimmedName &&
        m.relationship.trim().toLowerCase() === trimmedRel
    );

    if (existingDuplicate) {
      return res.status(400).json({
        success: false,
        message: "A family member with this name and relationship already exists",
      });
    }

    // Optional subscription family member quota check
    const activeMembersCount =
      user.familyMembers?.filter((m) => !m.isArchived).length || 0;
    const planLimit = user.currentSubscription?.familyMembersLimit;
    if (planLimit && activeMembersCount >= planLimit) {
      return res.status(403).json({
        success: false,
        code: "FAMILY_LIMIT_REACHED",
        message: `Your current plan allows up to ${planLimit} family members. Please upgrade your plan to add more.`,
      });
    }

    const newMember = {
      name: name.trim(),
      relationship: relationship.trim(),
      gender: gender || "other",
      dob: dob || "",
      phone: phone ? phone.trim() : "",
      bloodGroup: bloodGroup ? bloodGroup.trim() : "",
      allergies: Array.isArray(allergies)
        ? allergies
        : allergies
        ? [allergies]
        : [],
      chronicConditions: Array.isArray(chronicConditions)
        ? chronicConditions
        : chronicConditions
        ? [chronicConditions]
        : [],
      image: image || "",
      isArchived: false,
      createdAt: new Date(),
    };

    user.familyMembers.push(newMember);
    await user.save();

    const createdMember = user.familyMembers[user.familyMembers.length - 1];

    return res.status(201).json({
      success: true,
      message: "Family member added successfully",
      familyMember: createdMember,
      data: createdMember,
      familyMembers: user.familyMembers.filter((m) => !m.isArchived),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update an existing family member profile.
 */
export const updateFamilyMember = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    const { memberId } = req.params;
    const requesterId = (req.user.id || req.user._id)?.toString();

    if (requesterId !== targetUserId?.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update family members on your own account",
      });
    }

    const user = await userModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const member = user.familyMembers?.id
      ? user.familyMembers.id(memberId)
      : user.familyMembers?.find((m) => m._id.toString() === memberId.toString());

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "Family member not found",
      });
    }

    const {
      name,
      relationship,
      gender,
      dob,
      phone,
      bloodGroup,
      allergies,
      chronicConditions,
      image,
      isArchived,
    } = req.body;

    if (name !== undefined) member.name = name.trim();
    if (relationship !== undefined) member.relationship = relationship.trim();
    if (gender !== undefined) member.gender = gender;
    if (dob !== undefined) member.dob = dob;
    if (phone !== undefined) member.phone = phone.trim();
    if (bloodGroup !== undefined) member.bloodGroup = bloodGroup.trim();
    if (allergies !== undefined) {
      member.allergies = Array.isArray(allergies)
        ? allergies
        : allergies
        ? [allergies]
        : [];
    }
    if (chronicConditions !== undefined) {
      member.chronicConditions = Array.isArray(chronicConditions)
        ? chronicConditions
        : chronicConditions
        ? [chronicConditions]
        : [];
    }
    if (image !== undefined) member.image = image;
    if (isArchived !== undefined) member.isArchived = Boolean(isArchived);

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Family member updated successfully",
      familyMember: member,
      data: member,
      familyMembers: user.familyMembers.filter((m) => !m.isArchived),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove or archive a family member.
 * If historical appointments or medical documents exist, safe archive (isArchived: true).
 */
export const deleteFamilyMember = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    const { memberId } = req.params;
    const requesterId = (req.user.id || req.user._id)?.toString();

    if (requesterId !== targetUserId?.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only remove family members from your own account",
      });
    }

    const user = await userModel.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const memberIndex = user.familyMembers?.findIndex(
      (m) => m._id.toString() === memberId.toString()
    );

    if (memberIndex === -1 || memberIndex === undefined) {
      return res.status(404).json({
        success: false,
        message: "Family member not found",
      });
    }

    const forceArchive =
      req.query.archive === "true" || req.query.archive === true;

    // Check if appointments or documents exist for this member
    let hasRecords = false;
    if (!forceArchive) {
      const [apptCount, docCount] = await Promise.all([
        appointmentModel.countDocuments({
          userId: targetUserId,
          familyMemberId: memberId,
        }),
        healthDocumentModel.countDocuments({
          userId: targetUserId,
          familyMemberId: memberId,
        }),
      ]);
      hasRecords = apptCount > 0 || docCount > 0;
    }

    if (forceArchive || hasRecords) {
      // Safe Archive to preserve medical and appointment history
      user.familyMembers[memberIndex].isArchived = true;
      await user.save();

      return res.status(200).json({
        success: true,
        archived: true,
        message:
          "Family member has historical health records and was safely archived.",
        familyMembers: user.familyMembers.filter((m) => !m.isArchived),
      });
    }

    // Hard delete if no records ever existed
    user.familyMembers.splice(memberIndex, 1);
    await user.save();

    return res.status(200).json({
      success: true,
      archived: false,
      message: "Family member removed successfully.",
      familyMembers: user.familyMembers.filter((m) => !m.isArchived),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

