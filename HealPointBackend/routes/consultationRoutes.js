import express from "express";
import mongoose from "mongoose";
import { getOnlineDoctors } from "../controllers/doctorController.js";
import appointmentModel from "../models/appointmentModel.js";
import doctorModel from "../models/doctorModel.js";
import userModel from "../models/userModel.js";
import hospitalModel from "../models/hospitalModel.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/online-doctors", getOnlineDoctors);
router.get("/online", getOnlineDoctors);

router.get("/patient/:userId", authenticate, async (req, res) => {
  try {
    const consultations = await appointmentModel
      .find({ userId: req.params.userId, consultationType: "video" })
      .populate("doctorId", "name speciality image rating fees")
      .populate("hospitalId", "name location")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: consultations.length, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/doctor/:doctorId", authenticate, async (req, res) => {
  try {
    const consultations = await appointmentModel
      .find({ doctorId: req.params.doctorId, consultationType: "video" })
      .populate("userId", "name email phone image")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: consultations.length, consultations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch("/doctor/:doctorId/toggle", authenticate, async (req, res) => {
  try {
    const { online } = req.body;
    const doc = await doctorModel.findByIdAndUpdate(
      req.params.doctorId,
      { $set: { onlineConsultationEnabled: Boolean(online), onlineStatus: online ? "online" : "offline" } },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Doctor online consultation status updated", doctor: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch("/doctor/:doctorId/status/:appointmentId", authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const apt = await appointmentModel.findByIdAndUpdate(
      req.params.appointmentId,
      { $set: { consultationStatus: status } },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Consultation status updated", appointment: apt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/doctor/:doctorId/meeting-link/:appointmentId", authenticate, async (req, res) => {
  try {
    const { meetingUrl } = req.body;
    const apt = await appointmentModel.findByIdAndUpdate(
      req.params.appointmentId,
      { $set: { meetingUrl, meetingStatus: "ready" } },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Google Meet link saved", appointment: apt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/doctor/:doctorId/meeting-link/:appointmentId", authenticate, async (req, res) => {
  try {
    const apt = await appointmentModel.findByIdAndUpdate(
      req.params.appointmentId,
      { $set: { meetingUrl: "", meetingStatus: "not_created" } },
      { new: true }
    );
    res.status(200).json({ success: true, message: "Google Meet link removed", appointment: apt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


router.get("/hospital/stats", authenticate, async (req, res) => {
  try {
    let hospitalId = req.user?.hospitalId;
    if (!hospitalId && req.user?.id) {
      const user = await doctorModel.findById(req.user.id).select("hospitalId");
      if (user?.hospitalId) hospitalId = user.hospitalId;
    }
    if (!hospitalId && req.user?.id) {
      const userDoc = await mongoose.model("User").findById(req.user.id).select("hospitalId");
      if (userDoc?.hospitalId) hospitalId = userDoc.hospitalId;
    }
    if (!hospitalId) {
      const first = await mongoose.model("Hospital").findOne({});
      hospitalId = first?._id;
    }

    const doctors = await doctorModel.find({ hospitalId });
    const videoAppts = await appointmentModel
      .find({ hospitalId, consultationType: "video" })
      .populate("doctorId", "name speciality department image")
      .populate("userId", "name phone email")
      .sort({ createdAt: -1 });

    const total = videoAppts.length;
    const completed = videoAppts.filter((a) => a.status === "completed").length;
    const upcoming = videoAppts.filter((a) =>
      ["pending", "confirmed", "scheduled"].includes(a.status)
    ).length;
    const activeOnlineDoctors = doctors.filter(
      (d) => d.onlineStatus === "online" || d.onlineConsultationEnabled !== false
    ).length;
    const revenue = videoAppts
      .filter((a) => a.payment === true || a.paymentStatus === "paid" || a.paymentStatus === "SUCCESS")
      .reduce((s, a) => s + (Number(a.amount) || Number(a.billing?.totalAmount) || 0), 0);

    res.status(200).json({
      success: true,
      totalConsultations: total,
      completedConsultations: completed,
      stats: {
        total,
        upcoming,
        completed,
        activeOnlineDoctors,
        revenue,
      },
      doctors: doctors.filter(
        (d) => d.onlineConsultationEnabled !== false || d.consultationTypes?.includes("video")
      ),
      recent: videoAppts.slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/super-admin/stats", authenticate, async (req, res) => {
  try {
    const totalVideo = await appointmentModel.countDocuments({ consultationType: "video" });
    const activeDoctors = await doctorModel.countDocuments({ onlineStatus: "online" });
    res.status(200).json({ success: true, totalConsultations: totalVideo, onlineDoctors: activeDoctors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
