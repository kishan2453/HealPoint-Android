package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.remote.dto.AppointmentDto
import com.healpoint.app.data.repositories.AppointmentRepository
import com.healpoint.app.util.toDDMMYYYY
import com.google.gson.JsonObject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

data class RescheduleUiState(
    val current: AppointmentDto? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val days: List<LocalDate> = emptyList(),
    val selectedDate: LocalDate? = null,
    val availableSlots: List<String> = emptyList(),
    val slotsLoading: Boolean = false,
    val slotsError: String? = null,
    val selectedSlot: String? = null,
    val submitting: Boolean = false,
    val message: String? = null,
)

/**
 * Reschedule flow. Mirrors the RN screen: the doctorId is resolved from the raw
 * user-appointments list (the details endpoint does not expose it), then the
 * real slot API is used for the selected date.
 */
class RescheduleViewModel(private val repo: AppointmentRepository) : ViewModel() {

    private val _state = MutableStateFlow(RescheduleUiState())
    val state = _state.asStateFlow()

    fun load(appointmentId: String) {
        val today = LocalDate.now()
        val days = (0..6).map { today.plusDays(it.toLong()) }
        _state.update { it.copy(days = days, selectedDate = today) }

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            when (val result = repo.getUserAppointments()) {
                is AppResult.Success -> {
                    val record = result.data.firstOrNull { it.id == appointmentId }
                    if (record == null) {
                        _state.update { it.copy(isLoading = false, error = "Appointment not found.") }
                        return@launch
                    }
                    _state.update { it.copy(current = record, isLoading = false) }
                    val doctorId = doctorIdFrom(record)
                    if (!doctorId.isNullOrBlank()) {
                        loadSlots(doctorId, today)
                    }
                }
                is AppResult.Failure -> _state.update { it.copy(isLoading = false, error = result.error.message) }
            }
        }
    }

    fun selectDate(appointmentId: String, date: LocalDate) {
        val doctorId = doctorIdFrom(_state.value.current)
        _state.update { it.copy(selectedDate = date, selectedSlot = null, availableSlots = emptyList()) }
        if (!doctorId.isNullOrBlank()) {
            loadSlots(doctorId, date)
        }
    }

    fun selectSlot(slot: String) {
        _state.update { it.copy(selectedSlot = slot) }
    }

    fun reschedule(appointmentId: String, onDone: () -> Unit = {}) {
        val ui = _state.value
        val slotDate = ui.selectedDate ?: return
        val slotTime = ui.selectedSlot ?: return
        viewModelScope.launch {
            _state.update { it.copy(submitting = true, message = null) }
            when (val result = repo.rescheduleAppointment(appointmentId, slotDate.toDDMMYYYY(), slotTime)) {
                is AppResult.Success -> {
                    _state.update { it.copy(submitting = false, message = result.data) }
                    onDone()
                }
                is AppResult.Failure -> _state.update { it.copy(submitting = false, message = result.error.message) }
            }
        }
    }

    private fun loadSlots(doctorId: String, date: LocalDate) {
        viewModelScope.launch {
            _state.update { it.copy(slotsLoading = true, slotsError = null) }
            when (val result = repo.getAvailableSlots(doctorId, date.toDDMMYYYY())) {
                is AppResult.Success -> _state.update { ui ->
                    ui.copy(
                        slotsLoading = false,
                        availableSlots = result.data,
                        selectedSlot = if (result.data.isNotEmpty() && ui.selectedSlot !in result.data) result.data.first() else ui.selectedSlot,
                    )
                }
                is AppResult.Failure -> _state.update { it.copy(slotsLoading = false, slotsError = result.error.message) }
            }
        }
    }

    private fun doctorIdFrom(appointment: AppointmentDto?): String? {
        val doctor = appointment?.doctorId as? JsonObject ?: return null
        return doctor.get("_id")?.takeIf { it.isJsonPrimitive }?.asString
    }
}