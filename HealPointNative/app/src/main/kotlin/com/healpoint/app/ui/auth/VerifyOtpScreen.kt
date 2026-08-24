package com.healpoint.app.ui.auth

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.HealPointTextField
import com.healpoint.app.ui.components.Screen
import com.healpoint.app.viewmodel.AuthViewModel

/** Enter the OTP that was sent, then move to the reset-password step. */
@Composable
fun VerifyOtpScreen(
    identifier: String,
    viewModel: AuthViewModel,
    onBack: () -> Unit,
    onVerified: (String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var otp by rememberSaveable { mutableStateOf("") }
    var otpError by rememberSaveable { mutableStateOf<String?>(null) }

    val submit = {
        otpError = if (otp.isBlank()) "Enter the OTP you received." else null
        if (otpError == null) {
            viewModel.verifyOtp(identifier, otp.trim()) { resetToken -> onVerified(resetToken) }
        }
    }

    Screen {
        AppHeader("Verify OTP", onBack = onBack)
        Spacer(Modifier.height(20.dp))
        Text("Enter the OTP", style = MaterialTheme.typography.headlineMedium)
        Text(
            "We sent a one-time password to your registered email/phone.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (state.message != null) {
            Spacer(Modifier.height(8.dp))
            Text(state.message.orEmpty(), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))
        HealPointTextField(
            value = otp,
            onValueChange = { otp = it.filter(Char::isDigit).take(6); otpError = null },
            label = "OTP",
            keyboardType = KeyboardType.Number,
            leadingIcon = Icons.Filled.Lock,
            error = otpError,
        )

        if (state.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))
        HealPointButton("Verify OTP", onClick = submit, loading = state.busy)
    }
}