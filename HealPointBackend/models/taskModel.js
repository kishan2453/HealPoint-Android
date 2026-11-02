import mongoose from "mongoose";

const taskCommentSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, default: "staff" },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null, // null indicates platform-wide / super-admin task
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    department: { type: String, default: "Operations", trim: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: [
        "New",
        "Assigned",
        "In Progress",
        "Under Review",
        "Completed",
        "Cancelled",
      ],
      default: "New",
      index: true,
    },
    assignedTo: {
      id: { type: String, default: "" },
      name: { type: String, default: "" },
      role: {
        type: String,
        enum: ["doctor", "staff", "admin", "hospital-admin", "super-admin", "unassigned"],
        default: "unassigned",
      },
    },
    assignedBy: {
      id: { type: String, default: "" },
      name: { type: String, default: "Administrator" },
      role: { type: String, default: "admin" },
    },
    dueDate: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    completionNotes: { type: String, default: "" },
    comments: { type: [taskCommentSchema], default: [] },
    relatedEntityType: {
      type: String,
      enum: ["appointment", "patient", "resource", "roster", "support", "general"],
      default: "general",
    },
    relatedEntityId: { type: String, default: "" },
  },
  { timestamps: true }
);

taskSchema.index({ hospitalId: 1, status: 1, dueDate: 1 });
taskSchema.index({ "assignedTo.id": 1, status: 1 });
taskSchema.index({ department: 1, status: 1 });

export default mongoose.models.Task || mongoose.model("Task", taskSchema);
