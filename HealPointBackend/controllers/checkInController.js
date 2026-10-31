import mongoose from "mongoose";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import userModel from "../models/userModel.js";
import hospitalModel from "../models/hospitalModel.js";
import auditLogModel from "../models/auditLogModel.js";
import { resolveHospitalId } from "./hospitalAdminController.js";
import { broadcastQueueSync, broadcastAppointmentSync } from "../services/socketService.js";

const isLiveQueueEnabled = () => process.env.FEATURE_LIVE_QUEUE === "true";

// Helper to format appointment response for check-in UI
const formatAppointmentForCheckIn = (appt) => {
  const patientName = appt.patientName || appt.userId?.name || "Verified Patient";
  const patientPhone = appt.patientPhone || appt.userId?.phone || "";
  const doctorName = appt.doctorId?.name || appt.doctorName || "Attending Doctor";
  const doctorSpeciality =
    appt.doctorId?.speciality ||
    appt.doctorId?.department ||
    appt.doctorSpeciality ||
    "General Medicine";
  const hospitalName =
    appt.hospitalName ||
    appt.hospitalId?.name ||
    "HealPoint Medical Center";

  return {
    _id: appt._id,
    appointmentId: appt.appointmentId || appt.displayAppointmentId || String(appt._id),
    displayAppointmentId: appt.displayAppointmentId || appt.appointmentId,
    patientName,
    patientPhone,
    doctorName,
    doctorSpeciality,
    department: doctorSpeciality,
    hospitalName,
    slotDate: appt.slotDate || "",
    slotTime: appt.slotTime || "",
    status: appt.status || "confirmed",
    checkedIn: Boolean(appt.checkedIn),
    checkInAt: appt.checkInAt || null,
    queueToken: appt.queueToken || "",
    queueStatus: appt.queueStatus || "waiting",
    amount: appt.amount || 0,
    paymentStatus: appt.paymentStatus || "paid",
  };
};

export const getCheckInStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const query = {
      $or: [{ _id: mongoose.Types.ObjectId.isValid(appointmentId) ? appointmentId : null }, { appointmentId }],
    };
    if (req.user?.id && req.user?.role === "patient") {
      query.userId = req.user.id;
    }

    const appointment = await appointmentModel.findOne(query)
      .populate("userId", "name phone email")
      .populate("doctorId", "name speciality department");

    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    res.status(200).json({
      success: true,
      checkedIn: appointment.checkedIn || false,
      queueToken: appointment.queueToken || "",
      queueStatus: appointment.queueStatus || "not_checked_in",
      appointment: formatAppointmentForCheckIn(appointment),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processCheckIn = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    const query = {
      $or: [{ _id: mongoose.Types.ObjectId.isValid(appointmentId) ? appointmentId : null }, { appointmentId }],
    };
    if (req.user?.id && req.user?.role === "patient") {
      query.userId = req.user.id;
    }

    const appointment = await appointmentModel.findOne(query)
      .populate("userId", "name phone email")
      .populate("doctorId", "name speciality department slotDurationMinutes")
      .populate("hospitalId", "name");

    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (appointment.checkedIn) {
      return res.status(200).json({
        success: true,
        alreadyCheckedIn: true,
        message: `Already checked in with Token: ${appointment.queueToken}`,
        queueToken: appointment.queueToken,
        appointment: formatAppointmentForCheckIn(appointment),
      });
    }

    const count = await appointmentModel.countDocuments({
      hospitalId: appointment.hospitalId?._id || appointment.hospitalId,
      doctorId: appointment.doctorId?._id || appointment.doctorId,
      checkedIn: true,
      slotDate: appointment.slotDate,
    });
    const prefix = appointment.doctorId?.speciality ? appointment.doctorId.speciality.charAt(0).toUpperCase() : "A";
    const queueToken = `${prefix}-${String(count + 1).padStart(3, "0")}`;

    // Atomic update to prevent duplicate check-in race conditions
    const updatedAppointment = await appointmentModel.findOneAndUpdate(
      { _id: appointment._id, checkedIn: { $ne: true } },
      {
        $set: {
          checkedIn: true,
          checkInAt: new Date(),
          queueToken,
          queueStatus: "waiting",
          status: appointment.status === "pending" ? "confirmed" : appointment.status,
        },
      },
      { new: true }
    )
      .populate("userId", "name phone email")
      .populate("doctorId", "name speciality department slotDurationMinutes")
      .populate("hospitalId", "name");

    const finalAppt = updatedAppointment || (await appointmentModel.findById(appointment._id)
      .populate("userId", "name phone email")
      .populate("doctorId", "name speciality department")
      .populate("hospitalId", "name"));

    if (isLiveQueueEnabled() && updatedAppointment) {
      const patientsAhead = await appointmentModel.countDocuments({
        hospitalId: finalAppt.hospitalId?._id || finalAppt.hospitalId,
        doctorId: finalAppt.doctorId?._id || finalAppt.doctorId,
        slotDate: finalAppt.slotDate,
        checkedIn: true,
        queueStatus: "waiting",
        checkInAt: { $lt: finalAppt.checkInAt || new Date() },
      });
      const avgDuration = finalAppt.doctorId?.slotDurationMinutes || 15;
      const estimatedWaitMinutes = patientsAhead * avgDuration;

      broadcastQueueSync({
        hospitalId: finalAppt.hospitalId?._id || finalAppt.hospitalId,
        doctorId: finalAppt.doctorId?._id || finalAppt.doctorId,
        userId: finalAppt.userId?._id || finalAppt.userId,
        action: "check_in",
        appointmentId: finalAppt._id,
        queueToken: finalAppt.queueToken,
        queueStatus: "waiting",
        patientsAhead,
        estimatedWaitMinutes,
        doctorName: finalAppt.doctorId?.name || "",
        hospitalName: finalAppt.hospitalId?.name || finalAppt.hospitalName || "",
        slotDate: finalAppt.slotDate,
        slotTime: finalAppt.slotTime,
      });

      broadcastAppointmentSync({
        hospitalId: finalAppt.hospitalId?._id || finalAppt.hospitalId,
        doctorId: finalAppt.doctorId?._id || finalAppt.doctorId,
        userId: finalAppt.userId?._id || finalAppt.userId,
        appointmentId: finalAppt._id,
        status: finalAppt.status,
        paymentStatus: finalAppt.paymentStatus,
        slotDate: finalAppt.slotDate,
        slotTime: finalAppt.slotTime,
      });
    }

    res.status(200).json({
      success: true,
      message: "Check-in successful! Your digital token has been assigned.",
      queueToken: finalAppt.queueToken,
      appointment: formatAppointmentForCheckIn(finalAppt),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Digital QR & Summary for Patient Mobile App Pass
export const getAppointmentQRSummary = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const conditions = [];
    if (mongoose.Types.ObjectId.isValid(appointmentId)) {
      conditions.push({ _id: appointmentId });
    }
    conditions.push({ appointmentId: appointmentId });
    conditions.push({ displayAppointmentId: appointmentId });

    const appt = await appointmentModel.findOne({ $or: conditions })
      .populate("userId", "name phone email")
      .populate("doctorId", "name speciality department degree image")
      .populate("hospitalId", "name address city phone logo mapsUrl");

    if (!appt) {
      return res.status(404).json({ success: false, message: "Appointment not found for pass" });
    }

    const formatted = formatAppointmentForCheckIn(appt);
    const qrPayload = JSON.stringify({
      appointmentId: appt.appointmentId || String(appt._id),
      hospitalId: String(appt.hospitalId?._id || appt.hospitalId),
      patientName: formatted.patientName,
      slotDate: appt.slotDate,
      slotTime: appt.slotTime,
      token: appt.queueToken || `HPQR-${appt.appointmentId || appt._id}`,
    });

    res.status(200).json({
      success: true,
      token: appt.queueToken || appt.appointmentId || String(appt._id),
      qrToken: appt.queueToken || appt.appointmentId || String(appt._id),
      qrPayload,
      appointment: formatted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Patient Live Queue Status
export const getAppointmentLiveQueueStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const conditions = [];
    if (mongoose.Types.ObjectId.isValid(appointmentId)) {
      conditions.push({ _id: appointmentId });
    }
    conditions.push({ appointmentId });
    conditions.push({ displayAppointmentId: appointmentId });

    const appt = await appointmentModel.findOne({ $or: conditions })
      .populate("doctorId", "name speciality slotDurationMinutes")
      .populate("hospitalId", "name");

    if (!appt) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    let patientsAhead = 0;
    if (appt.checkedIn && appt.queueStatus === "waiting") {
      patientsAhead = await appointmentModel.countDocuments({
        hospitalId: appt.hospitalId?._id || appt.hospitalId,
        doctorId: appt.doctorId?._id || appt.doctorId,
        slotDate: appt.slotDate,
        checkedIn: true,
        queueStatus: "waiting",
        checkInAt: { $lt: appt.checkInAt || new Date() },
      });
    }

    const currentlyServing = await appointmentModel.findOne({
      hospitalId: appt.hospitalId?._id || appt.hospitalId,
      doctorId: appt.doctorId?._id || appt.doctorId,
      slotDate: appt.slotDate,
      queueStatus: "in_consultation",
    });

    const avgDuration = appt.doctorId?.slotDurationMinutes || 15;
    const estimatedWaitMinutes = patientsAhead * avgDuration;

    res.status(200).json({
      success: true,
      checkedIn: Boolean(appt.checkedIn),
      queueToken: appt.queueToken || null,
      queueStatus: appt.queueStatus || "not_checked_in",
      currentServingToken: currentlyServing?.queueToken || null,
      patientsAhead,
      estimatedWaitMinutes,
      averageConsultationMinutes: avgDuration,
      checkInAt: appt.checkInAt || null,
      doctorName: appt.doctorId?.name || appt.doctorName || "",
      hospitalName: appt.hospitalId?.name || appt.hospitalName || "",
      slotDate: appt.slotDate,
      slotTime: appt.slotTime,
      featureLiveQueueEnabled: isLiveQueueEnabled(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Hospital Admin: Scan QR or Enter Appointment Reference
export const processScanCheckIn = async (req, res) => {
  try {
    const rawInput = (
      req.body.token ||
      req.body.rawReference ||
      req.body.appointmentId ||
      req.body.qrData ||
      ""
    ).toString().trim();

    if (!rawInput) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid QR code or appointment reference number",
      });
    }

    // Parse if JSON QR payload
    let targetCode = rawInput;
    if (rawInput.startsWith("{") && rawInput.endsWith("}")) {
      try {
        const parsed = JSON.parse(rawInput);
        targetCode = parsed.appointmentId || parsed.id || parsed.token || rawInput;
      } catch {
        targetCode = rawInput;
      }
    }

    // Clean prefix if any
    targetCode = targetCode.replace(/^HPQR:/i, "").replace(/^REF:/i, "").trim();

    // Query appointment by multiple candidate identifiers
    const conditions = [];
    if (mongoose.Types.ObjectId.isValid(targetCode)) {
      conditions.push({ _id: new mongoose.Types.ObjectId(targetCode) });
    }
    conditions.push({ appointmentId: targetCode });
    conditions.push({ displayAppointmentId: targetCode });
    conditions.push({ appointmentId: new RegExp(`^${targetCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    conditions.push({ queueToken: new RegExp(`^${targetCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });

    const appt = await appointmentModel.findOne({ $or: conditions })
      .populate("userId", "name phone email")
      .populate("doctorId", "name speciality department")
      .populate("hospitalId", "name");

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: `No appointment found matching reference "${targetCode}". Please verify the booking reference.`,
      });
    }

    // Enforce Hospital Scope
    const adminHospitalId = await resolveHospitalId(req);
    if (adminHospitalId && appt.hospitalId) {
      const apptHospId = appt.hospitalId._id ? appt.hospitalId._id.toString() : appt.hospitalId.toString();
      if (apptHospId !== adminHospitalId.toString()) {
        return res.status(403).json({
          success: false,
          message: `This appointment belongs to a different hospital (${appt.hospitalName || appt.hospitalId.name || "Other Facility"}). You can only check in patients for your assigned hospital.`,
        });
      }
    }

    // Check cancellation
    if (["cancel", "cancelled", "missed"].includes(appt.status?.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Cannot check in: This appointment is marked as ${appt.status}. Please direct the patient to reception desk for re-booking.`,
      });
    }

    // If already checked in
    if (appt.checkedIn) {
      return res.status(200).json({
        success: true,
        alreadyCheckedIn: true,
        message: `Patient is already checked in. Assigned Token: ${appt.queueToken || "A-001"}`,
        token: appt.queueToken || "A-001",
        appointment: formatAppointmentForCheckIn(appt),
      });
    }

    // Generate daily queue token
    const todayCheckinCount = await appointmentModel.countDocuments({
      hospitalId: appt.hospitalId?._id || appt.hospitalId,
      checkedIn: true,
    });
    const prefix = appt.doctorId?.speciality ? appt.doctorId.speciality.charAt(0).toUpperCase() : "A";
    const queueToken = `${prefix}-${String(todayCheckinCount + 101).padStart(3, "0")}`;

    appt.checkedIn = true;
    appt.checkInAt = new Date();
    appt.queueToken = queueToken;
    appt.queueStatus = "waiting";
    if (appt.status === "pending") {
      appt.status = "confirmed";
    }
    await appt.save();

    if (isLiveQueueEnabled()) {
      broadcastQueueSync({
        hospitalId: appt.hospitalId?._id || appt.hospitalId,
        doctorId: appt.doctorId?._id || appt.doctorId,
        userId: appt.userId?._id || appt.userId,
        action: "scan_check_in",
        appointmentId: appt._id,
        queueToken,
        queueStatus: "waiting",
        doctorName: appt.doctorId?.name || "",
        hospitalName: appt.hospitalName || appt.hospitalId?.name || "",
        slotDate: appt.slotDate,
        slotTime: appt.slotTime,
      });
      broadcastAppointmentSync({
        hospitalId: appt.hospitalId?._id || appt.hospitalId,
        doctorId: appt.doctorId?._id || appt.doctorId,
        userId: appt.userId?._id || appt.userId,
        appointmentId: appt._id,
        status: appt.status,
        paymentStatus: appt.paymentStatus,
        slotDate: appt.slotDate,
        slotTime: appt.slotTime,
      });
    }

    // Audit Log Entry
    try {
      const patientName = appt.patientName || appt.userId?.name || "Patient";
      await auditLogModel.create({
        hospitalId: appt.hospitalId?._id || appt.hospitalId,
        timestamp: new Date(),
        action: "patient_check_in",
        category: "appointment",
        severity: "notice",
        actor: {
          role: req.user?.role || "Hospital Admin",
          name: req.user?.name || "OPD Reception",
          email: req.user?.email || "",
        },
        resourceType: "appointment",
        resourceId: appt._id,
        status: "success",
        title: `Reception Check-In: ${patientName} (${queueToken})`,
        description: `Verified patient arrival at OPD Reception desk. Token ${queueToken} assigned. Doctor: ${appt.doctorId?.name || "Attending"}.`,
      });
    } catch (auditErr) {
      console.warn("Audit log creation skipped:", auditErr.message);
    }

    res.status(200).json({
      success: true,
      message: `Check-in verified successfully! Queue Token: ${queueToken}`,
      token: queueToken,
      appointment: formatAppointmentForCheckIn(appt),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Hospital Admin: Live OPD Queue Overview
export const getHospitalQueueOverview = async (req, res) => {
  try {
    const hospitalId = await resolveHospitalId(req);
    if (!hospitalId) {
      return res.status(403).json({ success: false, message: "Forbidden: No hospital associated with this administrator" });
    }

    const { doctorId, status } = req.query || {};

    const baseFilter = { hospitalId };

    if (doctorId && doctorId !== "all") {
      if (mongoose.Types.ObjectId.isValid(doctorId)) {
        baseFilter.doctorId = new mongoose.Types.ObjectId(doctorId);
      }
    }

    // Total today filter
    const allAppointments = await appointmentModel
      .find(baseFilter)
      .populate("userId", "name phone email")
      .populate("doctorId", "name speciality department")
      .sort({ checkInAt: -1, createdAt: -1 });

    const totalToday = allAppointments.length;
    const checkedInAppts = allAppointments.filter((a) => a.checkedIn);
    const checkedInCount = checkedInAppts.length;
    const waitingCount = checkedInAppts.filter((a) => !a.queueStatus || a.queueStatus === "waiting").length;
    const inConsultationCount = checkedInAppts.filter((a) => a.queueStatus === "in_consultation" || a.queueStatus === "called").length;
    const completedCount = checkedInAppts.filter((a) => a.queueStatus === "completed").length;

    // Filter appointments for the live queue view
    let displayList = checkedInAppts;
    if (status && status !== "all") {
      if (status === "waiting") {
        displayList = checkedInAppts.filter((a) => !a.queueStatus || a.queueStatus === "waiting");
      } else if (status === "in_consultation") {
        displayList = checkedInAppts.filter((a) => a.queueStatus === "in_consultation" || a.queueStatus === "called");
      } else if (status === "completed") {
        displayList = checkedInAppts.filter((a) => a.queueStatus === "completed");
      }
    }

    const formattedList = displayList.map((a) => formatAppointmentForCheckIn(a));

    res.status(200).json({
      success: true,
      summary: {
        totalToday,
        checkedInCount,
        waitingCount,
        inConsultationCount,
        completedCount,
      },
      doctorStats: [],
      appointments: formattedList,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
