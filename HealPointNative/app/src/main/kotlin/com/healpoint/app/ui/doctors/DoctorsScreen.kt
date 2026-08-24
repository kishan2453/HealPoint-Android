package com.healpoint.app.ui.doctors

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.DoctorCard
import com.healpoint.app.ui.components.EmptyState
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.viewmodel.DoctorsViewModel

/** Doctor catalog with search + department filter and favorite hearts. */
@Composable
fun DoctorsScreen(navController: NavHostController) {
    val vm: DoctorsViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()
    val favoriteIds by vm.favoriteIds.collectAsStateWithLifecycle()

    var searchText by rememberSaveable { mutableStateOf("") }
    var selectedDept by rememberSaveable { mutableStateOf<String?>(null) }

    val applySearch = {
        vm.setQuery(searchText)
        vm.load()
    }

    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background),
    ) {
        AppHeader("Doctors")

        Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search by name or specialty") },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                trailingIcon = if (searchText.isNotEmpty()) {
                    {
                        IconButton(onClick = { searchText = ""; applySearch() }) {
                            Icon(Icons.Filled.Close, contentDescription = "Clear search")
                        }
                    }
                } else {
                    null
                },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { applySearch() }),
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FilterChip(selected = selectedDept == null, onClick = {
                selectedDept = null
                vm.setDepartment(null)
            }, label = { Text("All") })
            vm.departments().forEach { dept ->
                FilterChip(
                    selected = selectedDept == dept,
                    onClick = {
                        selectedDept = dept
                        vm.setDepartment(dept)
                    },
                    label = { Text(dept) },
                )
            }
        }

        when {
            state.isLoading -> LoadingState("Loading doctors...", Modifier.fillMaxWidth())
            state.error != null -> ErrorState(state.error.orEmpty(), onRetry = { vm.load() }, modifier = Modifier.fillMaxWidth())
            state.data.orEmpty().isEmpty() -> EmptyState(
                "No doctors found",
                "Try a different search term or department.",
                Modifier.fillMaxWidth(),
            )
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.data.orEmpty(), key = { it.id ?: it.toString() }) { doctor ->
                    DoctorCard(
                        doctor = doctor,
                        isFavorite = favoriteIds.contains(doctor.id),
                        onToggleFavorite = { doctor.id?.let { vm.toggleFavorite(it) } },
                        onClick = { doctor.id?.let { navController.navigate(Routes.doctorDetail(it)) } },
                    )
                }
            }
        }
    }
}