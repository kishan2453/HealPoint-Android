import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String, default: "", trim: true },
    image: { type: String, default: "" },
    coverBanner: { type: String, default: "" },
    degree: { type: String, default: "MBBS" },
    qualification: { type: String, default: "" },
    registrationNumber: { type: String, default: "" },
    speciality: { type: String, required: true, trim: true },
    department: { type: String, default: "" },
    specialization: { type: String, default: "" },
    about: { type: String, default: "" },
    experience: { type: Number, default: 1 },
    fees: { type: Number, default: 500 },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    hospitalName: { type: String, default: "" },
    available: { type: Boolean, default: true },
    onlineStatus: { type: String, enum: ["online", "offline"], default: "offline" },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 4.8 },
    reviewCount: { type: Number, default: 0 },
    appointmentCount: { type: Number, default: 0 },
    clinicInfo: {
      name: { type: String, default: "" },
      address: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      roomNo: { type: String, default: "" },
    },
    onlineConsultationEnabled: { type: Boolean, default: true },
    instantConsultationEnabled: { type: Boolean, default: true },
    verificationStatus: {
      type: String,
      enum: ["Pending", "Verified", "Rejected", "Suspended"],
      default: "Verified",
    },
    slotDurationMinutes: { type: Number, default: 30 },
    maxAppointmentsPerDay: { type: Number, default: 30 },
    queuePaused: { type: Boolean, default: false },
    queuePauseReason: { type: String, default: "" },
    weeklySchedule: [
      {
        day: { type: String },
        enabled: { type: Boolean, default: true },
        startTime: { type: String, default: "09:00 AM" },
        endTime: { type: String, default: "05:00 PM" },
        sessions: [
          { name: { type: String }, startTime: { type: String }, endTime: { type: String } },
        ],
        breaks: [
          { name: { type: String }, startTime: { type: String }, endTime: { type: String } },
        ],
      },
    ],
    breakTimes: [
      { name: { type: String }, startTime: { type: String }, endTime: { type: String } },
    ],
    dateOverrides: [
      { date: { type: String }, isAvailable: { type: Boolean }, startTime: { type: String }, endTime: { type: String }, reason: { type: String } },
    ],
    leaves: [
      { startDate: { type: String }, endDate: { type: String }, reason: { type: String }, type: { type: String } },
    ],
    leaveDates: [{ type: String }],
    blockedHolidays: [{ type: String }],
    notificationSettings: {
      emailAlerts: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: true },
      appointmentReminders: { type: Boolean, default: true },
      marketingEmails: { type: Boolean, default: false },
    },
    timeSlots: [
      {
        date: { type: String },
        startTime: { type: String },
        endTime: { type: String },
        isAvailable: { type: Boolean, default: true },
      },
    ],
    blockedSlots: [
      {
        date: { type: String },
        slotTime: { type: String },
        reason: { type: String },
      },
    ],
  },
  { timestamps: true }
);

// Performance Optimization Compound Indexes
doctorSchema.index({ hospitalId: 1, isActive: 1, verificationStatus: 1 });
doctorSchema.index({ speciality: 1, isActive: 1 });
doctorSchema.index({ rating: -1, reviewCount: -1 });


export default mongoose.models.Doctor || mongoose.model("Doctor", doctorSchema);
