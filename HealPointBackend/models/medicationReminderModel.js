import mongoose from "mongoose";

const doseLogSchema = new mongoose.Schema(
  {
    doseDate: { type: String, required: true }, // Format: YYYY-MM-DD
    scheduledTime: { type: String, required: true }, // e.g. "08:00 AM"
    status: {
      type: String,
      enum: ["pending", "taken", "skipped", "snoozed", "missed"],
      default: "pending",
    },
    actionTimestamp: { type: Date, default: null },
    notes: { type: String, default: "" },
  },
  { _id: true }
);

const medicationReminderSchema = new mongoose.Schema(
  {
    userId: {
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
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      default: null,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },

    medicineName: { type: String, required: true, trim: true },
    strength: { type: String, default: "", trim: true },
    dosage: { type: String, default: "1 Tablet", trim: true },
    frequency: { type: String, default: "1-0-1", trim: true },
    timing: { type: String, default: "After food", trim: true },
    instructions: { type: String, default: "", trim: true },

    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, default: null },
    times: [{ type: String, required: true }], // e.g. ["08:00 AM", "08:00 PM"]

    isActive: { type: Boolean, default: true, index: true },

    refillReminder: {
      enabled: { type: Boolean, default: false },
      refillDate: { type: Date, default: null },
      remindBeforeDays: { type: Number, default: 2 },
      isNotified: { type: Boolean, default: false },
    },

    followUpReminder: {
      enabled: { type: Boolean, default: false },
      followUpDate: { type: Date, default: null },
      isNotified: { type: Boolean, default: false },
    },

    notificationPreferences: {
      pushEnabled: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
      snoozeDurationMinutes: { type: Number, default: 15 },
    },

    logs: [doseLogSchema],
  },
  { timestamps: true }
);

const medicationReminderModel =
  mongoose.models.MedicationReminder ||
  mongoose.model("MedicationReminder", medicationReminderSchema);

export default medicationReminderModel;
