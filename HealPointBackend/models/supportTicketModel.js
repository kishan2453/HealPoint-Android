import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, required: true },
      role: {
        type: String,
        enum: ["patient", "admin", "doctor", "agent", "system", "hospital_admin", "super_admin"],
        default: "patient",
      },
    },
    body: { type: String, required: true },
    isInternalNote: { type: Boolean, default: false },
    attachments: { type: [String], default: [] },
    sentAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const timelineSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    note: { type: String, default: "" },
    performedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "System" },
      role: { type: String, default: "system" },
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "APPOINTMENT_BOOKING",
        "APPOINTMENT_CANCELLATION",
        "APPOINTMENT_RESCHEDULING",
        "DOCTOR_FEEDBACK",
        "PAYMENT_BILLING",
        "REFUND_REQUEST",
        "SUBSCRIPTION_BENEFITS",
        "SUBSCRIPTION_UPGRADE_DOWNGRADE",
        "ONLINE_CONSULTATION",
        "PRESCRIPTION_REPORTS",
        "MEDICAL_RECORDS",
        "QUEUE_CHECKIN",
        "REFERRAL",
        "CLINICAL_HANDOVER",
        "PRIVACY_DATA",
        "SECURITY_ACCESS",
        "TECHNICAL_APP",
        "GENERAL_ENQUIRY",
        "FEEDBACK_SUGGESTION",
        "COMPLAINT",
        // legacy / friendly fallbacks
        "appointment",
        "payment",
        "account",
        "doctor",
        "hospital",
        "wallet",
        "technical",
        "other",
      ],
      default: "GENERAL_ENQUIRY",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "OPEN",
        "TRIAGED",
        "ASSIGNED",
        "IN_PROGRESS",
        "WAITING_FOR_PATIENT",
        "WAITING_FOR_HOSPITAL",
        "ESCALATED",
        "RESOLVED",
        "CLOSED",
        // legacy lowercase/titlecase
        "Open",
        "In Progress",
        "Resolved",
        "Closed",
      ],
      default: "OPEN",
      index: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL", "Low", "Medium", "High", "Urgent"],
      default: "MEDIUM",
      index: true,
    },
    team: {
      type: String,
      enum: [
        "TIER_1_SUPPORT",
        "TIER_2_SUPPORT",
        "BILLING_TEAM",
        "CLINICAL_TEAM",
        "TECHNICAL_TEAM",
        "ESCALATIONS_TEAM",
        "MANAGEMENT",
      ],
      default: "TIER_1_SUPPORT",
    },

    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    patientName: { type: String, default: "" },
    patientEmail: { type: String, default: "" },
    patientPhone: { type: String, default: "" },

    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", index: true },
    hospitalName: { type: String, default: "" },

    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    familyMemberId: { type: String, default: "" },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    paymentId: { type: String, default: "" },
    subscriptionId: { type: String, default: "" },
    consultationId: { type: String, default: "" },
    recoveryId: { type: String, default: "" },

    assignedTo: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      role: { type: String, default: "" },
      team: { type: String, default: "" },
    },
    assignedAt: { type: Date },

    messages: { type: [messageSchema], default: [] },
    timeline: { type: [timelineSchema], default: [] },

    resolvedAt: { type: Date },
    resolvedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      role: { type: String, default: "" },
    },
    resolutionNote: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound index for efficient user and hospital queries
supportTicketSchema.index({ patientId: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ hospitalId: 1, status: 1, createdAt: -1 });

export default mongoose.models.SupportTicket || mongoose.model("SupportTicket", supportTicketSchema);
