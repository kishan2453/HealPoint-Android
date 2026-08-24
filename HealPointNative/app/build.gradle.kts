plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

// Optional per-build override:  -PHEALPOINT_API_URL=https://api.example.com/api/v1
// Empty means "use the build-type default" (see below).
val apiUrlOverride: String = (project.findProperty("HEALPOINT_API_URL") as String?)?.trim().orEmpty()

android {
    namespace = "com.healpoint.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.healpoint.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }

        buildConfigField("String", "API_BASE_URL", "\"${apiUrlOverride}\"")
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            // Debug default: Android emulator reaches the host machine's loopback
            // via 10.0.2.2. For a physical phone set -PHEALPOINT_API_URL to the
            // LAN/hosted backend URL - the app never hardcodes your LAN IP.
            buildConfigField("String", "API_BASE_URL", "\"${apiUrlOverride.ifEmpty { "http://10.0.2.2:8080/api/v1" }}\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Release builds REQUIRE an explicit HTTPS backend endpoint. Leaving
            // HEALPOINT_API_URL empty makes ApiConfig fail fast at runtime with a
            // clear diagnostic instead of shipping a fake/placeholder URL.
            buildConfigField("String", "API_BASE_URL", "\"${apiUrlOverride}\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)
    implementation(libs.coil.compose)
    implementation(libs.security.crypto)
    implementation(libs.kotlinx.coroutines.android)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
