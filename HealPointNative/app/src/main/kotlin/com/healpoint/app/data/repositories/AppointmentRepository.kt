package com.healpoint.app.data.repositories

import com.healpoint.app.data.ApiError
import com.healpoint.app.data.ApiErrorCategory
import com.healpoint.app.data.AppResult
import com.healpoint.app.data.SessionManager
import com.healpoint.app.data.exceptionToError
import com.healpoint.app.data.remote.ApiService
import com.healpoint.app.data.remote.dto.AppointmentDetailsDto
import com.healpoint.app.data.remote.dto.AppointmentDto
import com.healpoint.app.data.remote.dto.BookAppointmentRequest
import com.healpoint.app.data.remote.dto.BookAppointmentResponse
import com.healpoint.app.data.remote.dto.RescheduleRequest

/** Appointment repository. Booking, listing, details, cancel and reschedule. */
class AppointmentRepository(
    private val api: ApiService,
    private val session: SessionManager,
) {

    suspend fun getAvailableSlots(doctorId: String, date: String): AppResult<List<String>> {
        return try {
            val res = api.getAvailableSlots(doctorId, date)
            AppResult.Success(res.availableSlots ?: emptyList())
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun bookAppointment(
        doctorId: String,
        slotDate: String,
        slotTime: String,
        consultationType: String,
        paymentMethod: String = "cash",
    ): AppResult<BookAppointmentResponse> {
        return try {
            val res = api.bookAppointment(
                BookAppointmentRequest(
                    doctorId = doctorId,
                    slotDate = slotDate,
                    slotTime = slotTime,
                    paymentMethod = paymentMethod,
                    consultationType = consultationType,
                )
            )
            AppResult.Success(res)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun getUserAppointments(): AppResult<List<AppointmentDto>> {
        val userId = session.userId()
        if (userId.isNullOrBlank()) return AppResult.Success(emptyList())
        return try {
            val res = api.getUserAppointments(userId)
            AppResult.Success(res.appointments ?: emptyList())
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun getAppointmentDetails(appointmentId: String): AppResult<AppointmentDetailsDto> {
        return try {
            val res = api.getUserAppointmentDetails(appointmentId)
            val details = res.appointmentDetails
                ?: return AppResult.Failure(ApiError("Appointment not found.", ApiErrorCategory.NOT_FOUND))
            AppResult.Success(details)
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun cancelAppointment(appointmentId: String): AppResult<String> {
        return try {
            val res = api.cancelAppointment(appointmentId)
            AppResult.Success(res.message ?: "Appointment cancelled.")
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }

    suspend fun rescheduleAppointment(appointmentId: String, slotDate: String, slotTime: String): AppResult<String> {
        return try {
            val res = api.rescheduleAppointment(appointmentId, RescheduleRequest(slotDate = slotDate, slotTime = slotTime, reason = null))
            AppResult.Success(res.message ?: "Appointment rescheduled.")
        } catch (e: Throwable) {
            AppResult.Failure(exceptionToError(e))
        }
    }
}
