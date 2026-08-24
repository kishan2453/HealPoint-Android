package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.remote.dto.AppointmentDetailsDto
import com.healpoint.app.data.repositories.AppointmentRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AppointmentDetailUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val details: AppointmentDetailsDto? = null,
    val actionBusy: Boolean = false,
    val actionMessage: String? = null,
)

/** Single appointment details + cancel action. */
class AppointmentDetailViewModel(private val repo: AppointmentRepository) : ViewModel() {

    private val _state = MutableStateFlow(AppointmentDetailUiState())
    val state = _state.asStateFlow()

    fun load(appointmentId: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            when (val result = repo.getAppointmentDetails(appointmentId)) {
                is AppResult.Success -> _state.update { it.copy(isLoading = false, details = result.data) }
                is AppResult.Failure -> _state.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun cancel(appointmentId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            _state.update { it.copy(actionBusy = true, actionMessage = null) }
            when (val result = repo.cancelAppointment(appointmentId)) {
                is AppResult.Success -> {
                    _state.update { it.copy(actionBusy = false, actionMessage = result.data) }
                    load(appointmentId)
                    onDone()
                }
                is AppResult.Failure -> {
                    _state.update { it.copy(actionBusy = false, actionMessage = result.error.message) }
                }
            }
        }
    }

    fun clearActionMessage() {
        _state.update { it.copy(actionMessage = null) }
    }
}