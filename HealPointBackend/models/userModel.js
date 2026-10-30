import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    image: { type: String, default: "" },
    phone: { type: String, default: "", trim: true },
    address: { type: String, default: "" },
    dob: { type: String, default: "" },
    gender: { type: String, default: "other" },
    bloodGroup: { type: String, default: "" },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    emergencyContact: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      relation: { type: String, default: "" },
    },
    role: {
      type: String,
      enum: [
        "patient",
        "Patient",
        "doctor",
        "Doctor",
        "admin",
        "Admin",
        "super_admin",
        "Super Admin",
        "hospital_admin",
        "Hospital Admin",
      ],
      default: "patient",
      set: (val) => (typeof val === "string" ? val.toLowerCase() : "patient"),
    },
    isAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    hospitalName: { type: String, default: "" },
    authProvider: { type: String, enum: ["password", "google", "both"], default: "password" },
    googleId: { type: String, sparse: true, index: true },
    familyMembers: [
      {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        gender: { type: String, default: "" },
        dob: { type: String, default: "" },
        phone: { type: String, default: "" },
        bloodGroup: { type: String, default: "" },
        allergies: { type: [String], default: [] },
        chronicConditions: { type: [String], default: [] },
        image: { type: String, default: "" },
        isArchived: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    favorites: [
      {
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
        doctorName: { type: String },
        speciality: { type: String },
        image: { type: String },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    favoriteHospitals: [
      {
        hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    currentSubscription: {
      planKey: { type: String, default: "free" },
      planName: { type: String, default: "Free Starter" },
      status: { type: String, default: "active" },
      videoQuotaTotal: { type: Number, default: 0 },
      videoQuotaUsed: { type: Number, default: 0 },
      expiresAt: { type: Date },
    },
    appointmentStats: {
      totalBookings: { type: Number, default: 0 },
      cancelledBookings: { type: Number, default: 0 },
      completedBookings: { type: Number, default: 0 },
      missedAppointments: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
