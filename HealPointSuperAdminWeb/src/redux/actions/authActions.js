import { createAsyncThunk } from "@reduxjs/toolkit";
import API from "../../Api/API";

//LOGIN
export const login = createAsyncThunk(
  "auth/login",
  async ({ email, password }, thunkApi) => {
    try {
      const res = await API.post("/user/login", { email, password });

      const user = res?.data?.user;
      if (!user?.isAdmin || user.role !== "Super Admin") {
        return thunkApi.rejectWithValue("Only HealPoint Super Admin users can login here");
      }

      localStorage.setItem("appData", JSON.stringify(res?.data));
      return res?.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "login error";
      return thunkApi.rejectWithValue(message);
    }
  }
);

//get user data
export const getUserData = createAsyncThunk("auth/getUserData", () => {
  const localData = localStorage.getItem("appData");
  const appData = JSON.parse(localData);
  return appData?.user;
});

//get token
export const loadToken = createAsyncThunk("auth/loadToken", () => {
  const localData = localStorage.getItem("appData");
  const appData = JSON.parse(localData);
  return appData?.token;
});

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async ({ id, oldPassword, newPassword }, thunkApi) => {
    try {
      const res = await API.patch(`/user/update-password/${id}`, {
        oldPassword,
        newPassword,
      });
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "update-password error";
      return thunkApi.rejectWithValue(message);
    }
  }
);
