import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      (authHeader
        ? authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : authHeader.trim()
        : null) || req.query?.token;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authorization token required", code: "UNAUTHORIZED" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "healpoint_dev_secret_jwt_key_2026");

    req.user = decoded;
    if (req.user) {
      if (req.user.id && !req.user._id) req.user._id = req.user.id;
      if (req.user._id && !req.user.id) req.user.id = req.user._id;
    }
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
      if (req.user) {
        if (req.user.id && !req.user._id) req.user._id = req.user.id;
        if (req.user._id && !req.user.id) req.user.id = req.user._id;
      }
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
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required", code: "UNAUTHORIZED" });
  }
  const role = (req.user.role || "").toLowerCase();
  if (role === "super_admin" || role === "admin" || req.user.isAdmin) {
    return next();
  }
  if (role === "hospital_admin" || role === "doctor") {
    const hospitalId = req.user.hospitalId || req.user.hospital;
    if (!hospitalId) {
      return res.status(403).json({ success: false, message: "Hospital association required", code: "FORBIDDEN" });
    }
    req.hospitalId = String(hospitalId);
    return next();
  }
  return res.status(403).json({ success: false, message: "Access forbidden for this role", code: "FORBIDDEN" });
};

export default {
  authenticate,
  optionalAuth,
  authorizeRoles,
  enforceHospitalScope,
};
