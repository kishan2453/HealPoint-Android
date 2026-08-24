package com.healpoint.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.CompositionLocalProvider
import com.healpoint.app.ui.LocalAppContainer
import com.healpoint.app.ui.HealPointRoot
import com.healpoint.app.ui.theme.HealPointTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val container = (application as HealPointApp).container

        setContent {
            CompositionLocalProvider(LocalAppContainer provides container) {
                HealPointTheme {
                    HealPointRoot()
                }
            }
        }
    }
}
