import mongoose from "mongoose";
import User from "../models/userModel.js";
import Doctor from "../models/doctorModel.js";
import Hospital from "../models/hospitalModel.js";
import { dispatchNotification } from "../services/socketService.js";

/**
 * Get Authenticated Patient's Favorite Doctors
 * GET /api/v1/user/favorites
 * GET /api/v1/favorites/doctors
 */
export const getFavoriteDoctors = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
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

    // Filter out null records and gracefully fall back to embedded fields if needed
    const formatted = (user.favorites || [])
      .filter((item) => item && (item.doctorId || item._id))
      .map((item) => {
        const isPopulated = item.doctorId && typeof item.doctorId === "object" && item.doctorId._id;
        const doc = isPopulated
          ? (item.doctorId.toObject ? item.doctorId.toObject() : item.doctorId)
          : {};
        const docId = isPopulated
          ? doc._id?.toString()
          : (item.doctorId?.toString() || item._id?.toString());
        return {
          ...doc,
          _id: docId,
          doctorId: docId,
          name: doc.name || item.doctorName || "Doctor",
          speciality: doc.speciality || item.speciality || "General Physician",
          image: doc.image || item.image || "",
          fees: doc.fees !== undefined ? doc.fees : 500,
          rating: doc.rating !== undefined ? doc.rating : 4.8,
          experience: doc.experience || "10+ years",
          hospitalName: doc.hospitalName || (doc.hospitalId?.name) || "HealPoint Clinic",
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
    const userId = req.user?._id || req.user?.id;
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

      // Dispatch in-app notification confirming addition
      dispatchNotification({
        userId: user._id,
        recipientRole: "patient",
        title: "Doctor Saved to Favorites",
        message: `Dr. ${doctor.name} (${doctor.speciality || "Specialist"}) has been saved to your favorites.`,
        type: "favorite",
        category: "favorites",
        refId: doctor._id.toString(),
        refModel: "Doctor",
        link: `/doctor/${doctor._id}`,
        sendPush: false,
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: alreadyExists ? "Doctor is already in favorites" : "Doctor added to favorites",
      isFavorite: true,
      doctorId: doctor._id.toString(),
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
    const userId = req.user?._id || req.user?.id;
    const doctorId = req.params.doctorId || req.body.doctorId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!doctorId) {
      return res.status(400).json({ success: false, message: "Doctor ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!Array.isArray(user.favorites)) {
      user.favorites = [];
    }

    const initialLength = user.favorites.length;
    user.favorites = user.favorites.filter(
      (f) => f.doctorId && f.doctorId.toString() !== doctorId.toString()
    );

    if (user.favorites.length !== initialLength) {
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Doctor removed from favorites",
      isFavorite: false,
      doctorId: doctorId.toString(),
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
    const userId = req.user?._id || req.user?.id;
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
      .filter((item) => item && (item.hospitalId || item._id))
      .map((item) => {
        const isPopulated = item.hospitalId && typeof item.hospitalId === "object" && item.hospitalId._id;
        const hosp = isPopulated
          ? (item.hospitalId.toObject ? item.hospitalId.toObject() : item.hospitalId)
          : {};
        const hospId = isPopulated
          ? hosp._id?.toString()
          : (item.hospitalId?.toString() || item._id?.toString());
        return {
          ...hosp,
          _id: hospId,
          hospitalId: hospId,
          name: hosp.name || "Hospital",
          location: hosp.location || "Nearby",
          rating: hosp.rating !== undefined ? hosp.rating : 4.8,
          logo: hosp.logo || "",
          image: hosp.coverImage || hosp.image || "",
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
    const userId = req.user?._id || req.user?.id;
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
      (h) => h.hospitalId && h.hospitalId.toString() === hospitalId.toString()
    );

    if (!alreadyExists) {
      user.favoriteHospitals.unshift({
        hospitalId: hospital._id,
        addedAt: new Date(),
      });
      await user.save();

      // Dispatch in-app notification confirming addition
      dispatchNotification({
        userId: user._id,
        recipientRole: "patient",
        title: "Hospital Saved to Favorites",
        message: `${hospital.name} has been added to your favorites list.`,
        type: "favorite",
        category: "favorites",
        refId: hospital._id.toString(),
        refModel: "Hospital",
        link: `/hospital/${hospital._id}`,
        sendPush: false,
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      message: alreadyExists ? "Hospital is already in favorites" : "Hospital added to favorites",
      isFavorite: true,
      hospitalId: hospital._id.toString(),
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
    const userId = req.user?._id || req.user?.id;
    const hospitalId = req.params.hospitalId || req.body.hospitalId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Hospital ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!Array.isArray(user.favoriteHospitals)) {
      user.favoriteHospitals = [];
    }

    const initialLength = user.favoriteHospitals.length;
    user.favoriteHospitals = user.favoriteHospitals.filter(
      (h) => h.hospitalId && h.hospitalId.toString() !== hospitalId.toString()
    );

    if (user.favoriteHospitals.length !== initialLength) {
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "Hospital removed from favorites",
      isFavorite: false,
      hospitalId: hospitalId.toString(),
    });
  } catch (error) {
    console.error("[removeFavoriteHospital] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Total Favorites Counts
 * GET /api/v1/user/favorites/counts
 * GET /api/v1/favorites/counts
 */
export const getFavoriteCounts = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
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
 * Check if Doctor or Hospital is Favorited
 * GET /api/v1/user/favorites/check
 * GET /api/v1/favorites/check
 */
export const checkFavoriteStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { doctorId, hospitalId } = req.query;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

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
        (h) => h.hospitalId && h.hospitalId.toString() === hospitalId.toString()
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
