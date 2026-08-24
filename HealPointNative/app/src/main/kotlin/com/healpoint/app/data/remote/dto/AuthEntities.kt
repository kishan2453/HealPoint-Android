package com.healpoint.app.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Entity DTOs (part 1/5 - auth). Field names match the backend responses
 * exactly (the server is the source of truth). All fields are nullable
 * because the backend frequently omits optional fields.
 */

data class UserDto(
    @SerializedName("_id") val id: String? = null,
    val name: String? = null,
    val email: String? = null,
    val image: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val role: String? = null,
    @SerializedName("isAdmin") val isAdmin: Boolean? = null,
    @SerializedName("isActive") val isActive: Boolean? = null,
    @SerializedName("authProvider") val authProvider: String? = null,
    val favorites: List<FavoriteDoctorDto>? = null,
    @SerializedName("appointmentStats") val appointmentStats: AppointmentStatsDto? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
)

data class AppointmentStatsDto(
    @SerializedName("totalBookings") val totalBookings: Int? = null,
    @SerializedName("cancelledBookings") val cancelledBookings: Int? = null,
    @SerializedName("completedBookings") val completedBookings: Int? = null,
    @SerializedName("missedAppointments") val missedAppointments: Int? = null,
)

data class FavoriteDoctorDto(
    @SerializedName("doctorId") val doctorId: String? = null,
    @SerializedName("addedAt") val addedAt: String? = null,
)
