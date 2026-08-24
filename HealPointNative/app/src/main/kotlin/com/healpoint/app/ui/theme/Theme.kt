package com.healpoint.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    primaryContainer = PrimaryLight,
    onPrimaryContainer = TextLight,
    secondary = Accent,
    onSecondary = Color.White,
    secondaryContainer = PrimaryLight,
    onSecondaryContainer = TextLight,
    tertiary = SuccessGreen,
    onTertiary = Color.White,
    background = BackgroundLight,
    onBackground = TextLight,
    surface = SurfaceLight,
    onSurface = TextLight,
    surfaceVariant = PrimaryLight,
    onSurfaceVariant = TextMutedLight,
    surfaceContainerHigh = SurfaceLight,
    surfaceContainer = SurfaceLight,
    surfaceContainerLow = BackgroundLight,
    outline = BorderLight,
    outlineVariant = BorderLight,
    error = ErrorRed,
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = PrimaryDarkScheme,
    onPrimary = Color(0xFF06211D),
    primaryContainer = Color(0xFF123C36),
    onPrimaryContainer = Color(0xFFC6F4EC),
    secondary = PrimaryDarkScheme,
    onSecondary = Color(0xFF06211D),
    background = BackgroundDark,
    onBackground = TextDark,
    surface = SurfaceDark,
    onSurface = TextDark,
    surfaceVariant = Color(0xFF1B2A26),
    onSurfaceVariant = TextMutedDark,
    outline = BorderDark,
    outlineVariant = BorderDark,
    error = Color(0xFFF06B82),
    onError = Color(0xFF2A0A10),
)

@Composable
fun HealPointTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = HealPointTypography,
        content = content,
    )
}
