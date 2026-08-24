package com.healpoint.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import com.healpoint.app.di.AppContainer
import com.healpoint.app.ui.LocalAppContainer
import com.healpoint.app.viewmodel.AppViewModelFactory

/**
 * Creates a ViewModel backed by the app dependency container.
 * Scoped to the nearest ViewModelStoreOwner (activity or NavHost entry).
 */
@Composable
inline fun <reified VM : ViewModel> appViewModel(): VM {
    val container: AppContainer = LocalAppContainer.current
    val factory = remember(container) { AppViewModelFactory(container) }
    return viewModel(factory = factory)
}