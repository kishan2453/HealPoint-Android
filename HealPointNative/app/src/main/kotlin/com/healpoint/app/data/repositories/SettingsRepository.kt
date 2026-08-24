package com.healpoint.app.data.repositories

import com.healpoint.app.data.AppResult
import com.healpoint.app.data.exceptionToError
import com.healpoint.app.data.remote.ApiService

/** Platform settings repository (public endpoint). */
class SettingsRepository(private val api: ApiService) {

    suspend fun getPublicSettings(): AppResult<String?> {
        return try {
            val res = api.getPublicSettings()
            AppResult.Success(res.guideVideoUrl)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }
}
