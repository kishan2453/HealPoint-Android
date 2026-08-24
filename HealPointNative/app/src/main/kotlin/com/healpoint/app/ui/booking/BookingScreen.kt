package com.healpoint.app.ui.booking

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.data.remote.dto.displayFees
import com.healpoint.app.data.remote.dto.displayHospitalName
import com.healpoint.app.data.remote.dto.displaySpeciality
import com.healpoint.app.data.remote.dto.profileImage
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.components.RemoteImage
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.ui.theme.Primary
import com.healpoint.app.ui.theme.SuccessGreen
import com.healpoint.app.util.dateLabel
import com.healpoint.app.util.weekdayLabel
import com.healpoint.app.viewmodel.BookingViewModel
import com.healpoint.app.viewmodel.BookingUiState
import java.time.LocalDate

/** Selectable day tile for the 7-day booking row. */
@Composable
private fun DayTile(date: LocalDate, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(14.dp),
        color = if (selected) Primary else MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, if (selected) Primary else MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
        ) {
            Text(weekdayLabel(date), style = MaterialTheme.typography.labelSmall, color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant)
            Text(date.dayOfMonth.toString(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface)
            Text(date.month.name.take(3), style = MaterialTheme.typography.labelSmall, color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Selectable time-slot chip. */
@Composable
private fun SlotChip(slot: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) Primary else MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, if (selected) Primary else MaterialTheme.colorScheme.outlineVariant),
    ) {
        Text(
            slot,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
        )
    }
}

/** Book-appointment flow: date -> slot -> consultation type -> confirm. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BookingScreen(doctorId: String, navController: NavHostController) {
    val vm: BookingViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()

    LaunchedEffect(doctorId) { vm.load(doctorId) }

    if (state.bookedResponse != null) {
        ConfirmedContent(state = state, navController = navController)
        return
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AppHeader("Book appointment", onBack = { navController.popBackStack() })

        val doctor = state.doctor
        when {
            state.isLoadingDoctor -> LoadingState("Loading doctor...", Modifier.fillMaxWidth().weight(1f))
            state.doctorError != null -> ErrorState(state.doctorError.orEmpty(), onRetry = { vm.load(doctorId) }, modifier = Modifier.fillMaxWidth().weight(1f))
            doctor == null -> LoadingState("Preparing booking...", Modifier.fillMaxWidth().weight(1f))
            else -> Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        RemoteImage(url = doctor.profileImage(), modifier = Modifier.size(56.dp).clip(RoundedCornerShape(12.dp)))
                        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                            Text(doctor.name ?: "Doctor", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Text(doctor.displaySpeciality(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                            Text(doctor.displayHospitalName(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                // Date selection (next 7 days)
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Select a date", style = MaterialTheme.typography.titleMedium)
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        state.days.forEach { day ->
                            DayTile(
                                date = day,
                                selected = state.selectedDate == day,
                                onClick = { vm.selectDate(doctorId, day) },
                            )
                        }
                    }
                }

                // Time slots
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Available time slots", style = MaterialTheme.typography.titleMedium)
                    when {
                        state.slotsLoading -> LoadingState(null, Modifier.fillMaxWidth())
                        state.slotsError != null -> Text(state.slotsError.orEmpty(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                        state.availableSlots.isEmpty() -> Text(
                            "No slots available for this date. Try another day.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        else -> FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            state.availableSlots.forEach { slot ->
                                SlotChip(slot = slot, selected = state.selectedSlot == slot, onClick = { vm.selectSlot(slot) })
                            }
                        }
                    }
                }

                // Consultation type
                val types = doctor.consultationTypes.orEmpty()
                if (types.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Consultation type", style = MaterialTheme.typography.titleMedium)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChip(selected = state.consultationType == "clinic", onClick = { vm.selectConsultationType("clinic") }, label = { Text("Clinic visit") })
                            FilterChip(
                                selected = state.consultationType == "video",
                                onClick = { vm.selectConsultationType("video") },
                                enabled = types.contains("video"),
                                label = { Text("Video consultation") },
                            )
                        }
                    }
                }

                // Booking summary + errors
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SummaryRow("Doctor", doctor.name ?: "Doctor")
                        SummaryRow("Date", state.selectedDate?.let { dateLabel(it) } ?: "-")
                        SummaryRow("Time", state.selectedSlot ?: "Not selected")
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, modifier = Modifier.padding(vertical = 8.dp))
                        SummaryRow("Consultation fee", com.healpoint.app.util.formatINR(doctor.displayFees()))
                    }
                }

                if (state.bookingError != null) {
                    Text(state.bookingError.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }

                HealPointButton(
                    text = "Confirm booking",
                    onClick = { vm.book(doctorId) },
                    loading = state.booking,
                    enabled = state.selectedSlot != null,
                )
            }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

/** Post-booking confirmation shown after a successful create. */
@Composable
private fun ConfirmedContent(state: BookingUiState, navController: NavHostController) {
    val booked = state.bookedResponse
    val doctor = state.doctor

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(
            modifier = Modifier.weight(1f).verticalScroll(androidx.compose.foundation.rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Icon(Icons.Filled.CheckCircle, contentDescription = null, modifier = Modifier.size(72.dp), tint = SuccessGreen)
            Text("Appointment booked!", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Text(
                "Your request has been submitted. You can view and manage it under My Appointments.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    SummaryRow("Doctor", doctor?.name ?: "Doctor")
                    SummaryRow("Date", state.selectedDate?.let { dateLabel(it) } ?: "-")
                    SummaryRow("Time", state.selectedSlot ?: "-")
                    SummaryRow("Type", if (state.consultationType == "video") "Video consultation" else "Clinic visit")
                    SummaryRow("Fee", com.healpoint.app.util.formatINR(doctor?.displayFees()))
                    booked?.appointment?.appointmentId?.let { SummaryRow("Reference", it) }
                }
            }
        }

        Surface(shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                HealPointButton(
                    text = "View appointment",
                    onClick = {
                        val id = booked?.appointment?.id
                        if (id != null) navController.navigate(Routes.appointmentDetail(id))
                        else navController.navigate(Routes.MAIN) { popUpTo(0) { inclusive = true } }
                    },
                )
                HealPointButton(
                    text = "Go to home",
                    variant = com.healpoint.app.ui.components.HealPointButtonVariant.Outlined,
                    onClick = { navController.navigate(Routes.MAIN) { popUpTo(0) { inclusive = true } } },
                )
            }
        }
    }
}


