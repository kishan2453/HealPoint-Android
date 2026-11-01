import mongoose from "mongoose";

export function syncNotificationFields(doc) {
  if (doc.read !== undefined && doc.isRead === undefined) {
    doc.isRead = doc.read;
  } else if (doc.isRead !== undefined && doc.read === undefined) {
    doc.read = doc.isRead;
  } else if (doc.read !== undefined && doc.isRead !== undefined) {
    doc.isRead = Boolean(doc.read || doc.isRead);
    doc.read = doc.isRead;
  }
  if ((!doc.category || doc.category === "general") && doc.type && doc.type !== "general") {
    doc.category = doc.type;
  }
  if ((!doc.type || doc.type === "general") && doc.category && doc.category !== "general") {
    doc.type = doc.category;
  }
  return doc;
}

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", index: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", index: true },
    recipientRole: {
      type: String,
      enum: ["patient", "doctor", "hospital_admin", "super_admin", "all"],
      default: "patient",
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, default: "general", index: true },
    category: { type: String, default: "general", index: true },
    priority: {
      type: String,
      enum: ["low", "normal", "medium", "high", "urgent"],
      default: "normal",
      index: true,
    },
    read: { type: Boolean, default: false, index: true },
    isRead: { type: Boolean, default: false, index: true },
    link: { type: String, default: "" },
    actorName: { type: String, default: "" },
    actorRole: { type: String, default: "" },
    refId: { type: String, default: "" },
    refModel: { type: String, default: "" },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

// Pre-validate & Pre-save synchronization hooks
notificationSchema.pre("validate", function (next) {
  syncNotificationFields(this);
  if (typeof next === "function") next();
});

notificationSchema.pre("save", function (next) {
  syncNotificationFields(this);
  if (typeof next === "function") next();
});

// Compound indexes for optimal tenant-isolated and user-scoped lookups
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ doctorId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ hospitalId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, read: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
