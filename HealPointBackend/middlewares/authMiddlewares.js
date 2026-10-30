import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: "Authorization token required", code: "UNAUTHORIZED" });
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026");

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token", code: "UNAUTHORIZED" });
  }
};

export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026");
      req.user = decoded;
    }
  } catch (err) {
    // Ignore invalid token in optional auth
  }
  next();
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden: insufficient permissions", code: "FORBIDDEN" });
    }
    next();
  };
};

export const enforceHospitalScope = (req, res, next) => {
  if (req.user && req.user.role === "hospital_admin") {
    if (!req.user.hospitalId) {
      return res.status(403).json({ success: false, message: "Forbidden: No hospital associated with this admin" });
    }
    req.hospitalId = req.user.hospitalId;
  }
  next();
};
