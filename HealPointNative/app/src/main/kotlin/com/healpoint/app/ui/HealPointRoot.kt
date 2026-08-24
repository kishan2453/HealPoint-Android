package com.healpoint.app.ui

import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import com.healpoint.app.ui.navigation.AppNavHost
import com.healpoint.app.ui.navigation.Routes
import com.healpoint.app.ui.navigation.appViewModel
import com.healpoint.app.viewmodel.AuthViewModel

/**
 * App root. Owns the single [AuthViewModel] (activity scope), shows the splash
 * while the session restores, and drives top-level navigation from the auth
 * state (authenticated -> main tabs, otherwise -> welcome).
 */
@Composable
fun HealPointRoot() {
    val authViewModel: AuthViewModel = appViewModel()
    val authState by authViewModel.state.collectAsStateWithLifecycle()
    val navController: NavHostController = rememberNavController()

    if (authState.isRestoring) {
        SplashScreen()
    } else {
        LaunchedEffect(authState.isAuthenticated) {
            val route = if (authState.isAuthenticated) Routes.MAIN else Routes.WELCOME
            if (navController.currentDestination?.route != route) {
                navController.navigate(route) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
        AppNavHost(navController = navController, authViewModel = authViewModel)
    }
}