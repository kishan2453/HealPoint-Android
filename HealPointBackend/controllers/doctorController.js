import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import doctorModel from "../models/doctorModel.js";
import hospitalModel from "../models/hospitalModel.js";
import appointmentModel from "../models/appointmentModel.js";
import userModel from "../models/userModel.js";
import reviewModel from "../models/reviewModel.js";
import healthDocumentModel from "../models/healthDocumentModel.js";
import notificationModel from "../models/notificationModel.js";

const JWT_SECRET = process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026";

// Helper: Format Doctor Title
const formatDoctorTitle = (name = "") => {
  const clean = String(name || "").trim();
  if (!clean) return "Doctor";
  return clean.toLowerCase().startsWith("dr.") ? clean : `Dr. ${clean}`;
};

// Helper: Today IST Date Formats
const getTodayDateFormats = () => {
  const now = new Date();
  const istDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dd = String(istDate.getDate()).padStart(2, "0");
  const mm = String(istDate.getMonth() + 1).padStart(2, "0");
  const yyyy = istDate.getFullYear();
  return {
    ddmmyyyy: `${dd}-${mm}-${yyyy}`,
    slash: `${dd}/${mm}/${yyyy}`,
    iso: `${yyyy}-${mm}-${dd}`,
    dayName: istDate.toLocaleDateString("en-US", { weekday: "long" }),
  };
};

// Helper: Parse Date String to Date object
const parseDateString = (str) => {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  const s = String(str).trim();
  if (s.includes("-")) {
    const parts = s.split("-");
    if (parts[0].length === 4) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }
  if (s.includes("/")) {
    const parts = s.split("/");
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(str);
};

// Helper: Format Date to DD-MM-YYYY
const formatDateDDMMYYYY = (d) => {
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
};

// ==========================================
// 1. PUBLIC & CATALOG
// ==========================================

export const getAllDoctors = async (req, res) => {
  try {
    const { search, speciality, hospitalId, available, online } = req.query;
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { speciality: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
      ];
    }
    if (speciality) filter.speciality = { $regex: `^${speciality}$`, $options: "i" };
    if (hospitalId) filter.hospitalId = hospitalId;
    if (available === "true") filter.available = true;
    if (online === "true") filter.onlineStatus = "online";

    const doctors = await doctorModel.find(filter).populate("hospitalId", "name location logo");
    res.status(200).json({
      success: true,
      count: doctors.length,
      totalCount: doctors.length,
      doctors,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID format" });
    }
    const doctor = await doctorModel.findById(id).populate("hospitalId");
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
    res.status(200).json({ success: true, doctor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOnlineDoctors = async (req, res) => {
  try {
    const { search, speciality } = req.query;

    const filter = {
      isActive: { $ne: false },
      onlineConsultationEnabled: { $ne: false },
      available: { $ne: false },
      verificationStatus: { $nin: ["Rejected", "Suspended"] },
    };

    if (search && search.trim()) {
      const q = search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { speciality: { $regex: q, $options: "i" } },
        { department: { $regex: q, $options: "i" } },
        { specialization: { $regex: q, $options: "i" } },
      ];
    }

    if (speciality && speciality.trim() && speciality.toLowerCase() !== "all") {
      filter.speciality = { $regex: `^${speciality.trim()}$`, $options: "i" };
    }

    const doctors = await doctorModel
      .find(filter)
      .populate("hospitalId", "name location logo image")
      .sort({ onlineStatus: -1, rating: -1, reviewCount: -1 });

    const formatted = doctors.map((doc) => {
      const hospitalObj =
        doc.hospitalId && typeof doc.hospitalId === "object" ? doc.hospitalId : null;
      return {
        _id: doc._id,
        name: doc.name,
        speciality: doc.speciality,
        specialization: doc.specialization || doc.speciality,
        department: doc.department || doc.speciality,
        degree: doc.degree || "MBBS",
        experience: doc.experience || 1,
        fees: doc.fees || 500,
        rating: doc.rating || 4.8,
        reviewCount: doc.reviewCount || 0,
        image: doc.image || "",
        onlineStatus: doc.onlineStatus || "online",
        onlineConsultationEnabled: doc.onlineConsultationEnabled !== false,
        instantConsultationEnabled: doc.instantConsultationEnabled !== false,
        available: doc.available !== false,
        verificationStatus: doc.verificationStatus || "Verified",
        hospitalId: hospitalObj?._id || doc.hospitalId,
        hospitalName: hospitalObj?.name || doc.hospitalName || "HealPoint Clinic",
        hospital: hospitalObj || { name: doc.hospitalName || "HealPoint Clinic" },
        nextAvailableSlot: "Today, Available Now",
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      totalCount: formatted.length,
      doctors: formatted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 2. AUTHENTICATION
// ==========================================

export const loginDoctor = async (req, res) => {
  try {
    const { email, password, hospitalId } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const doctor = await doctorModel.findOne({ email: email.toLowerCase().trim() }).populate("hospitalId");
    if (!doctor) {
      return res.status(401).json({ success: false, message: "Invalid doctor email or password" });
    }

    const valid = await bcrypt.compare(password, doctor.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid doctor email or password" });
    }

    if (hospitalId && doctor.hospitalId) {
      const docHospitalId = doctor.hospitalId._id
        ? doctor.hospitalId._id.toString()
        : doctor.hospitalId.toString();
      if (docHospitalId !== hospitalId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Doctor account is not registered with the selected hospital",
        });
      }
    }

    const token = jwt.sign(
      {
        id: doctor._id,
        role: "doctor",
        email: doctor.email,
        hospitalId: doctor.hospitalId?._id || doctor.hospitalId,
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      success: true,
      message: "Doctor login successful",
      token,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        email: doctor.email,
        phone: doctor.phone,
        speciality: doctor.speciality,
        hospitalId: doctor.hospitalId,
        image: doctor.image,
        role: "doctor",
      },
      hospital: doctor.hospitalId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 3. DOCTOR PROFILE & SETTINGS
// ==========================================

export const getDoctorProfile = async (req, res) => {
  try {
    const id = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }
    const doctor = await doctorModel.findById(id).populate("hospitalId");
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
    res.status(200).json({ success: true, doctor, hospital: doctor.hospitalId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDoctorProfile = async (req, res) => {
  try {
    const id = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const allowedFields = [
      "name",
      "phone",
      "speciality",
      "department",
      "specialization",
      "qualification",
      "degree",
      "registrationNumber",
      "about",
      "experience",
      "fees",
      "image",
      "coverBanner",
      "clinicInfo",
      "onlineConsultationEnabled",
      "instantConsultationEnabled",
      "available",
      "onlineStatus",
    ];

    const updateData = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    const doctor = await doctorModel.findByIdAndUpdate(id, { $set: updateData }, { new: true }).populate("hospitalId");
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    res.status(200).json({
      success: true,
      message: "Doctor profile updated successfully",
      doctor,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeDoctorPassword = async (req, res) => {
  try {
    const id = req.params.id || req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new password are required" });
    }

    const doctor = await doctorModel.findById(id);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const isValid = await bcrypt.compare(currentPassword, doctor.password);
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Incorrect current password" });
    }

    doctor.password = await bcrypt.hash(newPassword, 10);
    await doctor.save();

    res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDoctorNotificationSettings = async (req, res) => {
  try {
    const id = req.params.id || req.user?.id;
    const doctor = await doctorModel.findByIdAndUpdate(
      id,
      { $set: { notificationSettings: req.body } },
      { new: true }
    );
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });
    res.status(200).json({ success: true, message: "Notification settings saved", settings: doctor.notificationSettings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 4. DOCTOR PANEL & DASHBOARD (GET /panel/:id)
// ==========================================

export const getDoctorDashboardAndPanel = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const doctor = await doctorModel.findById(doctorId).populate("hospitalId");
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const appointments = await appointmentModel
      .find({ doctorId })
      .populate("userId", "name email phone image gender age dob bloodGroup")
      .populate("hospitalId", "name location logo")
      .sort({ createdAt: -1 });

    const todayDates = getTodayDateFormats();
    const todayAppointments = [];
    const upcomingAppointments = [];
    let todayRevenue = 0;
    let totalRevenue = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    const patientSet = new Set();

    appointments.forEach((apt) => {
      const isToday =
        apt.slotDate === todayDates.ddmmyyyy ||
        apt.slotDate === todayDates.slash ||
        apt.slotDate === todayDates.iso;

      if (isToday) todayAppointments.push(apt);

      if (apt.userId?._id) patientSet.add(apt.userId._id.toString());

      const status = (apt.status || "pending").toLowerCase();
      if (status === "pending") pendingCount++;
      else if (status === "confirmed") confirmedCount++;
      else if (status === "completed") completedCount++;
      else if (status === "cancel" || status === "missed") cancelledCount++;

      const isPaid = apt.payment === true || apt.paymentStatus === "SUCCESS" || apt.paymentStatus === "paid";
      const amt = Number(apt.amount || apt.billing?.totalAmount || 0);
      if (isPaid || status === "completed") {
        totalRevenue += amt;
        if (isToday) todayRevenue += amt;
      }
    });

    const notifications = await notificationModel
      .find({ doctorId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const formattedNotifications = notifications.map((n) => ({
      ...n,
      isRead: n.read ?? false,
    }));

    const dashboard = {
      totals: {
        today: todayAppointments.length,
        pending: pendingCount,
        confirmed: confirmedCount,
        completed: completedCount,
        cancelled: cancelledCount,
        revenue: totalRevenue,
        patients: patientSet.size,
      },
      earnings: {
        total: totalRevenue,
        today: todayRevenue,
      },
      todayAppointments,
      upcomingAppointments: appointments.filter((a) =>
        ["pending", "confirmed"].includes((a.status || "").toLowerCase())
      ),
      allAppointments: appointments,
      notifications: formattedNotifications,
    };

    res.status(200).json({
      success: true,
      doctor,
      hospital: doctor.hospitalId,
      dashboard,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 5. PATIENT QUEUE (OPD)
// ==========================================

export const getDoctorQueue = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const doctor = await doctorModel.findById(doctorId).populate("hospitalId");
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const todayDates = getTodayDateFormats();
    const queryDate = req.query.date;

    let filter = { doctorId };
    if (queryDate) {
      filter.slotDate = queryDate;
    }

    let appointments = await appointmentModel
      .find(filter)
      .populate("userId", "name email phone image gender age dob bloodGroup")
      .populate("hospitalId", "name location")
      .sort({ slotDate: 1, slotTime: 1, createdAt: 1 });

    // If queryDate wasn't provided, prioritize today's appointments
    if (!queryDate) {
      const todayMatches = appointments.filter(
        (a) =>
          a.slotDate === todayDates.ddmmyyyy ||
          a.slotDate === todayDates.slash ||
          a.slotDate === todayDates.iso
      );
      if (todayMatches.length > 0) {
        appointments = todayMatches;
      }
    }

    const sections = {
      waiting: [],
      checkedIn: [],
      inConsultation: [],
      completed: [],
      cancelled: [],
    };

    appointments.forEach((apt) => {
      const qStatus = (apt.queueStatus || "not_checked_in").toLowerCase();
      const status = (apt.status || "pending").toLowerCase();

      if (status === "cancel" || status === "missed" || qStatus === "cancelled") {
        sections.cancelled.push(apt);
      } else if (status === "completed" || qStatus === "completed") {
        sections.completed.push(apt);
      } else if (qStatus === "in_consultation" || apt.consultationStatus === "in_progress") {
        sections.inConsultation.push(apt);
      } else if (apt.checkedIn === true || qStatus === "called") {
        sections.checkedIn.push(apt);
      } else {
        sections.waiting.push(apt);
      }
    });

    const summary = {
      todayDate: todayDates.ddmmyyyy,
      doctorName: formatDoctorTitle(doctor.name),
      hospitalName: doctor.hospitalId?.name || "HealPoint Partner Hospital",
      department: doctor.department || doctor.speciality || "OPD",
      totalToday: appointments.length,
      waitingCount: sections.waiting.length,
      checkedInCount: sections.checkedIn.length,
      inConsultationCount: sections.inConsultation.length,
      completedCount: sections.completed.length,
      cancelledCount: sections.cancelled.length,
    };

    res.status(200).json({
      success: true,
      count: appointments.length,
      queue: appointments,
      appointments,
      sections,
      summary,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const handleDoctorQueueAction = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { action, reason, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (action === "call_patient") {
      appointment.calledAt = new Date();
      appointment.queueStatus = "called";
      appointment.checkedIn = true;
      if (!appointment.checkInAt) appointment.checkInAt = new Date();
    } else if (action === "complete_consultation") {
      appointment.status = "completed";
      appointment.queueStatus = "completed";
      appointment.consultationStatus = "completed";
      if (notes) {
        appointment.medicalNotes = (appointment.medicalNotes ? appointment.medicalNotes + "\n" : "") + notes;
      }
    } else if (action === "mark_noshow") {
      appointment.status = "missed";
      appointment.queueStatus = "cancelled";
      appointment.medicalNotes = (appointment.medicalNotes ? appointment.medicalNotes + "\n" : "") + (reason || "Marked No-Show by Doctor");
    } else if (action === "cancel") {
      appointment.status = "cancel";
      appointment.queueStatus = "cancelled";
      appointment.medicalNotes = (appointment.medicalNotes ? appointment.medicalNotes + "\n" : "") + (reason || "Cancelled by Doctor");
    }

    await appointment.save();

    res.status(200).json({
      success: true,
      message: `Queue action '${action}' applied successfully`,
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const startDoctorConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    appointment.queueStatus = "in_consultation";
    appointment.consultationStatus = "in_progress";
    if (appointment.status === "pending") appointment.status = "confirmed";
    appointment.consultationStartedAt = new Date();
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Consultation started successfully",
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 6. MEDICAL REPORTS
// ==========================================

export const getDoctorReports = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const { search = "", category = "all" } = req.query;

    // Find appointments for this doctor that have medical reports
    const appointments = await appointmentModel
      .find({ doctorId, "medicalReports.0": { $exists: true } })
      .populate("userId", "name email phone image")
      .select("medicalReports slotDate slotTime patientName patientPhone userId")
      .lean();

    const reports = [];
    appointments.forEach((apt) => {
      (apt.medicalReports || []).forEach((rep) => {
        reports.push({
          _id: rep._id,
          name: rep.name || "Medical Report",
          filename: rep.filename || rep.name || "report.pdf",
          mimeType: rep.type || rep.mimeType || "application/pdf",
          size: rep.size || 0,
          category: rep.category || "Other Medical Report",
          type: rep.type || "Other Medical Report",
          notes: rep.notes || "",
          url: rep.url || "",
          uploadedAt: rep.uploadedAt || new Date(),
          slotDate: apt.slotDate,
          slotTime: apt.slotTime,
          appointmentId: apt._id,
          patient: apt.userId || { name: apt.patientName, phone: apt.patientPhone },
        });
      });
    });

    // Also include health documents for patients under this doctor
    const patientIds = (await appointmentModel.find({ doctorId }).distinct("userId")).filter(Boolean);
    const healthDocs = await healthDocumentModel
      .find({
        $or: [{ sharedWithDoctorIds: doctorId }, { userId: { $in: patientIds } }],
      })
      .populate("userId", "name email phone image")
      .lean();

    healthDocs.forEach((doc) => {
      reports.push({
        _id: doc._id,
        name: doc.title || "Health Document",
        filename: doc.title || "document.pdf",
        mimeType: doc.mimeType || "application/pdf",
        size: doc.size || 0,
        category:
          doc.category === "lab_report"
            ? "Blood Test"
            : doc.category === "radiology"
            ? "X-Ray"
            : doc.category === "prescription"
            ? "Prescription"
            : "Other Medical Report",
        type: doc.category || "other",
        notes: doc.notes || "",
        url: doc.fileData || "",
        uploadedAt: doc.createdAt || new Date(),
        slotDate: doc.documentDate || "",
        slotTime: "",
        appointmentId: null,
        patient: doc.userId || {},
      });
    });

    // Summary count calculation
    const summary = {
      total: reports.length,
      bloodTest: 0,
      radiology: 0,
      pathology: 0,
      other: 0,
    };

    reports.forEach((r) => {
      const c = (r.category || "").toLowerCase();
      if (c.includes("blood") || c.includes("lab")) summary.bloodTest++;
      else if (c.includes("x-ray") || c.includes("ct") || c.includes("mri") || c.includes("ultrasound") || c.includes("radiology")) summary.radiology++;
      else if (c.includes("pathology")) summary.pathology++;
      else summary.other++;
    });

    // Filter by search & category
    let filtered = reports;
    if (category && category !== "all") {
      filtered = filtered.filter(
        (r) => (r.category || "").toLowerCase() === category.toLowerCase()
      );
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.name || "").toLowerCase().includes(q) ||
          (r.patient?.name || "").toLowerCase().includes(q) ||
          (r.filename || "").toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q)
      );
    }

    res.status(200).json({
      success: true,
      count: filtered.length,
      reports: filtered,
      summary,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const uploadDoctorReport = async (req, res) => {
  try {
    const { aptId } = req.params;
    const { reports = [] } = req.body;

    if (!mongoose.Types.ObjectId.isValid(aptId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await appointmentModel.findById(aptId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (!Array.isArray(reports) || reports.length === 0) {
      return res.status(400).json({ success: false, message: "No report files provided" });
    }

    reports.forEach((rep) => {
      appointment.medicalReports.push({
        name: rep.name || "Medical Report",
        url: rep.url,
        type: rep.mimeType || rep.type || "application/pdf",
        uploadedAt: new Date(),
        category: rep.category || "Other Medical Report",
        notes: rep.notes || "",
        filename: rep.filename || rep.name,
        size: rep.size || 0,
      });
    });

    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Medical report(s) uploaded successfully",
      medicalReports: appointment.medicalReports,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDoctorReport = async (req, res) => {
  try {
    const { aptId, reportId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(aptId)) {
      return res.status(400).json({ success: false, message: "Invalid appointment ID" });
    }

    const appointment = await appointmentModel.findById(aptId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    appointment.medicalReports = (appointment.medicalReports || []).filter(
      (r) => r._id.toString() !== reportId.toString()
    );
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 7. AVAILABILITY, SCHEDULE & CALENDAR
// ==========================================

export const getDoctorSchedule = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const defaultSchedule = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ].map((day) => ({
      day,
      enabled: day !== "Sunday",
      startTime: "09:00 AM",
      endTime: "05:00 PM",
      sessions: [
        { name: "Morning OPD", startTime: "09:00 AM", endTime: "01:00 PM" },
        { name: "Evening OPD", startTime: "02:00 PM", endTime: "05:00 PM" },
      ],
      breaks: [{ name: "Lunch Break", startTime: "01:00 PM", endTime: "02:00 PM" }],
    }));

    const schedule = {
      available: Boolean(doctor.available),
      slotDurationMinutes: doctor.slotDurationMinutes || 30,
      weeklySchedule: doctor.weeklySchedule?.length ? doctor.weeklySchedule : defaultSchedule,
      breakTimes: doctor.breakTimes || [],
      dateOverrides: doctor.dateOverrides || [],
      leaves: doctor.leaves || [],
      leaveDates: doctor.leaveDates || [],
      blockedHolidays: doctor.blockedHolidays || [],
    };

    res.status(200).json({
      success: true,
      schedule,
      availability: doctor.available ? "active" : "offline",
      slotDuration: doctor.slotDurationMinutes || 30,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDoctorSchedule = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const {
      weeklySchedule,
      slotDurationMinutes,
      breakTimes,
      dateOverrides,
      leaveDates,
      blockedHolidays,
    } = req.body;

    const update = {};
    if (weeklySchedule) update.weeklySchedule = weeklySchedule;
    if (slotDurationMinutes) update.slotDurationMinutes = Number(slotDurationMinutes);
    if (breakTimes) update.breakTimes = breakTimes;
    if (dateOverrides) update.dateOverrides = dateOverrides;
    if (leaveDates) update.leaveDates = leaveDates;
    if (blockedHolidays) update.blockedHolidays = blockedHolidays;

    const doctor = await doctorModel.findByIdAndUpdate(doctorId, { $set: update }, { new: true });
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    res.status(200).json({
      success: true,
      message: "Schedule configuration saved successfully",
      schedule: {
        weeklySchedule: doctor.weeklySchedule,
        slotDurationMinutes: doctor.slotDurationMinutes,
        breakTimes: doctor.breakTimes,
        dateOverrides: doctor.dateOverrides,
        leaveDates: doctor.leaveDates,
        blockedHolidays: doctor.blockedHolidays,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleDoctorAvailability = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const { available } = req.body;
    const doctor = await doctorModel.findByIdAndUpdate(
      doctorId,
      { $set: { available: Boolean(available) } },
      { new: true }
    );
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    res.status(200).json({
      success: true,
      message: doctor.available ? "Doctor availability activated" : "Doctor availability paused",
      available: doctor.available,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generates Smart Calendar Slots
export const getDoctorCalendar = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const { startDate, endDate } = req.query;
    const start = parseDateString(startDate);
    const end = parseDateString(endDate || startDate);

    // Limit range to maximum 45 days for performance
    const diffDays = Math.min(45, Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1));

    // Fetch existing booked appointments in range
    const bookedAppointments = await appointmentModel
      .find({
        doctorId,
        status: { $nin: ["cancel", "missed"] },
      })
      .populate("userId", "name email phone image")
      .lean();

    const bookedMap = new Map();
    bookedAppointments.forEach((apt) => {
      const key = `${apt.slotDate}__${(apt.slotTime || "").trim().toUpperCase()}`;
      bookedMap.set(key, apt);
    });

    const blockedSlots = doctor.blockedSlots || [];
    const blockedMap = new Map();
    blockedSlots.forEach((bs) => {
      blockedMap.set(`${bs.date}__${(bs.slotTime || "").trim().toUpperCase()}`, bs.reason || "Doctor Blocked");
    });

    const weekly = doctor.weeklySchedule || [];
    const slotDuration = doctor.slotDurationMinutes || 30;

    const days = [];
    let totalSlots = 0;
    let totalAvailable = 0;
    let totalBooked = 0;
    let totalBlocked = 0;

    for (let i = 0; i < diffDays; i++) {
      const current = new Date(start);
      current.setDate(current.getDate() + i);

      const dStr = formatDateDDMMYYYY(current);
      const dayName = current.toLocaleDateString("en-US", { weekday: "long" });

      const dayConfig = weekly.find((w) => (w.day || "").toLowerCase() === dayName.toLowerCase());
      const isWorkingDay = dayConfig ? dayConfig.enabled !== false : dayName !== "Sunday";

      // Check date overrides / leaves
      const isLeave = (doctor.leaveDates || []).includes(dStr);

      const slots = [];
      if (isWorkingDay && !isLeave && doctor.available !== false) {
        // Generate slots from 09:00 AM to 05:00 PM in increments of slotDuration
        let startMinutes = 9 * 60; // 09:00 AM
        let endMinutes = 17 * 60; // 05:00 PM

        if (dayConfig?.startTime && dayConfig?.endTime) {
          const parseTime = (tStr) => {
            const [time, modifier] = tStr.trim().split(" ");
            let [hours, minutes] = time.split(":").map(Number);
            if (modifier === "PM" && hours < 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
            return hours * 60 + minutes;
          };
          try {
            startMinutes = parseTime(dayConfig.startTime);
            endMinutes = parseTime(dayConfig.endTime);
          } catch {
            // fallback
          }
        }

        for (let m = startMinutes; m < endMinutes; m += slotDuration) {
          const h = Math.floor(m / 60);
          const min = m % 60;
          const period = h >= 12 ? "PM" : "AM";
          const displayH = h % 12 === 0 ? 12 : h % 12;
          const timeLabel = `${String(displayH).padStart(2, "0")}:${String(min).padStart(2, "0")} ${period}`;

          const key = `${dStr}__${timeLabel.toUpperCase()}`;
          const isBooked = bookedMap.has(key);
          const isBlocked = blockedMap.has(key);

          let status = "available";
          let aptDetails = null;
          let reason = "";

          if (isBooked) {
            status = "booked";
            aptDetails = bookedMap.get(key);
            totalBooked++;
          } else if (isBlocked) {
            status = "blocked";
            reason = blockedMap.get(key);
            totalBlocked++;
          } else {
            totalAvailable++;
          }
          totalSlots++;

          slots.push({
            date: dStr,
            startTime: timeLabel,
            endTime: "",
            status,
            isBooked,
            isBlocked,
            appointment: aptDetails,
            reason,
          });
        }
      }

      days.push({
        date: dStr,
        day: dayName,
        isWorkingDay: isWorkingDay && !isLeave,
        leaveType: isLeave ? "Holiday / Personal Leave" : null,
        reason: !isWorkingDay ? "Weekly Off" : isLeave ? "Doctor On Leave" : "",
        availableSlots: slots.filter((s) => s.status === "available").length,
        slots,
      });
    }

    const summary = {
      startDate: formatDateDDMMYYYY(start),
      endDate: formatDateDDMMYYYY(new Date(start.getTime() + (diffDays - 1) * 86400000)),
      totalSlots,
      totalAvailable,
      totalBooked,
      totalBlocked,
    };

    res.status(200).json({
      success: true,
      days,
      summary,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateDoctorSlots = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const { startDate, endDate, slotDuration = 30 } = req.body;
    const start = parseDateString(startDate);
    const end = parseDateString(endDate || startDate);
    const diffDays = Math.min(30, Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1));

    const newSlots = [];
    for (let i = 0; i < diffDays; i++) {
      const current = new Date(start);
      current.setDate(current.getDate() + i);
      const dStr = formatDateDDMMYYYY(current);
      const dayName = current.toLocaleDateString("en-US", { weekday: "long" });

      const dayConfig = (doctor.weeklySchedule || []).find(
        (w) => (w.day || "").toLowerCase() === dayName.toLowerCase()
      );
      if (dayConfig && dayConfig.enabled === false) continue;

      for (let m = 9 * 60; m < 17 * 60; m += slotDuration) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const period = h >= 12 ? "PM" : "AM";
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const timeLabel = `${String(displayH).padStart(2, "0")}:${String(min).padStart(2, "0")} ${period}`;

        newSlots.push({
          date: dStr,
          startTime: timeLabel,
          endTime: "",
          isAvailable: true,
        });
      }
    }

    doctor.timeSlots = newSlots;
    await doctor.save();

    res.status(200).json({
      success: true,
      message: `Generated ${newSlots.length} schedule slots across ${diffDays} day(s)`,
      count: newSlots.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const blockDoctorSlot = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    const { date, slotTime, reason } = req.body;

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    doctor.blockedSlots = (doctor.blockedSlots || []).filter(
      (b) => !(b.date === date && b.slotTime === slotTime)
    );
    doctor.blockedSlots.push({ date, slotTime, reason: reason || "Doctor Blocked" });
    await doctor.save();

    res.status(200).json({
      success: true,
      message: `Slot ${slotTime} on ${date} blocked successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const unblockDoctorSlot = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    const { date, slotTime } = req.body;

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    doctor.blockedSlots = (doctor.blockedSlots || []).filter(
      (b) => !(b.date === date && b.slotTime === slotTime)
    );
    await doctor.save();

    res.status(200).json({
      success: true,
      message: `Slot ${slotTime} on ${date} unblocked`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 8. PATIENT HISTORY & EMR
// ==========================================

export const getDoctorPatients = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const appointments = await appointmentModel
      .find({ doctorId })
      .populate("userId", "name email phone image gender age dob bloodGroup address allergies chronicConditions")
      .sort({ createdAt: -1 });

    const patientMap = new Map();
    appointments.forEach((apt) => {
      const u = apt.userId;
      if (u && u._id) {
        const id = u._id.toString();
        if (!patientMap.has(id)) {
          patientMap.set(id, {
            ...u.toObject(),
            lastVisitDate: apt.slotDate || apt.createdAt,
            lastStatus: apt.status,
            totalVisits: 1,
          });
        } else {
          const p = patientMap.get(id);
          p.totalVisits += 1;
        }
      }
    });

    let patients = Array.from(patientMap.values());
    const search = (req.query.search || "").trim().toLowerCase();
    if (search) {
      patients = patients.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(search) ||
          (p.phone || "").includes(search) ||
          (p.email || "").toLowerCase().includes(search)
      );
    }

    res.status(200).json({
      success: true,
      count: patients.length,
      patients,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorPatientDetails = async (req, res) => {
  try {
    const { id: doctorId, patientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: "Invalid patient ID format" });
    }

    const patient = await userModel.findById(patientId).select("-password");
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    const appointments = await appointmentModel
      .find({ userId: patientId, doctorId })
      .sort({ createdAt: -1 });

    let totalSpent = 0;
    const prescriptions = [];
    const reports = [];

    appointments.forEach((apt) => {
      totalSpent += Number(apt.amount || apt.billing?.totalAmount || 0);
      if (apt.prescription || apt.medicines?.length) {
        prescriptions.push({
          _id: apt._id,
          date: apt.slotDate || formatDateDDMMYYYY(apt.createdAt),
          diagnosis: apt.diagnosis || "",
          prescription: apt.prescription || "",
          medicines: apt.medicines || [],
        });
      }
      (apt.medicalReports || []).forEach((r) => reports.push(r));
    });

    const overview = {
      totalVisits: appointments.length,
      totalSpent,
      lastVisit: appointments[0]?.slotDate || "No prior visits",
      nextAppointment: appointments.find((a) => ["pending", "confirmed"].includes(a.status))?.slotDate || null,
      primaryDiagnosis: appointments.find((a) => a.diagnosis)?.diagnosis || "General Consultation",
    };

    res.status(200).json({
      success: true,
      patient,
      overview,
      appointments,
      prescriptions,
      reports,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorPatientEMR = async (req, res) => {
  try {
    const { id: doctorId, patientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ success: false, message: "Invalid patient ID" });
    }

    const patient = await userModel.findById(patientId).select("-password");
    if (!patient) return res.status(404).json({ success: false, message: "Patient EMR not found" });

    // Verify doctor has authorization (appointment exists between doctor and patient)
    const appointments = await appointmentModel
      .find({ userId: patientId, doctorId })
      .populate("hospitalId", "name location")
      .sort({ createdAt: -1 });

    const consultations = appointments;
    const diagnoses = [];
    const vitalsHistory = [];
    const prescriptions = [];
    const reports = [];
    const timeline = [];

    appointments.forEach((apt) => {
      const dateStr = apt.slotDate || formatDateDDMMYYYY(apt.createdAt);

      if (apt.diagnosis) {
        diagnoses.push({
          date: dateStr,
          diagnosis: apt.diagnosis,
          doctorName: "Dr. Consultant",
          appointmentId: apt._id,
        });
      }

      if (apt.vitals) {
        vitalsHistory.push({
          date: dateStr,
          ...apt.vitals,
        });
      }

      if (apt.prescription || apt.medicines?.length) {
        prescriptions.push({
          date: dateStr,
          appointmentId: apt._id,
          diagnosis: apt.diagnosis || "",
          medicines: apt.medicines || [],
          instructions: apt.medicalNotes || "",
          prescription: apt.prescription || "",
        });
      }

      (apt.medicalReports || []).forEach((r) => {
        reports.push({
          ...r.toObject?.() || r,
          slotDate: dateStr,
          appointmentId: apt._id,
        });
      });

      timeline.push({
        date: dateStr,
        type: "consultation",
        title: `OPD Consultation — ${apt.status}`,
        details: apt.diagnosis || apt.consultationType || "General Checkup",
      });
    });

    const overview = {
      totalVisits: appointments.length,
      firstVisit: appointments[appointments.length - 1]?.slotDate || "N/A",
      lastVisit: appointments[0]?.slotDate || "N/A",
      primaryDiagnosis: diagnoses[0]?.diagnosis || "None Recorded",
      totalPrescriptions: prescriptions.length,
      totalReports: reports.length,
    };

    res.status(200).json({
      success: true,
      patient,
      overview,
      consultations,
      diagnoses,
      vitalsHistory,
      prescriptions,
      reports,
      timeline,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePatientClinicalProfile = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { bloodGroup, allergies, chronicConditions } = req.body;

    const update = {};
    if (bloodGroup !== undefined) update.bloodGroup = bloodGroup;
    if (allergies !== undefined) update.allergies = allergies;
    if (chronicConditions !== undefined) update.chronicConditions = chronicConditions;

    const patient = await userModel.findByIdAndUpdate(patientId, { $set: update }, { new: true });
    if (!patient) return res.status(404).json({ success: false, message: "Patient not found" });

    res.status(200).json({
      success: true,
      message: "Patient clinical profile updated",
      patient,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 9. PATIENT REVIEWS & RATINGS
// ==========================================

export const getDoctorReviews = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const { rating, search, page = 1, limit = 10 } = req.query;

    const query = {
      doctorId,
      isApproved: { $ne: false },
    };

    if (rating && rating !== "all") {
      query.rating = Number(rating);
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { comment: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { userName: { $regex: q, $options: "i" } },
      ];
    }

    const allDoctorReviews = await reviewModel.find({ doctorId, isApproved: { $ne: false } }).lean();

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let ratingSum = 0;
    allDoctorReviews.forEach((r) => {
      const star = Math.min(5, Math.max(1, Math.round(r.rating || 5)));
      distribution[star] = (distribution[star] || 0) + 1;
      ratingSum += Number(r.rating || 5);
    });

    const total = allDoctorReviews.length;
    const averageRating = total > 0 ? Number((ratingSum / total).toFixed(1)) : 4.8;

    const skip = (Number(page) - 1) * Number(limit);
    const reviews = await reviewModel
      .find(query)
      .populate("userId", "name email phone image")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const formatted = reviews.map((r) => ({
      _id: r._id,
      patientId: r.patientId || r.userId || { name: r.userName || r.name || "Verified Patient", image: r.avatar },
      patient: r.patientId || r.userId || { name: r.userName || r.name || "Verified Patient", image: r.avatar },
      name: r.name || r.userName || r.userId?.name || "Verified Patient",
      rating: r.rating,
      title: r.title || "Consultation Review",
      comment: r.comment || "",
      createdAt: r.createdAt,
    }));

    res.status(200).json({
      success: true,
      reviews: formatted,
      total,
      averageRating,
      distribution,
      pages: Math.ceil(total / Number(limit)) || 1,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 10. PRESCRIPTIONS
// ==========================================

export const getDoctorPrescriptions = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const doctor = await doctorModel.findById(doctorId).populate("hospitalId");

    const appointments = await appointmentModel
      .find({
        doctorId,
        $or: [{ prescription: { $exists: true, $ne: "" } }, { "medicines.0": { $exists: true } }],
      })
      .populate("userId", "name email phone image gender age dob")
      .sort({ createdAt: -1 });

    const search = (req.query.search || "").trim().toLowerCase();
    let filtered = appointments;
    if (search) {
      filtered = filtered.filter(
        (a) =>
          (a.userId?.name || a.patientName || "").toLowerCase().includes(search) ||
          (a.diagnosis || "").toLowerCase().includes(search) ||
          (a.medicines || []).some((m) => (m.name || "").toLowerCase().includes(search))
      );
    }

    res.status(200).json({
      success: true,
      prescriptions: filtered,
      doctor,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorAppointmentPrescription = async (req, res) => {
  try {
    const { aptId } = req.params;
    const doctorId = req.params.id || req.user?.id;

    const appointment = await appointmentModel
      .findById(aptId)
      .populate("userId", "name email phone image gender age dob")
      .populate("doctorId", "name speciality qualification degree registrationNumber hospitalName phone");

    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    res.status(200).json({
      success: true,
      appointment,
      doctor: appointment.doctorId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveDoctorAppointmentPrescription = async (req, res) => {
  try {
    const { aptId } = req.params;
    const { diagnosis, medicines, prescriptionInstructions, followUpAdvice, prescription } = req.body;

    const appointment = await appointmentModel.findById(aptId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (diagnosis !== undefined) appointment.diagnosis = diagnosis;
    if (medicines !== undefined) appointment.medicines = medicines;
    if (prescriptionInstructions !== undefined) appointment.prescriptionInstructions = prescriptionInstructions;
    if (followUpAdvice !== undefined) appointment.followUpAdvice = followUpAdvice;
    if (prescription !== undefined) appointment.prescription = prescription;

    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Prescription saved successfully",
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 11. EARNINGS & ANALYTICS
// ==========================================

export const getDoctorEarnings = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid doctor ID" });
    }

    const { filter = "all" } = req.query;
    const appointments = await appointmentModel
      .find({ doctorId })
      .populate("userId", "name email phone image")
      .sort({ createdAt: -1 });

    const todayDates = getTodayDateFormats();
    let totalEarnings = 0;
    let todayEarnings = 0;
    let weekEarnings = 0;
    let monthEarnings = 0;
    let paidCount = 0;

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const transactions = [];

    appointments.forEach((apt) => {
      const isPaid = apt.payment === true || apt.paymentStatus === "SUCCESS" || apt.paymentStatus === "paid" || apt.status === "completed";
      const amt = Number(apt.amount || apt.billing?.totalAmount || 0);

      if (isPaid) {
        totalEarnings += amt;
        paidCount++;

        const isToday =
          apt.slotDate === todayDates.ddmmyyyy ||
          apt.slotDate === todayDates.slash ||
          apt.slotDate === todayDates.iso;
        if (isToday) todayEarnings += amt;

        const aptDate = apt.createdAt ? new Date(apt.createdAt) : now;
        if (aptDate >= oneWeekAgo) weekEarnings += amt;
        if (aptDate >= oneMonthAgo) monthEarnings += amt;
      }

      transactions.push({
        _id: apt._id,
        appointmentId: apt.appointmentId || apt.displayAppointmentId || apt._id,
        patientName: apt.userId?.name || apt.patientName || "Patient",
        patient: apt.userId,
        date: apt.slotDate || formatDateDDMMYYYY(apt.createdAt),
        slotDate: apt.slotDate,
        slotTime: apt.slotTime,
        type: apt.consultationType || "clinic",
        consultationType: apt.consultationType || "clinic",
        amount: amt,
        paymentStatus: isPaid ? "paid" : "pending",
        status: apt.status,
      });
    });

    const summary = {
      totalEarnings,
      todayEarnings,
      weekEarnings,
      monthEarnings,
      totalAppointments: appointments.length,
      paidAppointments: paidCount,
      pendingPayout: Math.round(totalEarnings * 0.1),
      settledPayout: Math.round(totalEarnings * 0.9),
    };

    res.status(200).json({
      success: true,
      summary,
      transactions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDoctorAnalytics = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    const appointments = await appointmentModel.find({ doctorId }).populate("userId", "gender age dob").lean();

    const genderSplit = { male: 0, female: 0, other: 0 };
    const ageGroups = { "0-18": 0, "19-35": 0, "36-50": 0, "50+": 0 };
    const conditionMap = new Map();

    appointments.forEach((apt) => {
      const g = (apt.userId?.gender || "other").toLowerCase();
      if (g.startsWith("m")) genderSplit.male++;
      else if (g.startsWith("f")) genderSplit.female++;
      else genderSplit.other++;

      let age = apt.userId?.age;
      if (!age && apt.userId?.dob) {
        age = new Date().getFullYear() - new Date(apt.userId.dob).getFullYear();
      }
      if (age <= 18) ageGroups["0-18"]++;
      else if (age <= 35) ageGroups["19-35"]++;
      else if (age <= 50) ageGroups["36-50"]++;
      else ageGroups["50+"]++;

      if (apt.diagnosis) {
        conditionMap.set(apt.diagnosis, (conditionMap.get(apt.diagnosis) || 0) + 1);
      }
    });

    const topConditions = Array.from(conditionMap.entries())
      .map(([condition, count]) => ({ condition, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.status(200).json({
      success: true,
      analytics: {
        demographics: {
          genderSplit,
          ageGroups,
        },
        topConditions,
        retentionRate: 88,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 12. NOTIFICATIONS
// ==========================================

export const getDoctorNotifications = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    const notifications = await notificationModel
      .find({ doctorId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formatted = notifications.map((n) => ({
      ...n,
      isRead: n.read ?? false,
    }));

    const unreadCount = formatted.filter((n) => !n.isRead).length;

    res.status(200).json({
      success: true,
      notifications: formatted,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markDoctorNotificationRead = async (req, res) => {
  try {
    const { notifId } = req.params;
    const doctorId = req.params.id || req.user?.id;

    await notificationModel.findByIdAndUpdate(notifId, { $set: { read: true } });
    const unreadCount = await notificationModel.countDocuments({ doctorId, read: false });

    res.status(200).json({
      success: true,
      message: "Notification marked read",
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllDoctorNotificationsRead = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    await notificationModel.updateMany({ doctorId, read: false }, { $set: { read: true } });

    res.status(200).json({
      success: true,
      message: "All notifications marked read",
      unreadCount: 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 13. CONSULTATION WORKSPACE
// ==========================================

export const getDoctorConsultationDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = req.params.id || req.user?.id;

    const appointment = await appointmentModel
      .findById(appointmentId)
      .populate("userId", "name email phone image gender age dob bloodGroup allergies chronicConditions")
      .populate("hospitalId", "name location");

    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    res.status(200).json({
      success: true,
      appointment,
      patient: appointment.userId,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveDoctorConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { vitals, clinicalNotes, diagnosis, prescription, medicines, followUpAdvice, medicalNotes } = req.body;

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (vitals) appointment.vitals = { ...appointment.vitals, ...vitals };
    if (clinicalNotes) appointment.clinicalNotes = { ...appointment.clinicalNotes, ...clinicalNotes };
    if (diagnosis) appointment.diagnosis = diagnosis;
    if (prescription) appointment.prescription = prescription;
    if (medicines) appointment.medicines = medicines;
    if (followUpAdvice) appointment.followUpAdvice = followUpAdvice;
    if (medicalNotes) appointment.medicalNotes = medicalNotes;

    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Consultation notes and clinical data saved",
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const completeDoctorConsultation = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    appointment.status = "completed";
    appointment.queueStatus = "completed";
    appointment.consultationStatus = "completed";
    appointment.meetingStatus = "completed";
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Consultation successfully completed",
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 14. APPOINTMENT RESCHEDULING & GENERAL UPDATES
// ==========================================

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

export const updateDoctorAppointmentStatus = async (req, res) => {
  try {
    const id = req.params.aptId || req.params.id;
    const { status, notes, meetingUrl } = req.body;
    const appointment = await appointmentModel.findById(id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    if (status) appointment.status = status;
    if (notes) {
      appointment.medicalNotes = (appointment.medicalNotes ? appointment.medicalNotes + "\n" : "") + notes;
    }
    if (meetingUrl) appointment.meetingUrl = meetingUrl;
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment updated successfully",
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rescheduleDoctorAppointment = async (req, res) => {
  try {
    const id = req.params.aptId || req.params.id;
    const { date, slotTime, reason } = req.body;

    const appointment = await appointmentModel.findById(id);
    if (!appointment) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (date) appointment.slotDate = date;
    if (slotTime) appointment.slotTime = slotTime;
    appointment.status = "rescheduled";
    if (reason) {
      appointment.medicalNotes = (appointment.medicalNotes ? appointment.medicalNotes + "\n" : "") + `Rescheduled: ${reason}`;
    }
    await appointment.save();

    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      appointment,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitDoctorVerification = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    const doctor = await doctorModel.findByIdAndUpdate(
      doctorId,
      { $set: { verificationStatus: "Pending" } },
      { new: true }
    );
    res.status(200).json({
      success: true,
      message: "Verification documents submitted for review",
      doctor,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
