import express from "express";
import {
  registerUser,
  loginUser,
  googleLogin,
  getUserProfile,
  updateUserProfile,
  changeUserEmail,
  changeUserPassword,
  addFamilyMember,
  getFamilyMembers,
  getStats,
  getAnalytics,
  getPlatformUsers,
  getAdminList,
  getAuditLogs,
  getUserDetails,
  updatePatientStatus,
  updateHospitalAdminStatus,
} from "../controllers/userController.js";
import {
  getFavoriteDoctors,
  addFavoriteDoctor,
  removeFavoriteDoctor,
  getFavoriteHospitals,
  addFavoriteHospital,
  removeFavoriteHospital,
  getFavoriteCounts,
  checkFavoriteStatus,
} from "../controllers/favoriteController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/google/login", googleLogin);

// Platform & Admin endpoints
router.get("/get-stats", authenticate, getStats);
router.get("/stats", authenticate, getStats);
router.get("/analytics", authenticate, getAnalytics);
router.get("/admin/users", authenticate, getPlatformUsers);
router.get("/admin/admins", authenticate, getAdminList);
router.get("/admin/audit-logs", authenticate, getAuditLogs);
router.patch("/admin/users/:id/status", authenticate, updatePatientStatus);
router.patch(
  "/admin/admins/:id/status",
  authenticate,
  updateHospitalAdminStatus,
);
router.get("/get-user/:id", authenticate, getUserDetails);

// Profile & Family
router.get("/profile", authenticate, getUserProfile);
router.get("/profile/:id", authenticate, getUserProfile);
router.get("/get-login-user/:id", authenticate, getUserProfile);
router.get("/get-login-user", authenticate, getUserProfile);
router.post("/logout", (req, res) =>
  res.status(200).json({ success: true, message: "Logged out successfully" }),
);
router.patch("/profile", authenticate, upload.single("image"), updateUserProfile);
router.patch("/update/:id", authenticate, upload.single("image"), updateUserProfile);
router.patch("/change-email", authenticate, changeUserEmail);
router.patch("/change-email/:id", authenticate, changeUserEmail);
router.patch("/update-password", authenticate, changeUserPassword);
router.patch("/update-password/:id", authenticate, changeUserPassword);
router.post("/family", authenticate, addFamilyMember);
router.get("/family", authenticate, getFamilyMembers);

// Favorites Endpoints
router.get("/favorites", authenticate, getFavoriteDoctors);
router.get("/favorites/doctors", authenticate, getFavoriteDoctors);
router.post("/favorites/:doctorId", authenticate, addFavoriteDoctor);
router.post("/favorites/doctors/:doctorId", authenticate, addFavoriteDoctor);
router.delete("/favorites/:doctorId", authenticate, removeFavoriteDoctor);
router.delete("/favorites/doctors/:doctorId", authenticate, removeFavoriteDoctor);

router.get("/favorites/hospitals", authenticate, getFavoriteHospitals);
router.post("/favorites/hospitals/:hospitalId", authenticate, addFavoriteHospital);
router.delete("/favorites/hospitals/:hospitalId", authenticate, removeFavoriteHospital);

router.get("/favorites/counts", authenticate, getFavoriteCounts);
router.get("/favorites/check", authenticate, checkFavoriteStatus);

export default router;
