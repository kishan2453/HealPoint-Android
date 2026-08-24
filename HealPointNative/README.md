# HealPoint — Native Android App

A **production-oriented native Android** (Kotlin + Jetpack Compose) replacement for the
original Expo/React Native HealPoint patient client. It talks to the **same backend API**
(`/api/v1`) and reuses every existing endpoint — nothing is mocked, and no business logic
was dropped.

It does **not** depend on Expo Go, Expo tunnel, Metro, ngrok or LAN-IP startup hacks.
It builds as a normal Android APK/AAB and launches by itself.

---

## 1. Highlights / how it maps to the original app

| Original (Expo) feature | Native Android implementation |
|--------------------------|-------------------------------|
| Registration | `RegisterScreen` → `POST /user/register` |
| Login / session | `POST /user/login`; JWT + user cached in **EncryptedSharedPreferences** |
| Logout | `POST /user/logout` + local session cleared |
| Password reset | `forgot-password → verify-otp → reset-password` screens |
| Doctor listing / search | `GET /doctor/get-all` (search + department filter) |
| Doctor detail + favorites | `GET /doctor/get-details/{id}` + `/user/favorites` toggle |
| Hospital listing/detail | `GET /hospital/public/get-all` & `get-details/{id}` |
| Booking | `GET /appointment/get-available-slots/{doctorId}?date=DD-MM-YYYY` → `POST /appointment/create` |
| My appointments | `GET /appointment/get-user-appointments/{userId}` (uses the backend's misspelled `appoinmtent` key) |
| Appointment detail | `GET /appointment/get-user-appointment-details/{id}` |
| Cancel / reschedule | `POST /appointment/cancel/{id}`, `PATCH /appointment/reschedule/{id}` |
| Notifications | `GET/PATCH/DELETE /notification/*` |
| Reviews | `POST /review/create`, `GET /review/public` (shown on doctor profile) |
| Light/dark theme | Material 3 `isSystemInDarkTheme()` |

---

## 2. Configuration (backend URL)

There is **one** configuration point and it is set at **build time** — you never hardcode a
LAN IP or edit source code to change environments.

| Build type | Default backend | Override |
|------------|-----------------|----------|
| `debug` | `http://10.0.2.2:8080/api/v1` (Android emulator → host) | `-PHEALPOINT_API_URL=https://…` |
| `release` | **Required** — fails fast if unset | `-PHEALPOINT_API_URL=https://…` |

```bash
# Debug with an emulator (defaults to 10.0.2.2)
./gradlew assembleDebug

# Debug/Release pointing at a hosted backend
./gradlew assembleRelease -PHEALPOINT_API_URL=https://api.healpoint.example.com/api/v1
```

Rationale: `10.0.2.2` is the emulator's fixed alias for the host machine (never a random LAN
IP). Release builds deliberately throw a clear diagnostic when no URL is supplied instead of
silently shipping a placeholder.

Secrets (MongoDB credentials, JWT secret, any API keys) live **only on the backend**. The
Android app holds only the public base URL and the user's own session token (encrypted).

---

## 3. Project structure (`HealPointNative/`)

```
HealPointNative/
├── settings.gradle.kts / build.gradle.kts / gradle.properties
├── gradle/libs.versions.toml          # version catalog (AGP 8.7.3, Kotlin 2.0.21, Compose BOM)
├── gradle/wrapper/gradle-wrapper.properties
└── app/
    ├── build.gradle.kts              # compileSdk 35, minSdk 26, API_URL buildConfigField
    ├── proguard-rules.pro            # R8 rules for Retrofit/Gson/OkHttp/Coil
    └── src/
        ├── main/AndroidManifest.xml  # INTERNET permission; no cleartext in release
        ├── debug/AndroidManifest.xml # cleartext allowed only in debug builds
        ├── main/res/                 # strings, colors, themes (light/dark), adaptive icon
        └── main/kotlin/com/healpoint/app/
            ├── HealPointApp.kt, MainActivity.kt      # entry points + DI container
            ├── di/AppContainer.kt                    # manual dependency wiring
            ├── data/
            │   ├── SessionManager.kt                 # EncryptedSharedPreferences (token+user)
            │   ├── AppResult.kt                      # Success/Failure + error mapping
            │   ├── remote/ApiConfig.kt, ApiClient.kt, ApiService.kt   # Retrofit + OkHttp
            │   ├── remote/dto/*.kt                   # DTOs mirroring backend JSON exactly
            │   └── repositories/*.kt                 # Auth/Doctor/Hospital/Appointment/…
            ├── util/Validation.kt, Formatters.kt, ImageUtils.kt
            ├── ui/theme/                             # Material 3 light/dark palette + type
            ├── ui/components/                        # Buttons, fields, cards, states, dialogs
            ├── ui/navigation/ (Routes, AppNavHost, MainScreen, appViewModel)
            ├── ui/auth/   (Welcome, Login, Register, Forgot, VerifyOtp, Reset)
            ├── ui/home/, ui/doctors/, ui/hospitals/, ui/appointments/, ui/profile/
            ├── ui/doctor/, ui/booking/, ui/appointment/, ui/notification/, ui/settings/
            └── viewmodel/                            # StateFlow ViewModels + factory
```

---

## 4. Commands

### Requirements
- **Android Studio** (or a machine with JDK 17 + Android SDK 35). The machine where this
  conversion was written has no JDK/SDK, so the build must run where the toolchain exists.

### Install & build (Android Studio, preferred)
1. Open the `HealPointNative` folder in Android Studio.
2. Let it sync Gradle (it generates `gradlew` / `gradle-wrapper.jar`).
3. Select a device and press **Run** (produces a debug build).

### Command line
```bash
# Generate the wrapper once if missing
gradle wrapper --gradle-version 8.9

# Debug APK
./gradlew assembleDebug

# Release APK (must supply a real backend URL) + AAB
./gradlew assembleRelease -PHEALPOINT_API_URL=https://api.healpoint.example.com/api/v1
./gradlew bundleRelease   -PHEALPOINT_API_URL=https://api.healpoint.example.com/api/v1
```

### Artifact locations
- Debug APK: `app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `app/build/outputs/apk/release/app-release.apk`
- AAB: `app/build/outputs/bundle/release/app-release.aab`

### Install on a physical phone
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
For a physical phone in debug, pass a backend the phone can reach:
```bash
./gradlew assembleDebug -PHEALPOINT_API_URL=http://<your-host>:8080/api/v1
```

---

## 5. Backend

No backend files were present in this folder, so none were changed. The client was built
against the **existing API contract** (routes, payloads and response shapes read from the
original project's `services/*.ts` and `types/index.ts`). The backend must be hosted somewhere
reachable over HTTP(S) from the phone for the app to work.

### Endpoints used
- Auth: `POST /user/register|login|logout|forgot-password|verify-otp|reset-password`,
  `GET /user/get-login-user/{id}`, `PATCH /user/update/{id}` (multipart), `PATCH /user/update-password/{id}`
- Favorites: `GET /user/favorites`, `POST /user/favorites/{id}`, `DELETE /user/favorites/{id}`
- Catalog: `GET /doctor/get-all`, `GET /doctor/get-details/{id}`,
  `GET /hospital/public/get-all`, `GET /hospital/public/get-details/{idOrSlug}`
- Appointments: `GET /appointment/get-available-slots/{doctorId}?date=DD-MM-YYYY`,
  `POST /appointment/validate-slot/{doctorId}`, `POST /appointment/create`,
  `GET /appointment/get-user-appointments/{userId}`,
  `GET /appointment/get-user-appointment-details/{id}`,
  `POST /appointment/cancel/{id}`, `PATCH /appointment/reschedule/{id}`
- Reviews: `POST /review/create`, `GET /review/public`
- Notifications: `GET|PATCH /notification/get-all|read/{id}|mark-all`, `DELETE /notification/delete/{id}`
- Settings: `GET /settings/public`

---

## 6. Known limitations / remaining work
1. **Not compiled/verified here.** This machine has no JDK + Android SDK/Gradle, so the Kotlin
   project could not be built or run here. Open it in Android Studio / build with Gradle and
   resolve any diagnostics. It is complete-by-design, not build-verified.
2. **Online payment (Razorpay)** not wired — booking defaults to **Cash** (`paymentMethod = "cash"`).
   The backend already returns `razorpayOrder`/`razorpayKey`; integrating the Razorpay SDK is
   a follow-up and was intentionally not faked.
3. **Profile-photo upload:** the backend multipart `image` field is wired, but no photo-picker
   UI was added; `EditProfileScreen` sends text fields only.
4. Favorites and notifications require auth and a reachable backend.
5. The original backend uses typos/misspellings in keys; this client deliberately mirrors them
   (e.g. the `appoinmtent` list key and `_id` fields), matching the server as source of truth.

