package com.healpoint.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.healpoint.app.ui.SplashScreen
import com.healpoint.app.ui.appointment.AppointmentDetailScreen
import com.healpoint.app.ui.appointment.RescheduleScreen
import com.healpoint.app.ui.auth.ForgotPasswordScreen
import com.healpoint.app.ui.auth.LoginScreen
import com.healpoint.app.ui.auth.RegisterScreen
import com.healpoint.app.ui.auth.ResetPasswordScreen
import com.healpoint.app.ui.auth.VerifyOtpScreen
import com.healpoint.app.ui.auth.WelcomeScreen
import com.healpoint.app.ui.booking.BookingScreen
import com.healpoint.app.ui.doctor.DoctorDetailScreen
import com.healpoint.app.ui.hospital.HospitalDetailScreen
import com.healpoint.app.ui.profile.ChangePasswordScreen
import com.healpoint.app.ui.profile.EditProfileScreen
import com.healpoint.app.ui.notification.NotificationsScreen
import com.healpoint.app.ui.settings.SettingsScreen
import com.healpoint.app.viewmodel.AuthViewModel

/**
 * Navigation graph for the whole app. Top-level auth transitions
 * (welcome <-> main) are driven by [com.healpoint.app.ui.HealPointRoot].
 */
@Composable
fun AppNavHost(
    navController: NavHostController,
    authViewModel: AuthViewModel,
) {
    NavHost(navController = navController, startDestination = Routes.SPLASH) {
        composable(Routes.SPLASH) { SplashScreen() }

        composable(Routes.WELCOME) {
            WelcomeScreen(
                onLogin = { navController.navigate(Routes.LOGIN) },
                onRegister = { navController.navigate(Routes.REGISTER) },
            )
        }

        composable(Routes.LOGIN) {
            LoginScreen(
                viewModel = authViewModel,
                onBack = { navController.popBackStack() },
                onForgotPassword = { navController.navigate(Routes.FORGOT) },
            )
        }

        composable(Routes.REGISTER) {
            RegisterScreen(
                viewModel = authViewModel,
                onBack = { navController.popBackStack() },
                onGoToLogin = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.REGISTER) { inclusive = true }
                    }
                },
            )
        }

        composable(Routes.FORGOT) {
            ForgotPasswordScreen(
                viewModel = authViewModel,
                onBack = { navController.popBackStack() },
                onOtpSent = { identifier -> navController.navigate(Routes.verifyOtp(identifier)) },
            )
        }

        composable(
            route = Routes.VERIFY_OTP,
            arguments = listOf(navArgument("identifier") { type = NavType.StringType }),
        ) { entry ->
            val identifier = entry.arguments?.getString("identifier").orEmpty()
            VerifyOtpScreen(
                identifier = identifier,
                viewModel = authViewModel,
                onBack = { navController.popBackStack() },
                onVerified = { resetToken -> navController.navigate(Routes.reset(resetToken)) },
            )
        }

        composable(
            route = Routes.RESET,
            arguments = listOf(navArgument("resetToken") { type = NavType.StringType }),
        ) { entry ->
            val resetToken = entry.arguments?.getString("resetToken").orEmpty()
            ResetPasswordScreen(
                resetToken = resetToken,
                viewModel = authViewModel,
                onBack = { navController.popBackStack() },
                onDone = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(Routes.FORGOT) { inclusive = true }
                    }
                },
            )
        }

        composable(Routes.MAIN) {
            MainScreen(authViewModel = authViewModel, navController = navController)
        }

        composable(
            route = Routes.DOCTOR_DETAIL,
            arguments = listOf(navArgument("doctorId") { type = NavType.StringType }),
        ) { entry ->
            DoctorDetailScreen(doctorId = entry.arguments?.getString("doctorId").orEmpty(), navController = navController)
        }

        composable(
            route = Routes.HOSPITAL_DETAIL,
            arguments = listOf(navArgument("hospitalId") { type = NavType.StringType }),
        ) { entry ->
            HospitalDetailScreen(hospitalId = entry.arguments?.getString("hospitalId").orEmpty(), navController = navController)
        }

        composable(
            route = Routes.BOOKING,
            arguments = listOf(navArgument("doctorId") { type = NavType.StringType }),
        ) { entry ->
            BookingScreen(doctorId = entry.arguments?.getString("doctorId").orEmpty(), navController = navController)
        }

        composable(
            route = Routes.APPOINTMENT_DETAIL,
            arguments = listOf(navArgument("appointmentId") { type = NavType.StringType }),
        ) { entry ->
            val appointmentId = entry.arguments?.getString("appointmentId").orEmpty()
            AppointmentDetailScreen(appointmentId = appointmentId, navController = navController)
        }

        composable(
            route = Routes.RESCHEDULE,
            arguments = listOf(navArgument("appointmentId") { type = NavType.StringType }),
        ) { entry ->
            val appointmentId = entry.arguments?.getString("appointmentId").orEmpty()
            RescheduleScreen(appointmentId = appointmentId, navController = navController)
        }

        composable(Routes.EDIT_PROFILE) {
            EditProfileScreen(navController = navController)
        }

        composable(Routes.CHANGE_PASSWORD) {
            ChangePasswordScreen(navController = navController)
        }

        composable(Routes.NOTIFICATIONS) {
            NotificationsScreen(navController = navController)
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(navController = navController)
        }
    }
}