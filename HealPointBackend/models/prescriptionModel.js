import mongoose from "mongoose";

const medicineItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    strength: { type: String, default: "", trim: true },
    form: {
      type: String,
      enum: ["Tablet", "Capsule", "Syrup", "Injection", "Drops", "Ointment", "Inhaler", "Other"],
      default: "Tablet",
    },
    dosage: { type: String, default: "1 Tablet", trim: true },
    frequency: { type: String, default: "1-0-1", trim: true },
    duration: { type: String, default: "5 days", trim: true },
    durationDays: { type: Number, default: 5 },
    route: { type: String, default: "Oral", trim: true },
    timing: {
      type: String,
      enum: ["After food", "Before food", "With food", "Empty stomach", "As directed"],
      default: "After food",
    },
    instructions: { type: String, default: "", trim: true },
    scheduleTimes: [{ type: String }],
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
  },
  { _id: true }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    familyMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    // Snapshot of clinical identities
    patientSnapshot: {
      name: { type: String, default: "" },
      age: { type: String, default: "" },
      gender: { type: String, default: "" },
      phone: { type: String, default: "" },
      displayId: { type: String, default: "" },
    },
    doctorSnapshot: {
      name: { type: String, default: "" },
      qualification: { type: String, default: "" },
      speciality: { type: String, default: "" },
      registrationNumber: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    hospitalSnapshot: {
      name: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
      phone: { type: String, default: "" },
    },

    // Clinical Information
    diagnosis: { type: String, default: "", trim: true },
    symptoms: [{ type: String, trim: true }],
    vitals: {
      bloodPressure: { type: String, default: "" },
      pulse: { type: String, default: "" },
      temperature: { type: String, default: "" },
      spo2: { type: String, default: "" },
      weight: { type: String, default: "" },
    },
    medicines: [medicineItemSchema],
    generalInstructions: { type: String, default: "", trim: true },
    dietInstructions: { type: String, default: "", trim: true },
    followUpDate: { type: Date, default: null },
    followUpInstructions: { type: String, default: "", trim: true },

    // Status and Signing
    status: {
      type: String,
      enum: ["draft", "issued", "amended", "discontinued"],
      default: "draft",
      index: true,
    },
    isDigitallySigned: { type: Boolean, default: false },
    signedAt: { type: Date, default: null },
    signedByDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    doctorSignatureStamp: { type: String, default: "" },

    // Versioning & Audit Trail
    version: { type: Number, default: 1 },
    history: [
      {
        version: { type: Number, required: true },
        amendedAt: { type: Date, default: Date.now },
        amendedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Doctor",
          required: true,
        },
        amendmentReason: { type: String, required: true },
        snapshot: { type: Object, required: true },
      },
    ],
  },
  { timestamps: true }
);

const prescriptionModel =
  mongoose.models.Prescription ||
  mongoose.model("Prescription", prescriptionSchema);

export default prescriptionModel;
