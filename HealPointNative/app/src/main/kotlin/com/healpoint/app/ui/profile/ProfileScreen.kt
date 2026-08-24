package com.healpoint.app.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.data.remote.dto.safeName
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.HealPointButtonVariant
import com.healpoint.app.ui.components.RemoteImage
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.viewmodel.AuthViewModel

/** A row-style menu item used in the profile screen. */
@Composable
private fun MenuItem(icon: ImageVector, label: String, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Text(
                label,
                style = MaterialTheme.typography.bodyLarge,
                modifier = Modifier.weight(1f).padding(start = 12.dp),
            )
            Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Simple numeric stat tile. */
@Composable
private fun StatTile(label: String, value: Int) {
    Surface(
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(vertical = 12.dp),
        ) {
            Text(value.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, fontWeight = FontWeight.SemiBold)
        }
    }
}

/** Patient profile: header, booking stats and settings/logout actions. */
@Composable
fun ProfileScreen(authViewModel: AuthViewModel, navController: NavHostController) {
    val authState by authViewModel.state.collectAsStateWithLifecycle()
    val user = authState.user
    val stats = user?.appointmentStats

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        ) {
            Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                RemoteImage(
                    url = user?.image,
                    modifier = Modifier.size(72.dp).clip(CircleShape),
                )
                Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                    Text(user?.safeName() ?: "Patient", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(
                        user?.email.orEmpty(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        user?.phone.orEmpty(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Text("Your activity", style = MaterialTheme.typography.titleMedium)

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatTile("Total bookings", stats?.totalBookings ?: 0)
            StatTile("Completed", stats?.completedBookings ?: 0)
            StatTile("Cancelled", stats?.cancelledBookings ?: 0)
        }

        MenuItem(Icons.Filled.Edit, "Edit profile") { navController.navigate(Routes.EDIT_PROFILE) }
        MenuItem(Icons.Filled.Lock, "Change password") { navController.navigate(Routes.CHANGE_PASSWORD) }
        MenuItem(Icons.Filled.Notifications, "Notifications") { navController.navigate(Routes.NOTIFICATIONS) }
        MenuItem(Icons.Filled.Settings, "Settings") { navController.navigate(Routes.SETTINGS) }

        androidx.compose.foundation.layout.Spacer(Modifier.size(8.dp))

        HealPointButton(
            text = "Logout",
            onClick = { authViewModel.logout() },
            variant = HealPointButtonVariant.Outlined,
            icon = Icons.Filled.Settings,
        )
    }
}
