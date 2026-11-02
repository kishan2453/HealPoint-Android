import mongoose from "mongoose";

const importErrorSchema = new mongoose.Schema(
  {
    row: { type: Number, required: true },
    identifier: { type: String, default: "" },
    error: { type: String, required: true },
  },
  { _id: false }
);

const importHistorySchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },
    entityType: {
      type: String,
      enum: ["staff", "resources", "shifts", "tasks"],
      required: true,
      index: true,
    },
    fileName: { type: String, required: true },
    totalRows: { type: Number, default: 0 },
    importedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    errors: { type: [importErrorSchema], default: [] },
    importedRecordIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    importedBy: { type: String, default: "admin" },
    status: {
      type: String,
      enum: ["completed", "partially_failed", "failed", "rolled_back"],
      default: "completed",
    },
  },
  { timestamps: true }
);

importHistorySchema.index({ hospitalId: 1, createdAt: -1 });

export default mongoose.models.ImportHistory ||
  mongoose.model("ImportHistory", importHistorySchema);
