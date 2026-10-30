import notificationModel from "../models/notificationModel.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await notificationModel
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res
      .status(200)
      .json({ success: true, count: notifications.length, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationModel.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { read: true },
    );
    res
      .status(200)
      .json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await notificationModel.updateMany({ userId: req.user.id }, { read: true });
    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationModel.findOneAndDelete({ _id: id, userId: req.user.id });
    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

