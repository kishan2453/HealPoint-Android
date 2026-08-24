# HealPoint Mobile (Expo / React Native)

The HealPoint patient & role-based mobile app, built with Expo SDK 54 and
React Native. It talks to the HealPoint backend at
`Doctor-apppointment/server-with-client` (Express + MongoDB).

## Features

- Premium Login / Sign Up with validation, show/hide password, password
  strength meter, Terms & Privacy consent.
- "Continue with Google" (OAuth authorization-code flow, exchanged
  server-side; no secrets in the app).
- Session persistence via `expo-secure-store` with automatic restore on
  launch (no blank screens, no redirect loops).
- Role-based routing: Patient `(drawer)` (premium role-aware drawer),
  Doctor `(doctor)`, Admin `(admin)`, Super Admin `(super-admin)`.
- Development-only backend connection diagnostic on the auth screens.

## 1. Install

```bash
npm install
```

## 2. Backend

From `../Doctor-apppointment/server-with-client`:

```bash
npm install
npm start        # or: npm run server (nodemon)
```

The server listens on `0.0.0.0:8080` (already configured) and exposes:

- `POST /api/v1/user/login`
- `POST /api/v1/user/register`
- `POST /api/v1/user/google/login`
- `GET  /api/v1/health`

## 3. Configure the API URL (physical Android phone)

The app resolves the backend base URL at runtime in this order:

1. `EXPO_PUBLIC_API_URL` from `.env` (highest priority).
2. The Metro dev-server host detected from `expo-constants` (`hostUri`,
   `expoGoConfig.debuggerHost`, `linkingUri`, …). Expo Go forwards the
   laptop's LAN IP, so `http://<laptop-IP>:8080/api/v1` is built
   automatically when running on the same Wi-Fi.
3. A labelled placeholder (`LAN-IP-NOT-CONFIGURED`) that only ever shows up
   as a clear development message.

**Recommended** — bake the real Wi-Fi IP into `.env` once:

```bash
npm run detect:ip          # picks the real Wi-Fi adapter, writes .env
npx expo start --clear     # restart Expo so the value is loaded
```

If your Wi-Fi IP changes later, re-run with `--force`:

```bash
npm run detect:ip -- --force
```

You can also set it manually in `.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.34:8080/api/v1
```

> Never use `localhost` / `127.0.0.1` for a physical Android phone.

### Windows Firewall (port 8080)

If the phone still cannot reach the backend, allow Node.js / port 8080 on
the private network (run PowerShell as Administrator):

```powershell
New-NetFirewallRule -DisplayName "HealPoint dev 8080" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Private
```

Verify from the phone's browser: `http://<laptop-IP>:8080/api/v1/health`.

## 4. Google Sign-In (optional)

The app reads platform-specific OAuth client IDs from `.env`:

```dotenv
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android-web/native-client-id>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>
```

1. Create OAuth 2.0 credentials at
   https://console.cloud.google.com/apis/credentials. Create **Web** and
   **Android** application credentials (the Android type is required for
   native Google Sign-In on a physical device).
2. Put the **client secret** only in the backend `.env`
   (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
3. Put the public **Android / iOS / Web client IDs** in the mobile `.env`
   (see above). If a platform's ID is empty, the "Continue with Google" button
   shows a friendly message instead of crashing — email/password still works.
4. Register the app's OAuth redirect URI in the Google console
   ("Authorized redirect URIs"). On a dev phone through Expo Go it is
   printed by the app when you press the button; typical value:
   `exp://<laptop-IP>:8081/--/oauth2redirect`.

The mobile app only ever sends a one-time authorization code + redirect URI
to the backend, which exchanges and validates it with Google server-side.

## 5. Razorpay Online Payments

The app includes a full **Razorpay** integration: patients can pay the
consultation fee online when booking (`Pay Online` in the booking screen) or
later from the appointment details / a dedicated **Secure payment** screen.
The flow is always:

```
Book appointment → Pay Online → backend creates Razorpay Order
→ native Razorpay Checkout → payment → backend signature verification
→ payment SUCCESS → appointment confirmed
```

### Mobile setup

1. The official `react-native-razorpay` SDK is already a dependency and is
   patched (`patches/react-native-razorpay+3.0.0.patch`, applied automatically
   by `postinstall` → `patch-package`) so it compiles against RN 0.81.
2. `.env` (optional, see `.env.example`):
   ```dotenv
   EXPO_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   ```
   The **Key ID is public** and safe to bundle. The **Key Secret must only
   exist in the backend `.env`** — never here, never in `app.json`, never in
   git.
3. The SDK contains native Android/iOS code, so it is **not available in
   Expo Go**. Build a development build or an APK/AAB with prebuild/EAS
   (see section 7 below).

### Backend setup

The backend (in `Doctor-apppointment/server-with-client`) must expose three
endpoints. The exact contracts, reference code and the payment state machine
are documented in [`RAZORPAY_BACKEND_IMPLEMENTATION.md`](./RAZORPAY_BACKEND_IMPLEMENTATION.md):

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/appointment/create` | Creates the booking and, for `paymentMethod: "online"`, a Razorpay Order server-side |
| `POST /api/v1/appointment/payment/order/:appointmentId` | Creates/re-creates an order for an existing booking (retry / pay-later) |
| `POST /api/v1/appointment/verify-payment` | Verifies the Razorpay signature (HMAC-SHA256) and only then marks `SUCCESS` + confirms the booking |

Backend `.env`:
```dotenv
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=<long-secret>
```

Until the backend endpoints exist, the app shows an honest "online payment is
not configured yet" failure — it never fakes a successful payment.

## 6. Run the app

```bash
npx expo start
```

Scan the QR code with Expo Go (phone and laptop on the same Wi-Fi).

> **Razorpay note:** online payment needs the native module, which Expo Go does
> not include. Use `npx expo run:android` (development build) or an EAS build.

## 7. Scripts

| Command                  | Purpose                                              |
| ------------------------ | ---------------------------------------------------- |
| `npm start`              | Start Expo                                            |
| `npm run detect:ip`      | Write the laptop's real Wi-Fi IP into `.env`          |
| `npm run typecheck`      | TypeScript check (`tsc --noEmit`)                     |
| `npm run lint`           | ESLint (`expo lint`)                                  |
| `npm run postinstall`    | Re-apply `patches/*` via patch-package (runs on `npm install`) |

