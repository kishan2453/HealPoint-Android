import mongoose from "mongoose";

const stepExecutionSchema = new mongoose.Schema(
  {
    stepIndex: { type: Number, required: true },
    actionType: { type: String, required: true },
    status: {
      type: String,
      enum: ["success", "failed", "skipped"],
      default: "success",
    },
    output: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: "" },
    executedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const workflowExecutionSchema = new mongoose.Schema(
  {
    workflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
      index: true,
    },
    workflowName: { type: String, required: true },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },
    trigger: { type: String, required: true },
    triggerData: { type: mongoose.Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String, index: true },
    status: {
      type: String,
      enum: ["success", "failed", "running", "retrying"],
      default: "running",
      index: true,
    },
    stepsExecuted: { type: [stepExecutionSchema], default: [] },
    retryCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
    durationMs: { type: Number, default: 0 },
    executedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

workflowExecutionSchema.index({ workflowId: 1, executedAt: -1 });
workflowExecutionSchema.index({ hospitalId: 1, executedAt: -1 });

export default mongoose.models.WorkflowExecution ||
  mongoose.model("WorkflowExecution", workflowExecutionSchema);
