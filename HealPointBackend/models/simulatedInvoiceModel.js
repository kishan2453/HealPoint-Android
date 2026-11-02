import mongoose from "mongoose";

const simulatedInvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true }, // e.g. "INV-HOSP-2026-001"
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
    hospitalName: { type: String, default: "" },
    planName: { type: String, default: "Professional Hospital Plan" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    billingPeriod: { type: String, default: "Current Month" },
    issueDate: { type: Date, default: Date.now },
    dueDate: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
    status: {
      type: String,
      enum: ["paid_simulated", "pending_simulated"],
      default: "paid_simulated",
    },
    paymentMethod: { type: String, default: "Platform Balance (Simulated)" },
    transactionReference: { type: String, default: "" },
    items: [
      {
        description: { type: String },
        amount: { type: Number },
      },
    ],
    notes: { type: String, default: "Simulated hospital subscription invoice. Zero real-world financial transaction." },
  },
  { timestamps: true }
);

simulatedInvoiceSchema.index({ hospitalId: 1, issueDate: -1 });

export default mongoose.models.SimulatedInvoice ||
  mongoose.model("SimulatedInvoice", simulatedInvoiceSchema);
