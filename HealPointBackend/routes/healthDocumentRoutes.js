import express from "express";
import {
  uploadDocument,
  getMyDocuments,
  getDocumentDetails,
  deleteDocument,
} from "../controllers/healthDocumentController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.post("/upload", authenticate, uploadDocument);
router.get("/my", authenticate, getMyDocuments);
router.get("/:id", authenticate, getDocumentDetails);
router.delete("/:id", authenticate, deleteDocument);

export default router;
