package com.healpoint.app.data.remote.dto

import com.google.gson.annotations.SerializedName

/**
 * Entity DTOs (part 3/5 - hospital catalog).
 */

data class HospitalLocationDto(
    @SerializedName("address") val address: String? = null,
    @SerializedName("city") val city: String? = null,
    @SerializedName("state") val state: String? = null,
    @SerializedName("pincode") val pincode: String? = null,
    @SerializedName("mapsUrl") val mapsUrl: String? = null,
)

data class HospitalContactDto(
    @SerializedName("emergency") val emergency: String? = null,
    @SerializedName("reception") val reception: String? = null,
    @SerializedName("email") val email: String? = null,
    @SerializedName("website") val website: String? = null,
)

data class HospitalFacilitiesDto(
    @SerializedName("ambulance") val ambulance: Boolean? = null,
    @SerializedName("icu") val icu: Boolean? = null,
    @SerializedName("operationTheatre") val operationTheatre: Boolean? = null,
    @SerializedName("facilities") val facilities: List<String>? = null,
)

data class HospitalDto(
    @SerializedName("_id") val id: String? = null,
    val name: String? = null,
    val slug: String? = null,
    val logo: String? = null,
    @SerializedName("coverImage") val coverImage: String? = null,
    val about: String? = null,
    val location: HospitalLocationDto? = null,
    val contact: HospitalContactDto? = null,
    val departments: List<String>? = null,
    val services: List<String>? = null,
    val gallery: List<String>? = null,
    @SerializedName("hospitalImages") val hospitalImages: List<String>? = null,
    val beds: Number? = null,
    @SerializedName("icuBeds") val icuBeds: Number? = null,
    @SerializedName("emergencyFacility") val emergencyFacility: Boolean? = null,
    @SerializedName("opdTimings") val opdTimings: String? = null,
    val rating: Number? = null,
    @SerializedName("reviewCount") val reviewCount: Number? = null,
    @SerializedName("isActive") val isActive: Boolean? = null,
    val doctors: List<DoctorDto>? = null,
    @SerializedName("doctorCount") val doctorCount: Number? = null,
    @SerializedName("availableDoctorCount") val availableDoctorCount: Number? = null,
    @SerializedName("consultationFee") val consultationFee: Number? = null,
    val icu: Boolean? = null,
    val specializations: List<String>? = null,
    @SerializedName("facilitiesInfo") val facilitiesInfo: HospitalFacilitiesDto? = null,
)
