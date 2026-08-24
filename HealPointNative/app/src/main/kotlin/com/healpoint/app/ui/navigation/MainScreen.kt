package com.healpoint.app.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.MedicalServices
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavHostController
import com.healpoint.app.ui.appointments.AppointmentsScreen
import com.healpoint.app.ui.doctors.DoctorsScreen
import com.healpoint.app.ui.home.HomeScreen
import com.healpoint.app.ui.hospitals.HospitalsScreen
import com.healpoint.app.ui.profile.ProfileScreen
import com.healpoint.app.viewmodel.AuthViewModel

/** A single navigation-bar tab. */
private data class MainTab(
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
)

private val mainTabs = listOf(
    MainTab("Home", Icons.Filled.Home, Icons.Outlined.Home),
    MainTab("Doctors", Icons.Filled.MedicalServices, Icons.Outlined.MedicalServices),
    MainTab("Hospitals", Icons.Filled.LocalHospital, Icons.Outlined.LocalHospital),
    MainTab("Appointments", Icons.Filled.CalendarMonth, Icons.Outlined.CalendarMonth),
    MainTab("Profile", Icons.Filled.Person, Icons.Outlined.Person),
)

/** Bottom-navigation shell hosting the five main tab screens. */
@Composable
fun MainScreen(authViewModel: AuthViewModel, navController: NavHostController) {
    var selectedTab by rememberSaveable { mutableStateOf(0) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                mainTabs.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        icon = {
                            Icon(
                                if (selectedTab == index) tab.selectedIcon else tab.unselectedIcon,
                                contentDescription = tab.label,
                            )
                        },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            when (selectedTab) {
                0 -> HomeScreen(authViewModel = authViewModel, navController = navController, onNavigateToTab = { selectedTab = it })
                1 -> DoctorsScreen(navController = navController)
                2 -> HospitalsScreen(navController = navController)
                3 -> AppointmentsScreen(navController = navController)
                4 -> ProfileScreen(authViewModel = authViewModel, navController = navController)
            }
        }
    }
}