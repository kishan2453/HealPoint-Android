import { createSlice } from "@reduxjs/toolkit";
import {
  deleteMessage,
  getAllMessages,
  replyMessage,
  updateMessageReadStatus,
} from "../actions/messageActions";

const messageSlice = createSlice({
  name: "messages",
  initialState: { loading: false, messages: [], error: null, success: false },
  reducers: {
    reset: (state) => {
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAllMessages.pending, (state) => {
        state.loading = true;
      })
      .addCase(getAllMessages.fulfilled, (state, action) => {
        state.loading = false;
        state.messages = action.payload.webMessages || [];
      })
      .addCase(getAllMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateMessageReadStatus.fulfilled, (state) => {
        state.success = true;
      })
      .addCase(replyMessage.fulfilled, (state, action) => {
        state.success = true;
        const updatedMessage = action.payload.webMessage;
        if (updatedMessage?._id) {
          state.messages = state.messages.map((message) =>
            message._id === updatedMessage._id ? updatedMessage : message
          );
        }
      })
      .addCase(deleteMessage.fulfilled, (state) => {
        state.success = true;
      });
  },
});

export const { reset } = messageSlice.actions;
export default messageSlice.reducer;
