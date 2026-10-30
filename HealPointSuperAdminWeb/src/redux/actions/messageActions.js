import { createAsyncThunk } from "@reduxjs/toolkit";
import API from "../../Api/API";

export const getAllMessages = createAsyncThunk(
  "messages/getAllMessages",
  async ({ search = "", status = "all" } = {}, thunkApi) => {
    try {
      const res = await API.get("/webmessage/get-all", { params: { search, status } });
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message || error.message || "messages error"
      );
    }
  }
);

export const updateMessageReadStatus = createAsyncThunk(
  "messages/updateMessageReadStatus",
  async ({ id, isRead }, thunkApi) => {
    try {
      const res = await API.patch(`/webmessage/read/${id}`, { isRead });
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message || error.message || "message status error"
      );
    }
  }
);

export const replyMessage = createAsyncThunk(
  "messages/replyMessage",
  async ({ id, adminReply }, thunkApi) => {
    try {
      const res = await API.patch(`/webmessage/reply/${id}`, { adminReply });
      return res.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        try {
          const retryRes = await API.patch(`/webmessage/replay/${id}`, { adminReply });
          return retryRes.data;
        } catch (retryError) {
          return thunkApi.rejectWithValue(
            retryError?.response?.data?.message ||
              retryError?.response?.data ||
              retryError.message ||
              "reply message error"
          );
        }
      }

      return thunkApi.rejectWithValue(
        error?.response?.data?.message ||
          error?.response?.data ||
          error.message ||
          "reply message error"
      );
    }
  }
);

export const deleteMessage = createAsyncThunk("messages/deleteMessage", async (id, thunkApi) => {
  try {
    const res = await API.delete(`/webmessage/delete/${id}`);
    return res.data;
  } catch (error) {
    return thunkApi.rejectWithValue(
      error?.response?.data?.message || error.message || "delete message error"
    );
  }
});
