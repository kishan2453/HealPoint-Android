package com.healpoint.app.ui.appointment

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.data.remote.dto.amountValue
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.ConfirmDialog
import com.healpoint.app.ui.components.EmptyState
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.HealPointButtonVariant
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.components.StatusBadge
import com.healpoint.app.ui.components.appointmentStatusStyle
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.util.displayDate
import com.healpoint.app.util.formatINR
import com.healpoint.app.viewmodel.AppointmentDetailViewModel

@Composable
private fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.End, modifier = Modifier.padding(start = 16.dp))
    }
}

/** Single appointment details with cancel and reschedule actions. */
@Composable
fun AppointmentDetailScreen(appointmentId: String, navController: NavHostController) {
    val vm: AppointmentDetailViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    var showCancelDialog by remember { mutableStateOf(false) }

    LaunchedEffect(appointmentId) { vm.load(appointmentId) }

    val details = state.details
    val status = details?.bookingStatus
    val actionable = status in setOf("pending", "confirmed", "rescheduled")

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AppHeader("Appointment details", onBack = { navController.popBackStack() })

        when {
            state.isLoading -> LoadingState("Loading appointment...", Modifier.fillMaxWidth().weight(1f))
            state.error != null -> ErrorState(state.error.orEmpty(), onRetry = { vm.load(appointmentId) }, modifier = Modifier.fillMaxWidth().weight(1f))
            details == null -> EmptyState("Appointment not found", "We could not load this appointment.", Modifier.fillMaxWidth().weight(1f))
            else -> Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                val (label, color) = appointmentStatusStyle(status)
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        androidx.compose.material3.Icon(
                            Icons.Filled.CalendarMonth,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(bottom = 4.dp),
                        )
                        Text(details.doctorName ?: "Doctor", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        Text(details.hospitalName ?: "Hospital", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        StatusBadge(label, color)
                    }
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        DetailRow("Date", displayDate(details.bookingDate))
                        DetailRow("Time", details.bookingTime.orEmpty())
                        DetailRow("Fee", formatINR(details.amountValue()))
                        DetailRow("Payment", if (details.payment == true) "Paid" else "Pay at clinic")
                        if (details.appointmentId != null) DetailRow("Reference", details.appointmentId.orEmpty())
                    }
                }

                if (state.actionMessage != null) {
                    Text(
                        state.actionMessage.orEmpty(),
                        color = MaterialTheme.colorScheme.primary,
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                    )
                }

                if (actionable) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        HealPointButton(
                            text = "Cancel",
                            onClick = { showCancelDialog = true },
                            variant = HealPointButtonVariant.Outlined,
                            modifier = Modifier.weight(1f),
                        )
                        HealPointButton(
                            text = "Reschedule",
                            onClick = { navController.navigate(Routes.reschedule(appointmentId)) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }

    if (showCancelDialog) {
        ConfirmDialog(
            title = "Cancel appointment?",
            message = "This will cancel your appointment and release the time slot. This action cannot be undone.",
            confirmLabel = "Yes, cancel",
            loading = state.actionBusy,
            onConfirm = {
                showCancelDialog = false
                vm.cancel(appointmentId)
            },
            onDismiss = { showCancelDialog = false },
        )
    }
}
