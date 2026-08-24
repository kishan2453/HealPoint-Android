package com.healpoint.app.data.remote

import com.healpoint.app.data.remote.dto.AvailableSlotsResponse
import com.healpoint.app.data.remote.dto.BookAppointmentRequest
import com.healpoint.app.data.remote.dto.BookAppointmentResponse
import com.healpoint.app.data.remote.dto.CreateReviewRequest
import com.healpoint.app.data.remote.dto.CreateReviewResponse
import com.healpoint.app.data.remote.dto.DoctorDetailResponse
import com.healpoint.app.data.remote.dto.DoctorListResponse
import com.healpoint.app.data.remote.dto.FavoriteMutationResponse
import com.healpoint.app.data.remote.dto.FavoritesResponse
import com.healpoint.app.data.remote.dto.HospitalDetailResponse
import com.healpoint.app.data.remote.dto.HospitalListResponse
import com.healpoint.app.data.remote.dto.LoginRequest
import com.healpoint.app.data.remote.dto.LoginResponse
import com.healpoint.app.data.remote.dto.NotificationsResponse
import com.healpoint.app.data.remote.dto.ProfileResponse
import com.healpoint.app.data.remote.dto.PublicReviewsResponse
import com.healpoint.app.data.remote.dto.RegisterRequest
import com.healpoint.app.data.remote.dto.RegisterResponse
import com.healpoint.app.data.remote.dto.RescheduleRequest
import com.healpoint.app.data.remote.dto.RescheduleResponse
import com.healpoint.app.data.remote.dto.ResetPasswordRequest
import com.healpoint.app.data.remote.dto.SettingsResponse
import com.healpoint.app.data.remote.dto.SimpleResponse
import com.healpoint.app.data.remote.dto.UpdatePasswordRequest
import com.healpoint.app.data.remote.dto.UserAppointmentsResponse
import com.healpoint.app.data.remote.dto.AppointmentDetailsResponse
import com.healpoint.app.data.remote.dto.ValidateSlotRequest
import com.healpoint.app.data.remote.dto.ValidateSlotResponse
import com.healpoint.app.data.remote.dto.VerifyOtpResponse
import okhttp3.RequestBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit descriptions of every backend endpoint used by the patient client.
 * All paths are relative to the base URL, which ends with `/api/v1`.
 */
interface ApiService {

    // ------------------------------------------------------------------- Auth
    @POST("user/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("user/register")
    suspend fun register(@Body body: RegisterRequest): RegisterResponse

    @POST("user/forgot-password")
    suspend fun forgotPassword(@Body body: Map<String, String>): SimpleResponse

    @POST("user/verify-otp")
    suspend fun verifyOtp(@Body body: Map<String, String>): VerifyOtpResponse

    @POST("user/reset-password")
    suspend fun resetPassword(@Body body: ResetPasswordRequest): SimpleResponse

    @POST("user/logout")
    suspend fun logout(): SimpleResponse

    @GET("user/get-login-user/{userId}")
    suspend fun getProfile(@Path("userId") userId: String): ProfileResponse

    @PATCH("user/update/{userId}")
    suspend fun updateProfile(@Path("userId") userId: String, @Body body: RequestBody): ProfileResponse

    @PATCH("user/update-password/{userId}")
    suspend fun updatePassword(@Path("userId") userId: String, @Body body: UpdatePasswordRequest): SimpleResponse

    @GET("user/favorites")
    suspend fun getFavorites(): FavoritesResponse

    @POST("user/favorites/{doctorId}")
    suspend fun addFavorite(@Path("doctorId") doctorId: String): FavoriteMutationResponse

    @DELETE("user/favorites/{doctorId}")
    suspend fun removeFavorite(@Path("doctorId") doctorId: String): FavoriteMutationResponse

    // ---------------------------------------------------------------- Doctors
    @GET("doctor/get-all")
    suspend fun getAllDoctors(
        @Query("search") search: String?,
        @Query("q") q: String?,
        @Query("hospitalId") hospitalId: String?,
        @Query("hospitalName") hospitalName: String?,
        @Query("doctorName") doctorName: String?,
        @Query("department") department: String?,
        @Query("specialization") specialization: String?,
        @Query("speciality") speciality: String?,
        @Query("language") language: String?,
        @Query("gender") gender: String?,
        @Query("availability") availability: Boolean?,
        @Query("onlineConsultation") onlineConsultation: Boolean?,
        @Query("offlineConsultation") offlineConsultation: Boolean?,
        @Query("location") location: String?,
        @Query("minExperience") minExperience: Int?,
        @Query("maxExperience") maxExperience: Int?,
        @Query("minFee") minFee: Int?,
        @Query("maxFee") maxFee: Int?,
        @Query("minRating") minRating: Double?,
        @Query("limit") limit: Int?,
    ): DoctorListResponse

    @GET("doctor/get-details/{id}")
    suspend fun getDoctorDetails(@Path("id") id: String): DoctorDetailResponse

    // --------------------------------------------------------------- Hospitals
    @GET("hospital/public/get-all")
    suspend fun getPublicHospitals(): HospitalListResponse

    @GET("hospital/public/get-details/{idOrSlug}")
    suspend fun getPublicHospitalDetails(@Path("idOrSlug") idOrSlug: String): HospitalDetailResponse

    // ------------------------------------------------------------- Appointments
    @GET("appointment/get-available-slots/{doctorId}")
    suspend fun getAvailableSlots(
        @Path("doctorId") doctorId: String,
        @Query("date") date: String,
    ): AvailableSlotsResponse

    @POST("appointment/validate-slot/{doctorId}")
    suspend fun validateSlot(
        @Path("doctorId") doctorId: String,
        @Body body: ValidateSlotRequest,
    ): ValidateSlotResponse

    @POST("appointment/create")
    suspend fun bookAppointment(@Body body: BookAppointmentRequest): BookAppointmentResponse

    @GET("appointment/get-user-appointments/{userId}")
    suspend fun getUserAppointments(@Path("userId") userId: String): UserAppointmentsResponse

    @GET("appointment/get-user-appointment-details/{appointmentId}")
    suspend fun getUserAppointmentDetails(@Path("appointmentId") appointmentId: String): AppointmentDetailsResponse

    @POST("appointment/cancel/{appointmentId}")
    suspend fun cancelAppointment(@Path("appointmentId") appointmentId: String): SimpleResponse

    @PATCH("appointment/reschedule/{appointmentId}")
    suspend fun rescheduleAppointment(
        @Path("appointmentId") appointmentId: String,
        @Body body: RescheduleRequest,
    ): RescheduleResponse

    // ----------------------------------------------------------------- Reviews
    @POST("review/create")
    suspend fun createReview(@Body body: CreateReviewRequest): CreateReviewResponse

    @GET("review/public")
    suspend fun getPublicReviews(): PublicReviewsResponse

    // ----------------------------------------------------------- Notifications
    @GET("notification/get-all")
    suspend fun getNotifications(
        @Query("status") status: String?,
        @Query("type") type: String?,
        @Query("limit") limit: Int?,
    ): NotificationsResponse

    @PATCH("notification/read/{id}")
    suspend fun updateNotificationRead(
        @Path("id") id: String,
        @Body body: Map<String, Boolean>,
    ): NotificationsResponse

    @PATCH("notification/mark-all")
    suspend fun markAllNotificationsRead(@Body body: Map<String, Boolean>): NotificationsResponse

    @DELETE("notification/delete/{id}")
    suspend fun deleteNotification(@Path("id") id: String): NotificationsResponse

    // ---------------------------------------------------------------- Settings
    @GET("settings/public")
    suspend fun getPublicSettings(): SettingsResponse
}
