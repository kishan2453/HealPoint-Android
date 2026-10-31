import mongoose from "mongoose";

/**
 * HealPoint 2.0 — AI Conversation History Model.
 *
 * Persists patient conversations with the AI Health Assistant.
 * Strictly scoped to the authenticated patient (`userId`).
 * Allows instant deletion by the patient in compliance with DPDP Act 2023.
 */
const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: String,
      enum: ["user", "ai"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      enum: ["en", "hi", "gu"],
      default: "en",
    },
    isEmergency: {
      type: Boolean,
      default: false,
    },
    suggestedSpeciality: {
      type: String,
      default: null,
    },
    disclaimer: {
      type: String,
      default: null,
    },
    cards: {
      type: Array,
      default: [],
    },
    actions: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user-chronological queries and GDPR/DPDP deletions
aiConversationSchema.index({ userId: 1, createdAt: -1 });

const aiConversationModel =
  mongoose.models.AiConversation ||
  mongoose.model("AiConversation", aiConversationSchema);

export default aiConversationModel;

