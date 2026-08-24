package com.healpoint.app.ui.doctor

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.data.remote.dto.displayFees
import com.healpoint.app.data.remote.dto.displayHospitalName
import com.healpoint.app.data.remote.dto.displayRating
import com.healpoint.app.data.remote.dto.displayReviewCount
import com.healpoint.app.data.remote.dto.displaySpeciality
import com.healpoint.app.data.remote.dto.isAvailableDoctor
import com.healpoint.app.data.remote.dto.isVerified
import com.healpoint.app.data.remote.dto.profileImage
import com.healpoint.app.data.remote.dto.ratingValue
import com.healpoint.app.data.remote.dto.reviewerName
import com.healpoint.app.data.remote.dto.supportsVideo
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.EmptyState
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.components.RatingStars
import com.healpoint.app.ui.components.RemoteImage
import com.healpoint.app.ui.components.StatusBadge
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.ui.theme.ErrorRed
import com.healpoint.app.ui.theme.Primary
import com.healpoint.app.ui.theme.SuccessGreen
import com.healpoint.app.util.formatINR
import com.healpoint.app.util.formatRating
import com.healpoint.app.viewmodel.DoctorDetailViewModel

@Composable
private fun StatTile(icon: ImageVector, text: String) {
    Surface(
        modifier = Modifier.weight(1f),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(vertical = 12.dp),
        ) {
            Icon(icon, contentDescription = null, tint = Primary, modifier = Modifier.size(18.dp))
            Text(text, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 16.dp))
    }
}

/** Doctor profile with real catalog data, favorite toggle, reviews and booking. */
@Composable
fun DoctorDetailScreen(doctorId: String, navController: NavHostController) {
    val vm: DoctorDetailViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    val doctor = state.doctor

    LaunchedEffect(doctorId) { vm.load(doctorId) }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AppHeader(
            title = "Doctor profile",
            onBack = { navController.popBackStack() },
            actions = {
                if (doctor != null) {
                    IconButton(onClick = { vm.toggleFavorite(doctorId) }) {
                        Icon(
                            if (state.isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                            contentDescription = "Toggle favorite",
                            tint = if (state.isFavorite) ErrorRed else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            },
        )

        when {
            state.isLoading -> LoadingState("Loading doctor...", Modifier.fillMaxWidth().weight(1f))
            state.error != null -> ErrorState(state.error.orEmpty(), onRetry = { vm.load(doctorId) }, modifier = Modifier.fillMaxWidth().weight(1f))
            doctor == null -> EmptyState("Doctor not found", "We could not load this doctor's profile.", Modifier.fillMaxWidth().weight(1f))
            else -> {
                Column(
                    modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    ) {
                        Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                            RemoteImage(url = doctor.profileImage(), modifier = Modifier.size(80.dp).clip(RoundedCornerShape(18.dp)))
                            Column(modifier = Modifier.weight(1f).padding(start = 14.dp)) {
                                Text(doctor.name ?: "Doctor", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                                Text(doctor.displaySpeciality(), style = MaterialTheme.typography.bodyMedium, color = Primary, fontWeight = FontWeight.SemiBold)
                                Text(doctor.displayHospitalName(), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        StatTile(Icons.Filled.CalendarMonth, "${doctor.experience?.toInt() ?: 0}+ yrs")
                        StatTile(Icons.Filled.Star, "${doctor.displayRating().formatRating()}")
                        StatTile(Icons.Filled.CalendarMonth, "${doctor.displayReviewCount()} reviews")
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (doctor.isAvailableDoctor()) StatusBadge("Available", SuccessGreen)
                        if (doctor.isVerified()) StatusBadge("Verified", Primary)
                        if (doctor.supportsVideo()) StatusBadge("Video consultation", MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    if (!doctor.about.isNullOrBlank()) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text("About", style = MaterialTheme.typography.titleMedium)
                            Text(doctor.about.orEmpty(), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            DetailRow("Consultation fee", formatINR(doctor.displayFees()))
                            if (!doctor.degree.isNullOrBlank()) DetailRow("Qualification", doctor.degree.orEmpty())
                            if (!doctor.languages.isNullOrEmpty()) DetailRow("Languages", doctor.languages!!.joinToString(", "))
                            if (!doctor.email.isNullOrBlank()) DetailRow("Email", doctor.email.orEmpty())
                            if (!doctor.phone.isNullOrBlank()) DetailRow("Phone", doctor.phone.orEmpty())
                        }
                    }

                    val reviews = doctor.reviews.orEmpty()
                    if (reviews.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Patient reviews (${reviews.size})", style = MaterialTheme.typography.titleMedium)
                            reviews.take(5).forEach { review ->
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Box(
                                        modifier = Modifier.size(32.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
                                        contentAlignment = Alignment.Center,
                                    ) {
                                        Text(review.reviewerName().take(1).uppercase(), color = MaterialTheme.colorScheme.onPrimaryContainer, fontWeight = FontWeight.Bold)
                                    }
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(review.reviewerName(), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                        RatingStars(review.ratingValue(), starSize = 12)
                                    }
                                }
                                Text(
                                    review.comment.orEmpty(),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(start = 42.dp),
                                )
                            }
                        }
                    }
                }

                Surface(shadowElevation = 8.dp, color = MaterialTheme.colorScheme.surface) {
                    Box(Modifier.fillMaxWidth().padding(16.dp)) {
                        HealPointButton("Book appointment", onClick = { navController.navigate(Routes.booking(doctorId)) })
                    }
                }
            }
        }
    }
}