package com.healpoint.app.ui.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.FilterChip
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
import androidx.navigation.NavHostController
import com.healpoint.app.ui.LocalAppContainer
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.HealPointButton
import com.healpoint.app.ui.components.HealPointTextField
import com.healpoint.app.ui.components.Screen
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.util.Validation
import com.healpoint.app.viewmodel.ProfileViewModel

/** Edit the patient's profile (name, phone, gender, address). */
@Composable
fun EditProfileScreen(navController: NavHostController) {
    val container = LocalAppContainer.current
    val user = container.sessionManager.user
    val vm: ProfileViewModel = appViewModel()
    val action by vm.action.collectAsStateWithLifecycle()

    var name by rememberSaveable { mutableStateOf(user?.name.orEmpty()) }
    var phone by rememberSaveable { mutableStateOf(user?.phone.orEmpty()) }
    var gender by rememberSaveable { mutableStateOf(user?.gender.orEmpty()) }
    var address by rememberSaveable { mutableStateOf(user?.address.orEmpty()) }
    var nameError by rememberSaveable { mutableStateOf<String?>(null) }
    var phoneError by rememberSaveable { mutableStateOf<String?>(null) }

    val genders = listOf("Male", "Female", "Other")

    val submit = {
        nameError = if (name.isBlank()) "Name is required." else null
        phoneError = if (phone.isNotBlank() && !Validation.isValidIndianPhone(phone)) "Enter a valid 10-digit mobile number." else null
        if (nameError == null && phoneError == null) {
            val fields = buildMap {
                if (name.isNotBlank()) put("name", name.trim())
                if (phone.isNotBlank()) put("phone", phone.trim())
                if (gender.isNotBlank()) put("gender", gender)
                if (address.isNotBlank()) put("address", address.trim())
            }
            vm.updateProfile(fields, imageUri = null) { navController.popBackStack() }
        }
    }

    Screen {
        AppHeader("Edit profile", onBack = { navController.popBackStack() })
        Spacer(Modifier.height(12.dp))
        Text("Keep your details up to date.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

        Spacer(Modifier.height(16.dp))
        HealPointTextField(value = name, onValueChange = { name = it; nameError = null }, label = "Full name", leadingIcon = Icons.Filled.Person, error = nameError)
        Spacer(Modifier.height(12.dp))
        HealPointTextField(value = phone, onValueChange = { phone = it; phoneError = null }, label = "Phone", keyboardType = KeyboardType.Phone, leadingIcon = Icons.Filled.Phone, error = phoneError)

        Spacer(Modifier.height(12.dp))
        Text("Gender", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            genders.forEach { option ->
                FilterChip(selected = gender == option, onClick = { gender = option }, label = { Text(option) })
            }
        }

        Spacer(Modifier.height(12.dp))
        HealPointTextField(value = address, onValueChange = { address = it }, label = "Address", singleLine = false)

        if (action.error != null) {
            Spacer(Modifier.height(8.dp))
            Text(action.error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(Modifier.height(20.dp))
        HealPointButton("Save changes", onClick = submit, loading = action.busy)
    }
}