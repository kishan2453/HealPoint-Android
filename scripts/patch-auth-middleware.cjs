const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../HealPointBackend/middlewares/authMiddlewares.js");
let content = fs.readFileSync(filePath, "utf8");

if (!content.includes("enforceHospitalScope")) {
  const addition = `
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
`;

  content = content.replace("export default {", addition + "\nexport default {");
  content = content.replace("  authorizeRoles,", "  authorizeRoles,\n  enforceHospitalScope,");
  fs.writeFileSync(filePath, content, "utf8");
  console.log("Added enforceHospitalScope to authMiddlewares.js");
} else {
  console.log("enforceHospitalScope already present in authMiddlewares.js");
}

