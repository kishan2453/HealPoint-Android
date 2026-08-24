package com.healpoint.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import com.healpoint.app.ui.theme.Primary

/** Branded splash shown while the auth session restores and on the splash route. */
@Composable
fun SplashScreen() {
    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            modifier = Modifier.size(96.dp).clip(RoundedCornerShape(48.dp)).background(Primary),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "H",
                color = MaterialTheme.colorScheme.onPrimary,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
            )
        }
        Text(
            text = "HealPoint",
            style = MaterialTheme.typography.headlineMedium,
            color = Primary,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            text = "Your health, simplified",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        CircularProgressIndicator(
            color = Primary,
            modifier = Modifier.size(28.dp).padding(top = 8.dp),
        )
    }
}