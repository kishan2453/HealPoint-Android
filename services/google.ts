/**
 * HealPoint - Google Sign-In bridge.
 *
 * Frontend side of the backend's `/api/v1/user/google/login` endpoint.
 *
 * Flow:
 *   1. We build a Google OAuth **authorization-code** request (never a token)
 *      and open Google's consent screen. The user gets a one-time code plus the
 *      exact redirect URI that was used.
 *   2. We forward `{ code, redirectUri }` to the backend.
 *   3. The backend exchanges the code with Google using the *same* redirect URI
 *      (its `GOOGLE_CLIENT_SECRET` never leaves the server), verifies the
 *      ID token, and issues the normal HealPoint JWT.
 *
 * IMPORTANT (the crash fix):
 *   `expo-auth-session/providers/google`'s `useAuthRequest` THROWS a render
 *   error ("Client Id property `androidClientId` must be defined...") whenever a
 *   platform's client ID is missing. Because hooks cannot be skipped
 *   conditionally, we deliberately do NOT use that provider hook. Instead we
 *   build a plain `AuthRequest` only when (and only if) the current platform has
 *   a real client ID configured. When there is no configuration we never touch
 *   the Google provider and simply report `not_configured`, so the Login /
 *   Sign Up screens can never crash on Android for missing credentials.
 *
 * No Google secrets are ever shipped in the mobile app — only the public client
 * IDs via EXPO_PUBLIC_GOOGLE_* env vars.
 */
import {
  AuthRequest,
  makeRedirectUri,
  ResponseType,
  type DiscoveryDocument,
} from 'expo-auth-session';
import { Platform } from 'react-native';
import { useCallback, useState } from 'react';

import {
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
} from '@/lib/env';
import * as authService from '@/services/auth';
import { toErrorMessage } from '@/services/api';
import type { LoginResponse } from '@/types';

export type GoogleSignInStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; response: LoginResponse }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'not_configured' };

export interface GoogleSignIn {
  status: GoogleSignInStatus;
  signIn: () => Promise<void>;
}

/** Google's well-known OAuth endpoints (same as `expo-auth-session`'s provider). */
const GOOGLE_DISCOVERY: DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
};

/** The public client ID for the *current* platform, or '' when unconfigured. */
export function getGoogleClientId(): string {
  if (Platform.OS === 'android') return GOOGLE_ANDROID_CLIENT_ID;
  if (Platform.OS === 'ios') return GOOGLE_IOS_CLIENT_ID;
  return GOOGLE_WEB_CLIENT_ID;
}

/** True when the *current* platform has a Google client ID configured. */
export function isGoogleSignInConfigured(): boolean {
  return getGoogleClientId().length > 0;
}

/**
 * Google Sign-In state + action. Call `signIn()` from the "Continue with
 * Google" button. Read `status` to render loading / errors.
 *
 * Never crashes when Google is unconfigured — `signIn()` resolves to the
 * `not_configured` status instead of touching the (throwing) Google provider.
 */
export function useGoogleSignIn(): GoogleSignIn {
  const [status, setStatus] = useState<GoogleSignInStatus>({ status: 'idle' });
  const configured = isGoogleSignInConfigured();

  const signIn = useCallback(async () => {
    const clientId = getGoogleClientId();

    // Validate configuration BEFORE touching the Google OAuth provider. This is
    // the guard that prevents the androidClientId render crash on Android.
    if (!configured || !clientId) {
      setStatus({ status: 'not_configured' });
      return;
    }

    setStatus({ status: 'loading' });

    try {
      const request = new AuthRequest({
        clientId,
        responseType: ResponseType.Code,
        scopes: ['openid', 'profile', 'email'],
        redirectUri: makeRedirectUri({ path: 'oauth2redirect' }),
        // The backend exchanges the one-time code (+ this exact redirect URI) with
        // Google server-side, so we must NOT bind the code to a PKCE verifier we
        // cannot share with it.
        usePKCE: false,
      });

      const result = await request.promptAsync(GOOGLE_DISCOVERY);

      if (result.type === 'success') {
        const code = result.params?.code;
        if (!code) {
          setStatus({
            status: 'error',
            message: 'Google Sign-In did not return an authorization code. Please try again.',
          });
          return;
        }
        const res = await authService.googleLogin(code, request.redirectUri);
        setStatus({ status: 'success', response: res });
      } else if (result.type === 'error') {
        setStatus({
          status: 'error',
          message: result.error?.message || 'Google Sign-In failed. Please try again.',
        });
      } else {
        // 'cancel' and 'dismiss' are normal user choices — not an error.
        setStatus({ status: 'cancelled' });
      }
    } catch (error) {
      setStatus({
        status: 'error',
        message: toErrorMessage(error, 'Google Sign-In failed. Please try again.'),
      });
    }
  }, [configured]);

  return { status, signIn };
}
