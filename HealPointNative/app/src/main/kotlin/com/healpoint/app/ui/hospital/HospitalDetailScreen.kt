package com.healpoint.app.ui.hospital

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.data.remote.dto.coverImageUrl
import com.healpoint.app.data.remote.dto.displayAddress
import com.healpoint.app.data.remote.dto.displayRating
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.EmptyState
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.components.RemoteImage
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.ui.theme.Gold
import com.healpoint.app.util.formatRating
import com.healpoint.app.viewmodel.HospitalDetailViewModel

/** Hospital profile with cover image, location, contact and departments. */
@Composable
fun HospitalDetailScreen(hospitalId: String, navController: NavHostController) {
    val vm: HospitalDetailViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    val hospital = state.hospital

    LaunchedEffect(hospitalId) { vm.load(hospitalId) }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AppHeader("Hospital", onBack = { navController.popBackStack() })

        when {
            state.isLoading -> LoadingState("Loading hospital...", Modifier.fillMaxWidth().weight(1f))
            state.error != null -> ErrorState(state.error.orEmpty(), onRetry = { vm.load(hospitalId) }, modifier = Modifier.fillMaxWidth().weight(1f))
            hospital == null -> EmptyState("Hospital not found", "We could not load this hospital.", Modifier.fillMaxWidth().weight(1f))
            else -> Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                ) {
                    Box {
                        RemoteImage(
                            url = hospital.coverImageUrl(),
                            modifier = Modifier.fillMaxWidth().height(160.dp).clip(RoundedCornerShape(20.dp)),
                        )
                        Row(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(10.dp)
                                .clip(RoundedCornerShape(50))
                                .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.95f))
                                .padding(horizontal = 10.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Filled.Star, contentDescription = null, modifier = Modifier.size(14.dp), tint = Gold)
                            Text(" ${hospital.displayRating().formatRating()}", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(hospital.name ?: "Hospital", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                        Text(hospital.displayAddress(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (!hospital.contact?.emergency.isNullOrBlank()) {
                            Text("Emergency: ${hospital.contact?.emergency}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
                        }
                        if (!hospital.contact?.reception.isNullOrBlank()) {
                            Text("Reception: ${hospital.contact?.reception}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (!hospital.opdTimings.isNullOrBlank()) {
                            Text("OPD: ${hospital.opdTimings}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }

                if (!hospital.about.isNullOrBlank()) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("About", style = MaterialTheme.typography.titleMedium)
                        Text(hospital.about.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }

                if (!hospital.departments.isNullOrEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Departments", style = MaterialTheme.typography.titleMedium)
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            hospital.departments!!.forEach { dept -> Text("•  $dept", style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                }
            }
        }
    }
}
