package com.healpoint.app

import android.app.Application
import com.healpoint.app.di.AppContainer

/**
 * Application entry point. Holds the app-wide dependency container so that
 * Activities/composables can reach the repositories and session manager.
 */
class HealPointApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
