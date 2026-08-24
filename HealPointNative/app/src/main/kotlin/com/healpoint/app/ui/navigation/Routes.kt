package com.healpoint.app.ui.navigation

/** Central route table for Navigation Compose. */
object Routes {
    const val SPLASH = "splash"
    const val WELCOME = "welcome"
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val FORGOT = "forgot"
    const val VERIFY_OTP = "verify-otp/{identifier}"
    const val RESET = "reset-password/{resetToken}"
    const val MAIN = "main"
    const val DOCTOR_DETAIL = "doctor/{doctorId}"
    const val HOSPITAL_DETAIL = "hospital/{hospitalId}"
    const val BOOKING = "booking/{doctorId}"
    const val APPOINTMENT_DETAIL = "appointment/{appointmentId}"
    const val RESCHEDULE = "reschedule/{appointmentId}"
    const val EDIT_PROFILE = "edit-profile"
    const val CHANGE_PASSWORD = "change-password"
    const val NOTIFICATIONS = "notifications"
    const val SETTINGS = "settings"

    fun verifyOtp(identifier: String) = "verify-otp/$identifier"
    fun reset(resetToken: String) = "reset-password/$resetToken"
    fun doctorDetail(id: String) = "doctor/$id"
    fun hospitalDetail(id: String) = "hospital/$id"
    fun booking(doctorId: String) = "booking/$doctorId"
    fun appointmentDetail(id: String) = "appointment/$id"
    fun reschedule(id: String) = "reschedule/$id"
}