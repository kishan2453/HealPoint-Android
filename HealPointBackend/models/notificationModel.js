import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "general" },
    read: { type: Boolean, default: false },
    link: { type: String, default: "" },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
