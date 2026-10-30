import hospitalModel from "../models/hospitalModel.js";
import doctorModel from "../models/doctorModel.js";

export const getAllHospitals = async (req, res) => {
  try {
    const { search, city } = req.query;
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { "location.city": { $regex: search, $options: "i" } },
      ];
    }
    if (city) filter["location.city"] = { $regex: `^${city}$`, $options: "i" };

    const hospitals = await hospitalModel.find(filter);
    res.status(200).json({ success: true, count: hospitals.length, hospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHospitalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const hospital = await hospitalModel.findById(id);
    if (!hospital)
      return res
        .status(404)
        .json({ success: false, message: "Hospital not found" });

    const doctors = await doctorModel.find({ hospitalId: id, isActive: true });
    res.status(200).json({
      success: true,
      hospital: {
        ...hospital.toObject(),
        doctors,
        doctorCount: doctors.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const compareHospitals = async (req, res) => {
  try {
    const { ids } = req.query;
    if (!ids) return res.status(400).json({ success: false, message: "Hospital IDs required" });
    const idList = ids.split(",").map((s) => s.trim());
    const hospitals = await hospitalModel.find({ _id: { $in: idList } });
    res.status(200).json({ success: true, count: hospitals.length, hospitals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

