import express from "express";
import {
  uploadDocument,
  getMyDocuments,
  getDocumentTimeline,
  getDocumentStats,
  getDocumentDetails,
  viewOrDownloadDocument,
  updateDocumentMetadata,
  shareDocumentWithDoctor,
  revokeDocumentShare,
  deleteDocument,
} from "../controllers/healthDocumentController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Specific routes before parameterized /:id routes
router.post("/upload", authenticate, uploadDocument);
router.get("/my", authenticate, getMyDocuments);
router.get("/timeline", authenticate, getDocumentTimeline);
router.get("/stats", authenticate, getDocumentStats);

// Parameterized routes
router.get("/:id", authenticate, getDocumentDetails);
router.get("/:id/view", authenticate, viewOrDownloadDocument);
router.get("/:id/download", authenticate, viewOrDownloadDocument);
router.patch("/:id/metadata", authenticate, updateDocumentMetadata);
router.post("/:id/share", authenticate, shareDocumentWithDoctor);
router.delete("/:id/share/:doctorId", authenticate, revokeDocumentShare);
router.delete("/:id", authenticate, deleteDocument);

export default router;
