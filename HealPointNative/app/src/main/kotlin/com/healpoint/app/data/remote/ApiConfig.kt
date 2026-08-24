package com.healpoint.app.data.remote

import com.healpoint.app.BuildConfig

/**
 * Backend URL configuration.
 *
 * The URL comes from Gradle (BuildConfig.API_BASE_URL), which itself reads the
 * `HEALPOINT_API_URL` Gradle property. Debug builds default to the Android
 * emulator loopback (10.0.2.2). Release builds REQUIRE an explicit HTTPS URL:
 * leave it empty and the app fails fast with a clear diagnostic instead of
 * silently shipping a wrong placeholder.
 */
object ApiConfig {

    private val rawBaseUrl: String = BuildConfig.API_BASE_URL.trim().trimEnd('/')

    val isConfigured: Boolean get() = rawBaseUrl.isNotBlank()

    /** Retrofit base URL - always ends with a trailing slash. */
    val baseUrl: String
        get() {
            if (!isConfigured) {
                throw IllegalStateException(
                    "No backend URL is configured. Pass -PHEALPOINT_API_URL=https://your-backend.example.com/api/v1 " +
                        "to the Gradle build (or set HEALPOINT_API_URL in gradle.properties) before building."
                )
            }
            return "$rawBaseUrl/"
        }
}
