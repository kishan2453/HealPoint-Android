package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.healpoint.app.di.AppContainer

/**
 * Creates every ViewModel from the app dependency container.
 * Used by the [appViewModel] composable helper.
 */
class AppViewModelFactory(private val container: AppContainer) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(AuthViewModel::class.java) ->
                AuthViewModel(container.authRepository, container.sessionManager)

            modelClass.isAssignableFrom(DoctorsViewModel::class.java) ->
                DoctorsViewModel(container.doctorRepository, container.authRepository)

            modelClass.isAssignableFrom(DoctorDetailViewModel::class.java) ->
                DoctorDetailViewModel(container.doctorRepository, container.authRepository)

            modelClass.isAssignableFrom(HospitalDetailViewModel::class.java) ->
                HospitalDetailViewModel(container.hospitalRepository)

            modelClass.isAssignableFrom(HospitalsViewModel::class.java) ->
                HospitalsViewModel(container.hospitalRepository)

            modelClass.isAssignableFrom(AppointmentsViewModel::class.java) ->
                AppointmentsViewModel(container.appointmentRepository)

            modelClass.isAssignableFrom(BookingViewModel::class.java) ->
                BookingViewModel(container.doctorRepository, container.appointmentRepository)

            modelClass.isAssignableFrom(AppointmentDetailViewModel::class.java) ->
                AppointmentDetailViewModel(container.appointmentRepository)

            modelClass.isAssignableFrom(RescheduleViewModel::class.java) ->
                RescheduleViewModel(container.appointmentRepository)

            modelClass.isAssignableFrom(ProfileViewModel::class.java) ->
                ProfileViewModel(container.authRepository, container.sessionManager)

            modelClass.isAssignableFrom(NotificationsViewModel::class.java) ->
                NotificationsViewModel(container.notificationRepository)

            modelClass.isAssignableFrom(SettingsViewModel::class.java) ->
                SettingsViewModel(container.settingsRepository)

            else -> throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        } as T
    }
}