import { createSlice } from "@reduxjs/toolkit";
import { deleteReview, getAllReviews, updateReviewStatus } from "../actions/reviewActions";

const reviewSlice = createSlice({
  name: "reviews",
  initialState: { loading: false, reviews: [], error: null, success: false },
  reducers: {
    reset: (state) => {
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAllReviews.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllReviews.fulfilled, (state, action) => {
        state.loading = false;
        state.reviews = action.payload.reviews || [];
      })
      .addCase(getAllReviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateReviewStatus.fulfilled, (state) => {
        state.success = true;
      })
      .addCase(deleteReview.fulfilled, (state) => {
        state.success = true;
      });
  },
});

export const { reset } = reviewSlice.actions;
export default reviewSlice.reducer;
