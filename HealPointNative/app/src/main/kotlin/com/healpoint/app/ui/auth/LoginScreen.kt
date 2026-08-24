package com.healpoint.app.ui.auth

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
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
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.util.Validation
import com.healpoint.app.viewmodel.AuthViewModel

/** Patient login. Invalid credentials and network errors surface inline. */
@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onBack: () -> Unit,
    onForgotPassword: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var emailError by rememberSaveable { mutableStateOf<String?>(null) }
    var passwordError by rememberSaveable { mutableStateOf<String?>(null) }

    val submit = {
        emailError = if (email.isBlank()) "Email is required." else if (!Validation.isValidEmail(email)) "Please enter a valid email address." else null
        passwordError = if (password.isBlank()) "Password is required." else null
        if (emailError == null && passwordError == null) {
            viewModel.login(email.trim(), password)
        }
    }

    Screen {
        AppHeader("Login", onBack = onBack)
        Spacer(Modifier.height(24.dp))
        Text("Welcome back 👋", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Login to book appointments and manage your health.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))

        HealPointTextField(
            value = email,
            onValueChange = { email = it; emailError = null },
            label = "Email",
            keyboardType = KeyboardType.Email,
            leadingIcon = Icons.Filled.Email,
            error = emailError,
        )
        Spacer(Modifier.height(12.dp))
        HealPointTextField(
            value = password,
            onValueChange = { password = it; passwordError = null },
            label = "Password",
            password = true,
            leadingIcon = Icons.Filled.Lock,
            error = passwordError,
        )

        androidx.compose.material3.TextButton(
            onClick = onForgotPassword,
            modifier = Modifier.align(androidx.compose.ui.Alignment.End),
        ) {
            Text("Forgot password?", color = MaterialTheme.colorScheme.primary)
        }

        if (state.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(
                state.error.orEmpty(),
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Spacer(Modifier.height(20.dp))
        HealPointButton("Login", onClick = submit, loading = state.busy)

        Spacer(Modifier.height(32.dp))
    }
}