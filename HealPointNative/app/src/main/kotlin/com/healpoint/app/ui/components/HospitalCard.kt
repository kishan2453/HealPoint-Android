package com.healpoint.app.ui.components

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
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
import com.healpoint.app.data.remote.dto.HospitalDto
import com.healpoint.app.data.remote.dto.coverImageUrl
import com.healpoint.app.data.remote.dto.displayAddress
import com.healpoint.app.data.remote.dto.displayDepartmentCount
import com.healpoint.app.data.remote.dto.displayDoctorCount
import com.healpoint.app.data.remote.dto.displayRating
import com.healpoint.app.ui.theme.ErrorRed
import com.healpoint.app.ui.theme.Gold
import com.healpoint.app.ui.theme.WarningOrange
import com.healpoint.app.util.formatRating

/** Hospital card with cover image, rating and quick facts. */
@Composable
fun HospitalCard(hospital: HospitalDto, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    ) {
        Column {
            Box(modifier = Modifier.fillMaxWidth().height(120.dp)) {
                RemoteImage(url = hospital.coverImageUrl(), modifier = Modifier.fillMaxSize())
                Row(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp)
                        .clip(RoundedCornerShape(50))
                        .clip(RoundedCornerShape(50))
                        .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.95f))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Filled.Star, contentDescription = null, modifier = Modifier.size(14.dp), tint = Gold)
                    Text(
                        " ${hospital.displayRating().formatRating()}",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    hospital.name ?: "Hospital",
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    hospital.displayAddress(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    MetaItem(Icons.Filled.CalendarMonth, "${hospital.displayDoctorCount()} doctors")
                    MetaItem(Icons.Filled.CalendarMonth, "${hospital.displayDepartmentCount()} departments")
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (hospital.emergencyFacility == true) StatusBadge("Emergency", ErrorRed)
                    if (hospital.icu == true) StatusBadge("ICU", WarningOrange)
                    if (hospital.beds != null && hospital.beds.toInt() > 0) {
                        StatusBadge("${hospital.beds.toInt()} beds", Color(0xFF5F6F6C))
                    }
                }
            }
        }
    }
}