package com.healpoint.app.ui.appointments

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.AppointmentCard
import com.healpoint.app.ui.components.EmptyState
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.viewmodel.AppointmentsViewModel

private data class AppointmentSegment(val key: String, val label: String)

private val segments = listOf(
    AppointmentSegment("upcoming", "Upcoming"),
    AppointmentSegment("today", "Today"),
    AppointmentSegment("completed", "Completed"),
    AppointmentSegment("cancelled", "Cancelled"),
)

/** Patient's appointments bucketed into today / upcoming / completed / cancelled. */
@Composable
fun AppointmentsScreen(navController: NavHostController) {
    val vm: AppointmentsViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    var tabKey by rememberSaveable { mutableStateOf("upcoming") }

    LaunchedEffect(Unit) { vm.load() }

    val data = when (tabKey) {
        "today" -> vm.today
        "completed" -> vm.completed
        "cancelled" -> vm.cancelled
        else -> vm.upcoming
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AppHeader("My appointments")

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            segments.forEach { seg ->
                val count = when (seg.key) {
                    "today" -> vm.today.size
                    "completed" -> vm.completed.size
                    "cancelled" -> vm.cancelled.size
                    else -> vm.upcoming.size
                }
                FilterChip(
                    selected = tabKey == seg.key,
                    onClick = { tabKey = seg.key },
                    label = { Text("${seg.label} ($count)") },
                )
            }
        }

        when {
            state.isLoading -> LoadingState("Loading appointments...", Modifier.fillMaxWidth())
            state.error != null -> ErrorState(state.error.orEmpty(), onRetry = { vm.load() }, modifier = Modifier.fillMaxWidth())
            data.isEmpty() -> EmptyState(
                emptyTitleFor(tabKey),
                emptyMessageFor(tabKey),
                Modifier.fillMaxWidth(),
                icon = Icons.Outlined.CalendarMonth,
            )
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(data, key = { it.id ?: it.toString() }) { appointment ->
                    AppointmentCard(
                        appointment = appointment,
                        onClick = { appointment.id?.let { navController.navigate(Routes.appointmentDetail(it)) } },
                    )
                }
            }
        }
    }
}

private fun emptyTitleFor(tab: String): String = when (tab) {
    "today" -> "No appointments today"
    "completed" -> "No completed appointments"
    "cancelled" -> "No cancelled appointments"
    else -> "No upcoming appointments"
}

private fun emptyMessageFor(tab: String): String = when (tab) {
    "today" -> "Your appointments for today will appear here."
    "completed" -> "Past appointments will appear here as they complete."
    "cancelled" -> "Cancelled or missed appointments appear here."
    else -> "Book a consultation with a trusted doctor to see it here."
}