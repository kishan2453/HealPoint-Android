import mongoose from "mongoose";

const gallerySchema = new mongoose.Schema(
  {
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
    title: { type: String, default: "" },
    category: { type: String, default: "general" },
    imageUrl: { type: String },
    url: { type: String },
    caption: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "galleries" }
);

export default mongoose.models.Gallery ||
  mongoose.model("Gallery", gallerySchema, "galleries");
