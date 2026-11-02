import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    hospitalName: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    identifier: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["room", "bed", "equipment", "facility", "vehicle"],
      required: true,
    },
    department: { type: String, default: "General Medicine", trim: true },
    status: {
      type: String,
      enum: ["available", "occupied", "under_maintenance", "reserved", "retired"],
      default: "available",
    },
    capacity: { type: Number, default: 1 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedName: { type: String, default: "" },
    assignedAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    assignedAt: { type: Date },
    lastMaintenanceDate: { type: Date },
    nextMaintenanceDate: { type: Date },
    maintenanceNotes: { type: String, default: "" },
    maintenanceAlert: { type: Boolean, default: false },
    specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
    location: { type: String, default: "" }, // e.g. "Building A, Floor 2, Room 204"
    notes: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

resourceSchema.index({ hospitalId: 1, category: 1, status: 1 });
resourceSchema.index({ hospitalId: 1, department: 1 });
resourceSchema.index({ hospitalId: 1, identifier: 1 }, { unique: true });

export default mongoose.models.Resource || mongoose.model("Resource", resourceSchema);
