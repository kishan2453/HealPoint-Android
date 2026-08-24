package com.healpoint.app.di

import android.content.Context
import com.healpoint.app.data.SessionManager
import com.healpoint.app.data.remote.ApiClient
import com.healpoint.app.data.remote.ApiService
import com.healpoint.app.data.repositories.AppointmentRepository
import com.healpoint.app.data.repositories.AuthRepository
import com.healpoint.app.data.repositories.DoctorRepository
import com.healpoint.app.data.repositories.HospitalRepository
import com.healpoint.app.data.repositories.NotificationRepository
import com.healpoint.app.data.repositories.ReviewRepository
import com.healpoint.app.data.repositories.SettingsRepository

/**
 * Simple manual dependency container. Constructed once in [com.healpoint.app.HealPointApp].
 */
class AppContainer(context: Context) {

    private val appContext = context.applicationContext

    val sessionManager: SessionManager = SessionManager(appContext)

    private val apiService: ApiService = ApiClient.create(sessionManager)

    val authRepository: AuthRepository = AuthRepository(apiService, sessionManager)
    val doctorRepository: DoctorRepository = DoctorRepository(apiService)
    val hospitalRepository: HospitalRepository = HospitalRepository(apiService)
    val appointmentRepository: AppointmentRepository = AppointmentRepository(apiService, sessionManager)
    val reviewRepository: ReviewRepository = ReviewRepository(apiService)
    val notificationRepository: NotificationRepository = NotificationRepository(apiService)
    val settingsRepository: SettingsRepository = SettingsRepository(apiService)
}
