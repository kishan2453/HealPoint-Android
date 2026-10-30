import { createAsyncThunk } from "@reduxjs/toolkit";
import API from "../../Api/API";

//get all doctors
export const getAllDoctors = createAsyncThunk(
  "doctor/getAllDoctrors",
  async (_, thunkApi) => {
    try {
      const res = await API.get("/doctor/get-all");
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "get all doc  error";
      return thunkApi.rejectWithValue(message);
    }
  }
);

//get doctor setails
export const getDoctorDetails = createAsyncThunk(
  "doctor/getDoctorDetails",
  async (id, thunkApi) => {
    try {
      const res = await API.get(`/doctor/get-details/${id}`);
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "doctror details error";
      return thunkApi.rejectWithValue(message);
    }
  }
);

//ADD DOCTOR
export const addDoctor = createAsyncThunk(
  "doctor/AddDoctor",
  async (formData, thunkApi) => {
    try {
      const res = await API.post("/doctor/add", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "add new doc  error";
      return thunkApi.rejectWithValue(message);
    }
  }
);

//ADD DOCTOR
export const updateDoctor = createAsyncThunk(
  "doctor/updateDoctor",
  async ({ id, formData }, thunkApi) => {
    try {
      const res = await API.patch(`/doctor/update/${id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "udpate  doc  error";
      return thunkApi.rejectWithValue(message);
    }
  }
);

//DELETE DOCTOR
export const deleteDoctor = createAsyncThunk(
  "doctor/deleteDoctor",
  async (id, thunkApi) => {
    try {
      const res = await API.delete(`/doctor/delete/${id}`);
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message || error.message || "delete  doc  error";
      return thunkApi.rejectWithValue(message);
    }
  }
);

//udpate status DOCTOR
export const updateStatus = createAsyncThunk(
  "doctor/updateStatus",
  async ({ id, availableStatus }, thunkApi) => {
    try {
      const res = await API.patch(`/doctor/update-status/${id}`, {
        availableStatus,
      });
      return res.data;
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error.message ||
        "update status  doc  error";
      return thunkApi.rejectWithValue(message);
    }
  }
);
