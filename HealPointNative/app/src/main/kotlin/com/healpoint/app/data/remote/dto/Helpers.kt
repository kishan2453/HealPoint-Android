package com.healpoint.app.data.remote.dto

import com.google.gson.JsonObject

/** Safe accessors over the nullable backend DTOs used across the UI. */

fun UserDto.safeName(): String = name?.takeIf { it.isNotBlank() } ?: "Patient"
fun UserDto.requiredId(): String = id.orEmpty()

fun DoctorDto.displaySpeciality(): String =
    speciality?.takeIf { it.isNotBlank() }
        ?: specialization?.takeIf { it.isNotBlank() }
        ?: department?.takeIf { it.isNotBlank() }
        ?: "General physician"

fun DoctorDto.displayHospitalName(): String {
    val hospital = hospitalId as? JsonObject
    hospital?.get("name")?.takeIf { it.isJsonPrimitive }?.let { el ->
        val name = el.asString
        if (name.isNotBlank()) return name
    }
    return hospitalName?.takeIf { it.isNotBlank() }
        ?: clinicInfo?.name?.takeIf { it.isNotBlank() }
        ?: "Hospital details pending"
}

fun DoctorDto.displayRating(): Float = rating?.toFloat() ?: 0f
fun DoctorDto.displayReviewCount(): Int = reviewCount?.toInt() ?: 0
fun DoctorDto.displayExperience(): Int = experience?.toInt() ?: 0
fun DoctorDto.displayFees(): Int = fees?.toInt() ?: 0
fun DoctorDto.isAvailableDoctor(): Boolean = available == true
fun DoctorDto.isVerified(): Boolean = verificationStatus.equals("Verified", ignoreCase = true)
fun DoctorDto.supportsVideo(): Boolean = consultationTypes?.contains("video") == true
fun DoctorDto.profileImage(): String? = hdProfilePicture ?: image

fun AppointmentDto.doctorName(): String {
    val doctor = doctorId as? JsonObject
    doctor?.get("name")?.takeIf { it.isJsonPrimitive }?.let { el ->
        val name = el.asString
        if (name.isNotBlank()) return name
    }
    return "Doctor"
}

fun AppointmentDto.hospitalDisplayName(): String =
    hospitalName?.takeIf { it.isNotBlank() } ?: "Hospital"

fun AppointmentDto.amountValue(): Int = amount?.toInt() ?: 0

fun HospitalDto.displayAddress(): String {
    val loc = location
    return listOf(loc?.address, loc?.city, loc?.state)
        .filter { !it.isNullOrBlank() }
        .joinToString(", ")
        .ifBlank { "Address pending" }
}

fun HospitalDto.displayRating(): Float = rating?.toFloat() ?: 0f
fun HospitalDto.displayDoctorCount(): Int = doctorCount?.toInt() ?: 0
fun HospitalDto.displayDepartmentCount(): Int = departments?.size ?: 0
fun HospitalDto.displayBedCount(): Int = beds?.toInt() ?: 0
fun HospitalDto.coverImageUrl(): String? = coverImage ?: logo

fun AppointmentDetailsDto.amountValue(): Int = amount?.toInt() ?: 0

fun ReviewDto.reviewerName(): String =
    name?.takeIf { it.isNotBlank() }
        ?: (patientId as? JsonObject)?.get("name")?.takeIf { it.isJsonPrimitive }?.asString
        ?: "Anonymous"

fun ReviewDto.ratingValue(): Float = rating?.toFloat() ?: 0f
