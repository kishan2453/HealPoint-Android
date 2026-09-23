/**
 * HealPoint - environment configuration.
 *
 * The API base URL is resolved at runtime. Resolution order:
 *
 *   1. `EXPO_PUBLIC_API_URL` if set to a non-empty value in `.env`.
 *   2. The Metro dev server host, detected from every source expo-constants
 *      exposes in SDK 54:
 *        - `Constants.expoConfig.hostUri`        (Expo Go / dev builds)
 *        - `Constants.expoGoConfig.debuggerHost` (Expo Go)
 *        - `Constants.manifest2.extra.expoGo.debuggerHost` (legacy manifest)
 *        - `Constants.manifest.debuggerHost`     (legacy classic manifest)
 *        - `Constants.linkingUri`                (exp://host:port fallback)
 *      The Metro host runs the Express backend on port 8080, so a phone on the
 *      same Wi-Fi can reach it automatically.
 *   3. A clearly-labelled placeholder URL so the API client can show a useful
 *      diagnostic instead of silently hitting `localhost`.
 *
 * In addition, run `npm run detect:ip` on the dev machine once to write the
 * laptop's real LAN IPv4 into `.env` (`EXPO_PUBLIC_API_URL`). That is the most
 * reliable configuration for a physical Android device and does not depend on
 * Metro host detection at all.
 *
 * Only variables prefixed with EXPO_PUBLIC_ are exposed to the client. No
 * secrets belong here.
 */
import Constants from "expo-constants";

/** The Express backend always listens on this port on the same machine. */
export const API_PORT = 8080;

/** Verified active Wi-Fi LAN IPv4 of the backend host. */
export const DEFAULT_LAN_IP = "192.168.1.36";

/** Every API route lives under this base path on the backend. */
export const API_BASE_PATH = "/api/v1";

/** Sentinal host used when no API host could be resolved yet. */
export const PLACEHOLDER_HOST = "LAN-IP-NOT-CONFIGURED";

/** Environment-supplied override (may be undefined or empty). */
function envApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (!fromEnv || fromEnv.trim().length === 0) return "";
  let url = fromEnv.trim().replace(/\/+$/, "");
  // Sanitize localhost/127.0.0.1 on physical mobile devices
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    url = url.replace(/(localhost|127\.0\.0\.1)/g, DEFAULT_LAN_IP);
  }
  return url;
}

function isPrivateLanUrl(url: string): boolean {
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    /https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url)
  );
}

/**
 * Extract just the host part from a Metro-derived string.
 *
 * Handles every shape we actually see from expo-constants:
 *   `192.168.1.34:8081`         → `192.168.1.34`
 *   `[fe80::1]:8081`            → `fe80::1`
 *   `exp://192.168.1.34:8081`   → `192.168.1.34`
 *   `http://192.168.1.34:8081/` → `192.168.1.34`
 */
function extractHost(candidate: unknown): string {
  if (typeof candidate !== "string") return "";
  let value = candidate.trim();
  if (!value) return "";

  // Strip `scheme://` (exp://, http://, https://).
  const scheme = value.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//);
  if (scheme) value = value.slice(scheme[0].length);

  // Strip any path / query.
  value = value.split("/")[0].split("?")[0];

  // Bracketed IPv6 literal: [fe80::1]:8081
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end > 1 ? value.slice(1, end) : "";
  }

  // host:port (IPv4 or hostname)
  const portMatch = value.match(/^(.*?):\d{2,5}$/);
  if (portMatch) return portMatch[1].trim();

  return value.trim();
}

/**
 * Detect the dev machine's LAN host from every source expo-constants exposes.
 * Returns '' when no dev-server host information is available at all.
 */
function detectMetroHost(): string {
  // `expoGoConfig` / `manifest2` / `manifest` are not typed in every
  // expo-constants build, so access them defensively through plain objects.
  const constants = Constants as unknown as Record<string, unknown>;

  const expoGoDebuggerHost = (
    constants.expoGoConfig as { debuggerHost?: unknown } | null | undefined
  )?.debuggerHost;

  const manifest2ExpoGoDebuggerHost = (
    (
      constants.manifest2 as
        | { extra?: { expoGo?: { debuggerHost?: unknown } } }
        | null
        | undefined
    )?.extra?.expoGo as { debuggerHost?: unknown } | undefined
  )?.debuggerHost;

  const manifestDebuggerHost = (
    constants.manifest as { debuggerHost?: unknown } | null | undefined
  )?.debuggerHost;

  const candidates = [
    Constants.expoConfig?.hostUri,
    expoGoDebuggerHost,
    manifest2ExpoGoDebuggerHost,
    manifestDebuggerHost,
    Constants.linkingUri,
  ];

  for (const candidate of candidates) {
    const host = extractHost(candidate);
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  }

  return "";
}

export function resolveApiUrl(): string {
  const host = detectMetroHost();
  const explicit = envApiUrl();

  // If Metro dev server host is detected in development, it reflects the exact
  // machine IP the physical device or simulator is connected to right now.
  // We prefer it over explicit LAN/localhost settings (which often become stale
  // when moving between Wi-Fi networks).
  // Explicit non-LAN URLs (e.g. HTTPS production or ngrok tunnel) are respected.
  if (host) {
    if (!explicit || isPrivateLanUrl(explicit)) {
      return `http://${host}:${API_PORT}${API_BASE_PATH}`;
    }
    return explicit;
  }

  if (explicit) return explicit;

  // Fallback to verified local LAN IP so physical device always works
  return `http://${DEFAULT_LAN_IP}:${API_PORT}${API_BASE_PATH}`;
}

export const API_URL = resolveApiUrl();
/**
 * Default per-request timeout. Long enough for a real backend over Wi-Fi, short
 * enough that the UI never appears stuck forever. Individual calls can still
 * pass a shorter `timeout` (see `services/auth.ts` for the login request).
 */
export const API_TIMEOUT_MS = 15000;

/**
 * Quick per-request timeout for tiny reads (badges, single-day lookups).
 * Fail fast instead of holding a header hostage behind the full catalog
 * budget. Used by notification badges + calendar day chips.
 */
export const API_QUICK_TIMEOUT_MS = 6000;

/**
 * Google OAuth client IDs — safe to expose to the client (they are public).
 * Used with `expo-auth-session` to obtain a one-time authorization code that
 * the backend then exchanges + validates with Google server-side (the *secret*
 * never leaves the server). Empty when Google Sign-In is not configured for a
 * platform.
 *
 * The app sends the client ID of the *current platform* (see
 * `services/google.ts`). On Android that is
 * `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` — the public installed-app client
 * (`com.healpoint.app`). The redirect URI sent is the app's native scheme URI
 * (`healpoint://oauth2redirect` in standalone/dev-client/production builds,
 * `exp://…/--/oauth2redirect` under Expo Go) and MUST be listed in that
 * client's "Authorized redirect URIs" in the Google Cloud Console.
 *
 * NOTE: Never hard-code a client ID here, and never pass these to the Google
 * auth provider unless the value for the current platform is actually set —
 * expo-auth-session throws a render error if `androidClientId` is undefined.
 */
export const GOOGLE_ANDROID_CLIENT_ID = (
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || ""
).trim();
export const GOOGLE_IOS_CLIENT_ID = (
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || ""
).trim();

// Legacy single-value variable (EXPO_PUBLIC_GOOGLE_CLIENT_ID) is kept as an
// alias for the web client ID for backward compatibility.
export const GOOGLE_WEB_CLIENT_ID = (
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  ""
).trim();

/**
 * Optional public HTTPS callback for a *Web* OAuth client (used only when the
 * app is configured with the Web-client flow instead of the native scheme
 * flow). This is public configuration, never a client secret. It must be the
 * same value used by the backend for the Google token exchange.
 */
export const GOOGLE_OAUTH_REDIRECT_URI = (
  process.env.EXPO_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI || ""
).trim();

/**
 * Razorpay Key ID — a public identifier that is safe to bundle with the app
 * (the backend normally returns it alongside each order). This is only a
 * development fallback for backends that do not return it in the order
 * response.
 *
 * SECURITY: the matching RAZORPAY_KEY_SECRET must NEVER appear here or any
 * other client file. It stays in the backend `.env` and is only used
 * server-side to create orders and verify signatures.
 */
export const RAZORPAY_KEY_ID = (
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || ""
).trim();

/** True when any Google OAuth client ID is configured on *some* platform. */
export function isGoogleConfigured(): boolean {
  return (
    GOOGLE_ANDROID_CLIENT_ID.length > 0 ||
    GOOGLE_IOS_CLIENT_ID.length > 0 ||
    GOOGLE_WEB_CLIENT_ID.length > 0
  );
}

/** True when a real API host was resolved (no placeholder in the URL). */
export function isApiUrlConfigured(): boolean {
  return (
    !API_URL.includes(PLACEHOLDER_HOST) &&
    !API_URL.includes("localhost") &&
    !API_URL.includes("127.0.0.1")
  );
}

/** Host-only description used by the dev-time connection diagnostic. */
export function describeApiEndpoint(): string {
  try {
    return API_URL.replace(/^https?:\/\//, "");
  } catch {
    return "unknown";
  }
}

export type ApiUrlType = "localhost" | "lan" | "public" | "unconfigured";

export function getApiUrlType(url: string = API_URL): ApiUrlType {
  if (!url || url.includes(PLACEHOLDER_HOST)) return "unconfigured";
  if (url.includes("localhost") || url.includes("127.0.0.1"))
    return "localhost";
  if (isPrivateLanUrl(url)) return "lan";
  return "public";
}

export interface ApiDiagnosticInfo {
  apiUrl: string;
  endpoint: string;
  environment: "development" | "production";
  urlType: ApiUrlType;
  source: string;
  isConfigured: boolean;
}

export function getApiDiagnosticInfo(): ApiDiagnosticInfo {
  const source = envApiUrl()
    ? "EXPO_PUBLIC_API_URL"
    : detectMetroHost()
      ? "Metro dev server host"
      : "verified LAN IP fallback";
  return {
    apiUrl: API_URL,
    endpoint: describeApiEndpoint(),
    environment: __DEV__ ? "development" : "production",
    urlType: getApiUrlType(API_URL),
    source,
    isConfigured: isApiUrlConfigured(),
  };
}

/** Safe runtime diagnostic log (never includes tokens, keys, or credentials). */
const _diagnostic = getApiDiagnosticInfo();
console.log(
  `[HealPoint API] URL: ${_diagnostic.apiUrl} | Env: ${_diagnostic.environment} | Type: ${_diagnostic.urlType} | Source: ${_diagnostic.source}`,
);
