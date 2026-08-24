package com.healpoint.app.ui

import androidx.compose.runtime.staticCompositionLocalOf
import com.healpoint.app.di.AppContainer

/** Provides the app-wide dependency container to composables. */
val LocalAppContainer = staticCompositionLocalOf<AppContainer> {
    error("LocalAppContainer was not provided. Wrap the root composable in CompositionLocalProvider.")
}
