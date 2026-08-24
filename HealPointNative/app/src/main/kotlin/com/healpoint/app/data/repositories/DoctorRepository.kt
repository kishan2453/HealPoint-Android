package com.healpoint.app.data.repositories

import com.healpoint.app.data.ApiError
import com.healpoint.app.data.ApiErrorCategory
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.exceptionToError
import com.healpoint.app.data.remote.ApiService
import com.healpoint.app.data.remote.dto.DoctorDto

/** Doctor catalog repository (public endpoints - no auth required). */
class DoctorRepository(private val api: ApiService) {

    suspend fun getDoctors(search: String? = null, department: String? = null, limit: Int? = null): AppResult<List<DoctorDto>> {
        return try {
            val res = api.getAllDoctors(
                search = search?.takeIf { it.isNotBlank() },
                q = null,
                hospitalId = null,
                hospitalName = null,
                doctorName = null,
                department = department?.takeIf { it.isNotBlank() },
                specialization = null,
                speciality = null,
                language = null,
                gender = null,
                availability = null,
                onlineConsultation = null,
                offlineConsultation = null,
                location = null,
                minExperience = null,
                maxExperience = null,
                minFee = null,
                maxFee = null,
                minRating = null,
                limit = limit,
            )
            AppResult.Success(res.doctors ?: emptyList())
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun getDoctorDetails(id: String): AppResult<DoctorDto> {
        return try {
            val res = api.getDoctorDetails(id)
            val doctor = res.doctor
                ?: return AppResult.Failure(ApiError("Doctor not found.", ApiErrorCategory.NOT_FOUND))
            AppResult.Success(doctor)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }
}
