package com.healpoint.app.ui.auth

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
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
import com.healpoint.app.util.Validation
import com.healpoint.app.viewmodel.AuthViewModel

/** Request a password-reset OTP by email/phone. */
@Composable
fun ForgotPasswordScreen(
    viewModel: AuthViewModel,
    onBack: () -> Unit,
    onOtpSent: (String) -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var identifier by rememberSaveable { mutableStateOf("") }
    var fieldError by rememberSaveable { mutableStateOf<String?>(null) }

    val submit = {
        fieldError = if (identifier.isBlank()) {
            "Enter your registered email or phone number."
        } else if (!Validation.isValidEmail(identifier) && !Validation.isValidIndianPhone(identifier)) {
            "Enter a valid email address or a 10-digit mobile number."
        } else {
            null
        }
        if (fieldError == null) {
            viewModel.forgotPassword(identifier.trim()) { next -> onOtpSent(next) }
        }
    }

    Screen {
        AppHeader("Forgot password", onBack = onBack)
        Spacer(Modifier.height(20.dp))
        Text("Reset your password", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Enter your registered email address or phone number and we will send you a one-time password (OTP).",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(20.dp))

        HealPointTextField(
            value = identifier,
            onValueChange = { identifier = it; fieldError = null },
            label = "Email or phone",
            keyboardType = KeyboardType.Email,
            leadingIcon = Icons.Filled.Email,
            error = fieldError,
        )

        if (state.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))
        HealPointButton("Send OTP", onClick = submit, loading = state.busy)
    }
}