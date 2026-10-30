import { createSlice } from "@reduxjs/toolkit";
import {
  getAllUsers,
  getAnalytics,
  getStats,
  getUserDetails,
} from "../actions/userAction";

const userSlice = createSlice({
  name: "user",
  initialState: {
    loading: false,
    success: false,
    users: null,
    user: null,
    error: null,
    appoinmtents: null,
    stats: null,
    analytics: null,
    analyticsLastUpdated: null,
    analyticsRefreshing: false,
  },
  reducers: {
    reset: (state) => {
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      //getAllUsers
      .addCase(getAllUsers.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.users = action.payload.users;
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      //getStats
      .addCase(getStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(getStats.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.stats = action.payload.stats;
      })
      .addCase(getStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      //getAnalytics
      .addCase(getAnalytics.pending, (state) => {
        if (state.analytics) {
          state.analyticsRefreshing = true;
        } else {
          state.loading = true;
        }
      })
      .addCase(getAnalytics.fulfilled, (state, action) => {
        state.loading = false;
        state.analyticsRefreshing = false;
        state.success = true;
        state.analytics = action.payload.analytics;
        state.analyticsLastUpdated = new Date().toISOString();
      })
      .addCase(getAnalytics.rejected, (state, action) => {
        state.loading = false;
        state.analyticsRefreshing = false;
        state.error = action.payload;
      })
      //getUser Detaisl
      .addCase(getUserDetails.pending, (state) => {
        state.loading = true;
      })
      .addCase(getUserDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        state.user = action.payload.user;
        state.appoinmtents = action.payload.appointments || action.payload.appoinmtents || [];
      })
      .addCase(getUserDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { reset } = userSlice.actions;
export default userSlice.reducer;
