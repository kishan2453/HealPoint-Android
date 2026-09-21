/**
 * HealPoint - Google Sign-In bridge.
 *
 * Frontend side of the backend's `/api/v1/user/google/login` endpoint.
 *
 * Flow (authorization-code, server exchange):
 *   1. We build a Google OAuth **authorization-code** request (never a token)
 *      using the public client ID for the *current* platform (Android / iOS /
 *      Web) and the app's native redirect URI:
 *        - `healpoint://oauth2redirect` in standalone / dev-client /
 *          production builds (the `healpoint` scheme comes from app.json and
 *          is registered in the Android manifest's intent filter), or
 *        - `exp://<dev-machine>:8081/--/oauth2redirect` under Expo Go (the
 *          Expo Go app registers this redirect URI itself).
 *      The user authorizes on Google's consent screen and Google redirects
 *      back to the app with a one-time authorization code.
 *   2. We forward `{ code, redirectUri, codeVerifier, clientId }` to the
 *      backend (`POST /api/v1/user/google/login`).
 *   3. The backend exchanges the code with Google using the *same* redirect
 *      URI and client ID. For the public Android/iOS clients it sends the PKCE
 *      `code_verifier` (no secret); for a Web client it attaches its
 *      `GOOGLE_CLIENT_SECRET` which never leaves the server. It then verifies
 *      the Google ID token (signature / audience / issuer / expiry / verified
 *      email) and issues the normal HealPoint JWT.
 *
 * CRASH SAFETY (kept):
 *   `expo-auth-session/providers/google`'s `useAuthRequest` THROWS at render
 *   when a platform's client ID is missing and hooks cannot be skipped
 *   conditionally, so this module builds a plain `AuthRequest` only when a
 *   usable ID exists and otherwise reports `not_configured`.
 *
 * Google OAuth configuration is intentional:
 *   - The existing Android OAuth client
 *     (`785940028671-...apps.googleusercontent.com`, package
 *     `com.healpoint.app`) is the identity used on Android. It is a *public*
 *     installed-app client: no secret exists, PKCE protects the exchange.
 *   - The exact redirect URI the app actually sends (see `getGoogleRedirectUri`)
 *     MUST also be listed on the client's "Authorized redirect URIs" in the
 *     Google Cloud Console, or Google rejects the request with
 *     `400 invalid_request` / "Access blocked … does not comply with OAuth
 *     policy".
 *   - No Google secrets are ever shipped in the mobile app — only the public
 *     client IDs via EXPO_PUBLIC_GOOGLE_* env vars.
 */
import {
  AuthRequest,
  makeRedirectUri,
  ResponseType,
  type DiscoveryDocument,
} from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { useCallback, useRef, useState } from "react";

import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from "@/lib/env";
import * as authService from "@/services/auth";
import { toErrorMessage } from "@/services/api";
import type { LoginResponse } from "@/types";

// Required by expo-auth-session: completes a pending web-auth session (e.g.
// a Google redirect that arrived before React finished starting). Idempotent.
WebBrowser.maybeCompleteAuthSession();
export type GoogleSignInStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; response: LoginResponse }
  | { status: "cancelled" }
  | { status: "error"; message: string }
  | { status: "not_configured" };

export interface GoogleSignIn {
  status: GoogleSignInStatus;
  signIn: () => Promise<void>;
  reset: () => void;
}

/** Google's well-known OAuth endpoints (same as `expo-auth-session`'s provider). */
const GOOGLE_DISCOVERY: DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
  userInfoEndpoint: "https://openidconnect.googleapis.com/v1/userinfo",
};

/** The public client ID for the *current* platform, or '' when unconfigured. */
export function getGoogleClientId(): string {
  if (Platform.OS === "android")
    return GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;
  if (Platform.OS === "ios")
    return GOOGLE_IOS_CLIENT_ID || GOOGLE_WEB_CLIENT_ID;
  return GOOGLE_WEB_CLIENT_ID;
}

/**
 * Native redirect URI that Google redirects back to after the user approves.
 * - Standalone / dev-client / production builds: `healpoint://oauth2redirect`
 *   (scheme comes from app.json and is registered in the Android manifest).
 * - Expo Go development sessions: `exp://<host>:<port>/--/oauth2redirect`.
 * This exact string must be listed in the Google OAuth client's "Authorized
 * redirect URIs", and the same value is forwarded to the backend for the
 * server-side token exchange.
 */
export function getGoogleRedirectUri(): string {
  return makeRedirectUri({ scheme: "healpoint", path: "oauth2redirect" });
}

/** True when the *current* platform has a Google client ID configured. */
export function isGoogleSignInConfigured(): boolean {
  return getGoogleClientId().length > 0;
}

function logGoogleAuthorizationRequest(authUrl: string): void {
  if (!__DEV__) return;

  try {
    const url = new URL(authUrl);
    console.log(
      "[google] authorization request",
      JSON.stringify({
        clientId: url.searchParams.get("client_id"),
        redirectUri: url.searchParams.get("redirect_uri"),
        responseType: url.searchParams.get("response_type"),
        scope: url.searchParams.get("scope"),
        statePresent: Boolean(url.searchParams.get("state")),
        codeChallengePresent: Boolean(url.searchParams.get("code_challenge")),
        codeChallengeMethod: url.searchParams.get("code_challenge_method"),
        prompt: url.searchParams.get("prompt"),
      }),
    );
  } catch {
    console.warn("[google] unable to format authorization request metadata");
  }
}

function getGoogleAuthorizationErrorMessage(error: unknown): string {
  const detail = error as {
    code?: unknown;
    description?: unknown;
    message?: unknown;
  } | null;
  const code = String(detail?.code || "").toLowerCase();
  const description = String(detail?.description || detail?.message || "");

  if (__DEV__) {
    console.warn("[google] authorization error detail:", detail);
  }

  if (code === "access_denied") {
    return "Google Sign-In was cancelled or user is not in Google Console test users.";
  }
  if (/custom uri/i.test(description)) {
    return 'Google Sign-In: "Custom URI scheme" must be enabled in Google Cloud Console for the Android Client ID. Please use email & password for now.';
  }
  if (
    code === "invalid_request" ||
    /redirect.?uri|unsupported/i.test(description)
  ) {
    return "Google Sign-In configuration needs updating in Google Console. Please use email & password for now.";
  }
  if (code === "unauthorized_client" || code === "invalid_client") {
    return "Google Sign-In client ID is not configured correctly. Please use email & password for now.";
  }
  if (code === "invalid_scope") {
    return "Google Sign-In requested an unsupported permission. Please use email & password for now.";
  }
  return "Google Sign-In could not be completed. Please try again.";
}
/**
 * Google Sign-In state + action. Call `signIn()` from the "Continue with
 * Google" button. Read `status` to render loading / errors.
 *
 * Never crashes when Google is unconfigured — `signIn()` resolves to the
 * `not_configured` status instead of touching the (throwing) Google provider.
 */
export function useGoogleSignIn(): GoogleSignIn {
  const [status, setStatus] = useState<GoogleSignInStatus>({ status: "idle" });
  const inFlight = useRef(false);
  const configured = isGoogleSignInConfigured();

  const reset = useCallback(() => {
    setStatus({ status: "idle" });
  }, []);

  const signIn = useCallback(async () => {
    // Prevent double-tapping from firing duplicate browser + backend calls.
    if (inFlight.current) return;
    const clientId = getGoogleClientId();
    const redirectUri = getGoogleRedirectUri();

    if (!configured || !clientId) {
      setStatus({ status: "not_configured" });
      return;
    }

    inFlight.current = true;
    setStatus({ status: "loading" });
    if (__DEV__) {
      console.log(
        `[google] auth start clientId=${clientId} redirectUri=${redirectUri}`,
      );
    }

    try {
      const request = new AuthRequest({
        clientId,
        responseType: ResponseType.Code,
        scopes: ["openid", "profile", "email"],
        redirectUri,
        // Public clients (Android/iOS installed-app) must prove possession of
        // the authorization code via PKCE — Google rejects the token exchange
        // without it. The verifier is forwarded to the backend, which swaps the
        // code with Google server-side using the same redirect URI.
        usePKCE: true,
        extraParams: { prompt: "select_account" },
      });

      const authUrl = await request.makeAuthUrlAsync(GOOGLE_DISCOVERY);
      logGoogleAuthorizationRequest(authUrl);
      const result = await request.promptAsync(GOOGLE_DISCOVERY, {
        url: authUrl,
      });

      if (result.type === "success") {
        const code = result.params?.code;
        if (!code) {
          setStatus({
            status: "error",
            message:
              "Google Sign-In did not return an authorization code. Please try again.",
          });
          return;
        }
        const res = await authService.googleLogin(code, request.redirectUri, {
          codeVerifier: request.codeVerifier,
          clientId,
        });
        setStatus({ status: "success", response: res });
      } else if (result.type === "error") {
        setStatus({
          status: "error",
          message: getGoogleAuthorizationErrorMessage(result.error),
        });
      } else {
        // 'cancel' and 'dismiss' are normal user choices — not an error.
        setStatus({ status: "cancelled" });
      }
    } catch (error) {
      setStatus({
        status: "error",
        message: toErrorMessage(
          error,
          "Google Sign-In failed. Please try again.",
        ),
      });
    } finally {
      inFlight.current = false;
    }
  }, [configured]);

  return { status, signIn, reset };
}
