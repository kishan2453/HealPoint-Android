import { createAsyncThunk } from "@reduxjs/toolkit";
import API from "../../Api/API";

//get all users
export const getAllUsers = createAsyncThunk(
  "user/getAllUsers",
  async (_, thunkApi) => {
    try {
      const res = await API.get("/user/get-all");
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "login error";
      return thunkApi.rejectWithValue(message);
    }
  }
);
//get all stats
export const getStats = createAsyncThunk(
  "user/getStats",
  async (_, thunkApi) => {
    try {
      const res = await API.get("/user/get-stats");
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "get-stats error";
      return thunkApi.rejectWithValue(message);
    }
  }
);

//get admin analytics
export const getAnalytics = createAsyncThunk(
  "user/getAnalytics",
  async (range = "7d", thunkApi) => {
    try {
      const res = await API.get("/user/analytics", { params: { range } });
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "analytics error";
      return thunkApi.rejectWithValue(message);
    }
  }
);

//get user setails
export const getUserDetails = createAsyncThunk(
  "user/getUserDetails",
  async (id, thunkApi) => {
    try {
      const res = await API.get(`/user/get-user/${id}`);
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "user details error";
      return thunkApi.rejectWithValue(message);
    }
  }
);
