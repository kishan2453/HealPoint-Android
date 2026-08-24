package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.remote.dto.AppointmentDto
import com.healpoint.app.data.repositories.AppointmentRepository
import com.healpoint.app.util.parseDDMMYYYY
import com.healpoint.app.util.toDDMMYYYY
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

data class AppointmentsUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val all: List<AppointmentDto> = emptyList(),
)

/**
 * Patient appointments. Mirrors the RN hook: the backend key is the misspelled
 * `appoinmtent` and buckets are derived from `status` + `slotDate`.
 */
class AppointmentsViewModel(private val repo: AppointmentRepository) : ViewModel() {

    private val _state = MutableStateFlow(AppointmentsUiState())
    val state = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            when (val result = repo.getUserAppointments()) {
                is AppResult.Success -> _state.update { it.copy(isLoading = false, all = result.data) }
                is AppResult.Failure -> _state.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    private val upcomingStatuses = setOf("pending", "confirmed", "rescheduled")
    private val todayKey: String get() = LocalDate.now().toDDMMYYYY()

    val today: List<AppointmentDto>
        get() = _state.value.all
            .filter { it.slotDate == todayKey }
            .sortedBy { it.slotTime.orEmpty() }

    val upcoming: List<AppointmentDto>
        get() = _state.value.all
            .filter { it.status in upcomingStatuses && it.slotDate != todayKey }
            .sortedBy { parseDDMMYYYY(it.slotDate)?.toEpochDay() ?: Long.MAX_VALUE }

    val completed: List<AppointmentDto>
        get() = _state.value.all
            .filter { it.status == "completed" }
            .sortedByDescending { parseDDMMYYYY(it.slotDate)?.toEpochDay() ?: 0L }

    val cancelled: List<AppointmentDto>
        get() = _state.value.all
            .filter { it.status == "cancel" || it.status == "missed" }
            .sortedByDescending { parseDDMMYYYY(it.slotDate)?.toEpochDay() ?: 0L }

    fun nextAppointment(): AppointmentDto? = upcoming.firstOrNull()
}