import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    hospitalName: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    employeeId: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["doctor", "nurse", "technician", "pharmacist", "receptionist", "admin_staff", "support"],
      required: true,
    },
    department: { type: String, default: "General Medicine", trim: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    skills: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["active", "on_leave", "inactive"],
      default: "active",
    },
    shiftPreference: { type: String, default: "Morning" },
    joiningDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

staffSchema.index({ hospitalId: 1, department: 1, status: 1 });
staffSchema.index({ hospitalId: 1, employeeId: 1 }, { unique: true });

export default mongoose.models.Staff || mongoose.model("Staff", staffSchema);
