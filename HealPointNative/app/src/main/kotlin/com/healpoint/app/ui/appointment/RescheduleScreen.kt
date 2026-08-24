package com.healpoint.app.ui.appointment

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.data.remote.dto.doctorName
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.ConfirmDialog
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.theme.Primary
import com.healpoint.app.util.displayDate
import com.healpoint.app.util.weekdayLabel
import com.healpoint.app.viewmodel.RescheduleViewModel
import java.time.LocalDate

@Composable
private fun RowDetail(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

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

/** Reschedule an existing appointment: choose a new date + slot. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RescheduleScreen(appointmentId: String, navController: NavHostController) {
    val vm: RescheduleViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    var showConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(appointmentId) { vm.load(appointmentId) }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AppHeader("Reschedule appointment", onBack = { navController.popBackStack() })

        when {
            state.isLoading -> LoadingState("Loading appointment...", Modifier.fillMaxWidth().weight(1f))
            state.error != null -> ErrorState(state.error.orEmpty(), onRetry = { vm.load(appointmentId) }, modifier = Modifier.fillMaxWidth().weight(1f))
            else -> Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                state.current?.let { current ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            RowDetail("Doctor", current.doctorName())
                            RowDetail("Current slot", "${displayDate(current.slotDate)} · ${current.slotTime.orEmpty()}")
                        }
                    }
                }

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Select a new date", style = MaterialTheme.typography.titleMedium)
                    Row(
                        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        state.days.forEach { day ->
                            DayTile(
                                date = day,
                                selected = state.selectedDate == day,
                                onClick = { vm.selectDate(appointmentId, day) },
                            )
                        }
                    }
                }

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

                if (state.message != null) {
                    Text(state.message.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        Surface(shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
            Box(Modifier.fillMaxWidth().padding(16.dp)) {
                HealPointButton(
                    text = "Confirm reschedule",
                    onClick = { showConfirm = true },
                    enabled = state.selectedSlot != null && !state.submitting,
                    loading = state.submitting,
                )
            }
        }
    }

    if (showConfirm) {
        ConfirmDialog(
            title = "Reschedule appointment?",
            message = "Your appointment will be moved to the selected date and time.",
            confirmLabel = "Confirm",
            loading = state.submitting,
            onConfirm = {
                showConfirm = false
                vm.reschedule(appointmentId) { navController.popBackStack() }
            },
            onDismiss = { showConfirm = false },
        )
    }
}
