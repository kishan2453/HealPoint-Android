import mongoose from "mongoose";

const emergencyRequestSchema = new mongoose.Schema(
  {
    isDemo: {
      type: Boolean,
      default: true,
      index: true,
    },
    isSimulation: {
      type: Boolean,
      default: true,
      index: true,
    },
    emergencyCode: {
      type: String,
      unique: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      index: true,
    },
    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "in_progress", "resolved", "cancelled"],
      default: "pending",
      index: true,
    },
    emergencyType: {
      type: String,
      enum: [
        "cardiac",
        "respiratory",
        "accident",
        "stroke",
        "pregnancy",
        "severe_pain",
        "other",
      ],
      default: "other",
    },
    severity: {
      type: String,
      enum: ["critical", "high", "medium"],
      default: "critical",
    },
    notes: {
      type: String,
      default: "",
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, default: "" },
      accuracy: { type: Number },
      sharedAt: { type: Date, default: Date.now },
    },
    patientSnapshot: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      age: { type: Number },
      gender: { type: String, default: "" },
      bloodGroup: { type: String, default: "" },
      allergies: { type: [String], default: [] },
      chronicConditions: { type: [String], default: [] },
    },
    emergencyContacts: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relation: { type: String, default: "" },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    ambulance: {
      isDispatched: { type: Boolean, default: false },
      vehicleNumber: { type: String, default: "" },
      driverName: { type: String, default: "" },
      driverPhone: { type: String, default: "" },
      etaMinutes: { type: Number, default: 0 },
      dispatchedAt: { type: Date },
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        updatedBy: { type: mongoose.Schema.Types.ObjectId },
        role: { type: String, default: "system" },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
    resolutionDetails: {
      resolvedBy: { type: mongoose.Schema.Types.ObjectId },
      resolvedAt: { type: Date },
      clinicalNotes: { type: String, default: "" },
      outcome: { type: String, default: "" },
    },
    cancellationDetails: {
      cancelledBy: { type: mongoose.Schema.Types.ObjectId },
      cancelledAt: { type: Date },
      reason: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

export function generateEmergencyCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EMG-${timestamp}-${randomHex}`;
}

// Auto-generate emergencyCode before saving if not present
emergencyRequestSchema.pre("save", function (next) {
  if (!this.emergencyCode) {
    this.emergencyCode = generateEmergencyCode();
  }
  next();
});

const EmergencyRequest =
  mongoose.models.EmergencyRequest ||
  mongoose.model("EmergencyRequest", emergencyRequestSchema);

export default EmergencyRequest;
