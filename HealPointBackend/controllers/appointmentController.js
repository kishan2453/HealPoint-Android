import mongoose from "mongoose";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import hospitalModel from "../models/hospitalModel.js";
import userModel from "../models/userModel.js";
import healthDocumentModel from "../models/healthDocumentModel.js";
import subscriptionModel from "../models/subscriptionModel.js";
import { createRazorpayOrder, verifyPaymentSignature } from "../services/razorpayService.js";
import { processAppointmentReminders } from "../services/reminderScheduler.js";
import { dispatchNotification } from "../services/socketService.js";
import {
  generateDoctorSlotsForDate,
  getHourlyBookingCount,
  MAX_HOURLY_CAPACITY,
  normalizeDateDDMMYYYY,
} from "../helpers/slotHelper.js";

const isValidId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

export const bookAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      hospitalId,
      slotDate,
      slotTime,
      patientName,
      patientPhone,
      familyMemberId,
      familyRelationship,
      consultationType,
      paymentMethod,
    } = req.body;

    if (!doctorId || !slotDate || !slotTime || !patientName) {
      return res.status(400).json({ success: false, message: "Doctor, slot date, slot time, and patient name are required" });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    if (!doctor.isActive || doctor.available === false) {
      return res.status(400).json({
        success: false,
        message: "This doctor is currently not accepting appointments",
      });
    }

    // Enforce maximum 15 bookings per doctor per hour
    const currentHourlyBookings = await getHourlyBookingCount(doctor._id, slotDate, slotTime);
    if (currentHourlyBookings >= MAX_HOURLY_CAPACITY) {
      return res.status(409).json({
        success: false,
        code: "HOURLY_CAPACITY_FULL",
        message: `This doctor has reached the maximum capacity of ${MAX_HOURLY_CAPACITY} bookings for this hour. Please select another time slot or date.`,
      });
    }

    const finalHospitalId = hospitalId || doctor.hospitalId;
    const finalHospital = await hospitalModel.findById(finalHospitalId);

    // Verify video consultation entitlement if user selected video
    const isVideo = consultationType === "video";
    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Validate and verify family member ownership if booking for a dependent
    let finalPatientName = patientName;
    let finalFamilyRelationship = familyRelationship || "Self";
    let isFamilyBooking = false;

    if (familyMemberId && familyMemberId !== "self" && familyMemberId !== "all") {
      const match = user.familyMembers?.find(
        (fm) => fm._id?.toString() === familyMemberId.toString() && !fm.isArchived
      );
      if (!match) {
        return res.status(403).json({
          success: false,
          code: "FAMILY_MEMBER_NOT_AUTHORIZED",
          message: "Family member not authorized or not found for this account",
        });
      }
      isFamilyBooking = true;
      finalPatientName = match.name || patientName;
      finalFamilyRelationship = match.relationship || familyRelationship || "Dependent";
    }

    if (isVideo) {
      const activeSub = await subscriptionModel
        .findOne({
          userId: req.user.id,
          status: "active",
          endDate: { $gte: new Date() },
        })
        .sort({ createdAt: -1 });

      const totalQuota = activeSub
        ? (activeSub.videoConsultationsQuota || 0)
        : (user.currentSubscription?.videoQuotaTotal || 0);
      const usedQuota = activeSub
        ? (activeSub.videoConsultationsUsed || 0)
        : (user.currentSubscription?.videoQuotaUsed || 0);
      const quotaRemaining = Math.max(0, totalQuota - usedQuota);

      const hasPlan = Boolean(
        activeSub ||
        (user.currentSubscription?.status === "active" && user.currentSubscription?.planKey !== "free")
      );

      if (!hasPlan || quotaRemaining <= 0) {
        return res.status(403).json({
          success: false,
          code: "SUBSCRIPTION_REQUIRED",
          message: "Subscription Required – Please subscribe to continue with video consultation.",
        });
      }
    }

    const amount = isVideo ? (doctor.fees || 500) : (doctor.fees || 0);
    const appointmentId = `APT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newAppointment = await appointmentModel.create({
      appointmentId,
      displayAppointmentId: appointmentId,
      userId: req.user.id,
      doctorId,
      hospitalId: finalHospitalId,
      hospitalName: finalHospital?.name || doctor.hospitalName || "HealPoint Clinic",
      slotDate,
      slotTime,
      patientName: finalPatientName,
      patientPhone: patientPhone || user.phone || "",
      familyMemberId: isFamilyBooking ? familyMemberId : undefined,
      familyRelationship: finalFamilyRelationship,
      isFamilyBooking,
      amount,
      billing: {
        consultationFee: amount,
        subtotal: amount,
        totalAmount: amount,
      },
      consultationType: consultationType || "clinic",
      paymentMethod: paymentMethod || "cash",
      status: "pending",
      paymentStatus: paymentMethod === "online" ? "PENDING" : "PENDING",
      meetingUrl: isVideo ? `https://meet.google.com/new` : "",
    });

    // If online payment requested, generate Razorpay Order
    let razorpayOrder = null;
    if (paymentMethod === "online" && amount > 0) {
      razorpayOrder = await createRazorpayOrder({
        amount,
        receipt: appointmentId,
        notes: { appointmentId, userId: req.user.id },
      });
      newAppointment.razorpayOrderId = razorpayOrder.id;
      await newAppointment.save();
    }

    // Deduct video quota if applicable
    if (isVideo) {
      await subscriptionModel.findOneAndUpdate(
        { userId: req.user.id, status: "active", endDate: { $gte: new Date() } },
        { $inc: { videoConsultationsUsed: 1 } },
        { sort: { createdAt: -1 } }
      );
      if (user.currentSubscription) {
        user.currentSubscription.videoQuotaUsed = (user.currentSubscription.videoQuotaUsed || 0) + 1;
        await user.save();
      }
    }

        // Trigger real notifications to Patient, Doctor, and Hospital
    try {
      dispatchNotification({
        userId: req.user.id,
        recipientRole: "patient",
        title: "Appointment Booked",
        message: `Your appointment with Dr. ${doctor.name} on ${slotDate} at ${slotTime} has been successfully placed.`,
        type: "appointment",
        category: "appointment",
        priority: "normal",
        link: `/appointment/${newAppointment._id}`,
        refId: newAppointment._id.toString(),
        refModel: "Appointment",
        meta: { appointmentId: newAppointment.appointmentId, doctorId: doctor._id.toString(), slotDate, slotTime },
      }).catch(() => {});

      dispatchNotification({
        doctorId: doctor._id,
        recipientRole: "doctor",
        title: "New Appointment Booked",
        message: `${finalPatientName} has booked an appointment for ${slotDate} at ${slotTime}.`,
        type: "appointment",
        category: "appointment",
        priority: "normal",
        link: `/doctor/appointments`,
        refId: newAppointment._id.toString(),
        refModel: "Appointment",
        meta: { appointmentId: newAppointment.appointmentId, userId: req.user.id, slotDate, slotTime },
      }).catch(() => {});

      if (finalHospitalId) {
        dispatchNotification({
          hospitalId: finalHospitalId,
          recipientRole: "hospital_admin",
          title: "New OPD Booking",
          message: `${finalPatientName} booked with Dr. ${doctor.name} on ${slotDate} at ${slotTime}.`,
          type: "appointment",
          category: "appointment",
          priority: "normal",
          link: `/admin/appointments`,
          refId: newAppointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: newAppointment,
      razorpayOrder,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPaymentOrder = async (req, res) => {
  try {
    const id = req.params.id || req.body.appointmentId;
    if (!id) {
      return res.status(400).json({ success: false, message: "Appointment ID is required" });
    }

    const appointment = await appointmentModel.findOne({
      $or: [{ _id: id }, { appointmentId: id }],
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    if (
      appointment.payment === true ||
      appointment.paymentStatus === "SUCCESS" ||
      appointment.paymentStatus === "paid"
    ) {
      return res.status(400).json({
        success: false,
        message: "This appointment is already paid. You do not need to pay again.",
      });
    }

    if (appointment.status === "cancel" || appointment.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "This appointment is no longer open for payment.",
      });
    }

    const amount = Number(appointment.amount || appointment.billing?.totalAmount || 500);

    const razorpayOrder = await createRazorpayOrder({
      amount,
      receipt: appointment.appointmentId || `apt_${appointment._id}`,
      notes: {
        appointmentId: String(appointment._id),
        userId: String(appointment.userId),
      },
    });

    appointment.razorpayOrderId = razorpayOrder.id;
    await appointment.save();

    res.status(200).json({
      success: true,
      appointmentId: appointment._id,
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      razorpayKey: process.env.RAZORPAY_KEY_ID || "rzp_test_Spw1C33b1zf044",
    });
  } catch (error) {
    console.error("[createPaymentOrder Error]:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyAppointmentPayment = async (req, res) => {
  try {
    const {
      appointmentId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const orderId = razorpayOrderId || razorpay_order_id;
    const paymentId = razorpayPaymentId || razorpay_payment_id;
    const signature = razorpaySignature || razorpay_signature;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "Order ID, payment ID, and signature are required for payment verification",
      });
    }

    const isValid = verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Payment signature verification failed. Payment could not be confirmed.",
      });
    }

    const appointment = await appointmentModel.findOne({
      $or: [{ _id: appointmentId }, { appointmentId }],
    });

    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    appointment.payment = true;
    appointment.paymentStatus = "SUCCESS";
    appointment.status = "confirmed";
    appointment.razorpayPaymentId = paymentId;
    appointment.razorpayOrderId = orderId;
    await appointment.save();

        try {
      dispatchNotification({
        userId: appointment.userId,
        recipientRole: "patient",
        title: "Payment Confirmed",
        message: `Payment of ₹${appointment.amount} for appointment #${appointment.displayAppointmentId || appointment.appointmentId} was successful.`,
        type: "payment",
        category: "payment",
        priority: "normal",
        link: `/appointment/${appointment._id}`,
        refId: appointment._id.toString(),
        refModel: "Appointment",
      }).catch(() => {});

      if (appointment.hospitalId) {
        dispatchNotification({
          hospitalId: appointment.hospitalId,
          recipientRole: "hospital_admin",
          title: "Payment Received",
          message: `Payment of ₹${appointment.amount} received for appointment #${appointment.displayAppointmentId || appointment.appointmentId}.`,
          type: "payment",
          category: "payment",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      appointment,
    });
  } catch (error) {
    console.error("[verifyAppointmentPayment Error]:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserAppointments = async (req, res) => {
  try {
    const filter = { userId: req.user.id };
    const { familyMemberId, memberId } = req.query;
    const targetMemberId = familyMemberId || memberId;

    if (targetMemberId && targetMemberId !== "all") {
      if (targetMemberId === "self") {
        filter.$or = [
          { familyMemberId: { $exists: false } },
          { familyMemberId: null },
          { familyMemberId: "" },
          { familyRelationship: "Self" },
        ];
      } else {
        filter.familyMemberId = targetMemberId;
      }
    }

    const appointments = await appointmentModel
      .find(filter)
      .populate("doctorId", "name speciality image rating phone email")
      .populate("hospitalId", "name location")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      totalCount: appointments.length,
      appoinmtent: appointments,
      appointments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAppointmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ success: false, message: "Valid appointment ID is required" });
    }
    const appointment = await appointmentModel
      .findById(id)
      .populate("doctorId")
      .populate("hospitalId")
      .populate("userId", "name email phone");

    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    res.status(200).json({ success: true, appointmentDetails: appointment, appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ success: false, message: "Valid appointment ID is required" });
    }
    const { reason } = req.body;
    const appointment = await appointmentModel.findOne({ _id: id, userId: req.user.id });

    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    appointment.status = "cancel";
    appointment.medicalNotes = (appointment.medicalNotes ? appointment.medicalNotes + "\n" : "") + `Cancelled: ${reason || "User request"}`;
    await appointment.save();

    try {
      dispatchNotification({
        userId: appointment.userId,
        recipientRole: "patient",
        title: "Appointment Cancelled",
        message: `Appointment #${appointment.displayAppointmentId || appointment.appointmentId} has been cancelled.`,
        type: "appointment",
        category: "appointment",
        priority: "normal",
        refId: appointment._id.toString(),
        refModel: "Appointment",
      }).catch(() => {});

      if (appointment.doctorId) {
        dispatchNotification({
          doctorId: appointment.doctorId,
          recipientRole: "doctor",
          title: "Appointment Cancelled",
          message: `Appointment for ${appointment.patientName} on ${appointment.slotDate} at ${appointment.slotTime} was cancelled.`,
          type: "appointment",
          category: "appointment",
          priority: "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}

    res.status(200).json({ success: true, message: "Appointment cancelled successfully", appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rescheduleAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidId(id)) {
      return res.status(400).json({ success: false, message: "Valid appointment ID is required" });
    }
    const { slotDate, slotTime, reason } = req.body;

    if (!slotDate || !slotTime) {
      return res.status(400).json({ success: false, message: "New slot date and time are required" });
    }

    const appointment = await appointmentModel.findOne({ _id: id, userId: req.user.id });
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    // Check hourly capacity on new slot date and time (excluding this appointment)
    const newHourlyBookings = await getHourlyBookingCount(
      appointment.doctorId,
      slotDate,
      slotTime,
      appointment._id
    );
    if (newHourlyBookings >= MAX_HOURLY_CAPACITY) {
      return res.status(409).json({
        success: false,
        code: "HOURLY_CAPACITY_FULL",
        message: `This doctor has reached the maximum capacity of ${MAX_HOURLY_CAPACITY} bookings for the requested hour. Please select another time slot or date.`,
      });
    }

    appointment.slotDate = slotDate;
    appointment.slotTime = slotTime;
    appointment.status = "rescheduled";
    appointment.reminder24hSent = false;
    appointment.reminder24hSentAt = undefined;
    appointment.reminder1hSent = false;
    appointment.reminder1hSentAt = undefined;
    if (reason) {
      appointment.medicalNotes =
        (appointment.medicalNotes ? appointment.medicalNotes + "\n" : "") +
        `Rescheduled: ${reason}`;
    }
    await appointment.save();

    try {
      dispatchNotification({
        userId: appointment.userId,
        recipientRole: "patient",
        title: "Appointment Rescheduled",
        message: `Your appointment has been rescheduled to ${slotDate} at ${slotTime}.`,
        type: "appointment",
        category: "appointment",
        priority: "normal",
        refId: appointment._id.toString(),
        refModel: "Appointment",
      }).catch(() => {});

      if (appointment.doctorId) {
        dispatchNotification({
          doctorId: appointment.doctorId,
          recipientRole: "doctor",
          title: "Appointment Rescheduled",
          message: `Appointment for ${appointment.patientName} was rescheduled to ${slotDate} at ${slotTime}.`,
          type: "appointment",
          category: "appointment",
          priority: "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}

    res.status(200).json({ success: true, message: "Appointment rescheduled successfully", appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllAppointments = async (req, res) => {
  try {
    const { status, hospitalId, doctorId, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== "all") filter.status = status;
    if (hospitalId) filter.hospitalId = hospitalId;
    if (doctorId) filter.doctorId = doctorId;
    if (search) {
      filter.$or = [
        { patientName: { $regex: search, $options: "i" } },
        { appointmentId: { $regex: search, $options: "i" } },
        { hospitalName: { $regex: search, $options: "i" } },
      ];
    }

    const totalCount = await appointmentModel.countDocuments(filter);
    const appointments = await appointmentModel
      .find(filter)
      .populate("doctorId", "name speciality image")
      .populate("hospitalId", "name location")
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      totalCount,
      count: appointments.length,
      appointments,
      appoinmtent: appointments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorAppointments = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    const appointments = await appointmentModel
      .find({ doctorId })
      .populate("userId", "name email phone image")
      .populate("hospitalId", "name location")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      totalCount: appointments.length,
      appointments,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, medicalNotes, meetingUrl } = req.body;
    const appointment = await appointmentModel.findById(id);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (status) appointment.status = status;
    if (medicalNotes) appointment.medicalNotes = medicalNotes;
    if (meetingUrl) appointment.meetingUrl = meetingUrl;
    await appointment.save();

    try {
      if (appointment.userId && status) {
        const statusTitle =
          status === "confirmed"
            ? "Appointment Confirmed"
            : status === "completed"
            ? "Consultation Completed"
            : status === "cancel"
            ? "Appointment Cancelled by Clinic"
            : "Appointment Status Updated";

        const statusMsg =
          status === "confirmed"
            ? `Your appointment on ${appointment.slotDate} at ${appointment.slotTime} has been confirmed.`
            : status === "completed"
            ? `Your consultation has concluded successfully.`
            : status === "cancel"
            ? `Your appointment on ${appointment.slotDate} at ${appointment.slotTime} was cancelled.`
            : `Your appointment status has changed to ${status}.`;

        dispatchNotification({
          userId: appointment.userId,
          recipientRole: "patient",
          title: statusTitle,
          message: statusMsg,
          type: "appointment",
          category: "appointment",
          priority: status === "cancel" ? "high" : "normal",
          refId: appointment._id.toString(),
          refModel: "Appointment",
        }).catch(() => {});
      }
    } catch (err) {}

    res.status(200).json({ success: true, message: "Appointment updated successfully", appointment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAvailableSlots = async (req, res) => {
  try {
    const doctorId = req.params.doctorId || req.params.id;
    if (!doctorId || !isValidId(doctorId)) {
      return res.status(400).json({ success: false, message: "Valid Doctor ID is required" });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    // Determine target date (default to today DD-MM-YYYY if omitted)
    const rawDate = req.query.date || req.query.slotDate || req.body?.date || req.body?.slotDate;
    const todayStr = normalizeDateDDMMYYYY(new Date());
    const targetDate = rawDate ? String(rawDate).trim() : todayStr;

    const result = await generateDoctorSlotsForDate(doctor, targetDate);

    return res.status(200).json({
      success: true,
      doctorId,
      date: targetDate,
      slotDate: targetDate,
      availableSlots: result.availableSlots || [],
      totalSlots: result.totalSlots ?? (result.availableSlots ? result.availableSlots.length : 0),
      hourlyCapacity: result.hourlyCapacity || {},
      reason: result.reason,
      data: {
        doctorId,
        date: targetDate,
        slots: result.availableSlots || [],
        hourlyCapacity: result.hourlyCapacity || {},
        reason: result.reason,
      },
    });
  } catch (error) {
    console.error("[getAvailableSlots Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const validateSlot = async (req, res) => {
  try {
    const doctorId = req.params.doctorId || req.params.id;
    const { slotDate, slotTime } = req.body || {};

    if (!doctorId || !isValidId(doctorId) || !slotDate || !slotTime) {
      return res.status(400).json({
        success: false,
        message: "Valid doctorId, slotDate, and slotTime are required",
      });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    if (!doctor.isActive || doctor.available === false) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: "Doctor is currently unavailable",
      });
    }

    const slotData = await generateDoctorSlotsForDate(doctor, slotDate);
    const isSlotAvailable = (slotData.availableSlots || []).includes(slotTime);

    if (!isSlotAvailable) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: slotData.reason || "Selected slot is not available or has already passed",
      });
    }

    const hourlyBookings = await getHourlyBookingCount(doctor._id, slotDate, slotTime);
    if (hourlyBookings >= MAX_HOURLY_CAPACITY) {
      return res.status(200).json({
        success: true,
        available: false,
        reason: `Hourly capacity limit of ${MAX_HOURLY_CAPACITY} bookings reached for this time slot`,
      });
    }

    return res.status(200).json({
      success: true,
      available: true,
      message: "Slot is available for booking",
    });
  } catch (error) {
    console.error("[validateSlot Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getHealthWallet = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      familyMemberId,
      category,
      search,
      sort = "newest",
      page = 1,
      limit = 50,
      startDate,
      endDate,
      fromDate,
      toDate,
    } = req.query;

    const query = { userId };
    if (familyMemberId && familyMemberId !== "all") {
      query.familyMemberId = familyMemberId;
    }

    const appointments = await appointmentModel
      .find(query)
      .populate("doctorId", "name speciality qualification image")
      .populate("hospitalId", "name address city phone")
      .sort({ createdAt: sort === "oldest" ? 1 : -1 });

    // Also fetch patient-uploaded digital health documents
    const docQuery = { userId, isArchived: { $ne: true } };
    if (familyMemberId && familyMemberId !== "all") {
      docQuery.familyMemberId = familyMemberId;
    }
    const healthDocs = await healthDocumentModel
      .find(docQuery)
      .populate("doctorId", "name speciality qualification image")
      .populate("hospitalId", "name address city phone")
      .sort({ createdAt: sort === "oldest" ? 1 : -1 });

    const user = await userModel.findById(userId);

    const prescriptions = [];
    const reports = [];
    const bills = [];
    const consultations = [];
    const records = [];
    const passes = [];
    const allItems = [];

    for (const appt of appointments) {
      const doc = appt.doctorId || {};
      const hosp = appt.hospitalId || {};

      const baseItem = {
        appointmentId: appt.appointmentId || appt._id.toString(),
        displayAppointmentId: appt.displayAppointmentId || appt.appointmentId,
        date: appt.slotDate,
        time: appt.slotTime,
        timestamp: new Date(appt.createdAt || Date.now()).getTime(),
        status: appt.status,
        patientName: appt.patientName,
        patientRelationship: appt.familyRelationship || "Self",
        familyMemberId: appt.familyMemberId || null,
        doctor: {
          _id: doc._id?.toString() || "",
          name: doc.name || appt.doctorName || "Specialist",
          speciality: doc.speciality || "General",
          qualification: doc.qualification || "MBBS",
          image: doc.image || "",
        },
        hospital: {
          _id: hosp._id?.toString() || "",
          name: hosp.name || appt.hospitalName || "HealPoint Hospital",
          address: hosp.address || "",
          city: hosp.city || "",
          phone: hosp.phone || "",
        },
      };

      // 1. Consultation item
      const consultItem = {
        ...baseItem,
        id: `consult_${appt._id}`,
        type: "consultation",
        category: "consultations",
        title: `${appt.consultationType === "video" ? "Video Consultation" : "In-Person Clinic Visit"} - ${baseItem.doctor.name}`,
        consultationType: appt.consultationType,
        consultationMode: appt.consultationMode,
        meetingUrl: appt.meetingUrl,
        meetingStatus: appt.meetingStatus,
        consultationStatus: appt.consultationStatus,
        hasPrescription: Boolean(appt.prescription || (appt.medicines && appt.medicines.length > 0)),
        reportsCount: appt.medicalReports?.length || 0,
      };
      consultations.push(consultItem);
      allItems.push(consultItem);

      // 2. Prescription item
      if (appt.prescription || (appt.medicines && appt.medicines.length > 0)) {
        const rxItem = {
          ...baseItem,
          id: `rx_${appt._id}`,
          type: "prescription",
          category: "prescriptions",
          title: `Digital Prescription - ${baseItem.doctor.name}`,
          diagnosis: appt.diagnosis,
          prescription: appt.prescription,
          medicines: appt.medicines || [],
          followUpAdvice: appt.followUpAdvice,
          isDigitallySigned: true,
        };
        prescriptions.push(rxItem);
        allItems.push(rxItem);
      }

      // 3. Reports
      if (appt.medicalReports && appt.medicalReports.length > 0) {
        appt.medicalReports.forEach((rep, idx) => {
          const repItem = {
            ...baseItem,
            id: `rep_${appt._id}_${idx}`,
            type: "report",
            category: "reports",
            title: rep.name || `Medical Lab Report - ${baseItem.doctor.name}`,
            url: rep.url,
            reportType: rep.type || "application/pdf",
            uploadedAt: rep.uploadedAt ? new Date(rep.uploadedAt).toISOString() : new Date().toISOString(),
          };
          reports.push(repItem);
          allItems.push(repItem);
        });
      }

      // 4. Bills & Receipts
      if (appt.amount > 0 || appt.billing) {
        const billItem = {
          ...baseItem,
          id: `bill_${appt._id}`,
          type: "bill",
          category: "bills",
          title: `Invoice & Receipt - ${baseItem.doctor.name}`,
          amount: appt.amount || appt.billing?.totalAmount || 0,
          currency: "INR",
          paymentMethod: appt.paymentMethod,
          paymentStatus: appt.paymentStatus,
          razorpayOrderId: appt.razorpayOrderId || null,
          razorpayPaymentId: appt.razorpayPaymentId || null,
          billing: appt.billing,
        };
        bills.push(billItem);
        allItems.push(billItem);
      }

      // 5. Clinical EMR Record
      if (appt.diagnosis || appt.medicalNotes || appt.vitals?.bloodPressure) {
        const recordItem = {
          ...baseItem,
          id: `rec_${appt._id}`,
          type: "record",
          category: "records",
          title: `EMR Clinical Encounter - ${baseItem.doctor.name}`,
          diagnosis: appt.diagnosis,
          medicalNotes: appt.medicalNotes,
          vitals: appt.vitals,
        };
        records.push(recordItem);
        allItems.push(recordItem);
      }

      // 6. Hospital Passes
      if (appt.queueToken || appt.checkedIn || appt.status === "confirmed" || appt.status === "pending") {
        const passItem = {
          ...baseItem,
          id: `pass_${appt._id}`,
          type: "pass",
          category: "passes",
          title: `Digital Hospital Pass - ${baseItem.hospital.name}`,
          queueToken: appt.queueToken || null,
          queueStatus: appt.queueStatus,
          checkedIn: appt.checkedIn,
          checkInAt: appt.checkInAt ? new Date(appt.checkInAt).toISOString() : null,
        };
        passes.push(passItem);
        allItems.push(passItem);
      }
    }

    // Process uploaded health documents
    for (const doc of healthDocs) {
      const docDoctor = doc.doctorId || {};
      const docHospital = doc.hospitalId || {};

      const baseDocItem = {
        id: `doc_${doc._id}`,
        _id: doc._id.toString(),
        appointmentId: doc.appointmentId || "",
        displayAppointmentId: doc.appointmentId ? `DOC-${doc.appointmentId.slice(-6).toUpperCase()}` : "",
        date: doc.documentDate || (doc.createdAt ? new Date(doc.createdAt).toISOString().split("T")[0] : ""),
        time: "",
        timestamp: new Date(doc.createdAt || Date.now()).getTime(),
        status: doc.processingStatus || "processed",
        statusLabel: doc.category.replace(/_/g, " ").toUpperCase(),
        patientName: user?.name || "Patient",
        patientRelationship: "Self",
        familyMemberId: doc.familyMemberId?.toString() || null,
        doctor: {
          _id: docDoctor._id?.toString() || (doc.doctorId ? String(doc.doctorId) : ""),
          name: docDoctor.name || doc.doctorName || doc.extractedMetadata?.doctorName || "Treating Doctor",
          speciality: docDoctor.speciality || "General",
          qualification: docDoctor.qualification || "",
          image: docDoctor.image || "",
        },
        hospital: {
          _id: docHospital._id?.toString() || (doc.hospitalId ? String(doc.hospitalId) : ""),
          name: docHospital.name || doc.hospitalName || doc.extractedMetadata?.hospitalName || "HealPoint Health",
          address: docHospital.address || "",
          city: docHospital.city || "",
          phone: docHospital.phone || "",
        },
        title: doc.title,
        url: doc.fileUrl || (doc.fileData?.length < 2000 ? doc.fileData : `/api/v1/document/${doc._id}/view`),
        reportType: doc.category,
        mimeType: doc.mimeType || "application/pdf",
        size: doc.size || doc.fileSize || 0,
        notes: doc.notes || "",
        extractedMetadata: doc.extractedMetadata,
        userCorrections: doc.userCorrections,
        processingStatus: doc.processingStatus,
        confidence: doc.confidence,
      };

      if (doc.category === "prescription") {
        const item = { ...baseDocItem, type: "prescription", category: "prescriptions" };
        prescriptions.push(item);
        allItems.push(item);
      } else if (doc.category === "lab_report" || doc.category === "diagnostic_report" || doc.category === "radiology") {
        const item = { ...baseDocItem, type: "report", category: "reports" };
        reports.push(item);
        allItems.push(item);
      } else if (doc.category === "billing_receipt") {
        const item = { ...baseDocItem, type: "bill", category: "bills" };
        bills.push(item);
        allItems.push(item);
      } else if (doc.category === "consultation_history") {
        const item = { ...baseDocItem, type: "consultation", category: "consultations" };
        consultations.push(item);
        allItems.push(item);
      } else {
        const item = { ...baseDocItem, type: "record", category: "records" };
        records.push(item);
        allItems.push(item);
      }
    }

    // Sort allItems chronologically
    allItems.sort((a, b) => (sort === "oldest" ? a.timestamp - b.timestamp : b.timestamp - a.timestamp));

    // Filter by category if requested
    let filteredItems = allItems;
    if (category && category !== "all") {
      filteredItems = allItems.filter((it) => it.category === category);
    }

    // Date range filter
    const rangeStart = startDate || fromDate;
    const rangeEnd = endDate || toDate;
    if (rangeStart || rangeEnd) {
      filteredItems = filteredItems.filter((it) => {
        const itTime = it.timestamp;
        if (rangeStart && itTime < new Date(rangeStart).getTime()) return false;
        if (rangeEnd && itTime > new Date(rangeEnd).getTime()) return false;
        return true;
      });
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredItems = filteredItems.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.doctor.name.toLowerCase().includes(q) ||
          it.hospital.name.toLowerCase().includes(q) ||
          (it.diagnosis && it.diagnosis.toLowerCase().includes(q)) ||
          (it.notes && it.notes.toLowerCase().includes(q))
      );
    }

    const counts = {
      prescriptions: prescriptions.length,
      reports: reports.length,
      bills: bills.length,
      consultations: consultations.length,
      records: records.length,
      passes: passes.length,
      appointments: appointments.length,
      documents: healthDocs.length,
      total: allItems.length,
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;
    const paginatedItems = filteredItems.slice(skip, skip + limitNum);
    const totalPages = Math.ceil(filteredItems.length / limitNum) || 1;

    return res.status(200).json({
      success: true,
      counts,
      patient: {
        _id: user?._id?.toString() || userId,
        name: user?.name || "Patient",
        phone: user?.phone || "",
        email: user?.email || "",
      },
      wallet: {
        prescriptions,
        reports,
        bills,
        consultations,
        records,
        passes,
      },
      items: paginatedItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: filteredItems.length,
        totalPages,
        hasMore: pageNum < totalPages,
      },
    });
  } catch (error) {
    console.error("[getHealthWallet Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPatientMedicalHistory = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { familyMemberId } = req.query;

    const query = { userId };
    if (familyMemberId && familyMemberId !== "all") {
      query.familyMemberId = familyMemberId;
    }

    const appointments = await appointmentModel
      .find(query)
      .populate("doctorId", "name speciality qualification image")
      .populate("hospitalId", "name address city phone")
      .sort({ createdAt: -1 });

    const prescriptions = appointments.filter(
      (a) => a.prescription || (a.medicines && a.medicines.length > 0)
    );

    const consultations = appointments;
    const labReports = [];
    appointments.forEach((a) => {
      if (a.medicalReports && a.medicalReports.length > 0) {
        a.medicalReports.forEach((r) => {
          labReports.push({
            ...r.toObject(),
            appointmentId: a._id,
            doctorName: a.doctorId?.name || a.doctorName,
            hospitalName: a.hospitalId?.name || a.hospitalName,
            date: a.slotDate,
          });
        });
      }
    });

    return res.status(200).json({
      success: true,
      prescriptions,
      consultations,
      labReports,
      timeline: appointments,
    });
  } catch (error) {
    console.error("[getPatientMedicalHistory Error]:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

import {
  getPatientMedicationReminders as getPatientMedicationRemindersReal,
  createMedicationReminder as createMedicationReminderReal,
  recordMedicationAction as recordMedicationActionReal,
  deleteMedicationReminder as deleteMedicationReminderReal,
} from "./medicationReminderController.js";

export const getPatientMedicationReminders = async (req, res) => {
  return getPatientMedicationRemindersReal(req, res);
};

export const updateMedicationDoseStatus = async (req, res) => {
  req.params = req.params || {};
  if (req.body?.reminderId && !req.params.reminderId) {
    req.params.reminderId = req.body.reminderId;
  }
  return recordMedicationActionReal(req, res);
};

export const createMedicationReminder = async (req, res) => {
  return createMedicationReminderReal(req, res);
};

export const deleteMedicationReminder = async (req, res) => {
  return deleteMedicationReminderReal(req, res);
};

export const triggerAppointmentReminders = async (req, res) => {
  try {
    const results = await processAppointmentReminders();
    return res.status(200).json({
      success: true,
      message: "Appointment reminder check pass completed",
      results,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

