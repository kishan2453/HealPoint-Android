import mongoose from "mongoose";
import resourceModel from "../models/resourceModel.js";
import hospitalModel from "../models/hospitalModel.js";
import { resolveHospitalId } from "./hospitalAdminController.js";

const isValidId = (id) => typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

export const getResources = async (req, res) => {
  try {
    let hospitalId = req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }

    const query = { isActive: true };
    if (hospitalId && isValidId(hospitalId)) {
      query.hospitalId = hospitalId;
    }

    const { category, department, status, search, page = 1, limit = 50 } = req.query;
    if (category && category !== "all") query.category = category;
    if (department && department !== "all") query.department = department;
    if (status && status !== "all") query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { identifier: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const total = await resourceModel.countDocuments(query);
    const resources = await resourceModel
      .find(query)
      .populate("hospitalId", "name location")
      .populate("assignedTo", "name phone email")
      .sort({ updatedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    return res.status(200).json({
      success: true,
      count: resources.length,
      total,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        total,
      },
      resources,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getResourceById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid resource ID" });

    const resource = await resourceModel.findById(id).populate("hospitalId", "name location");
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    return res.status(200).json({ success: true, resource });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createResource = async (req, res) => {
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

    const { name, identifier, category, department, capacity, location, notes, specifications } = req.body;
    if (!name || !identifier || !category) {
      return res.status(400).json({ success: false, message: "Name, identifier, and category are required" });
    }

    const existing = await resourceModel.findOne({ hospitalId, identifier: identifier.trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Resource with identifier "${identifier}" already exists in this hospital`,
      });
    }

    const newResource = await resourceModel.create({
      hospitalId,
      hospitalName: hospital.name,
      name: name.trim(),
      identifier: identifier.trim(),
      category,
      department: department || "General Medicine",
      capacity: Number(capacity) || 1,
      location: location || "",
      notes: notes || "",
      specifications: specifications || {},
      status: "available",
    });

    return res.status(201).json({
      success: true,
      message: "Resource registered successfully",
      resource: newResource,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid resource ID" });

    const resource = await resourceModel.findById(id);
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    const fields = [
      "name",
      "department",
      "category",
      "status",
      "capacity",
      "location",
      "notes",
      "lastMaintenanceDate",
      "nextMaintenanceDate",
      "maintenanceNotes",
      "maintenanceAlert",
      "specifications",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        resource[f] = req.body[f];
      }
    });

    await resource.save();

    return res.status(200).json({
      success: true,
      message: "Resource updated successfully",
      resource,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ success: false, message: "Invalid resource ID" });

    const resource = await resourceModel.findById(id);
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    resource.isActive = false;
    resource.status = "retired";
    await resource.save();

    return res.status(200).json({
      success: true,
      message: "Resource retired successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const assignResource = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, assignedName, assignedAppointmentId, notes } = req.body;

    const resource = await resourceModel.findById(id);
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    if (resource.status === "under_maintenance") {
      return res.status(400).json({
        success: false,
        message: "Resource is currently under maintenance and cannot be assigned",
      });
    }

    resource.status = "occupied";
    if (assignedTo && isValidId(assignedTo)) resource.assignedTo = assignedTo;
    if (assignedName) resource.assignedName = assignedName;
    if (assignedAppointmentId && isValidId(assignedAppointmentId)) resource.assignedAppointmentId = assignedAppointmentId;
    resource.assignedAt = new Date();
    if (notes) resource.notes = (resource.notes ? resource.notes + "\n" : "") + notes;

    await resource.save();

    return res.status(200).json({
      success: true,
      message: "Resource assigned successfully",
      resource,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const releaseResource = async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await resourceModel.findById(id);
    if (!resource) return res.status(404).json({ success: false, message: "Resource not found" });

    resource.status = "available";
    resource.assignedTo = null;
    resource.assignedName = "";
    resource.assignedAppointmentId = null;
    resource.assignedAt = null;

    await resource.save();

    return res.status(200).json({
      success: true,
      message: "Resource released and marked available",
      resource,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getResourceAnalytics = async (req, res) => {
  try {
    let hospitalId = req.query.hospitalId;
    if (!hospitalId && req.user?.role === "hospital-admin") {
      hospitalId = await resolveHospitalId(req);
    }

    const query = { isActive: true };
    if (hospitalId && isValidId(hospitalId)) {
      query.hospitalId = new mongoose.Types.ObjectId(hospitalId);
    }

    const total = await resourceModel.countDocuments(query);
    const available = await resourceModel.countDocuments({ ...query, status: "available" });
    const occupied = await resourceModel.countDocuments({ ...query, status: "occupied" });
    const maintenance = await resourceModel.countDocuments({ ...query, status: "under_maintenance" });
    const reserved = await resourceModel.countDocuments({ ...query, status: "reserved" });

    // Category breakdown
    const categoryStats = await resourceModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$category",
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] } },
          occupied: { $sum: { $cond: [{ $eq: ["$status", "occupied"] }, 1, 0] } },
        },
      },
    ]);

    // Department breakdown
    const departmentStats = await resourceModel.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$department",
          total: { $sum: 1 },
          occupied: { $sum: { $cond: [{ $eq: ["$status", "occupied"] }, 1, 0] } },
        },
      },
    ]);

    const utilizationRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      summary: {
        totalResources: total,
        available,
        occupied,
        underMaintenance: maintenance,
        reserved,
        utilizationRatePercent: utilizationRate,
      },
      categoryStats,
      departmentStats,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getGlobalResourceOverview = async (req, res) => {
  try {
    const totalResources = await resourceModel.countDocuments({ isActive: true });
    const occupiedResources = await resourceModel.countDocuments({ isActive: true, status: "occupied" });
    const maintenanceResources = await resourceModel.countDocuments({ isActive: true, status: "under_maintenance" });

    const hospitalStats = await resourceModel.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$hospitalId",
          hospitalName: { $first: "$hospitalName" },
          total: { $sum: 1 },
          occupied: { $sum: { $cond: [{ $eq: ["$status", "occupied"] }, 1, 0] } },
          maintenance: { $sum: { $cond: [{ $eq: ["$status", "under_maintenance"] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        totalResources,
        occupiedResources,
        maintenanceResources,
        overallUtilizationPercent: totalResources > 0 ? Math.round((occupiedResources / totalResources) * 100) : 0,
      },
      hospitalStats,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
