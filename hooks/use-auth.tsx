/**
 * HealPoint - authentication context.
 *
 * Owns the JWT + cached user and keeps them in `expo-secure-store` so the
 * session survives app restarts. Registers itself as the token provider for
 * the shared API client. No secrets are logged or stored anywhere else.
 */
import {
  getStorageItem,
  setStorageItem,
  deleteStorageItem,
  getStorageItemSync,
  setStorageItemSync,
  deleteStorageItemSync,
} from "@/lib/storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  registerAuthTokenProvider,
  setAuthReady,
  ApiClientError,
} from "@/services/api";
import * as authService from "@/services/auth";
import { initSocket, disconnectSocket } from "@/services/socket";
import type {
  DoctorAccount,
  DoctorHospitalContext,
  UpdateProfilePayload,
  User,
} from "@/types";

const TOKEN_KEY = "healpoint.auth.token";
const USER_KEY = "healpoint.auth.user";
const ONBOARDING_KEY = "healpoint.onboarding.completed";

/**
 * Minimal session identity persisted to hardware SecureStore (< 150 bytes).
 *
 * SecureStore is designed for small credentials and tokens. Large objects,
 * photos (e.g. base64 image strings), medical histories, or addresses
 * exceed 2048 bytes and trigger warnings/rejections.
 *
 * The authoritative full User profile is always fetched fresh from the server
 * on startup via `authService.getProfile(userId)`.
 */
type StoredUser = {
  _id: string;
  name: string;
  email: string;
  role?: User["role"];
  hospitalId?: string;
  hospitalName?: string;
  authProvider?: User["authProvider"];
};

function toStoredUser(user: User): User {
  return { ...user };
}

function fromStoredUser(stored: User): User {
  return { ...stored };
}

/**
 * Map a doctor record returned by `/doctor/login` / `/doctor/panel/:id` onto the
 * shared `User` shape. The backend stores doctors in their own `doctors`
 * collection and the role guard (`RoleRoute`/`RoleGuard` with 'doctor') resolves
 * the session to the `(doctor)` portal purely from `user.role`. The hospital
 * context comes from the server-resolved login response (never client input).
 */
function toUserFromDoctor(
  doctor: DoctorAccount,
  hospital?: DoctorHospitalContext | null,
): User {
  return {
    _id: doctor._id,
    name: doctor.name || "Doctor",
    email: doctor.email || doctor.portalEmail || "",
    ...(doctor.image ? { image: doctor.image } : {}),
    ...(doctor.phone ? { phone: doctor.phone } : {}),
    role: "doctor",
    isActive: doctor.isActive,
    ...(hospital?._id || doctor.hospitalId
      ? { hospitalId: String(hospital?._id || doctor.hospitalId) }
      : {}),
    ...(hospital?.name || doctor.hospitalName
      ? { hospitalName: hospital?.name || doctor.hospitalName || "" }
      : {}),
  };
}

/** True when the error means the token is expired/revoked (HTTP 401). */
function isUnauthorizedError(error: unknown): boolean {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status?: number }).status === 401;
  }
  return false;
}

/**
 * Safely verify if a JWT has passed its expiration time client-side.
 * Returns true only if the token has an exp claim that is in the past.
 */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    let jsonStr = "";
    if (typeof atob === "function") {
      jsonStr = atob(base64);
    } else if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(base64, "base64").toString("utf-8");
    }
    if (!jsonStr) return false;
    const payload = JSON.parse(jsonStr);
    if (payload && typeof payload.exp === "number") {
      // Check expiration with a 10-second grace window
      return payload.exp < Date.now() / 1000 - 10;
    }
    return false;
  } catch {
    return false;
  }
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  markOnboardingCompleted: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (
    nameOrPayload: string | authService.RegisterPayload,
    email?: string,
    password?: string,
  ) => Promise<User>;
  /** Persist a session issued outside the email/password form (e.g. Google). */
  signInWithToken: (token: string, user: User) => Promise<void>;
  /**
   * Authenticate a doctor against their selected hospital via `/doctor/login`.
   * The backend verifies the doctor ↔ hospital relationship server-side.
   */
  signInAsDoctor: (
    email: string,
    password: string,
    hospitalId: string,
  ) => Promise<User>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<User | null>;
  updateStoredProfile: (patch: UpdateProfilePayload) => Promise<User | null>;
  changeAccountEmail: (password: string, newEmail: string) => Promise<User | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronous recovery on web ensures token and user are available on the very first render tick
  const initialToken = getStorageItemSync(TOKEN_KEY);
  let initialUser: User | null = null;
  const initialUserRaw = getStorageItemSync(USER_KEY);
  if (initialUserRaw) {
    try {
      initialUser = fromStoredUser(JSON.parse(initialUserRaw) as StoredUser);
    } catch {
      initialUser = null;
    }
  }
  const initialOnboarding = getStorageItemSync(ONBOARDING_KEY) === "true";

  const [token, setToken] = useState<string | null>(initialToken);
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialToken);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(initialOnboarding);
  const tokenRef = useRef<string | null>(initialToken);

  // Register the token provider immediately
  registerAuthTokenProvider(() => tokenRef.current || getStorageItemSync(TOKEN_KEY));
  if (initialToken && !isJwtExpired(initialToken)) {
    setAuthReady(true);
  }

  const markOnboardingCompleted = useCallback(async () => {
    setHasSeenOnboarding(true);
    setStorageItemSync(ONBOARDING_KEY, "true");
    try {
      await setStorageItem(ONBOARDING_KEY, "true");
    } catch (error) {
      console.warn("Unable to persist onboarding completion", error);
    }
  }, []);

  const persistAuth = useCallback(async (nextToken: string, nextUser: User) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
    setHasSeenOnboarding(true);
    setStorageItemSync(TOKEN_KEY, nextToken);
    setStorageItemSync(USER_KEY, JSON.stringify(toStoredUser(nextUser)));
    setStorageItemSync(ONBOARDING_KEY, "true");
    setAuthReady(true);
    try {
      await setStorageItem(TOKEN_KEY, nextToken);
      await setStorageItem(
        USER_KEY,
        JSON.stringify(toStoredUser(nextUser)),
      );
      await setStorageItem(ONBOARDING_KEY, "true");
    } catch (error) {
      // Storage errors should never break the current run; in-memory session
      // is enough until the next app start.
      console.warn("Unable to persist auth session", error);
    }
  }, []);

  const clearAuth = useCallback(async () => {
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    deleteStorageItemSync(TOKEN_KEY);
    deleteStorageItemSync(USER_KEY);
    try {
      await deleteStorageItem(TOKEN_KEY);
      await deleteStorageItem(USER_KEY);
    } catch (error) {
      console.warn("Unable to clear stored session", error);
    }
  }, []);

  // Register the token provider for the API client exactly once.
  useEffect(() => {
    registerAuthTokenProvider(() => tokenRef.current || getStorageItemSync(TOKEN_KEY));
  }, []);

  // Synchronize WebSocket lifecycle with auth session.
  useEffect(() => {
    if (token) {
      initSocket(token);
    } else {
      disconnectSocket();
    }
  }, [token]);

  // Restore the persisted session on startup.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const [storedToken, storedUser, storedOnboarding] = await Promise.all([
          getStorageItem(TOKEN_KEY),
          getStorageItem(USER_KEY),
          getStorageItem(ONBOARDING_KEY),
        ]);

        if (cancelled) return;

        if (storedOnboarding === "true") {
          setHasSeenOnboarding(true);
        }

        if (!storedToken) {
          setIsLoading(false);
          setAuthReady(true);
          return;
        }

        // Verify if token has truly expired client-side
        if (isJwtExpired(storedToken)) {
          console.warn("[auth] Stored JWT token has expired; clearing session.");
          await clearAuth();
          if (!cancelled) {
            setIsLoading(false);
            setAuthReady(true);
          }
          return;
        }

        tokenRef.current = storedToken;
        setToken(storedToken);
        setAuthReady(true);

        if (storedUser) {
          try {
            setUser(fromStoredUser(JSON.parse(storedUser) as StoredUser));
          } catch {
            // keep existing user
          }
        }

        // Revalidate the token against the server in the background. If the
        // token is expired/revoked (HTTP 401) we clear the session; if the
        // backend is simply unreachable we keep the cached session in memory so
        // the user is not logged out by a transient network problem.
        try {
          const parsedUser = storedUser
            ? (JSON.parse(storedUser) as StoredUser)
            : null;
          const userId = parsedUser?._id;
          if (userId) {
            if (parsedUser?.role === "doctor") {
              // Doctor sessions are revalidated against their own `doctors`
              // record (`doctorAuth`), never against the patient `users` API.
              const panel = await authService.getDoctorProfile(userId);
              if (!cancelled) {
                const updatedDoctorUser = panel.doctor
                  ? toUserFromDoctor(panel.doctor)
                  : fromStoredUser(parsedUser);
                setUser(updatedDoctorUser);
                setStorageItemSync(
                  USER_KEY,
                  JSON.stringify(toStoredUser(updatedDoctorUser)),
                );
                await setStorageItem(
                  USER_KEY,
                  JSON.stringify(toStoredUser(updatedDoctorUser)),
                );
              }
            } else {
              const res = await authService.getProfile(userId);
              if (!cancelled && res?.user) {
                setUser(res.user);
                setStorageItemSync(
                  USER_KEY,
                  JSON.stringify(toStoredUser(res.user)),
                );
                await setStorageItem(
                  USER_KEY,
                  JSON.stringify(toStoredUser(res.user)),
                );
              }
            }
          }
        } catch (error) {
          // Only clear session if token is truly expired.
          // Non-expired tokens with transient network or server errors are preserved.
          if (!cancelled && isUnauthorizedError(error) && storedToken && isJwtExpired(storedToken)) {
            await clearAuth();
          }
        }
      } catch (error) {
        console.warn("Session restore failed", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setAuthReady(true);
        }
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
      try {
        const res = await authService.login({ email, password });
        if (!res.token || !res.user) {
          throw new Error(
            "Login response did not include a session token or user.",
          );
        }
        await persistAuth(res.token, res.user);
        return res.user;
      } catch (error) {
        // Doctors authenticate against the separate `doctors` collection via
        // `/doctor/login`, so a NOT_FOUND ("User not found") from `/user/login`
        // simply means the email is not a patient/admin account — try the doctor
        // portal login before giving up so the Doctor portal actually opens for
        // doctor credentials.
        if (error instanceof ApiClientError && error.category === "NOT_FOUND") {
          const doctorRes = await authService.doctorLogin({ email, password });
          const user = toUserFromDoctor(doctorRes.doctor);
          await persistAuth(doctorRes.token, user);
          return user;
        }
        throw error;
      }
    },
    [persistAuth],
  );

  const signUp = useCallback(
    async (
      nameOrPayload: string | authService.RegisterPayload,
      email?: string,
      password?: string,
    ) => {
      let payload: authService.RegisterPayload;
      if (typeof nameOrPayload === "object" && nameOrPayload !== null) {
        payload = nameOrPayload;
      } else {
        payload = {
          name: nameOrPayload,
          email: email || "",
          password: password || "",
        };
      }
      const res = await authService.register(payload);
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

  const signInAsDoctor = useCallback(
    async (email: string, password: string, hospitalId: string) => {
      const res = await authService.doctorLogin({
        email,
        password,
        hospitalId,
      });
      const user = toUserFromDoctor(res.doctor, res.hospital);
      await persistAuth(res.token, user);
      return user;
    },
    [persistAuth],
  );

  const signOut = useCallback(async () => {
    // Notify server session cleanup in parallel; never block client teardown
    authService.logout().catch(() => {
      // Best-effort session closure
    });
    await clearAuth();
  }, [clearAuth]);

  const refreshProfile = useCallback(async (): Promise<User | null> => {
    if (!user?._id || !tokenRef.current) return null;
    if (user.role === "doctor") {
      const panel = await authService.getDoctorProfile(user._id);
      const next = panel.doctor ? toUserFromDoctor(panel.doctor) : user;
      setUser(next);
      try {
        await setStorageItem(
          USER_KEY,
          JSON.stringify(toStoredUser(next)),
        );
      } catch (e) {
        console.warn("[auth] Failed to persist user profile", e);
      }
      return next;
    }
    const res = await authService.getProfile(user._id);
    setUser(res.user);
    try {
      await setStorageItem(
        USER_KEY,
        JSON.stringify(toStoredUser(res.user)),
      );
    } catch (e) {
      console.warn("[auth] Failed to persist user profile", e);
    }
    return res.user;
  }, [user?._id, user?.role]);

  const updateStoredProfile = useCallback(
    async (patch: UpdateProfilePayload): Promise<User | null> => {
      if (!user?._id || !tokenRef.current) return null;
      // Doctor profiles are managed through the doctor portal API; the generic
      // patient update endpoint (`/user/update/:id`) belongs to the `users`
      // collection only and would 404 for a doctor id.
      if (user.role === "doctor") return user;
      const res = await authService.updateProfile(user._id, patch);
      setUser(res.user);
      try {
        await setStorageItem(
          USER_KEY,
          JSON.stringify(toStoredUser(res.user)),
        );
      } catch (e) {
        console.warn("[auth] Failed to persist updated user profile", e);
      }
      return res.user;
    },
    [user?._id, user?.role],
  );

  const changeAccountEmail = useCallback(
    async (password: string, newEmail: string): Promise<User | null> => {
      const res = await authService.changeEmail({ password, newEmail });
      setUser(res.user);
      if (res.token) {
        setToken(res.token);
        tokenRef.current = res.token;
        try {
          await setStorageItem(TOKEN_KEY, res.token);
        } catch (e) {
          console.warn("[auth] Failed to persist new token", e);
        }
      }
      try {
        await setStorageItem(
          USER_KEY,
          JSON.stringify(toStoredUser(res.user)),
        );
      } catch (e) {
        console.warn("[auth] Failed to persist updated email profile", e);
      }
      return res.user;
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(tokenRef.current && user),
      hasSeenOnboarding,
      markOnboardingCompleted,
      signIn,
      signUp,
      signInWithToken,
      signInAsDoctor,
      signOut,
      refreshProfile,
      updateStoredProfile,
      changeAccountEmail,
    }),
    [
      user,
      token,
      isLoading,
      hasSeenOnboarding,
      markOnboardingCompleted,
      signIn,
      signUp,
      signInWithToken,
      signInAsDoctor,
      signOut,
      refreshProfile,
      updateStoredProfile,
      changeAccountEmail,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return context;
}
