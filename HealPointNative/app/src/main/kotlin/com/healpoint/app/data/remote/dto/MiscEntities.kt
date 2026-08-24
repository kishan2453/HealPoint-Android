package com.healpoint.app.data.remote.dto

import com.google.gson.JsonElement
import com.google.gson.annotations.SerializedName

/**
 * Entity DTOs (part 5/5 - notifications & reviews).
 */

data class NotificationDto(
    @SerializedName("_id") val id: String? = null,
    val type: String? = null,
    val title: String? = null,
    val message: String? = null,
    @SerializedName("isRead") val isRead: Boolean? = null,
    val priority: String? = null,
    val link: String? = null,
    @SerializedName("actorName") val actorName: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
)

data class ReviewDto(
    @SerializedName("_id") val id: String? = null,
    @SerializedName("patientId") val patientId: JsonElement? = null,
    @SerializedName("doctorId") val doctorId: JsonElement? = null,
    @SerializedName("doctorName") val doctorName: String? = null,
    val name: String? = null,
    val email: String? = null,
    val rating: Number? = null,
    val title: String? = null,
    val comment: String? = null,
    val avatar: String? = null,
    @SerializedName("isApproved") val isApproved: Boolean? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
)
