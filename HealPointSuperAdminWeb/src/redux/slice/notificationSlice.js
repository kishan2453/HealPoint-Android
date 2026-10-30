import { createSlice } from "@reduxjs/toolkit";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  updateNotificationReadStatus,
} from "../actions/notificationActions";

const notificationSlice = createSlice({
  name: "notifications",
  initialState: {
    loading: false,
    notifications: [],
    unreadCount: 0,
    error: null,
  },
  reducers: {
    resetNotifications: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getNotifications.pending, (state) => {
        state.loading = true;
      })
      .addCase(getNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload.notifications || [];
        state.unreadCount = action.payload.unreadCount || 0;
      })
      .addCase(getNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateNotificationReadStatus.fulfilled, (state, action) => {
        const updated = action.payload.notification;
        state.notifications = state.notifications.map((notification) =>
          notification._id === updated?._id ? updated : notification
        );
        state.unreadCount = action.payload.unreadCount || 0;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state, action) => {
        const readValue = action.meta.arg !== false;
        state.notifications = state.notifications.map((notification) => ({
          ...notification,
          isRead: readValue,
        }));
        state.unreadCount = action.payload.unreadCount || 0;
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.notifications = state.notifications.filter(
          (notification) => notification._id !== action.payload.id
        );
        state.unreadCount = action.payload.unreadCount || 0;
      });
  },
});

export const { resetNotifications } = notificationSlice.actions;
export default notificationSlice.reducer;
