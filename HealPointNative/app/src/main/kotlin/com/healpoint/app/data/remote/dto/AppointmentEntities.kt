package com.healpoint.app.data.remote.dto

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName

/**
 * Entity DTOs (part 4/5 - appointments).
 */

data class AppointmentDto(
    @SerializedName("_id") val id: String? = null,
    @SerializedName("appointmentId") val appointmentId: String? = null,
    @SerializedName("displayAppointmentId") val displayAppointmentId: String? = null,
    @SerializedName("userId") val userId: String? = null,
    @SerializedName("doctorId") val doctorId: JsonElement? = null,
    @SerializedName("hospitalId") val hospitalId: JsonElement? = null,
    @SerializedName("hospitalName") val hospitalName: String? = null,
    @SerializedName("slotDate") val slotDate: String? = null,
    @SerializedName("slotTime") val slotTime: String? = null,
    @SerializedName("patientPhone") val patientPhone: String? = null,
    val amount: Number? = null,
    @SerializedName("consultationType") val consultationType: String? = null,
    val status: String? = null,
    val payment: Boolean? = null,
    @SerializedName("paymentMethod") val paymentMethod: String? = null,
    @SerializedName("paymentStatus") val paymentStatus: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
)

data class AppointmentDetailsDto(
    @SerializedName("_id") val id: String? = null,
    @SerializedName("appointmentId") val appointmentId: String? = null,
    @SerializedName("mongoAppointmentId") val mongoAppointmentId: String? = null,
    @SerializedName("doctorName") val doctorName: String? = null,
    @SerializedName("hospitalId") val hospitalId: String? = null,
    @SerializedName("hospitalName") val hospitalName: String? = null,
    @SerializedName("doctorPhone") val doctorPhone: String? = null,
    @SerializedName("doctorEmail") val doctorEmail: String? = null,
    @SerializedName("doctorSignatureImage") val doctorSignatureImage: String? = null,
    @SerializedName("bookingDate") val bookingDate: String? = null,
    @SerializedName("bookingTime") val bookingTime: String? = null,
    val amount: Number? = null,
    @SerializedName("bookingStatus") val bookingStatus: String? = null,
    @SerializedName("bookingStatusLabel") val bookingStatusLabel: String? = null,
    @SerializedName("patientPhone") val patientPhone: String? = null,
    val payment: Boolean? = null,
    @SerializedName("paymentMethod") val paymentMethod: String? = null,
    @SerializedName("paymentStatus") val paymentStatus: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
)
