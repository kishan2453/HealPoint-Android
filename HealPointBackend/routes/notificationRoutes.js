import express from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

router.get("/get-all", authenticate, getNotifications);
router.get("/my", authenticate, getNotifications);
router.patch("/read/:id", authenticate, markNotificationRead);
router.patch("/mark-all", authenticate, markAllNotificationsRead);
router.delete("/delete/:id", authenticate, deleteNotification);

export default router;
