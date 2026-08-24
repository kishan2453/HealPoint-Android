package com.healpoint.app.ui.auth

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
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

/** Patient registration. Password rules mirror the backend. */
@Composable
fun RegisterScreen(
    viewModel: AuthViewModel,
    onBack: () -> Unit,
    onGoToLogin: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var nameError by rememberSaveable { mutableStateOf<String?>(null) }
    var emailError by rememberSaveable { mutableStateOf<String?>(null) }
    var passwordError by rememberSaveable { mutableStateOf<String?>(null) }
    var confirmError by rememberSaveable { mutableStateOf<String?>(null) }

    val submit = {
        nameError = if (name.isBlank()) "Name is required." else null
        emailError = if (email.isBlank()) "Email is required." else if (!Validation.isValidEmail(email)) "Please enter a valid email address." else null
        passwordError = if (password.isBlank()) "Password is required." else if (!Validation.isValidStrongPassword(password)) Validation.PASSWORD_HELP else null
        confirmError = if (confirm != password) "Passwords do not match." else null
        if (listOf(nameError, emailError, passwordError, confirmError).all { it == null }) {
            viewModel.register(name.trim(), email.trim(), password)
        }
    }

    Screen {
        AppHeader("Create account", onBack = onBack)
        Spacer(Modifier.height(20.dp))
        Text("Register as a patient", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Book appointments and manage your health.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(20.dp))

        HealPointTextField(
            value = name,
            onValueChange = { name = it; nameError = null },
            label = "Full name",
            leadingIcon = Icons.Filled.Person,
            error = nameError,
        )
        Spacer(Modifier.height(12.dp))
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
        Spacer(Modifier.height(12.dp))
        HealPointTextField(
            value = confirm,
            onValueChange = { confirm = it; confirmError = null },
            label = "Confirm password",
            password = true,
            leadingIcon = Icons.Filled.Lock,
            error = confirmError,
        )

        if (state.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(state.error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        if (state.message != null) {
            Spacer(Modifier.height(8.dp))
            Text(state.message.orEmpty(), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))
        HealPointButton("Create account", onClick = submit, loading = state.busy)

        if (state.message != null) {
            Spacer(Modifier.height(8.dp))
            HealPointButton("Go to login", onClick = onGoToLogin, variant = com.healpoint.app.ui.components.HealPointButtonVariant.Outlined)
        }

        Spacer(Modifier.height(32.dp))
    }
}