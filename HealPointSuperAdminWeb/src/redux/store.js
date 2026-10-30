import { configureStore } from "@reduxjs/toolkit";
import AuthReducer from "./slice/authSlice";
import UserReducer from "./slice/userSlice";
import DoctorReducer from "./slice/doctorSlice";
import AppointmentsReducer from "./slice/appointmentSlice";
import MessageReducer from "./slice/messageSlice";
import ReviewReducer from "./slice/reviewSlice";
import NotificationReducer from "./slice/notificationSlice";
const store = configureStore({
  reducer: {
    auth: AuthReducer,
    user: UserReducer,
    doctor: DoctorReducer,
    appointments: AppointmentsReducer,
    messages: MessageReducer,
    reviews: ReviewReducer,
    notifications: NotificationReducer,
  },
});

export default store;
