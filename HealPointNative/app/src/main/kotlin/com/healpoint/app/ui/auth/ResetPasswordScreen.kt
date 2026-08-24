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
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.HealPointTextField
import com.healpoint.app.ui.components.Screen
import com.healpoint.app.util.Validation
import com.healpoint.app.viewmodel.AuthViewModel

/** Sets a new password using the reset token returned by OTP verification. */
@Composable
fun ResetPasswordScreen(
    resetToken: String,
    viewModel: AuthViewModel,
    onBack: () -> Unit,
    onDone: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var password by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var passwordError by rememberSaveable { mutableStateOf<String?>(null) }
    var confirmError by rememberSaveable { mutableStateOf<String?>(null) }

    val submit = {
        passwordError = if (password.isBlank()) {
            "New password is required."
        } else if (!Validation.isValidStrongPassword(password)) {
            Validation.PASSWORD_HELP
        } else {
            null
        }
        confirmError = if (confirm != password) "Passwords do not match." else null
        if (passwordError == null && confirmError == null) {
            viewModel.resetPassword(resetToken, password) { onDone() }
        }
    }

    Screen {
        AppHeader("Reset password", onBack = onBack)
        Spacer(Modifier.height(20.dp))
        Text("Choose a new password", style = MaterialTheme.typography.headlineMedium)
        Text(
            Validation.PASSWORD_HELP,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(20.dp))

        HealPointTextField(
            value = password,
            onValueChange = { password = it; passwordError = null },
            label = "New password",
            password = true,
            leadingIcon = Icons.Filled.Lock,
            error = passwordError,
        )
        Spacer(Modifier.height(12.dp))
        HealPointTextField(
            value = confirm,
            onValueChange = { confirm = it; confirmError = null },
            label = "Confirm new password",
            password = true,
            leadingIcon = Icons.Filled.Lock,
            error = confirmError,
        )

        if (state.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))
        HealPointButton("Reset password", onClick = submit, loading = state.busy)
    }
}