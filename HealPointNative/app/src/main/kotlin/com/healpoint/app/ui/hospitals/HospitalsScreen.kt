package com.healpoint.app.ui.hospitals

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
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
import com.healpoint.app.data.remote.dto.displayAddress
import com.healpoint.app.ui.components.AppHeader
import com.healpoint.app.ui.components.EmptyState
import com.healpoint.app.ui.components.ErrorState
import com.healpoint.app.ui.components.HospitalCard
import com.healpoint.app.ui.components.LoadingState
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.viewmodel.HospitalsViewModel

/** Hospital catalog with an optional name/location filter. */
@Composable
fun HospitalsScreen(navController: NavHostController) {
    val vm: HospitalsViewModel = appViewModel()
    val state by vm.state.collectAsStateWithLifecycle()

    var searchText by rememberSaveable { mutableStateOf("") }
    val filtered = state.data.orEmpty().filter {
        val term = searchText.trim()
        term.isEmpty() ||
            it.name?.contains(term, ignoreCase = true) == true ||
            it.displayAddress().contains(term, ignoreCase = true)
    }

    val applySearch = {
        vm.setQuery(searchText)
        vm.load()
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AppHeader("Hospitals")

        Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Search hospitals or locations") },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                trailingIcon = if (searchText.isNotEmpty()) {
                    { IconButton(onClick = { searchText = ""; applySearch() }) { Icon(Icons.Filled.Close, contentDescription = "Clear") } }
                } else {
                    null
                },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { applySearch() }),
            )
        }

        when {
            state.isLoading -> LoadingState("Loading hospitals...", Modifier.fillMaxWidth())
            state.error != null -> ErrorState(state.error.orEmpty(), onRetry = { vm.load() }, modifier = Modifier.fillMaxWidth())
            filtered.isEmpty() -> EmptyState("No hospitals found", "Try a different search.", Modifier.fillMaxWidth())
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(filtered, key = { it.id ?: it.toString() }) { hospital ->
                    HospitalCard(
                        hospital = hospital,
                        onClick = { hospital.id?.let { navController.navigate(Routes.hospitalDetail(it)) } },
                    )
                }
            }
        }
    }
}