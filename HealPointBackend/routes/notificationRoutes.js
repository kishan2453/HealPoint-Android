import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushToken,
  unregisterPushToken,
} from "../controllers/notificationController.js";
import { authenticate } from "../middlewares/authMiddlewares.js";

const router = express.Router();

// Notifications listing & counts
router.get("/get-all", authenticate, getNotifications);
router.get("/my", authenticate, getNotifications);
router.get("/unread-count", authenticate, getUnreadCount);

// Read state updates
router.patch("/read/:id", authenticate, markNotificationRead);
router.patch("/:id/read", authenticate, markNotificationRead);
router.patch("/mark-all", authenticate, markAllNotificationsRead);
router.patch("/read-all", authenticate, markAllNotificationsRead);

// Deletion
router.delete("/delete/:id", authenticate, deleteNotification);
router.delete("/:id", authenticate, deleteNotification);

// Preferences
router.get("/preferences", authenticate, getNotificationPreferences);
router.put("/preferences", authenticate, updateNotificationPreferences);
router.patch("/preferences", authenticate, updateNotificationPreferences);

// Push token management
router.post("/register-push-token", authenticate, registerPushToken);
router.post("/device-token", authenticate, registerPushToken);
router.delete("/device-token", authenticate, unregisterPushToken);
router.delete("/unregister-push-token", authenticate, unregisterPushToken);
router.post("/unregister-push-token", authenticate, unregisterPushToken);

export default router;
