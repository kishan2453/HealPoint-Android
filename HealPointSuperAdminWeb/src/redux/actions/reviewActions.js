import { createAsyncThunk } from "@reduxjs/toolkit";
import API from "../../Api/API";

export const getAllReviews = createAsyncThunk(
  "reviews/getAllReviews",
  async ({ search = "", status = "all" } = {}, thunkApi) => {
    try {
      const res = await API.get("/review/get-all", {
        params: { search, status, platform: 1 },
      });
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message || error.message || "reviews error",
      );
    }
  },
);

export const updateReviewStatus = createAsyncThunk(
  "reviews/updateReviewStatus",
  async ({ id, isApproved, isHidden }, thunkApi) => {
    try {
      const res = await API.patch(`/review/status/${id}`, {
        isApproved,
        isHidden,
      });
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message ||
          error.message ||
          "review status error",
      );
    }
  },
);

export const deleteReview = createAsyncThunk(
  "reviews/deleteReview",
  async (id, thunkApi) => {
    try {
      const res = await API.delete(`/review/delete/${id}`);
      return res.data;
    } catch (error) {
      return thunkApi.rejectWithValue(
        error?.response?.data?.message ||
          error.message ||
          "delete review error",
      );
    }
  },
);
