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
    emergencyContacts: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relation: { type: String, default: "" },
        isPrimary: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
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
    pushTokens: [
      {
        token: { type: String, required: true },
        platform: { type: String, default: "expo" },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    deviceTokens: [
      {
        token: { type: String },
        platform: { type: String, default: "expo" },
        lastUsedAt: { type: Date, default: Date.now },
      },
    ],
    pushToken: { type: String, default: "" },
    languagePreference: {
      type: String,
      enum: ["en", "hi", "gu"],
      default: "en",
    },
    accessibilityPreferences: {
      highContrast: { type: Boolean, default: false },
      fontScale: { type: String, enum: ["normal", "large", "extra-large"], default: "normal" },
      reduceMotion: { type: Boolean, default: false },
    },
    notificationPreferences: {
      channels: {
        push: { type: Boolean, default: true },
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        inApp: { type: Boolean, default: true },
      },
      categories: {
        appointments: { type: Boolean, default: true },
        payments: { type: Boolean, default: true },
        consultations: { type: Boolean, default: true },
        prescriptions: { type: Boolean, default: true },
        reports: { type: Boolean, default: true },
        referrals: { type: Boolean, default: true },
        consent: { type: Boolean, default: true },
        documents: { type: Boolean, default: true },
        subscriptions: { type: Boolean, default: true },
        security: { type: Boolean, default: true },
        queue: { type: Boolean, default: true },
        system: { type: Boolean, default: true },
      },
      quietHours: {
        enabled: { type: Boolean, default: false },
        startHour: { type: Number, default: 22 },
        endHour: { type: Number, default: 7 },
        start: { type: String, default: "22:00" },
        end: { type: String, default: "07:00" },
      },
    },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
