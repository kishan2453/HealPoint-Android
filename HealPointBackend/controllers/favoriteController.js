import mongoose from "mongoose";
import User from "../models/userModel.js";
import Doctor from "../models/doctorModel.js";
import Hospital from "../models/hospitalModel.js";

/**
 * Get Authenticated Patient's Favorite Doctors
 * GET /api/v1/user/favorites
 * GET /api/v1/favorites/doctors
 */
export const getFavoriteDoctors = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await User.findById(userId).populate({
      path: "favorites.doctorId",
      select:
        "name email phone image coverBanner degree qualification registrationNumber speciality department specialization about experience fees rating reviewCount appointmentCount available onlineStatus verificationStatus hospitalId hospitalName clinicInfo slotDurationMinutes weeklySchedule blockedSlots",
      populate: {
        path: "hospitalId",
        select: "name slug logo location contact rating reviewCount",
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Filter out null or missing doctor records (e.g. if doctor was removed from system)
    const formatted = (user.favorites || [])
      .filter((item) => item && item.doctorId)
      .map((item) => {
        const doc = item.doctorId.toObject ? item.doctorId.toObject() : item.doctorId;
        return {
          ...doc,
          _id: doc._id?.toString() || item.doctorId?.toString(),
          doctorId: doc._id?.toString() || item.doctorId?.toString(),
          addedAt: item.addedAt || user.updatedAt,
        };
      });

    return res.status(200).json({
      success: true,
      favorites: formatted,
      totalCount: formatted.length,
    });
  } catch (error) {
    console.error("[getFavoriteDoctors] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add Doctor to Favorites
 * POST /api/v1/user/favorites/:doctorId
 * POST /api/v1/favorites/doctors/:doctorId
 */
export const addFavoriteDoctor = async (req, res) => {
  try {
    const userId = req.user?._id;
    const doctorId = req.params.doctorId || req.body.doctorId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing doctor ID" });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!Array.isArray(user.favorites)) {
      user.favorites = [];
    }

    const alreadyExists = user.favorites.some(
      (f) => f.doctorId && f.doctorId.toString() === doctorId.toString()
    );

    if (!alreadyExists) {
      user.favorites.unshift({
        doctorId: doctor._id,
        doctorName: doctor.name,
        speciality: doctor.speciality || doctor.specialization || doctor.department || "General Physician",
        image: doctor.image || "",
        addedAt: new Date(),
      });
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Doctor saved to favorites successfully",
      isFavorite: true,
      doctorId: doctor._id.toString(),
      count: user.favorites.length,
    });
  } catch (error) {
    console.error("[addFavoriteDoctor] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove Doctor from Favorites
 * DELETE /api/v1/user/favorites/:doctorId
 * DELETE /api/v1/favorites/doctors/:doctorId
 */
export const removeFavoriteDoctor = async (req, res) => {
  try {
    const userId = req.user?._id;
    const doctorId = req.params.doctorId || req.body.doctorId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing doctor ID" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (Array.isArray(user.favorites)) {
      user.favorites = user.favorites.filter(
        (f) => f.doctorId && f.doctorId.toString() !== doctorId.toString()
      );
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Doctor removed from favorites successfully",
      isFavorite: false,
      doctorId: doctorId.toString(),
      count: (user.favorites || []).length,
    });
  } catch (error) {
    console.error("[removeFavoriteDoctor] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Authenticated Patient's Favorite Hospitals
 * GET /api/v1/user/favorites/hospitals
 * GET /api/v1/favorites/hospitals
 */
export const getFavoriteHospitals = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await User.findById(userId).populate({
      path: "favoriteHospitals.hospitalId",
      select:
        "name slug logo coverImage about location contact departments services gallery hospitalImages facilitiesInfo beds icuBeds emergencyFacility opdTimings rating reviewCount isActive consultationFee onlineConsultationAvailable",
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const formatted = (user.favoriteHospitals || [])
      .filter((item) => item && item.hospitalId)
      .map((item) => {
        const hosp = item.hospitalId.toObject ? item.hospitalId.toObject() : item.hospitalId;
        return {
          ...hosp,
          _id: hosp._id?.toString() || item.hospitalId?.toString(),
          hospitalId: hosp._id?.toString() || item.hospitalId?.toString(),
          addedAt: item.addedAt || user.updatedAt,
        };
      });

    return res.status(200).json({
      success: true,
      favorites: formatted,
      totalCount: formatted.length,
    });
  } catch (error) {
    console.error("[getFavoriteHospitals] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add Hospital to Favorites
 * POST /api/v1/user/favorites/hospitals/:hospitalId
 * POST /api/v1/favorites/hospitals/:hospitalId
 */
export const addFavoriteHospital = async (req, res) => {
  try {
    const userId = req.user?._id;
    const hospitalId = req.params.hospitalId || req.body.hospitalId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!hospitalId || !mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing hospital ID" });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!Array.isArray(user.favoriteHospitals)) {
      user.favoriteHospitals = [];
    }

    const alreadyExists = user.favoriteHospitals.some(
      (f) => f.hospitalId && f.hospitalId.toString() === hospitalId.toString()
    );

    if (!alreadyExists) {
      user.favoriteHospitals.unshift({
        hospitalId: hospital._id,
        addedAt: new Date(),
      });
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Hospital saved to favorites successfully",
      isFavorite: true,
      hospitalId: hospital._id.toString(),
      count: user.favoriteHospitals.length,
    });
  } catch (error) {
    console.error("[addFavoriteHospital] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Remove Hospital from Favorites
 * DELETE /api/v1/user/favorites/hospitals/:hospitalId
 * DELETE /api/v1/favorites/hospitals/:hospitalId
 */
export const removeFavoriteHospital = async (req, res) => {
  try {
    const userId = req.user?._id;
    const hospitalId = req.params.hospitalId || req.body.hospitalId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!hospitalId || !mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ success: false, message: "Invalid or missing hospital ID" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (Array.isArray(user.favoriteHospitals)) {
      user.favoriteHospitals = user.favoriteHospitals.filter(
        (f) => f.hospitalId && f.hospitalId.toString() !== hospitalId.toString()
      );
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Hospital removed from favorites successfully",
      isFavorite: false,
      hospitalId: hospitalId.toString(),
      count: (user.favoriteHospitals || []).length,
    });
  } catch (error) {
    console.error("[removeFavoriteHospital] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get All Favorite Counts
 * GET /api/v1/user/favorites/counts
 * GET /api/v1/favorites/counts
 */
export const getFavoriteCounts = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const user = await User.findById(userId).select("favorites favoriteHospitals");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const doctorCount = Array.isArray(user.favorites) ? user.favorites.length : 0;
    const hospitalCount = Array.isArray(user.favoriteHospitals) ? user.favoriteHospitals.length : 0;

    return res.status(200).json({
      success: true,
      doctorCount,
      hospitalCount,
      total: doctorCount + hospitalCount,
    });
  } catch (error) {
    console.error("[getFavoriteCounts] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Check Favorite Status for Doctor or Hospital
 * GET /api/v1/user/favorites/check?doctorId=...&hospitalId=...
 * GET /api/v1/favorites/check?doctorId=...&hospitalId=...
 */
export const checkFavoriteStatus = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { doctorId, hospitalId } = req.query;
    const user = await User.findById(userId).select("favorites favoriteHospitals");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let isDoctorFavorite = false;
    let isHospitalFavorite = false;

    if (doctorId && Array.isArray(user.favorites)) {
      isDoctorFavorite = user.favorites.some(
        (f) => f.doctorId && f.doctorId.toString() === doctorId.toString()
      );
    }

    if (hospitalId && Array.isArray(user.favoriteHospitals)) {
      isHospitalFavorite = user.favoriteHospitals.some(
        (f) => f.hospitalId && f.hospitalId.toString() === hospitalId.toString()
      );
    }

    return res.status(200).json({
      success: true,
      isDoctorFavorite,
      isHospitalFavorite,
    });
  } catch (error) {
    console.error("[checkFavoriteStatus] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

