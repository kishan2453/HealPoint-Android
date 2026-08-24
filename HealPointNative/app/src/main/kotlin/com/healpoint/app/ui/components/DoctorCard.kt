package com.healpoint.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.healpoint.app.data.remote.dto.DoctorDto
import com.healpoint.app.data.remote.dto.displayFees
import com.healpoint.app.data.remote.dto.displayExperience
import com.healpoint.app.data.remote.dto.displayHospitalName
import com.healpoint.app.data.remote.dto.displayRating
import com.healpoint.app.data.remote.dto.displayReviewCount
import com.healpoint.app.data.remote.dto.displaySpeciality
import com.healpoint.app.data.remote.dto.isAvailableDoctor
import com.healpoint.app.data.remote.dto.isVerified
import com.healpoint.app.data.remote.dto.profileImage
import com.healpoint.app.data.remote.dto.supportsVideo
import com.healpoint.app.ui.theme.ErrorRed
import com.healpoint.app.ui.theme.Gold
import com.healpoint.app.ui.theme.Primary
import com.healpoint.app.ui.theme.SuccessGreen
import com.healpoint.app.util.formatINR
import com.healpoint.app.util.formatRating

/** Doctor card with photo, specialty, hospital, meta and favorite toggle. */
@Composable
fun DoctorCard(
    doctor: DoctorDto,
    isFavorite: Boolean,
    onToggleFavorite: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RemoteImage(
                    url = doctor.profileImage(),
                    modifier = Modifier.size(64.dp).clip(RoundedCornerShape(14.dp)),
                )
                Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(
                        doctor.name ?: "Doctor",
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        doctor.displaySpeciality(),
                        style = MaterialTheme.typography.bodySmall,
                        color = Primary,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        doctor.displayHospitalName(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                IconButton(onClick = onToggleFavorite) {
                    Icon(
                        if (isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = if (isFavorite) "Remove from favorites" else "Add to favorites",
                        tint = if (isFavorite) ErrorRed else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                MetaItem(Icons.Filled.CalendarMonth, "${doctor.displayExperience()} yrs")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.Star, contentDescription = null, modifier = Modifier.size(14.dp), tint = Gold)
                    Text(
                        " ${doctor.displayRating().formatRating()} (${doctor.displayReviewCount()})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Text(formatINR(doctor.displayFees()), style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (doctor.isAvailableDoctor()) StatusBadge("Available", SuccessGreen)
                if (doctor.isVerified()) StatusBadge("Verified", Primary)
                if (doctor.supportsVideo()) StatusBadge("Video", MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}