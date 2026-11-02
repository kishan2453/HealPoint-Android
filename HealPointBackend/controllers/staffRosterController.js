import mongoose from "mongoose";
import staffModel from "../models/staffModel.js";
import shiftModel from "../models/shiftModel.js";
import rosterModel from "../models/rosterModel.js";
import leaveModel from "../models/leaveModel.js";
import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";
import { resolveHospitalId } from "./hospitalAdminController.js";

const isValidId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

// ==========================================
// 1. STAFF DIRECTORY MANAGEMENT
// ==========================================

export const getStaffList = async (req, res) => {
  try {
    let hospitalId = req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }

    const query = {};
    if (hospitalId && isValidId(hospitalId)) query.hospitalId = hospitalId;

    const { role, department, status, search, page = 1, limit = 50 } = req.query;
    if (role && role !== "all") query.role = role;
    if (department && department !== "all") query.department = department;
    if (status && status !== "all") query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const total = await staffModel.countDocuments(query);
    const staff = await staffModel
      .find(query)
      .populate("hospitalId", "name location")
      .populate("doctorId", "name speciality")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: staff.length,
      total,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        total,
      },
      staff,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createStaff = async (req, res) => {
  try {
    let hospitalId = req.body.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    if (!hospitalId || !isValidId(hospitalId)) {
      return res.status(400).json({ success: false, message: "Valid Hospital ID is required" });
    }

    const hospital = await hospitalModel.findById(hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: "Hospital not found" });

    const { name, email, phone, employeeId, role, department, doctorId, skills, shiftPreference } = req.body;
    if (!name || !employeeId || !role) {
      return res.status(400).json({ success: false, message: "Name, employeeId, and role are required" });
    }

    const existing = await staffModel.findOne({ hospitalId, employeeId: employeeId.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Staff member with employee ID "${employeeId}" already exists in this hospital`,
      });
    }

    const newStaff = await staffModel.create({
      hospitalId,
      hospitalName: hospital.name,
      name: name.trim(),
      email: email ? email.trim() : "",
      phone: phone ? phone.trim() : "",
      employeeId: employeeId.trim(),
      role,
      department: department || "General Medicine",
      doctorId: doctorId && isValidId(doctorId) ? doctorId : undefined,
      skills: Array.isArray(skills) ? skills : [],
      shiftPreference: shiftPreference || "Morning",
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Staff member added successfully",
      staff: newStaff,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid staff ID" });

    const staff = await staffModel.findById(id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });

    const fields = ["name", "email", "phone", "role", "department", "status", "skills", "shiftPreference"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) staff[f] = req.body[f];
    });

    await staff.save();
    return res.status(200).json({ success: true, message: "Staff profile updated", staff });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid staff ID" });

    const staff = await staffModel.findById(id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });

    staff.status = "inactive";
    await staff.save();

    return res.status(200).json({ success: true, message: "Staff member set to inactive" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 2. SHIFTS MANAGEMENT
// ==========================================

export const getShifts = async (req, res) => {
  try {
    let hospitalId = req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    const query = { isActive: true };
    if (hospitalId && isValidId(hospitalId)) query.hospitalId = hospitalId;

    const shifts = await shiftModel.find(query).sort({ startTime: 1 });
    return res.status(200).json({ success: true, count: shifts.length, shifts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createShift = async (req, res) => {
  try {
    let hospitalId = req.body.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    if (!hospitalId || !isValidId(hospitalId)) {
      return res.status(400).json({ success: false, message: "Valid Hospital ID is required" });
    }

    const { name, startTime, endTime, department, colorCode, maxStaff, description } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: "Shift name, startTime, and endTime are required" });
    }

    const newShift = await shiftModel.create({
      hospitalId,
      name: name.trim(),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      department: department || "General Medicine",
      colorCode: colorCode || "#2563EB",
      maxStaff: Number(maxStaff) || 10,
      description: description || "",
      isActive: true,
    });

    return res.status(201).json({ success: true, message: "Shift created successfully", shift: newShift });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await shiftModel.findById(id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });

    const fields = ["name", "startTime", "endTime", "department", "colorCode", "maxStaff", "description", "isActive"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) shift[f] = req.body[f];
    });

    await shift.save();
    return res.status(200).json({ success: true, message: "Shift updated", shift });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;
    const shift = await shiftModel.findById(id);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });

    shift.isActive = false;
    await shift.save();
    return res.status(200).json({ success: true, message: "Shift removed" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 3. DUTY ROSTER & CONFLICT DETECTION
// ==========================================

export const getRoster = async (req, res) => {
  try {
    let hospitalId = req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    const query = {};
    if (hospitalId && isValidId(hospitalId)) query.hospitalId = hospitalId;

    const { date, startDate, endDate, department, staffId } = req.query;
    if (date) query.date = date;
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }
    if (department && department !== "all") query.department = department;
    if (staffId && isValidId(staffId)) query.staffId = staffId;

    const roster = await rosterModel
      .find(query)
      .populate("staffId", "name employeeId role department phone")
      .populate("shiftId", "name startTime endTime colorCode")
      .sort({ date: 1, startTime: 1 });

    return res.status(200).json({ success: true, count: roster.length, roster });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const assignRosterShift = async (req, res) => {
  try {
    let hospitalId = req.body.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    if (!hospitalId || !isValidId(hospitalId)) {
      return res.status(400).json({ success: false, message: "Valid Hospital ID is required" });
    }

    const { staffId, shiftId, date, notes } = req.body;
    if (!staffId || !shiftId || !date) {
      return res.status(400).json({ success: false, message: "staffId, shiftId, and date are required" });
    }

    const staff = await staffModel.findById(staffId);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });

    const shift = await shiftModel.findById(shiftId);
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });

    // 1. Shift Conflict Detection: Check if staff is already scheduled on this date
    const existingRoster = await rosterModel.findOne({
      hospitalId,
      staffId,
      date,
      status: { $ne: "absent" },
    });

    if (existingRoster) {
      return res.status(409).json({
        success: false,
        code: "SHIFT_CONFLICT_DETECTED",
        message: `Shift Conflict: ${staff.name} is already assigned to "${existingRoster.shiftName}" on ${date}. Overlapping assignments are prohibited.`,
        conflict: existingRoster,
      });
    }

    // 2. Approved Leave Check
    const onLeave = await leaveModel.findOne({
      staffId,
      status: "approved",
      startDate: { $lte: date },
      endDate: { $gte: date },
    });

    if (onLeave) {
      return res.status(409).json({
        success: false,
        code: "STAFF_ON_APPROVED_LEAVE",
        message: `Leave Conflict: ${staff.name} is on approved ${onLeave.leaveType} leave on ${date}.`,
      });
    }

    const newRoster = await rosterModel.create({
      hospitalId,
      staffId: staff._id,
      staffName: staff.name,
      staffRole: staff.role,
      department: staff.department,
      shiftId: shift._id,
      shiftName: shift.name,
      date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      status: "scheduled",
      notes: notes || "",
    });

    return res.status(201).json({
      success: true,
      message: `Shift successfully assigned to ${staff.name}`,
      roster: newRoster,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRosterStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const roster = await rosterModel.findById(id);
    if (!roster) return res.status(404).json({ success: false, message: "Roster assignment not found" });

    if (status) roster.status = status;
    if (notes) roster.notes = notes;
    await roster.save();

    return res.status(200).json({ success: true, message: "Roster status updated", roster });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRoster = async (req, res) => {
  try {
    const { id } = req.params;
    const roster = await rosterModel.findByIdAndDelete(id);
    if (!roster) return res.status(404).json({ success: false, message: "Roster assignment not found" });

    return res.status(200).json({ success: true, message: "Roster assignment deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 4. LEAVE REQUESTS & APPROVALS
// ==========================================

export const getLeaveRequests = async (req, res) => {
  try {
    let hospitalId = req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    const query = {};
    if (hospitalId && isValidId(hospitalId)) query.hospitalId = hospitalId;

    const { status } = req.query;
    if (status && status !== "all") query.status = status;

    const leaves = await leaveModel
      .find(query)
      .populate("staffId", "name employeeId role department")
      .populate("doctorId", "name speciality")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, count: leaves.length, leaves });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const requestLeave = async (req, res) => {
  try {
    const { staffId, doctorId, hospitalId, leaveType, startDate, endDate, reason } = req.body;
    if (!startDate || !endDate || !reason) {
      return res.status(400).json({ success: false, message: "startDate, endDate, and reason are required" });
    }

    let resolvedHospId = hospitalId;
    let staffName = "";

    if (staffId && isValidId(staffId)) {
      const staff = await staffModel.findById(staffId);
      if (staff) {
        resolvedHospId = resolvedHospId || staff.hospitalId;
        staffName = staff.name;
      }
    } else if (doctorId && isValidId(doctorId)) {
      const doc = await doctorModel.findById(doctorId);
      if (doc) {
        resolvedHospId = resolvedHospId || doc.hospitalId;
        staffName = `Dr. ${doc.name.replace(/^Dr\.\s*/i, "")}`;
      }
    }

    if (!resolvedHospId || !isValidId(resolvedHospId)) {
      return res.status(400).json({ success: false, message: "Valid hospital association required" });
    }

    const newLeave = await leaveModel.create({
      hospitalId: resolvedHospId,
      staffId: staffId && isValidId(staffId) ? staffId : undefined,
      doctorId: doctorId && isValidId(doctorId) ? doctorId : undefined,
      staffName,
      leaveType: leaveType || "casual",
      startDate,
      endDate,
      reason: reason.trim(),
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully. Pending administrator review.",
      leave: newLeave,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const reviewLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNotes } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be strictly "approved" or "rejected"' });
    }

    const leave = await leaveModel.findById(id);
    if (!leave) return res.status(404).json({ success: false, message: "Leave request not found" });

    leave.status = status;
    leave.reviewNotes = reviewNotes || "";
    leave.reviewedBy = req.user?.name || "Hospital Administrator";
    leave.reviewedAt = new Date();
    await leave.save();

    // If approved and associated with a doctor, also add to doctor leaves array
    if (status === "approved" && leave.doctorId) {
      await doctorModel.findByIdAndUpdate(leave.doctorId, {
        $push: {
          leaves: {
            startDate: leave.startDate,
            endDate: leave.endDate,
            reason: leave.reason,
            type: leave.leaveType,
          },
          blockedSlots: {
            date: leave.startDate,
            slotTime: "All Day",
            reason: `Approved Leave: ${leave.reason}`,
          },
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Leave request has been ${status}`,
      leave,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 5. DOCTOR SPECIFIC ROSTER & LEAVES
// ==========================================

export const getDoctorRosterSchedule = async (req, res) => {
  try {
    const doctorId = req.params.id || req.user?.id;
    if (!isValidId(doctorId)) return res.status(400).json({ success: false, message: "Invalid doctor ID" });

    const doctor = await doctorModel.findById(doctorId).populate("hospitalId", "name location");
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    const staffProfile = await staffModel.findOne({ doctorId });
    let roster = [];
    if (staffProfile) {
      roster = await rosterModel
        .find({ staffId: staffProfile._id })
        .populate("shiftId")
        .sort({ date: 1 });
    }

    const leaves = await leaveModel
      .find({ doctorId })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      doctor: {
        _id: doctor._id,
        name: doctor.name,
        speciality: doctor.speciality,
        weeklySchedule: doctor.weeklySchedule,
        slotDurationMinutes: doctor.slotDurationMinutes,
        breakTimes: doctor.breakTimes,
      },
      staffProfile,
      upcomingShifts: roster,
      leaves,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 6. DASHBOARD STATISTICS
// ==========================================

export const getStaffRosterDashboardStats = async (req, res) => {
  try {
    let hospitalId = req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }
    const query = {};
    if (hospitalId && isValidId(hospitalId)) query.hospitalId = new mongoose.Types.ObjectId(hospitalId);

    const totalStaff = await staffModel.countDocuments(query);
    const activeStaff = await staffModel.countDocuments({ ...query, status: "active" });
    const onLeaveStaff = await staffModel.countDocuments({ ...query, status: "on_leave" });
    const pendingLeaves = await leaveModel.countDocuments({ ...query, status: "pending" });

    const todayStr = new Date().toISOString().split("T")[0];
    const todayShiftsScheduled = await rosterModel.countDocuments({ ...query, date: todayStr });

    const departmentDistribution = await staffModel.aggregate([
      { $match: query },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalStaff,
        activeStaff,
        onLeaveStaff,
        pendingLeaves,
        todayShiftsScheduled,
      },
      departmentDistribution,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
