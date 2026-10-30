import { createAsyncThunk } from "@reduxjs/toolkit";
import API from "../../Api/API";

export const getNotifications = createAsyncThunk(
  "notifications/getNotifications",
  async ({ status = "all", type = "all", limit = 50 } = {}, thunkApi) => {
    try {
      const res = await API.get("/notification/get-all", {
        params: { status, type, limit },
      });
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message || error.message || "notifications error"
      );
    }
  }
);

export const updateNotificationReadStatus = createAsyncThunk(
  "notifications/updateNotificationReadStatus",
  async ({ id, isRead }, thunkApi) => {
    try {
      const res = await API.patch(`/notification/read/${id}`, { isRead });
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message || error.message || "notification update error"
      );
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  "notifications/markAllNotificationsRead",
  async (isRead = true, thunkApi) => {
    try {
      const res = await API.patch("/notification/mark-all", { isRead });
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message || error.message || "notification bulk update error"
      );
    }
  }
);

export const deleteNotification = createAsyncThunk(
  "notifications/deleteNotification",
  async (id, thunkApi) => {
    try {
      const res = await API.delete(`/notification/delete/${id}`);
      return { ...res.data, id };
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message || error.message || "notification delete error"
      );
    }
  }
);
