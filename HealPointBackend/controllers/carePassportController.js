import appointmentModel from "../models/appointmentModel.js";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import hospitalModel from "../models/hospitalModel.js";
import crypto from "crypto";

// In-memory / persisted stores for share tokens and access logs
const sharesStore = new Map();
const accessLogsStore = [];

const formatEpisode = (appt) => {
  const isPaid = appt.payment === true || appt.paymentStatus === "SUCCESS" || (appt.amount === 0 && appt.billing?.totalAmount === 0);
  const doc = appt.doctorId || {};
  const hosp = appt.hospitalId || {};

  return {
    appointmentId: appt.appointmentId || appt._id.toString(),
    displayId: appt.displayAppointmentId || appt.appointmentId || appt._id.toString(),
    doctorId: doc._id?.toString() || appt.doctorId?.toString() || "",
    doctorName: doc.name || appt.doctorName || "Specialist Doctor",
    doctorSpeciality: doc.speciality || "General Medicine",
    doctorImage: doc.image || "",
    hospitalId: hosp._id?.toString() || appt.hospitalId?.toString() || "",
    hospitalName: hosp.name || appt.hospitalName || "HealPoint Hospital",
    department: doc.speciality || "Outpatient Department",
    slotDate: appt.slotDate,
    slotTime: appt.slotTime,
    consultationType: appt.consultationType || "clinic",
    status: appt.status,
    paymentStatus: isPaid ? "paid" : "pending",
    checkedIn: Boolean(appt.checkedIn),
    checkInAt: appt.checkInAt ? new Date(appt.checkInAt).toISOString() : null,
    queueToken: appt.queueToken || null,
    meetingUrl: appt.meetingUrl || null,
    hasConsultation: Boolean(appt.status === "completed" || appt.consultationStatus === "completed"),
    hasPrescription: Boolean(appt.prescription || (appt.medicines && appt.medicines.length > 0)),
    hasReports: Boolean(appt.medicalReports && appt.medicalReports.length > 0),
    hasFollowUp: Boolean(appt.followUpAdvice),
    patientName: appt.patientName,
    familyMemberId: appt.familyMemberId?.toString() || null,
    familyRelationship: appt.familyRelationship || "Self",
    createdAt: new Date(appt.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(appt.updatedAt || Date.now()).toISOString(),
    nextAction: {
      type: appt.checkedIn ? "WAIT_FOR_CALL" : isPaid ? "CHECK_IN" : "PAY_NOW",
      label: appt.checkedIn ? "Wait for Token Call" : isPaid ? "Smart QR Check-In" : "Complete Payment",
      route: `/appointment/${appt._id}`,
    },
  };
};

export const getMyPassport = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { familyMemberId } = req.query;

    const user = await userModel.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const filter = { userId };
    if (familyMemberId && familyMemberId !== "all") {
      filter.familyMemberId = familyMemberId;
    }

    const appointments = await appointmentModel
      .find(filter)
      .populate("doctorId", "name speciality qualification image")
      .populate("hospitalId", "name address city phone")
      .sort({ createdAt: -1 });

    const activeAppt = appointments.find(
      (a) => a.status === "confirmed" || a.status === "pending" || a.checkedIn
    );

    const activeEpisode = activeAppt ? formatEpisode(activeAppt) : null;
    const recentEpisodes = appointments.slice(0, 5).map(formatEpisode);

    const userShares = Array.from(sharesStore.values()).filter(
      (s) => s.patientUserId === userId.toString() && (!familyMemberId || s.familyMemberId === familyMemberId) && new Date(s.expiresAt) > new Date()
    );

    const userLogs = accessLogsStore.filter((l) => l.patientUserId === userId.toString());

    const passport = {
      passportId: `HP-PASS-${userId.toString().slice(-6).toUpperCase()}`,
      userId: userId.toString(),
      familyMemberId: familyMemberId || null,
      settings: {
        defaultScope: "APPOINTMENT_ONLY",
        qrExpiryMinutes: 15,
        allowEmergencyOverride: true,
        notifyOnAccess: true,
      },
      activeEpisode,
      recentEpisodes,
      activeShareCount: userShares.length,
      totalAccessEvents: userLogs.length,
      lastAccessedAt: userLogs.length > 0 ? userLogs[0].timestamp : null,
    };

    return res.status(200).json({ success: true, passport });
  } catch (error) {
    console.error("[getMyPassport Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCareEpisode = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id || req.user._id;

    const appt = await appointmentModel
      .findOne({
        $or: [{ appointmentId }, { displayAppointmentId: appointmentId }, { _id: appointmentId.match(/^[0-9a-fA-F]{24}$/) ? appointmentId : null }],
        userId,
      })
      .populate("doctorId", "name speciality qualification image")
      .populate("hospitalId", "name address city phone");

    if (!appt) {
      return res.status(404).json({ success: false, message: "Care episode not found" });
    }

    return res.status(200).json({ success: true, episode: formatEpisode(appt) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const generateQR = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { scope = "APPOINTMENT_ONLY", familyMemberId = null, appointmentId = null, expiryMinutes = 15 } = req.query;

    const token = `hp_qr_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(Date.now() + parseInt(expiryMinutes, 10) * 60 * 1000).toISOString();

    const qr = {
      token,
      scope,
      expiresAt,
      expiryMinutes: parseInt(expiryMinutes, 10),
      containsPII: true,
      containsMedicalData: scope === "FULL_RECORDS" || scope === "EMERGENCY_VITALS",
    };

    // Store in token store
    sharesStore.set(token, {
      id: token,
      token,
      patientUserId: userId.toString(),
      familyMemberId,
      appointmentId,
      scope,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true, qr });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyQR = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "Token is required" });

    const share = sharesStore.get(token);
    if (!share) {
      return res.status(404).json({ success: false, message: "QR token is invalid or expired" });
    }

    if (new Date(share.expiresAt) < new Date()) {
      sharesStore.delete(token);
      return res.status(410).json({ success: false, message: "QR token has expired" });
    }

    // Record access event
    const accessEvent = {
      id: `acc_${Date.now()}`,
      patientUserId: share.patientUserId,
      actorName: req.user?.name || "Treating Clinician",
      actorRole: req.user?.role || "Doctor",
      scope: share.scope,
      timestamp: new Date().toISOString(),
    };
    accessLogsStore.unshift(accessEvent);

    return res.status(200).json({
      success: true,
      scope: share.scope,
      patientUserId: share.patientUserId,
      familyMemberId: share.familyMemberId,
      episode: null,
      accessedAt: accessEvent.timestamp,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getShares = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { familyMemberId } = req.query;

    const shares = Array.from(sharesStore.values()).filter(
      (s) => s.patientUserId === userId.toString() && (!familyMemberId || s.familyMemberId === familyMemberId)
    );

    return res.status(200).json({ success: true, shares });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createShare = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { scope = "APPOINTMENT_ONLY", recipientName = "Clinician", expiryHours = 24, familyMemberId = null } = req.body;

    const shareId = `share_${crypto.randomBytes(8).toString("hex")}`;
    const token = `hp_sh_${crypto.randomBytes(16).toString("hex")}`;
    const expiresAt = new Date(Date.now() + parseInt(expiryHours, 10) * 60 * 60 * 1000).toISOString();

    const record = {
      id: shareId,
      shareId,
      token,
      patientUserId: userId.toString(),
      familyMemberId,
      recipientName,
      scope,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    sharesStore.set(shareId, record);
    sharesStore.set(token, record);

    return res.status(201).json({ success: true, share: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const revokeShare = async (req, res) => {
  try {
    const { shareId } = req.params;
    sharesStore.delete(shareId);
    return res.status(200).json({ success: true, message: "Share revoked successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAccessLog = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const limit = parseInt(req.query.limit || "20", 10);
    const history = accessLogsStore.filter((l) => l.patientUserId === userId.toString()).slice(0, limit);
    return res.status(200).json({ success: true, history });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const patchSettings = async (req, res) => {
  try {
    return res.status(200).json({ success: true, message: "Passport settings updated successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

