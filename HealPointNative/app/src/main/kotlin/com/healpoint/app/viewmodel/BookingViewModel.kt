package com.healpoint.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.remote.dto.BookAppointmentResponse
import com.healpoint.app.data.remote.dto.DoctorDto
import com.healpoint.app.data.repositories.AppointmentRepository
import com.healpoint.app.data.repositories.DoctorRepository
import com.healpoint.app.util.toDDMMYYYY
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

data class BookingUiState(
    val doctor: DoctorDto? = null,
    val isLoadingDoctor: Boolean = false,
    val doctorError: String? = null,
    val days: List<LocalDate> = emptyList(),
    val selectedDate: LocalDate? = null,
    val availableSlots: List<String> = emptyList(),
    val slotsLoading: Boolean = false,
    val slotsError: String? = null,
    val selectedSlot: String? = null,
    val consultationType: String = "clinic",
    val booking: Boolean = false,
    val bookingError: String? = null,
    val bookedResponse: BookAppointmentResponse? = null,
)

/** Book-appointment flow: doctor -> date -> slot -> consultation type -> book. */
class BookingViewModel(
    private val doctorRepo: DoctorRepository,
    private val appointmentRepo: AppointmentRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(BookingUiState())
    val state = _state.asStateFlow()

    fun load(doctorId: String) {
        val today = LocalDate.now()
        val days = (0..6).map { today.plusDays(it.toLong()) }
        _state.update { it.copy(days = days, selectedDate = today) }

        viewModelScope.launch {
            _state.update { it.copy(isLoadingDoctor = true, doctorError = null) }
            when (val result = doctorRepo.getDoctorDetails(doctorId)) {
                is AppResult.Success -> {
                    val types = result.data.consultationTypes.orEmpty()
                    val defaultType = if (types.isNotEmpty() && !types.contains("clinic")) "video" else "clinic"
                    _state.update { it.copy(doctor = result.data, isLoadingDoctor = false, consultationType = defaultType) }
                    loadSlots(doctorId, today)
                }
                is AppResult.Failure -> _state.update { it.copy(isLoadingDoctor = false, doctorError = result.error.message) }
            }
        }
    }

    fun selectDate(doctorId: String, date: LocalDate) {
        _state.update { it.copy(selectedDate = date, selectedSlot = null, availableSlots = emptyList()) }
        loadSlots(doctorId, date)
    }

    fun selectSlot(slot: String) {
        _state.update { it.copy(selectedSlot = slot) }
    }

    fun selectConsultationType(type: String) {
        _state.update { it.copy(consultationType = type) }
    }

    fun book(doctorId: String) {
        val ui = _state.value
        val slotDate = ui.selectedDate ?: return
        val slotTime = ui.selectedSlot ?: return
        viewModelScope.launch {
            _state.update { it.copy(booking = true, bookingError = null) }
            when (val result = appointmentRepo.bookAppointment(doctorId, slotDate.toDDMMYYYY(), slotTime, ui.consultationType, "cash")) {
                is AppResult.Success -> _state.update { it.copy(booking = false, bookedResponse = result.data) }
                is AppResult.Failure -> _state.update { it.copy(booking = false, bookingError = result.error.message) }
            }
        }
    }

    private fun loadSlots(doctorId: String, date: LocalDate) {
        viewModelScope.launch {
            _state.update { it.copy(slotsLoading = true, slotsError = null) }
            when (val result = appointmentRepo.getAvailableSlots(doctorId, date.toDDMMYYYY())) {
                is AppResult.Success -> _state.update { ui ->
                    ui.copy(
                        slotsLoading = false,
                        availableSlots = result.data,
                        selectedSlot = if (ui.selectedSlot in result.data) ui.selectedSlot else null,
                    )
                }
                is AppResult.Failure -> _state.update { it.copy(slotsLoading = false, slotsError = result.error.message) }
            }
        }
    }
}