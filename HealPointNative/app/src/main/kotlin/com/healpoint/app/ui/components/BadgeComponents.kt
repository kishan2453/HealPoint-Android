package com.healpoint.app.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.healpoint.app.ui.theme.Primary

/** Colored status pill used for appointments and doctor badges. */
@Composable
fun StatusBadge(text: String, color: Color, container: Color = color.copy(alpha = 0.12f)) {
    Surface(shape = RoundedCornerShape(8.dp), color = container) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium,
            color = color,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

private val WarningColor = Color(0xFFE89A3C)
private val SuccessColor = Color(0xFF2E9E5B)
private val ErrorColor = Color(0xFFD9435B)
private val NeutralColor = Color(0xFF5F6F6C)

/** Maps an appointment status to a display label + color. */
fun appointmentStatusStyle(status: String?): Pair<String, Color> = when (status) {
    "pending" -> "Pending" to WarningColor
    "confirmed" -> "Confirmed" to SuccessColor
    "completed" -> "Completed" to Primary
    "cancel" -> "Cancelled" to ErrorColor
    "rescheduled" -> "Rescheduled" to NeutralColor
    "missed" -> "Missed" to ErrorColor
    else -> (status ?: "Unknown") to NeutralColor
}

/** Star rating row. */
@Composable
fun RatingStars(rating: Float, starSize: Int = 16, tint: Color = Color(0xFFF2B705)) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        val rounded = rating coerceIn(0f, 5f)
        repeat(5) { index ->
            val active = index < rounded.toInt() || (index == rounded.toInt() && rounded - rounded.toInt() >= 0.5f)
            Icon(
                Icons.Filled.Star,
                contentDescription = null,
                modifier = Modifier.size(starSize.dp),
                tint = if (active) tint else tint.copy(alpha = 0.3f),
            )
        }
    }
}

/** Label/value row used on detail screens. */
@Composable
fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.End,
            modifier = Modifier.padding(start = 16.dp),
        )
    }
}

/** Confirmation dialog (used for cancelling appointments). */
@Composable
fun ConfirmDialog(
    title: String,
    message: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    loading: Boolean = false,
) {
    AlertDialog(
        onDismissRequest = { if (!loading) onDismiss() },
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            HealPointButton(
                text = confirmLabel,
                onClick = onConfirm,
                loading = loading,
                modifier = Modifier.width(120.dp).height(44.dp),
            )
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !loading) { Text("Cancel") }
        },
    )
}