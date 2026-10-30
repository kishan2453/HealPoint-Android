import mongoose from "mongoose";

const healthDocumentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    familyMemberId: { type: mongoose.Schema.Types.ObjectId },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: ["prescription", "lab_report", "radiology", "discharge_summary", "vaccination", "other"],
      default: "other",
    },
    documentDate: { type: String, default: "" },
    fileData: { type: String, required: true }, // Base64 encoded or secure object reference
    mimeType: { type: String, default: "application/pdf" },
    size: { type: Number, default: 0 },
    sharedWithDoctorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Doctor" }],
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.models.HealthDocument || mongoose.model("HealthDocument", healthDocumentSchema);
