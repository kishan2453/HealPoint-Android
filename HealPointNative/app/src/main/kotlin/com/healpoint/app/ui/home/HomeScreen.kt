package com.healpoint.app.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.FormatListBulleted
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.data.remote.dto.displayRating
import com.healpoint.app.ui.components.AppointmentCard
import com.healpoint.app.ui.components.DoctorCard
import com.healpoint.app.ui.components.EmptyState
import com.healpoint.app.ui.components.HospitalCard
import com.healpoint.app.ui.components.SectionHeader
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.ui.theme.ErrorRed
import com.healpoint.app.ui.theme.Primary
import com.healpoint.app.util.firstName
import com.healpoint.app.viewmodel.AppointmentsViewModel
import com.healpoint.app.viewmodel.AuthViewModel
import com.healpoint.app.viewmodel.DoctorsViewModel
import com.healpoint.app.viewmodel.HospitalsViewModel
import com.healpoint.app.viewmodel.NotificationsViewModel

/** Quick-action tile on the home screen. */
@Composable
private fun QuickActionCard(icon: ImageVector, label: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(vertical = 14.dp),
        ) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(28.dp), tint = Primary)
            Text(label, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        }
    }
}

/** Home dashboard: greeting, quick actions, next appointment and highlights. */
@Composable
fun HomeScreen(
    authViewModel: AuthViewModel,
    navController: NavHostController,
    onNavigateToTab: (Int) -> Unit,
) {
    val authState by authViewModel.state.collectAsStateWithLifecycle()
    val doctorsVm: DoctorsViewModel = appViewModel()
    val hospitalsVm: HospitalsViewModel = appViewModel()
    val appointmentsVm: AppointmentsViewModel = appViewModel()
    val notificationsVm: NotificationsViewModel = appViewModel()

    val doctorsState by doctorsVm.state.collectAsStateWithLifecycle()
    val hospitalsState by hospitalsVm.state.collectAsStateWithLifecycle()
    val favoriteIds by doctorsVm.favoriteIds.collectAsStateWithLifecycle()
    val notificationsState by notificationsVm.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        notificationsVm.load()
        doctorsVm.refreshFavorites()
    }

    val user = authState.user
    val popularDoctors = doctorsState.data.orEmpty().sortedByDescending { it.displayRating() }.take(5)
    val topHospitals = hospitalsState.data.orEmpty().sortedByDescending { it.displayRating() }.take(3)
    val nextAppointment = appointmentsVm.nextAppointment()

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 16.dp, vertical = 12.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // Greeting + notification bell
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Hello, ${user?.name?.firstName().orEmpty().ifBlank { "there" }} 👋",
                    style = MaterialTheme.typography.headlineMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "How can we help you today?",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Box {
                IconButton(onClick = { navController.navigate(Routes.NOTIFICATIONS) }) {
                    Icon(Icons.Filled.NotificationsNone, contentDescription = "Notifications")
                }
                if (notificationsState.unreadCount > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .size(18.dp)
                            .clip(RoundedCornerShape(9.dp))
                            .background(ErrorRed),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            if (notificationsState.unreadCount > 9) "9+" else notificationsState.unreadCount.toString(),
                            color = MaterialTheme.colorScheme.onError,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }

        // Quick actions
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            QuickActionCard(Icons.Filled.Search, "Find doctors") { onNavigateToTab(1) }
            QuickActionCard(Icons.Filled.CalendarMonth, "Book appointment") { onNavigateToTab(1) }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            QuickActionCard(Icons.Filled.LocalHospital, "Nearby hospitals") { onNavigateToTab(2) }
            QuickActionCard(Icons.Filled.FormatListBulleted, "My appointments") { onNavigateToTab(3) }
        }

        // Next appointment
        if (nextAppointment != null) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SectionHeader("Upcoming appointment")
                AppointmentCard(
                    appointment = nextAppointment,
                    onClick = { nextAppointment.id?.let { navController.navigate(Routes.appointmentDetail(it)) } },
                )
            }
        }

        // Popular doctors
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionHeader("Popular doctors", "See all") { onNavigateToTab(1) }
            if (popularDoctors.isEmpty()) {
                EmptyState("No doctors available right now", "Please check back later.", Modifier.fillMaxWidth())
            } else {
                popularDoctors.forEach { doctor ->
                    DoctorCard(
                        doctor = doctor,
                        isFavorite = favoriteIds.contains(doctor.id),
                        onToggleFavorite = { doctor.id?.let { doctorsVm.toggleFavorite(it) } },
                        onClick = { doctor.id?.let { navController.navigate(Routes.doctorDetail(it)) } },
                    )
                }
            }
        }

        // Recommended hospitals
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SectionHeader("Recommended hospitals", "See all") { onNavigateToTab(2) }
            if (topHospitals.isEmpty()) {
                EmptyState("No hospitals available right now", "Please check back later.", Modifier.fillMaxWidth())
            } else {
                topHospitals.forEach { hospital ->
                    HospitalCard(
                        hospital = hospital,
                        onClick = { hospital.id?.let { navController.navigate(Routes.hospitalDetail(it)) } },
                    )
                }
            }
        }
    }
}

