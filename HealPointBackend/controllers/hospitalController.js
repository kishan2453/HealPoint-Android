import mongoose from "mongoose";
import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";

/**
 * Get All Hospitals with Real Doctor Counts
 * GET /api/v1/hospital/public/get-all
 * GET /api/v1/hospital/get-all
 */
export const getAllHospitals = async (req, res) => {
  try {
    const { search, city, emergency } = req.query;
    const filter = { isActive: true };

    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { "location.city": { $regex: q, $options: "i" } },
        { "location.address": { $regex: q, $options: "i" } },
        { departments: { $in: [new RegExp(q, "i")] } },
      ];
    }

    if (city && String(city).trim()) {
      filter["location.city"] = { $regex: `^${String(city).trim()}$`, $options: "i" };
    }

    if (emergency === "true" || emergency === "1") {
      filter.emergencyFacility = true;
    }

    const hospitals = await hospitalModel.find(filter).sort({ rating: -1, name: 1 }).lean();

    // Aggregate real active verified doctors grouped by hospitalId
    const hospitalIds = hospitals.map((h) => h._id);

    const [doctorCounts, availableDoctorCounts] = await Promise.all([
      doctorModel.aggregate([
        {
          $match: {
            hospitalId: { $in: hospitalIds },
            isActive: true,
            verificationStatus: { $ne: "Rejected" },
          },
        },
        {
          $group: {
            _id: "$hospitalId",
            count: { $sum: 1 },
          },
        },
      ]),
      doctorModel.aggregate([
        {
          $match: {
            hospitalId: { $in: hospitalIds },
            isActive: true,
            available: true,
            verificationStatus: { $ne: "Rejected" },
          },
        },
        {
          $group: {
            _id: "$hospitalId",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalCountMap = new Map();
    doctorCounts.forEach((d) => {
      if (d._id) totalCountMap.set(d._id.toString(), d.count);
    });

    const availCountMap = new Map();
    availableDoctorCounts.forEach((d) => {
      if (d._id) availCountMap.set(d._id.toString(), d.count);
    });

    const enrichedHospitals = hospitals.map((h) => {
      const hid = h._id.toString();
      const docCount = totalCountMap.get(hid) || 0;
      const availCount = availCountMap.get(hid) || 0;

      return {
        ...h,
        doctorCount: docCount,
        availableDoctorCount: availCount,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedHospitals.length,
      totalCount: enrichedHospitals.length,
      hospitals: enrichedHospitals,
    });
  } catch (error) {
    console.error("[getAllHospitals] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get Hospital Details with Real Doctor Roster
 * GET /api/v1/hospital/public/get-details/:id
 * GET /api/v1/hospital/get-details/:id
 */
export const getHospitalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    let hospital = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      hospital = await hospitalModel.findById(id).lean();
    }
    if (!hospital) {
      hospital = await hospitalModel.findOne({ slug: String(id).toLowerCase() }).lean();
    }

    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    // Fetch active verified doctors affiliated with this hospital
    const doctors = await doctorModel
      .find({
        hospitalId: hospital._id,
        isActive: true,
        verificationStatus: { $ne: "Rejected" },
      })
      .select("-password")
      .sort({ rating: -1, name: 1 })
      .lean();

    const availableDoctorCount = doctors.filter((d) => d.available).length;

    return res.status(200).json({
      success: true,
      hospital: {
        ...hospital,
        doctors,
        doctorCount: doctors.length,
        availableDoctorCount,
      },
    });
  } catch (error) {
    console.error("[getHospitalDetails] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Compare Multiple Hospitals
 * GET /api/v1/hospital/compare?ids=id1,id2
 */
export const compareHospitals = async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ success: false, message: "Hospital IDs required" });
    }

    const idList = ids
      .split(",")
      .map((s) => s.trim())
      .filter((s) => mongoose.Types.ObjectId.isValid(s));

    const hospitals = await hospitalModel
      .find({ _id: { $in: idList } })
      .lean();

    const hospitalIds = hospitals.map((h) => h._id);

    const doctorCounts = await doctorModel.aggregate([
      {
        $match: {
          hospitalId: { $in: hospitalIds },
          isActive: true,
          verificationStatus: { $ne: "Rejected" },
        },
      },
      {
        $group: {
          _id: "$hospitalId",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map();
    doctorCounts.forEach((d) => {
      if (d._id) countMap.set(d._id.toString(), d.count);
    });

    const enriched = hospitals.map((h) => ({
      ...h,
      doctorCount: countMap.get(h._id.toString()) || 0,
    }));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      hospitals: enriched,
    });
  } catch (error) {
    console.error("[compareHospitals] Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
