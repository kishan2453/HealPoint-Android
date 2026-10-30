import express from "express";
import {
  getPublicReviews,
  getMyReviews,
  getAllAdminReviews,
  createReview,
  checkReviewEligibility,
} from "../controllers/reviewController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/public", getPublicReviews);
router.get("/my-reviews", authenticate, getMyReviews);
router.get("/get-all", authenticate, getAllAdminReviews);
router.get("/check-eligibility", authenticate, checkReviewEligibility);
router.post("/create", authenticate, createReview);

export default router;
