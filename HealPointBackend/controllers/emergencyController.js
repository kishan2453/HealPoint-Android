import mongoose from "mongoose";
import EmergencyRequest from "../models/emergencyRequestModel.js";
import userModel from "../models/userModel.js";
import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";
import {
  broadcastEmergencyAlert,
  broadcastEmergencyStatus,
  dispatchNotification,
} from "../services/socketService.js";

/**
 * Trigger an Emergency SOS request (Patient)
 */
export const createEmergencyRequest = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?._id;
    if (!patientId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await userModel.findById(patientId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "Patient not found" });
    }

    const {
      hospitalId,
      emergencyType = "other",
      severity = "critical",
      notes = "",
      location = {},
      emergencyContacts: customContacts,
    } = req.body;

    // Check if patient already has an active emergency (pending, accepted, in_progress)
    const existingActive = await EmergencyRequest.findOne({
      patientId,
      status: { $in: ["pending", "accepted", "in_progress"] },
    }).sort({ createdAt: -1 });

    if (existingActive) {
      // If active emergency is already present, update its location and return it
      if (location && location.latitude && location.longitude) {
        existingActive.location = {
          ...existingActive.location,
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          address: location.address || existingActive.location.address,
          sharedAt: new Date(),
        };
        await existingActive.save();
        broadcastEmergencyStatus(existingActive);
      }

      return res.status(200).json({
        success: true,
        message: "Active emergency SOS is already in progress.",
        data: existingActive,
        isExisting: true,
      });
    }

    // Build contacts snapshot from user profile or custom contacts passed
    const contactsSnapshot =
      Array.isArray(customContacts) && customContacts.length > 0
        ? customContacts
        : Array.isArray(user.emergencyContacts) && user.emergencyContacts.length > 0
        ? user.emergencyContacts
        : user.emergencyContact?.phone
        ? [
            {
              name: user.emergencyContact.name || "Emergency Contact",
              phone: user.emergencyContact.phone,
              relation: user.emergencyContact.relation || "Contact",
              isPrimary: true,
            },
          ]
        : [];

    // Calculate approximate age from DOB if available
    let age = undefined;
    if (user.dob) {
      const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(user.dob);
      if (match) {
        const birthYear = parseInt(match[3], 10);
        age = new Date().getFullYear() - birthYear;
      }
    }

    let targetHospitalId = hospitalId;
    if (!targetHospitalId) {
      // Find nearest active hospital or default to first active hospital
      const defaultHospital = await hospitalModel.findOne({ isActive: { $ne: false } }).sort({ rating: -1 });
      if (defaultHospital) {
        targetHospitalId = defaultHospital._id;
      }
    }

    const newEmergency = new EmergencyRequest({
      patientId,
      hospitalId: targetHospitalId,
      emergencyType,
      severity,
      notes,
      location: {
        latitude: location.latitude ? Number(location.latitude) : undefined,
        longitude: location.longitude ? Number(location.longitude) : undefined,
        address: location.address || "Location coordinates shared",
        accuracy: location.accuracy ? Number(location.accuracy) : undefined,
        sharedAt: new Date(),
      },
      patientSnapshot: {
        name: user.name,
        phone: user.phone || "",
        age,
        gender: user.gender || "other",
        bloodGroup: user.bloodGroup || "",
        allergies: user.allergies || [],
        chronicConditions: user.chronicConditions || [],
      },
      emergencyContacts: contactsSnapshot,
      status: "pending",
      statusHistory: [
        {
          status: "pending",
          updatedBy: patientId,
          role: "patient",
          timestamp: new Date(),
          note: "Emergency SOS triggered by patient",
        },
      ],
    });

    await newEmergency.save();

    // Broadcast real-time emergency alert via Socket.IO
    broadcastEmergencyAlert(newEmergency);

    // Dispatch notifications to hospital & super admin
    if (targetHospitalId) {
      dispatchNotification({
        hospitalId: targetHospitalId,
        type: "emergency",
        category: "emergency",
        title: "🚨 CRITICAL EMERGENCY SOS ALERT!",
        message: `Patient ${user.name} has triggered an Emergency SOS (${emergencyType.toUpperCase()}). Location: ${newEmergency.location.address || "GPS shared"}.`,
        priority: "urgent",
        meta: { emergencyId: String(newEmergency._id) },
      }).catch((err) => console.warn("[emergency] Notification dispatch warning:", err.message));
    }

    return res.status(201).json({
      success: true,
      message: "DEMO MODE: This is a simulated emergency request. No real hospital, ambulance or emergency service has been contacted.",
      isDemo: true,
      isSimulation: true,
      data: newEmergency,
    });
  } catch (error) {
    console.error("[createEmergencyRequest] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get active emergency for patient
 */
export const getActivePatientEmergency = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?._id;
    if (!patientId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const activeEmergency = await EmergencyRequest.findOne({
      patientId,
      status: { $in: ["pending", "accepted", "in_progress"] },
    })
      .populate("hospitalId", "name phone address emergency rating")
      .populate("assignedDoctorId", "name speciality image phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      activeEmergency: activeEmergency || null,
    });
  } catch (error) {
    console.error("[getActivePatientEmergency] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get emergency history for patient
 */
export const getPatientEmergencyHistory = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?._id;
    if (!patientId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const emergencies = await EmergencyRequest.find({ patientId })
      .populate("hospitalId", "name phone address emergency")
      .populate("assignedDoctorId", "name speciality")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies,
    });
  } catch (error) {
    console.error("[getPatientEmergencyHistory] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancel emergency request (Patient or authorized Admin)
 */
export const cancelEmergencyRequest = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    const { reason = "False alarm / patient cancelled" } = req.body;

    const emergency = await EmergencyRequest.findById(id);
    if (!emergency) {
      return res.status(404).json({ success: false, message: "Emergency request not found" });
    }

    const isPatient = String(emergency.patientId) === String(userId);
    const isAdmin = Boolean(
      req.user?.role === "admin" ||
      req.user?.role === "super_admin" ||
      req.user?.role === "hospital_admin"
    );

    if (!isPatient && !isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: unauthorized cancellation" });
    }

    if (emergency.status === "resolved") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel an emergency that has already been resolved.",
      });
    }

    emergency.status = "cancelled";
    emergency.cancellationDetails = {
      cancelledBy: userId,
      cancelledAt: new Date(),
      reason,
    };
    emergency.statusHistory.push({
      status: "cancelled",
      updatedBy: userId,
      role: req.user?.role || "patient",
      timestamp: new Date(),
      note: reason,
    });

    await emergency.save();
    broadcastEmergencyStatus(emergency);

    return res.status(200).json({
      success: true,
      message: "Emergency request cancelled successfully.",
      data: emergency,
    });
  } catch (error) {
    console.error("[cancelEmergencyRequest] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Hospital Emergencies (Hospital Admin / Staff)
 */
export const getHospitalEmergencies = async (req, res) => {
  try {
    const hospitalId = req.hospitalId || req.user?.hospitalId || req.query?.hospitalId;
    if (!hospitalId && req.user?.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Hospital context required to view emergency queue",
      });
    }

    const { status, limit = 50 } = req.query;

    const filter = {};
    if (hospitalId) {
      filter.$or = [{ hospitalId }, { hospitalId: null }];
    }

    if (status && status !== "all") {
      if (status === "active") {
        filter.status = { $in: ["pending", "accepted", "in_progress"] };
      } else {
        filter.status = status;
      }
    }

    const emergencies = await EmergencyRequest.find(filter)
      .populate("patientId", "name email phone image bloodGroup")
      .populate("assignedDoctorId", "name speciality phone")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      count: emergencies.length,
      emergencies,
    });
  } catch (error) {
    console.error("[getHospitalEmergencies] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update Emergency Status (Hospital Admin / Doctor)
 */
export const updateEmergencyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note = "", clinicalNotes = "", outcome = "", assignedDoctorId } = req.body;

    const validStatuses = ["pending", "accepted", "in_progress", "resolved", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid emergency status" });
    }

    const emergency = await EmergencyRequest.findById(id);
    if (!emergency) {
      return res.status(404).json({ success: false, message: "Emergency request not found" });
    }

    if (emergency.status === "resolved" && status !== "resolved") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a resolved emergency request.",
      });
    }

    const userId = req.user?.id || req.user?._id;
    const userRole = req.user?.role || "hospital_admin";

    // Auto-claim to hospital if unassigned
    if (!emergency.hospitalId && req.user?.hospitalId) {
      emergency.hospitalId = req.user.hospitalId;
    }

    if (assignedDoctorId) {
      emergency.assignedDoctorId = assignedDoctorId;
    }

    emergency.status = status;

    if (status === "resolved") {
      emergency.resolutionDetails = {
        resolvedBy: userId,
        resolvedAt: new Date(),
        clinicalNotes: clinicalNotes || note,
        outcome: outcome || "Treated & Stabilized",
      };
    }

    emergency.statusHistory.push({
      status,
      updatedBy: userId,
      role: userRole,
      timestamp: new Date(),
      note: note || `Status updated to ${status}`,
    });

    await emergency.save();
    broadcastEmergencyStatus(emergency);

    // Notify patient about the update
    if (emergency.patientId) {
      let title = "Emergency SOS Update";
      let msg = `Your emergency status is now: ${status.replace("_", " ").toUpperCase()}`;
      if (status === "accepted") {
        title = "Hospital Responded!";
        msg = "The hospital emergency desk has acknowledged your SOS. Emergency staff are attending.";
      } else if (status === "resolved") {
        title = "Emergency Case Closed";
        msg = "Your emergency case has been marked as resolved.";
      }

      dispatchNotification({
        userId: emergency.patientId,
        type: "emergency",
        category: "emergency",
        title,
        message: msg,
        priority: "urgent",
        meta: { emergencyId: String(emergency._id), status },
      }).catch((err) => console.warn("[emergency] Notification warning:", err.message));
    }

    return res.status(200).json({
      success: true,
      message: `Emergency status updated to ${status}`,
      data: emergency,
    });
  } catch (error) {
    console.error("[updateEmergencyStatus] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Dispatch Ambulance (Hospital Admin)
 */
export const dispatchAmbulance = async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicleNumber, driverName, driverPhone, etaMinutes = 15 } = req.body;

    if (!vehicleNumber || !driverName || !driverPhone) {
      return res.status(400).json({
        success: false,
        message: "Vehicle number, driver name, and driver phone number are required to dispatch ambulance.",
      });
    }

    const emergency = await EmergencyRequest.findById(id);
    if (!emergency) {
      return res.status(404).json({ success: false, message: "Emergency request not found" });
    }

    emergency.ambulance = {
      isDispatched: true,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      driverName: driverName.trim(),
      driverPhone: driverPhone.trim(),
      etaMinutes: Math.max(1, Number(etaMinutes) || 15),
      dispatchedAt: new Date(),
    };

    if (emergency.status === "pending" || emergency.status === "accepted") {
      emergency.status = "in_progress";
    }

    const userId = req.user?.id || req.user?._id;
    emergency.statusHistory.push({
      status: "in_progress",
      updatedBy: userId,
      role: req.user?.role || "hospital_admin",
      timestamp: new Date(),
      note: `Ambulance dispatched: ${emergency.ambulance.vehicleNumber} (Driver: ${emergency.ambulance.driverName}, ETA: ${emergency.ambulance.etaMinutes} mins)`,
    });

    await emergency.save();
    broadcastEmergencyStatus(emergency);

    // Urgent notification to patient
    if (emergency.patientId) {
      dispatchNotification({
        userId: emergency.patientId,
        type: "emergency",
        category: "emergency",
        title: "🚑 Ambulance Dispatched!",
        message: `Ambulance ${emergency.ambulance.vehicleNumber} is on the way! Driver: ${emergency.ambulance.driverName} (${emergency.ambulance.driverPhone}). Estimated ETA: ${emergency.ambulance.etaMinutes} minutes.`,
        priority: "urgent",
        meta: { emergencyId: String(emergency._id), ambulance: emergency.ambulance },
      }).catch((err) => console.warn("[dispatchAmbulance] Notification warning:", err.message));
    }

    return res.status(200).json({
      success: true,
      message: "DEMO MODE: Ambulance dispatch simulated. No real hospital or ambulance has been contacted.",
      isDemo: true,
      isSimulation: true,
      data: emergency,
    });
  } catch (error) {
    console.error("[dispatchAmbulance] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manage Emergency Contacts (Patient)
 */
export const getEmergencyContacts = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?._id;
    const user = await userModel.findById(patientId).select("emergencyContact emergencyContacts");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const contacts = Array.isArray(user.emergencyContacts) ? user.emergencyContacts : [];
    // If list is empty but legacy single contact exists, format it
    if (contacts.length === 0 && user.emergencyContact?.phone) {
      contacts.push({
        name: user.emergencyContact.name,
        phone: user.emergencyContact.phone,
        relation: user.emergencyContact.relation,
        isPrimary: true,
      });
    }

    return res.status(200).json({
      success: true,
      contacts,
    });
  } catch (error) {
    console.error("[getEmergencyContacts] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveEmergencyContact = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?._id;
    const { name, phone, relation = "Family", isPrimary = false, contactId } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone number are required for emergency contact.",
      });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit phone number.",
      });
    }

    const user = await userModel.findById(patientId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!Array.isArray(user.emergencyContacts)) {
      user.emergencyContacts = [];
    }

    if (isPrimary) {
      user.emergencyContacts.forEach((c) => {
        c.isPrimary = false;
      });
    }

    if (contactId) {
      const idx = user.emergencyContacts.findIndex((c) => String(c._id) === String(contactId));
      if (idx !== -1) {
        user.emergencyContacts[idx].name = name.trim();
        user.emergencyContacts[idx].phone = phone.trim();
        user.emergencyContacts[idx].relation = relation.trim();
        user.emergencyContacts[idx].isPrimary = Boolean(isPrimary);
      }
    } else {
      const shouldBePrimary = user.emergencyContacts.length === 0 || Boolean(isPrimary);
      user.emergencyContacts.push({
        name: name.trim(),
        phone: phone.trim(),
        relation: relation.trim(),
        isPrimary: shouldBePrimary,
        createdAt: new Date(),
      });
    }

    // Keep legacy single contact synchronized with primary contact
    const primaryContact = user.emergencyContacts.find((c) => c.isPrimary) || user.emergencyContacts[0];
    if (primaryContact) {
      user.emergencyContact = {
        name: primaryContact.name,
        phone: primaryContact.phone,
        relation: primaryContact.relation,
      };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Emergency contact saved successfully.",
      contacts: user.emergencyContacts,
    });
  } catch (error) {
    console.error("[saveEmergencyContact] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEmergencyContact = async (req, res) => {
  try {
    const patientId = req.user?.id || req.user?._id;
    const { contactId } = req.params;

    const user = await userModel.findById(patientId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (Array.isArray(user.emergencyContacts)) {
      user.emergencyContacts = user.emergencyContacts.filter(
        (c) => String(c._id) !== String(contactId)
      );
      if (user.emergencyContacts.length > 0 && !user.emergencyContacts.some((c) => c.isPrimary)) {
        user.emergencyContacts[0].isPrimary = true;
      }
      const primaryContact = user.emergencyContacts.find((c) => c.isPrimary);
      if (primaryContact) {
        user.emergencyContact = {
          name: primaryContact.name,
          phone: primaryContact.phone,
          relation: primaryContact.relation,
        };
      } else {
        user.emergencyContact = { name: "", phone: "", relation: "" };
      }
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Emergency contact deleted.",
      contacts: user.emergencyContacts || [],
    });
  } catch (error) {
    console.error("[deleteEmergencyContact] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Super Admin Platform Emergency Overview
 */
export const getSuperAdminEmergencyOverview = async (req, res) => {
  try {
    const [
      totalCount,
      activeCount,
      resolvedCount,
      cancelledCount,
      byTypeAgg,
      byHospitalAgg,
      recentEmergencies,
    ] = await Promise.all([
      EmergencyRequest.countDocuments(),
      EmergencyRequest.countDocuments({ status: { $in: ["pending", "accepted", "in_progress"] } }),
      EmergencyRequest.countDocuments({ status: "resolved" }),
      EmergencyRequest.countDocuments({ status: "cancelled" }),
      EmergencyRequest.aggregate([
        { $group: { _id: "$emergencyType", count: { $sum: 1 } } },
      ]),
      EmergencyRequest.aggregate([
        { $group: { _id: "$hospitalId", count: { $sum: 1 } } },
        { $lookup: { from: "hospitals", localField: "_id", foreignField: "_id", as: "hospital" } },
        { $unwind: { path: "$hospital", preserveNullAndEmptyArrays: true } },
        { $project: { hospitalName: { $ifNull: ["$hospital.name", "Unassigned"] }, count: 1 } },
      ]),
      EmergencyRequest.find()
        .populate("patientId", "name email phone")
        .populate("hospitalId", "name emergency")
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        total: totalCount,
        active: activeCount,
        resolved: resolvedCount,
        cancelled: cancelledCount,
        byType: byTypeAgg.map((b) => ({ type: b._id, count: b.count })),
        byHospital: byHospitalAgg,
      },
      recentEmergencies,
    });
  } catch (error) {
    console.error("[getSuperAdminEmergencyOverview] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

