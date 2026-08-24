package com.healpoint.app.data.repositories

import com.healpoint.app.data.ApiError
import com.healpoint.app.data.ApiErrorCategory
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.exceptionToError
import com.healpoint.app.data.remote.ApiService
import com.healpoint.app.data.remote.dto.HospitalDto

/** Hospital catalog repository (public endpoints - no auth required). */
class HospitalRepository(private val api: ApiService) {

    suspend fun getPublicHospitals(): AppResult<List<HospitalDto>> {
        return try {
            val res = api.getPublicHospitals()
            AppResult.Success(res.hospitals ?: emptyList())
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun getHospitalDetails(idOrSlug: String): AppResult<HospitalDto> {
        return try {
            val res = api.getPublicHospitalDetails(idOrSlug)
            val hospital = res.hospital
                ?: return AppResult.Failure(ApiError("Hospital not found.", ApiErrorCategory.NOT_FOUND))
            AppResult.Success(hospital)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }
}
