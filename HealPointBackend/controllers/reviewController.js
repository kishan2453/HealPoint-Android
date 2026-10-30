import reviewModel from "../models/reviewModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";

export const getPublicReviews = async (req, res) => {
  try {
    const reviews = await reviewModel
      .find({ isApproved: true, isHidden: { $ne: true } })
      .populate("doctorId", "name speciality image")
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyReviews = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const reviews = await reviewModel
      .find({ $or: [{ userId }, { patientId: userId }] })
      .populate("doctorId", "name speciality image")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllAdminReviews = async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    const filter = {};
    if (status === "approved") filter.isApproved = true;
    if (status === "pending") filter.isApproved = false;

    const [reviews, totalCount, approvedCount, pendingCount] = await Promise.all([
      reviewModel
        .find(filter)
        .populate("doctorId", "name speciality")
        .sort({ createdAt: -1 })
        .limit(Number(limit)),
      reviewModel.countDocuments({}),
      reviewModel.countDocuments({ isApproved: true }),
      reviewModel.countDocuments({ isApproved: false }),
    ]);

    res.status(200).json({
      success: true,
      totalCount,
      summary: {
        approvedCount,
        pendingCount,
        hiddenCount: 0,
      },
      reviews,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createReview = async (req, res) => {
  try {
    const { doctorId, appointmentId, rating, comment, title } = req.body;
    const userId = req.user.id || req.user._id;

    const doctor = await doctorModel.findById(doctorId);
    const review = await reviewModel.create({
      doctorId,
      doctorName: doctor?.name || "",
      userId,
      patientId: userId,
      userName: req.user.name || "Patient",
      name: req.user.name || "Patient",
      appointmentId,
      rating: Number(rating),
      comment: comment || "",
      title: title || "",
      isApproved: true,
    });

    if (doctor) {
      const allDocReviews = await reviewModel.find({ doctorId, isApproved: true });
      const avg = allDocReviews.reduce((sum, r) => sum + r.rating, 0) / allDocReviews.length;
      doctor.rating = Math.round(avg * 10) / 10;
      doctor.reviewCount = allDocReviews.length;
      await doctor.save();
    }

    res.status(201).json({ success: true, message: "Review submitted successfully", review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const checkReviewEligibility = async (req, res) => {
  try {
    const { doctorId } = req.query;
    const userId = req.user.id || req.user._id;
    const completedAppt = await appointmentModel.findOne({
      userId,
      doctorId,
      status: "completed",
    });

    res.status(200).json({
      success: true,
      eligible: Boolean(completedAppt),
      appointmentId: completedAppt?._id,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
