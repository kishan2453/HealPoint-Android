package com.healpoint.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.HealPointButtonVariant
import com.healpoint.app.ui.theme.Primary

/** Landing screen shown to signed-out users. */
@Composable
fun WelcomeScreen(onLogin: () -> Unit, onRegister: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Spacer(Modifier.weight(1f))

        Box(
            modifier = Modifier.size(96.dp).clip(RoundedCornerShape(48.dp)).background(Primary),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                "H",
                color = MaterialTheme.colorScheme.onPrimary,
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
            )
        }
        Spacer(Modifier.height(16.dp))
        Text("HealPoint", style = MaterialTheme.typography.headlineLarge, color = Primary, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(
            "Book appointments with trusted doctors and hospitals, manage your health in one place.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.weight(1f))

        HealPointButton("Login", onClick = onLogin)
        Spacer(Modifier.height(12.dp))
        HealPointButton("Create an account", onClick = onRegister, variant = HealPointButtonVariant.Outlined)
    }
}