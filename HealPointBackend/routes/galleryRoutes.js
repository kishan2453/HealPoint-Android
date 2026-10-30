import express from "express";
import galleryModel from "../models/galleryModel.js";
import { authenticate, optionalAuth } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// GET /api/v1/gallery
router.get("/", optionalAuth, async (req, res) => {
  try {
    const images = await galleryModel.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: images.length, images, galleries: images });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/gallery
router.post("/", authenticate, async (req, res) => {
  try {
    const { title, name, category, url, imageUrl, caption } = req.body;
    const finalUrl = imageUrl || url || "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop";
    const image = await galleryModel.create({
      title: title || name || "Gallery Image",
      category: category || "Hospital Photos",
      imageUrl: finalUrl,
      url: finalUrl,
      caption: caption || "",
      isActive: true,
    });
    res.status(201).json({ success: true, message: "Image added successfully", image });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/v1/gallery/:id
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await galleryModel.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
