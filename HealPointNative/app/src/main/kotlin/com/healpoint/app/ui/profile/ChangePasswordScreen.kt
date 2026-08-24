package com.healpoint.app.ui.profile

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
import androidx.navigation.NavHostController
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.HealPointButtonVariant
import com.healpoint.app.ui.components.HealPointTextField
import com.healpoint.app.ui.components.Screen
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.util.Validation
import com.healpoint.app.viewmodel.ProfileViewModel

/** Change account password (old + new, with strong-password validation). */
@Composable
fun ChangePasswordScreen(navController: NavHostController) {
    val vm: ProfileViewModel = appViewModel()
    val action by vm.action.collectAsStateWithLifecycle()

    var old by rememberSaveable { mutableStateOf("") }
    var new by rememberSaveable { mutableStateOf("") }
    var confirm by rememberSaveable { mutableStateOf("") }
    var oldError by rememberSaveable { mutableStateOf<String?>(null) }
    var newError by rememberSaveable { mutableStateOf<String?>(null) }
    var confirmError by rememberSaveable { mutableStateOf<String?>(null) }

    val submit = {
        oldError = if (old.isBlank()) "Enter your current password." else null
        newError = if (new.isBlank()) "Enter a new password." else if (!Validation.isValidStrongPassword(new)) Validation.PASSWORD_HELP else null
        confirmError = if (confirm != new) "Passwords do not match." else null
        if (listOf(oldError, newError, confirmError).all { it == null }) {
            vm.changePassword(old, new)
        }
    }

    Screen {
        AppHeader("Change password", onBack = { navController.popBackStack() })
        Spacer(Modifier.height(16.dp))
        Text(Validation.PASSWORD_HELP, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)

        Spacer(Modifier.height(16.dp))
        HealPointTextField(value = old, onValueChange = { old = it; oldError = null }, label = "Current password", password = true, leadingIcon = Icons.Filled.Lock, error = oldError)
        Spacer(Modifier.height(12.dp))
        HealPointTextField(value = new, onValueChange = { new = it; newError = null }, label = "New password", password = true, leadingIcon = Icons.Filled.Lock, error = newError)
        Spacer(Modifier.height(12.dp))
        HealPointTextField(value = confirm, onValueChange = { confirm = it; confirmError = null }, label = "Confirm new password", password = true, leadingIcon = Icons.Filled.Lock, error = confirmError)

        if (action.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(action.error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        if (action.message != null) {
            Spacer(Modifier.height(8.dp))
            Text(action.message.orEmpty(), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))
        HealPointButton("Update password", onClick = submit, loading = action.busy)

        if (action.message != null) {
            Spacer(Modifier.height(8.dp))
            HealPointButton("Done", onClick = { navController.popBackStack() }, variant = HealPointButtonVariant.Outlined)
        }
    }
}