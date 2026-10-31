import mongoose from "mongoose";

const healthDocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyMemberId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "prescription",
        "lab_report",
        "diagnostic_report",
        "consultation_history",
        "medical_document",
        "billing_receipt",
        "appointment_record",
        "other",
        // Backward-compatible legacy categories
        "radiology",
        "discharge_summary",
        "vaccination",
      ],
      default: "medical_document",
      index: true,
    },
    documentDate: { type: String, default: "" },
    fileData: { type: String, default: "" }, // Base64 encoded or secure object reference
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    mimeType: { type: String, default: "application/pdf" },
    size: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", default: null },
    hospitalName: { type: String, default: "" },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    doctorName: { type: String, default: "" },
    appointmentId: { type: String, default: "" },
    sharedWithDoctorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }],
    notes: { type: String, default: "" },
    tags: [{ type: String }],
    isArchived: { type: Boolean, default: false, index: true },

    // OCR & Document Intelligence metadata
    processingStatus: {
      type: String,
      enum: ["pending", "processing", "processed", "partially_processed", "failed"],
      default: "processed",
    },
    confidence: { type: Number, default: 100 },
    ocrProvider: { type: String, default: "healpoint-ocr-v2" },
    extractedMetadata: {
      documentType: { type: String, default: "" },
      doctorName: { type: String, default: "" },
      hospitalName: { type: String, default: "" },
      referenceNumber: { type: String, default: "" },
      patientName: { type: String, default: "" },
      testResults: [
        {
          testName: { type: String },
          value: { type: String },
          unit: { type: String, default: "" },
          normalRange: { type: String, default: "" },
          isAbnormal: { type: Boolean, default: false },
        },
      ],
    },
    userCorrections: {
      isCorrected: { type: Boolean, default: false },
      correctedAt: { type: Date },
      correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    doctorSummary: { type: String, default: "" },
    contentHash: { type: String, default: "" },
  },
  { timestamps: true }
);

// Compound indexes for multi-tenant isolation and fast queries
healthDocumentSchema.index({ userId: 1, category: 1, createdAt: -1 });
healthDocumentSchema.index({ userId: 1, familyMemberId: 1, createdAt: -1 });
healthDocumentSchema.index({ userId: 1, isArchived: 1 });

export default mongoose.models.HealthDocument || mongoose.model("HealthDocument", healthDocumentSchema);
