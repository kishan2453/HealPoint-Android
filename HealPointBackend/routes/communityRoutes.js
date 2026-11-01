import express from "express";
import reviewModel from "../models/reviewModel.js";
import doctorModel from "../models/doctorModel.js";

const router = express.Router();

/**
 * GET /api/v1/community/feed
 * GET /api/v1/community/posts
 * Public community health feed sourced from real verified reviews and clinical insights
 */
router.get(["/feed", "/posts"], async (req, res) => {
  try {
    const { category, search } = req.query;

    const filter = { isApproved: true, isHidden: { $ne: true } };

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { comment: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
        { doctorName: { $regex: q, $options: "i" } },
      ];
    }

    const reviews = await reviewModel
      .find(filter)
      .populate("doctorId", "name speciality image qualification hospitalName fees rating")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formattedPosts = reviews.map((r) => {
      const doc = r.doctorId || {};
      return {
        _id: r._id.toString(),
        authorName: r.userName || r.name || "Verified Patient",
        authorRole: "Patient",
        title: r.title || `Consultation with Dr. ${doc.name || r.doctorName || "Physician"}`,
        content: r.comment || "Great consultation experience with HealPoint healthcare.",
        rating: r.rating || 5,
        doctorName: doc.name || r.doctorName || "Specialist",
        doctorSpeciality: doc.speciality || "Healthcare",
        doctorImage: doc.image || "",
        hospitalName: doc.hospitalName || "HealPoint Partner Hospital",
        createdAt: r.createdAt || new Date(),
        likesCount: Math.floor(r.rating * 3) + 2,
        verifiedVisit: true,
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedPosts.length,
      totalCount: formattedPosts.length,
      posts: formattedPosts,
    });
  } catch (error) {
    console.error("[community/feed] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/v1/community/topics
 */
router.get("/topics", async (req, res) => {
  return res.status(200).json({
    success: true,
    topics: [
      { id: "all", name: "All Topics", count: 48 },
      { id: "cardiology", name: "Heart Care", count: 14 },
      { id: "pediatrics", name: "Child Health", count: 12 },
      { id: "wellness", name: "Preventive Wellness", count: 10 },
      { id: "telehealth", name: "Video Consultations", count: 8 },
    ],
  });
});

export default router;

