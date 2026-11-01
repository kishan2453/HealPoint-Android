import notificationModel from "../models/notificationModel.js";
import userModel from "../models/userModel.js";
import { isExpoPushToken } from "../services/pushNotificationService.js";

/**
 * Builds base ownership/tenant query based on authenticated caller's role.
 */
function buildRoleBaseFilter(user) {
  const userId = user?.id || user?._id;
  const role = (user?.role || "").toLowerCase();
  const isSuperAdmin = role.includes("super") || Boolean(user?.isAdmin);
  const isHospitalAdmin = role.includes("hospital");
  const isDoctor = role === "doctor";

  if (isSuperAdmin) {
    return {
      $or: [
        { recipientRole: { $in: ["super_admin", "all"] } },
        { type: { $in: ["system", "system_alert", "admin_action", "hospital_registered", "hospital_suspended"] } },
        { userId: userId },
      ],
    };
  }

  if (isHospitalAdmin && user?.hospitalId) {
    return {
      hospitalId: user.hospitalId,
      recipientRole: { $in: ["hospital_admin", "all"] },
    };
  }

  if (isDoctor) {
    return {
      $or: [
        { doctorId: userId },
        { userId: userId, recipientRole: { $in: ["doctor", "all"] } },
      ],
    };
  }

  // Default: Patient scoped
  return { userId: userId };
}

/**
 * GET /api/v1/notification/get-all
 * Role-scoped, tenant-isolated notifications list with status, category, search, and pagination.
 */
export const getNotifications = async (req, res) => {
  try {
    const baseFilter = buildRoleBaseFilter(req.user);
    const query = { ...baseFilter };

    const { status, type, category, priority, search } = req.query;

    // Filter by read / unread status
    if (status === "unread") {
      query.read = false;
    } else if (status === "read") {
      query.read = true;
    }

    // Filter by type or category
    if (category && category !== "all") {
      query.$or = [
        { category: category },
        { type: category },
        { category: new RegExp(`^${category}`, "i") },
        { type: new RegExp(`^${category}`, "i") },
      ];
    } else if (type && type !== "all") {
      query.type = type;
    }

    // Filter by priority
    if (priority && priority !== "all") {
      query.priority = priority;
    }

    // Live search within title, message, or actorName
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const searchConditions = [
        { title: { $regex: q, $options: "i" } },
        { message: { $regex: q, $options: "i" } },
        { actorName: { $regex: q, $options: "i" } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      notificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      notificationModel.countDocuments(query),
      notificationModel.countDocuments({ ...baseFilter, read: false }),
    ]);

    const formatted = notifications.map((n) => ({
      ...n,
      read: Boolean(n.read),
      isRead: Boolean(n.read || n.isRead),
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      notifications: formatted,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v1/notification/unread-count
 * Fast unread badge query.
 */
export const getUnreadCount = async (req, res) => {
  try {
    const baseFilter = buildRoleBaseFilter(req.user);
    const unreadCount = await notificationModel.countDocuments({ ...baseFilter, read: false });
    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/v1/notification/read/:id
 * Marks a notification as read (or updates read status).
 */
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const isRead = req.body.isRead !== undefined ? Boolean(req.body.isRead) : true;
    const baseFilter = buildRoleBaseFilter(req.user);

    const notification = await notificationModel.findOneAndUpdate(
      { _id: id, ...baseFilter },
      { $set: { read: isRead, isRead: isRead } },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found or access denied" });
    }

    const unreadCount = await notificationModel.countDocuments({ ...baseFilter, read: false });

    res.status(200).json({
      success: true,
      message: isRead ? "Notification marked as read" : "Notification marked as unread",
      notification: {
        ...notification,
        read: Boolean(notification.read),
        isRead: Boolean(notification.read || notification.isRead),
      },
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/v1/notification/mark-all
 * Marks all notifications for current user/tenant as read.
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const baseFilter = buildRoleBaseFilter(req.user);
    await notificationModel.updateMany(
      { ...baseFilter, read: false },
      { $set: { read: true, isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      unreadCount: 0,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v1/notification/delete/:id
 * Deletes a notification belonging to the authenticated caller.
 */
export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const baseFilter = buildRoleBaseFilter(req.user);

    const deleted = await notificationModel.findOneAndDelete({ _id: id, ...baseFilter });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notification not found or access denied" });
    }

    const unreadCount = await notificationModel.countDocuments({ ...baseFilter, read: false });

    res.status(200).json({
      success: true,
      message: "Notification deleted",
      id,
      unreadCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/v1/notification/preferences
 * Returns the current patient's notification preferences.
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await userModel.findById(userId).select("notificationPreferences").lean();

    const defaultPreferences = {
      channels: { inApp: true, push: true, email: true, sms: false },
      categories: {
        appointments: true,
        payments: true,
        consultations: true,
        prescriptions: true,
        reports: true,
        referrals: true,
        consent: true,
        documents: true,
        subscriptions: true,
        security: true,
        queue: true,
        system: true,
      },
      quietHours: { enabled: false, startHour: 22, endHour: 7, start: "22:00", end: "07:00" },
    };

    const preferences = {
      ...defaultPreferences,
      ...(user?.notificationPreferences || {}),
      channels: {
        ...defaultPreferences.channels,
        ...(user?.notificationPreferences?.channels || {}),
      },
      categories: {
        ...defaultPreferences.categories,
        ...(user?.notificationPreferences?.categories || {}),
      },
      quietHours: {
        ...defaultPreferences.quietHours,
        ...(user?.notificationPreferences?.quietHours || {}),
      },
    };

    res.status(200).json({ success: true, preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/v1/notification/preferences
 * Updates the current patient's notification preferences.
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const updates = req.body || {};

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.notificationPreferences) {
      user.notificationPreferences = {};
    }

    if (updates.channels) {
      user.notificationPreferences.channels = {
        ...(user.notificationPreferences.channels || {}),
        ...updates.channels,
      };
    }
    if (updates.categories) {
      user.notificationPreferences.categories = {
        ...(user.notificationPreferences.categories || {}),
        ...updates.categories,
      };
    }
    if (updates.quietHours) {
      user.notificationPreferences.quietHours = {
        ...(user.notificationPreferences.quietHours || {}),
        ...updates.quietHours,
      };
    }

    user.markModified("notificationPreferences");
    await user.save();

    res.status(200).json({
      success: true,
      message: "Notification preferences updated successfully",
      preferences: user.notificationPreferences,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/v1/notification/register-push-token
 * Registers an Expo device push token for background notifications.
 */
export const registerPushToken = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { token, platform = "expo" } = req.body;

    if (!token || typeof token !== "string" || !isExpoPushToken(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing Expo push token format (must start with ExponentPushToken[...] or ExpoPushToken[...])",
      });
    }

    const trimmedToken = token.trim();

    await userModel.findByIdAndUpdate(userId, {
      $set: { pushToken: trimmedToken },
      $addToSet: {
        pushTokens: { token: trimmedToken, platform, updatedAt: new Date() },
        deviceTokens: { token: trimmedToken, platform, lastUsedAt: new Date() },
      },
    });

    res.status(200).json({
      success: true,
      message: "Push token registered successfully",
      token: trimmedToken,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/v1/notification/device-token
 * Unregisters an Expo device push token on logout or permission revoke.
 */
export const unregisterPushToken = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const trimmedToken = String(token).trim();

    await userModel.findByIdAndUpdate(userId, {
      $pull: {
        pushTokens: { token: trimmedToken },
        deviceTokens: { token: trimmedToken },
      },
    });

    res.status(200).json({
      success: true,
      message: "Push token removed successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
