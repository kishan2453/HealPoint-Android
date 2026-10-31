/**
 * HealPoint Healthcare — Advanced Video Consultation Controller.
 *
 * Implements:
 *  - Cryptographically signed, short-lived consultation session tokens (30-min TTL)
 *  - Strict role and appointment-bound authorization (Patient & Assigned Doctor only)
 *  - Configurable STUN / TURN ICE server generation with zero client secret exposure
 *  - Real-time waiting room state machine (Scheduled -> Waiting -> DoctorReady -> InProgress -> Completed)
 *  - Consultation timestamps (consultationStartedAt, consultationEndedAt, durationSeconds)
 *  - Hospital-level video consultation analytics with strict multi-tenant isolation
 *  - Backward-compatible Google Meet URL fallback preservation
 */
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import userModel from "../models/userModel.js";
import hospitalModel from "../models/hospitalModel.js";
import subscriptionModel from "../models/subscriptionModel.js";
import { resolveHospitalId } from "./hospitalAdminController.js";
import { broadcastQueueSync, broadcastAppointmentSync, getIO } from "../services/socketService.js";

const JWT_SECRET = process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026";

/**
 * Returns configurable STUN and TURN server credentials.
 * Supports standard RFC 5766 Time-Limited TURN Credentials (coturn / Xirsys / Metered).
 */
export const getIceServersConfig = (userId) => {
  const iceServers = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  const customStun = process.env.STUN_SERVER;
  if (customStun) {
    iceServers.push({ urls: customStun });
  }

  const turnUrl = process.env.TURN_URL || process.env.TURN_SERVER;
  const turnSecret = process.env.TURN_SECRET;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrl) {
    if (turnSecret) {
      // Generate standard RFC 5766 time-limited ephemeral credentials
      const ttl = 24 * 3600; // 24 hours
      const timestamp = Math.floor(Date.now() / 1000) + ttl;
      const username = `${timestamp}:${userId || "anonymous"}`;
      const hmac = crypto.createHmac("sha1", turnSecret);
      hmac.update(username);
      const credential = hmac.digest("base64");

      iceServers.push({
        urls: turnUrl,
        username,
        credential,
      });
    } else if (turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }
  }

  return iceServers;
};

/**
 * 1. Create / Join Secure Consultation Session
 * Generates an appointment-bound, short-lived session token after verifying credentials.
 */
export const createConsultationSession = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id || req.user?._id;
    const userRole = (req.user?.role || "patient").toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await appointmentModel.findById(appointmentId)
      .populate("doctorId", "name speciality image fees slotDurationMinutes")
      .populate("hospitalId", "name address city phone")
      .populate("userId", "name phone email image");

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // Verify video appointment type
    if (appointment.consultationType !== "video") {
      return res.status(400).json({
        success: false,
        message: "This appointment is scheduled for in-person clinic visit, not video consultation.",
        code: "NOT_VIDEO_APPOINTMENT",
      });
    }

    // Rejection: Cancelled or Missed appointments
    if (["cancel", "cancelled", "missed"].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `This consultation cannot be started because it is marked as ${appointment.status}.`,
        code: "APPOINTMENT_INACTIVE",
      });
    }

    // Verification: Patient or Assigned Doctor Identity
    const apptPatientId = appointment.userId?._id?.toString() || appointment.userId?.toString();
    const apptDoctorId = appointment.doctorId?._id?.toString() || appointment.doctorId?.toString();
    const isPatient = String(userId) === apptPatientId;
    const isDoctor = String(userId) === apptDoctorId;
    const isSuperAdmin = userRole.includes("super");

    if (!isPatient && !isDoctor && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to join this consultation session.",
        code: "FORBIDDEN_CONSULTATION_PARTICIPANT",
      });
    }

    // Generate or reuse consultation session ID
    let sessionId = appointment.consultationSessionId;
    if (!sessionId) {
      sessionId = `HP-VID-${appointment._id.toString().slice(-8)}-${Date.now()}`;
      appointment.consultationSessionId = sessionId;
    }

    // Update waiting room status
    if (isPatient && appointment.consultationStatus === "waiting") {
      appointment.meetingStatus = "ready";
    } else if (isDoctor) {
      if (appointment.consultationStatus === "waiting") {
        appointment.consultationStatus = "doctor_ready";
      }
      appointment.meetingStatus = "ready";
    }
    await appointment.save();

    // Generate short-lived consultation session JWT (valid for 30 minutes)
    const sessionToken = jwt.sign(
      {
        sessionId,
        appointmentId: appointment._id.toString(),
        userId: String(userId),
        role: isDoctor ? "doctor" : "patient",
        hospitalId: appointment.hospitalId?._id?.toString(),
        doctorId: apptDoctorId,
        patientId: apptPatientId,
      },
      JWT_SECRET,
      { expiresIn: "30m" }
    );

    // Get ICE servers (STUN/TURN)
    const iceServers = getIceServersConfig(userId);

    // Broadcast waiting room sync via Socket.IO
    const io = getIO();
    if (io) {
      io.to(`consultation:${appointment._id}`).emit("consultation:status", {
        appointmentId: appointment._id.toString(),
        consultationStatus: appointment.consultationStatus,
        meetingStatus: appointment.meetingStatus,
        participantJoined: isDoctor ? "doctor" : "patient",
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      sessionId,
      sessionToken,
      iceServers,
      role: isDoctor ? "doctor" : "patient",
      consultationStatus: appointment.consultationStatus,
      meetingStatus: appointment.meetingStatus,
      meetingUrl: appointment.meetingUrl || "",
      appointment: {
        _id: appointment._id,
        appointmentId: appointment.appointmentId || appointment.displayAppointmentId,
        slotDate: appointment.slotDate,
        slotTime: appointment.slotTime,
        status: appointment.status,
        consultationStatus: appointment.consultationStatus,
        doctor: {
          _id: appointment.doctorId?._id,
          name: appointment.doctorId?.name,
          speciality: appointment.doctorId?.speciality,
          image: appointment.doctorId?.image,
        },
        patient: {
          _id: appointment.userId?._id,
          name: appointment.patientName || appointment.userId?.name,
          phone: appointment.patientPhone || appointment.userId?.phone,
        },
        hospital: {
          _id: appointment.hospitalId?._id,
          name: appointment.hospitalId?.name,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 2. Get Live Consultation Status & Waiting Room State
 */
export const getConsultationSessionStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user?.id || req.user?._id;

    const appointment = await appointmentModel.findById(appointmentId)
      .populate("doctorId", "name speciality image onlineStatus onlineConsultationEnabled")
      .populate("hospitalId", "name");

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    const apptPatientId = appointment.userId?.toString();
    const apptDoctorId = appointment.doctorId?._id?.toString() || appointment.doctorId?.toString();
    const isPatient = String(userId) === apptPatientId;
    const isDoctor = String(userId) === apptDoctorId;

    if (!isPatient && !isDoctor && req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.status(200).json({
      success: true,
      consultationStatus: appointment.consultationStatus || "waiting",
      meetingStatus: appointment.meetingStatus || "not_created",
      meetingUrl: appointment.meetingUrl || "",
      consultationStartedAt: appointment.consultationStartedAt || null,
      consultationEndedAt: appointment.consultationEndedAt || null,
      consultationDurationSeconds: appointment.consultationDurationSeconds || 0,
      doctorOnline: appointment.doctorId?.onlineStatus === "online",
      doctorName: appointment.doctorId?.name || "",
      isDoctorReady: appointment.consultationStatus === "doctor_ready" || appointment.consultationStatus === "in_progress",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 3. Update Consultation Status (Waiting -> DoctorReady -> InProgress -> Completed)
 */
export const updateConsultationStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, notes } = req.body;
    const userId = req.user?.id || req.user?._id;

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    // Validate Doctor or Patient Authorization
    const apptDoctorId = appointment.doctorId?.toString();
    const apptPatientId = appointment.userId?.toString();
    const isDoctor = String(userId) === apptDoctorId;
    const isPatient = String(userId) === apptPatientId;

    if (!isDoctor && !isPatient && req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Unauthorized to update consultation status" });
    }

    const prevStatus = appointment.consultationStatus;

    if (status === "in_progress") {
      appointment.consultationStatus = "in_progress";
      appointment.meetingStatus = "started";
      if (!appointment.consultationStartedAt) {
        appointment.consultationStartedAt = new Date();
      }
    } else if (status === "completed") {
      // Only doctor or admin can mark complete
      if (!isDoctor && req.user?.role !== "super_admin") {
        return res.status(403).json({ success: false, message: "Only the attending doctor can complete the consultation" });
      }
      appointment.consultationStatus = "completed";
      appointment.meetingStatus = "completed";
      appointment.status = "completed";
      appointment.consultationEndedAt = new Date();

      if (appointment.consultationStartedAt) {
        const durationSec = Math.round((appointment.consultationEndedAt.getTime() - new Date(appointment.consultationStartedAt).getTime()) / 1000);
        appointment.consultationDurationSeconds = Math.max(0, durationSec);
      }
      if (notes) {
        appointment.consultationNotes = notes;
      }
    } else if (status === "doctor_ready") {
      appointment.consultationStatus = "doctor_ready";
      appointment.meetingStatus = "ready";
    } else if (status === "waiting") {
      appointment.consultationStatus = "waiting";
    }

    await appointment.save();

    // Broadcast real-time consultation state update
    const io = getIO();
    if (io) {
      io.to(`consultation:${appointment._id}`).emit("consultation:status", {
        appointmentId: appointment._id.toString(),
        consultationStatus: appointment.consultationStatus,
        meetingStatus: appointment.meetingStatus,
        consultationDurationSeconds: appointment.consultationDurationSeconds || 0,
        timestamp: new Date().toISOString(),
      });
      io.to(`user:${appointment.userId}`).emit("consultation:sync", {
        appointmentId: appointment._id.toString(),
        consultationStatus: appointment.consultationStatus,
        status: appointment.status,
      });
      io.to(`doctor:${appointment.doctorId}`).emit("consultation:sync", {
        appointmentId: appointment._id.toString(),
        consultationStatus: appointment.consultationStatus,
        status: appointment.status,
      });
    }

    res.status(200).json({
      success: true,
      message: `Consultation status transitioned from ${prevStatus} to ${status}`,
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. Save Consultation Clinical Notes
 */
export const saveConsultationNotes = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { notes, diagnosis, followUpAdvice } = req.body;
    const userId = req.user?.id || req.user?._id;

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (String(appointment.doctorId) !== String(userId) && req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Only assigned doctor can save consultation notes" });
    }

    if (notes) appointment.consultationNotes = notes;
    if (diagnosis) appointment.diagnosis = diagnosis;
    if (followUpAdvice) appointment.followUpAdvice = followUpAdvice;

    await appointment.save();

    res.status(200).json({ success: true, message: "Consultation notes saved successfully", appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 5. Hospital Admin: Video Consultation Analytics with Strict Tenant Isolation
 */
export const getHospitalConsultationStats = async (req, res) => {
  try {
    const hospitalId = await resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: No hospital associated with this administrator",
        code: "FORBIDDEN_HOSPITAL_SCOPE",
      });
    }

    const doctors = await doctorModel.find({ hospitalId });
    const videoAppts = await appointmentModel
      .find({ hospitalId, consultationType: "video" })
      .populate("doctorId", "name speciality department image")
      .populate("userId", "name phone email")
      .sort({ createdAt: -1 });

    const total = videoAppts.length;
    const completed = videoAppts.filter((a) => a.status === "completed" || a.consultationStatus === "completed").length;
    const upcoming = videoAppts.filter((a) => ["pending", "confirmed", "scheduled"].includes(a.status)).length;
    const activeOnlineDoctors = doctors.filter((d) => d.onlineStatus === "online" || d.onlineConsultationEnabled !== false).length;

    const totalDurationSeconds = videoAppts.reduce((sum, a) => sum + (a.consultationDurationSeconds || 0), 0);
    const avgDurationMinutes = completed > 0 ? Math.round(totalDurationSeconds / (completed * 60)) : 15;

    const revenue = videoAppts
      .filter((a) => a.payment === true || a.paymentStatus === "paid" || a.paymentStatus === "SUCCESS")
      .reduce((s, a) => s + (Number(a.amount) || Number(a.billing?.totalAmount) || 0), 0);

    // Doctor-wise statistics
    const doctorStats = doctors.map((doc) => {
      const docAppts = videoAppts.filter((a) => String(a.doctorId?._id || a.doctorId) === String(doc._id));
      const docCompleted = docAppts.filter((a) => a.status === "completed").length;
      return {
        doctorId: doc._id,
        doctorName: doc.name,
        speciality: doc.speciality,
        totalConsultations: docAppts.length,
        completedConsultations: docCompleted,
        onlineStatus: doc.onlineStatus || "offline",
      };
    });

    res.status(200).json({
      success: true,
      totalConsultations: total,
      completedConsultations: completed,
      stats: {
        total,
        upcoming,
        completed,
        activeOnlineDoctors,
        revenue,
        avgDurationMinutes,
      },
      doctorStats,
      recent: videoAppts.slice(0, 15),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. Patient Consultation Detail (with prescription access)
 */
export const getPatientConsultationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?._id;

    const appointment = await appointmentModel.findOne({
      _id: id,
      userId,
    })
      .populate("doctorId", "name speciality degree qualification image fees roomNo clinicInfo")
      .populate("hospitalId", "name address city phone mapsUrl");

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Consultation not found" });
    }

    res.status(200).json({
      success: true,
      consultation: appointment,
      hasPrescription: Boolean(appointment.prescription || (appointment.medicines && appointment.medicines.length > 0)),
      medicines: appointment.medicines || [],
      prescription: appointment.prescription || "",
      diagnosis: appointment.diagnosis || "",
      followUpAdvice: appointment.followUpAdvice || "",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 7. Fallback Google Meet Link Management (Preserved for backward compatibility)
 */
export const saveDoctorMeetingLink = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { meetingUrl } = req.body;

    const apt = await appointmentModel.findByIdAndUpdate(
      appointmentId,
      { $set: { meetingUrl, meetingStatus: "ready" } },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Meeting link saved", appointment: apt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const removeDoctorMeetingLink = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const apt = await appointmentModel.findByIdAndUpdate(
      appointmentId,
      { $set: { meetingUrl: "", meetingStatus: "not_created" } },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Meeting link removed", appointment: apt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
