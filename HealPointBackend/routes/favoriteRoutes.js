import express from "express";
import { authenticate } from "../middlewares/authMiddlewares.js";
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

const router = express.Router();

// Favorite Doctors
router.get("/", authenticate, getFavoriteDoctors);
router.get("/doctors", authenticate, getFavoriteDoctors);
router.post("/:doctorId", authenticate, addFavoriteDoctor);
router.post("/doctors/:doctorId", authenticate, addFavoriteDoctor);
router.delete("/:doctorId", authenticate, removeFavoriteDoctor);
router.delete("/doctors/:doctorId", authenticate, removeFavoriteDoctor);

// Favorite Hospitals
router.get("/hospitals", authenticate, getFavoriteHospitals);
router.post("/hospitals/:hospitalId", authenticate, addFavoriteHospital);
router.delete("/hospitals/:hospitalId", authenticate, removeFavoriteHospital);

// Metadata & Checking
router.get("/counts", authenticate, getFavoriteCounts);
router.get("/check", authenticate, checkFavoriteStatus);

export default router;

