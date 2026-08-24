package com.healpoint.app.data.remote.dto

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName

/**
 * Entity DTOs (part 2/5 - doctor catalog).
 */

data class ClinicInfoDto(
    @SerializedName("name") val name: String? = null,
    @SerializedName("address") val address: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("email") val email: String? = null,
    @SerializedName("roomNo") val roomNo: String? = null,
)

data class TimelineDto(
    @SerializedName("title") val title: String? = null,
    @SerializedName("institute") val institute: String? = null,
    @SerializedName("hospital") val hospital: String? = null,
    @SerializedName("year") val year: String? = null,
    @SerializedName("startYear") val startYear: String? = null,
    @SerializedName("endYear") val endYear: String? = null,
    @SerializedName("description") val description: String? = null,
)

data class DoctorTimeSlotDto(
    @SerializedName("date") val date: String? = null,
    @SerializedName("startTime") val startTime: String? = null,
    @SerializedName("endTime") val endTime: String? = null,
    @SerializedName("isAvailable") val isAvailable: Boolean? = null,
)

data class WeeklyScheduleDto(
    @SerializedName("day") val day: String? = null,
    @SerializedName("enabled") val enabled: Boolean? = null,
    @SerializedName("startTime") val startTime: String? = null,
    @SerializedName("endTime") val endTime: String? = null,
)

data class DoctorDto(
    @SerializedName("_id") val id: String? = null,
    val name: String? = null,
    val about: String? = null,
    val degree: String? = null,
    val speciality: String? = null,
    val department: String? = null,
    val specialization: String? = null,
    val rating: Number? = null,
    @SerializedName("reviewCount") val reviewCount: Number? = null,
    val experience: Number? = null,
    val fees: Number? = null,
    val email: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val image: String? = null,
    @SerializedName("coverBanner") val coverBanner: String? = null,
    @SerializedName("hdProfilePicture") val hdProfilePicture: String? = null,
    @SerializedName("hospitalId") val hospitalId: JsonElement? = null,
    @SerializedName("hospitalName") val hospitalName: String? = null,
    @SerializedName("clinicInfo") val clinicInfo: ClinicInfoDto? = null,
    val available: Boolean? = null,
    @SerializedName("onlineStatus") val onlineStatus: String? = null,
    @SerializedName("isActive") val isActive: Boolean? = null,
    val languages: List<String>? = null,
    val gender: String? = null,
    @SerializedName("consultationTypes") val consultationTypes: List<String>? = null,
    @SerializedName("verificationStatus") val verificationStatus: String? = null,
    val awards: List<String>? = null,
    val achievements: List<String>? = null,
    @SerializedName("educationTimeline") val educationTimeline: List<TimelineDto>? = null,
    @SerializedName("experienceTimeline") val experienceTimeline: List<TimelineDto>? = null,
    @SerializedName("timeSlots") val timeSlots: List<DoctorTimeSlotDto>? = null,
    @SerializedName("weeklySchedule") val weeklySchedule: List<WeeklyScheduleDto>? = null,
    val reviews: List<ReviewDto>? = null,
    @SerializedName("patientFeedback") val patientFeedback: List<ReviewDto>? = null,
    @SerializedName("slotDurationMinutes") val slotDurationMinutes: Number? = null,
)
