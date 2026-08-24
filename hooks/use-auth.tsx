/**
 * HealPoint - authentication context.
 *
 * Owns the JWT + cached user and keeps them in `expo-secure-store` so the
 * session survives app restarts. Registers itself as the token provider for
 * the shared API client. No secrets are logged or stored anywhere else.
 */
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { registerAuthTokenProvider } from '@/services/api';
import * as authService from '@/services/auth';
import type { UpdateProfilePayload, User } from '@/types';

const TOKEN_KEY = 'healpoint.auth.token';
const USER_KEY = 'healpoint.auth.user';

/**
 * Minimal user snapshot persisted to SecureStore.
 *
 * `expo-secure-store` warns (and on some platforms rejects) values larger than
 * 2048 bytes. The full `User` object can exceed that once favorites / stats are
 * present, so we only persist the subset the UI needs to render a cached
 * session. The authoritative profile is always re-fetched from the server on
 * startup.
 */
type StoredUser = Pick<User, '_id' | 'name' | 'email'> & {
  image?: string;
  phone?: string;
  role?: User['role'];
};

function toStoredUser(user: User): StoredUser {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    ...(user.image ? { image: user.image } : {}),
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.role ? { role: user.role } : {}),
  };
}

function fromStoredUser(stored: StoredUser): User {
  return { ...stored };
}

/** True when the error means the token is expired/revoked (HTTP 401). */
function isUnauthorizedError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status?: number }).status === 401;
  }
  return false;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (name: string, email: string, password: string) => Promise<User>;
  /** Persist a session issued outside the email/password form (e.g. Google). */
  signInWithToken: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
  updateStoredProfile: (patch: UpdateProfilePayload) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  const persistAuth = useCallback(async (nextToken: string, nextUser: User) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(toStoredUser(nextUser)));
    } catch (error) {
      // Storage errors should never break the current run; in-memory session
      // is enough until the next app start.
      console.warn('Unable to persist auth session', error);
    }
  }, []);

  const clearAuth = useCallback(async () => {
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (error) {
      console.warn('Unable to clear stored session', error);
    }
  }, []);

  // Register the token provider for the API client exactly once.
  useEffect(() => {
    registerAuthTokenProvider(() => tokenRef.current);
  }, []);

  // Restore the persisted session on startup.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);

        if (cancelled) return;
        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        tokenRef.current = storedToken;
        setToken(storedToken);

        if (storedUser) {
          try {
            setUser(fromStoredUser(JSON.parse(storedUser) as StoredUser));
          } catch {
            setUser(null);
          }
        }

        // Revalidate the token against the server in the background. If the
        // token is expired/revoked (HTTP 401) we clear the session; if the
        // backend is simply unreachable we keep the cached session in memory so
        // the user is not logged out by a transient network problem.
        try {
          const parsedUser = storedUser ? (JSON.parse(storedUser) as StoredUser) : null;
          const userId = parsedUser?._id;
          if (userId) {
            const res = await authService.getProfile(userId);
            if (!cancelled) {
              setUser(res.user);
              await SecureStore.setItemAsync(USER_KEY, JSON.stringify(toStoredUser(res.user)));
            }
          }
        } catch (error) {
          // Only treat a real 401 (expired/revoked token) as signed-out. A
          // non-401 failure (backend offline) keeps the cached session so the
          // user isn't logged out by a transient network problem.
          if (!cancelled && isUnauthorizedError(error)) {
            await clearAuth();
          }
        }
      } catch (error) {
        console.warn('Session restore failed', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await authService.login({ email, password });
      await persistAuth(res.token, res.user);
      return res.user;
    },
    [persistAuth],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await authService.register({ name, email, password });
      return res.user;
    },
    [],
  );

  const signInWithToken = useCallback(
    async (nextToken: string, nextUser: User) => {
      await persistAuth(nextToken, nextUser);
    },
    [persistAuth],
  );

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Logout is best-effort; local session is cleared regardless.
    }
    await clearAuth();
  }, [clearAuth]);

  const refreshProfile = useCallback(async (): Promise<User | null> => {
    if (!user?._id || !tokenRef.current) return null;
    const res = await authService.getProfile(user._id);
    setUser(res.user);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(toStoredUser(res.user)));
    return res.user;
  }, [user?._id]);

  const updateStoredProfile = useCallback(
    async (patch: UpdateProfilePayload): Promise<User | null> => {
      if (!user?._id || !tokenRef.current) return null;
      const res = await authService.updateProfile(user._id, patch);
      setUser(res.user);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(toStoredUser(res.user)));
      return res.user;
    },
    [user?._id],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(tokenRef.current && user),
      signIn,
      signUp,
      signInWithToken,
      signOut,
      refreshProfile,
      updateStoredProfile,
    }),
    [user, token, isLoading, signIn, signUp, signInWithToken, signOut, refreshProfile, updateStoredProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return context;
}
