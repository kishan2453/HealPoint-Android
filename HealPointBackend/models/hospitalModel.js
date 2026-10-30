import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    about: { type: String, default: "" },
    location: {
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      pincode: { type: String, default: "" },
      mapsUrl: { type: String, default: "" },
      lat: { type: Number },
      lng: { type: Number },
    },
    contact: {
      phone: { type: String, default: "" },
      emergency: { type: String, default: "" },
      reception: { type: String, default: "" },
      email: { type: String, default: "" },
      website: { type: String, default: "" },
    },
    departments: { type: [String], default: [] },
    services: { type: [String], default: [] },
    gallery: { type: [String], default: [] },
    hospitalImages: { type: [String], default: [] },
    facilitiesInfo: {
      ambulance: { type: Boolean, default: false },
      icu: { type: Boolean, default: false },
      operationTheatre: { type: Boolean, default: false },
      facilities: { type: [String], default: [] },
    },
    beds: { type: Number, default: 0 },
    icuBeds: { type: Number, default: 0 },
    emergencyFacility: { type: Boolean, default: true },
    opdTimings: { type: String, default: "09:00 AM - 08:00 PM" },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    consultationFee: { type: Number, default: 0 },
    onlineConsultationAvailable: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Hospital || mongoose.model("Hospital", hospitalSchema);
