package com.healpoint.app.data.remote.dto

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName

/**
 * Request and response envelope DTOs. These mirror the exact JSON shapes the
 * backend returns - including the intentionally misspelled `appoinmtent` key
 * on the user-appointments endpoint.
 */

// ---- Auth requests ----
data class LoginRequest(val email: String, val password: String)

data class RegisterRequest(val name: String, val email: String, val password: String)

data class ResetPasswordRequest(
    @SerializedName("resetToken") val resetToken: String,
    @SerializedName("newPassword") val newPassword: String,
)

data class UpdatePasswordRequest(
    @SerializedName("oldPassword") val oldPassword: String,
    @SerializedName("newPassword") val newPassword: String,
)

// ---- Auth responses ----
data class LoginResponse(
    val success: Boolean = false,
    val message: String? = null,
    val token: String? = null,
    val user: UserDto? = null,
    @SerializedName("sessionId") val sessionId: String? = null,
)

data class RegisterResponse(
    val success: Boolean = false,
    val message: String? = null,
    val user: UserDto? = null,
)

data class SimpleResponse(
    val success: Boolean = false,
    val message: String? = null,
)

data class ProfileResponse(
    val success: Boolean = false,
    val user: UserDto? = null,
)

data class VerifyOtpResponse(
    val success: Boolean = false,
    val message: String? = null,
    @SerializedName("resetToken") val resetToken: String? = null,
)

data class FavoritesResponse(
    val success: Boolean = false,
    val favorites: List<FavoriteDoctorDto>? = null,
    @SerializedName("totalCount") val totalCount: Int? = null,
)

data class FavoriteMutationResponse(
    val success: Boolean = false,
    @SerializedName("isFavorite") val isFavorite: Boolean? = null,
    @SerializedName("doctorId") val doctorId: String? = null,
)

// ---- Doctor catalog ----
data class DoctorListResponse(
    val success: Boolean = false,
    @SerializedName("totalCount") val totalCount: Int? = null,
    val doctors: List<DoctorDto>? = null,
)

data class DoctorDetailResponse(
    val success: Boolean = false,
    val message: String? = null,
    val doctor: DoctorDto? = null,
)

// ---- Hospital catalog ----
data class HospitalListResponse(
    val success: Boolean = false,
    @SerializedName("totalCount") val totalCount: Int? = null,
    val hospitals: List<HospitalDto>? = null,
)

data class HospitalDetailResponse(
    val success: Boolean = false,
    val message: String? = null,
    val hospital: HospitalDto? = null,
)

// ---- Appointments ----
data class AvailableSlotsResponse(
    val success: Boolean = false,
    @SerializedName("doctorId") val doctorId: String? = null,
    @SerializedName("slotDate") val slotDate: String? = null,
    @SerializedName("availableSlots") val availableSlots: List<String>? = null,
    @SerializedName("totalSlots") val totalSlots: Int? = null,
)

data class BookAppointmentRequest(
    @SerializedName("doctorId") val doctorId: String,
    @SerializedName("slotDate") val slotDate: String,
    @SerializedName("slotTime") val slotTime: String,
    @SerializedName("paymentMethod") val paymentMethod: String? = "cash",
    @SerializedName("consultationType") val consultationType: String? = "clinic",
)

data class BookAppointmentResponse(
    val success: Boolean = false,
    val message: String? = null,
    val appointment: AppointmentDto? = null,
    @SerializedName("razorpayOrder") val razorpayOrder: JsonElement? = null,
    @SerializedName("razorpayKey") val razorpayKey: String? = null,
)

data class UserAppointmentsResponse(
    val success: Boolean = false,
    val message: String? = null,
    @SerializedName("totalCount") val totalCount: Int? = null,
    // The backend key is intentionally the misspelled `appoinmtent`.
    @SerializedName("appoinmtent") val appointments: List<AppointmentDto>? = null,
)

data class AppointmentDetailsResponse(
    val success: Boolean = false,
    val message: String? = null,
    @SerializedName("appointmentDetails") val appointmentDetails: AppointmentDetailsDto? = null,
)

data class ValidateSlotRequest(
    @SerializedName("slotDate") val slotDate: String,
    @SerializedName("slotTime") val slotTime: String,
)

data class ValidateSlotResponse(
    val success: Boolean = false,
    val available: Boolean? = null,
    val message: String? = null,
)

data class RescheduleRequest(
    @SerializedName("slotDate") val slotDate: String,
    @SerializedName("slotTime") val slotTime: String,
    val reason: String? = null,
)

data class RescheduleResponse(
    val success: Boolean = false,
    val message: String? = null,
    val appointment: JsonElement? = null,
)

// ---- Reviews ----
data class CreateReviewRequest(
    @SerializedName("doctorId") val doctorId: String,
    val name: String? = null,
    val email: String? = null,
    val rating: Int,
    val title: String? = null,
    val comment: String,
    val avatar: String? = null,
)

data class CreateReviewResponse(
    val success: Boolean = false,
    val message: String? = null,
    val review: ReviewDto? = null,
)

data class PublicReviewsResponse(
    val success: Boolean = false,
    val reviews: List<ReviewDto>? = null,
)

// ---- Notifications ----
data class NotificationsResponse(
    val success: Boolean = false,
    val message: String? = null,
    val notifications: List<NotificationDto>? = null,
    @SerializedName("unreadCount") val unreadCount: Int? = null,
    @SerializedName("totalCount") val totalCount: Int? = null,
)

// ---- Settings ----
data class SettingsResponse(
    val success: Boolean = false,
    @SerializedName("guideVideoUrl") val guideVideoUrl: String? = null,
)