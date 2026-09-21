/**
 * HealPoint - authentication context.
 *
 * Owns the JWT + cached user and keeps them in `expo-secure-store` so the
 * session survives app restarts. Registers itself as the token provider for
 * the shared API client. No secrets are logged or stored anywhere else.
 */
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { registerAuthTokenProvider, ApiClientError } from "@/services/api";
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
 * Minimal user snapshot persisted to SecureStore.
 *
 * `expo-secure-store` warns (and on some platforms rejects) values larger than
 * 2048 bytes. The full `User` object can exceed that once favorites / stats are
 * present, so we only persist the subset the UI needs to render a cached
 * session. The authoritative profile is always re-fetched from the server on
 * startup.
 */
type StoredUser = Pick<User, "_id" | "name" | "email"> & {
  image?: string;
  phone?: string;
  gender?: string;
  dob?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  role?: User["role"];
  hospitalId?: string;
  hospitalName?: string;
  authProvider?: User["authProvider"];
  emergencyContact?: User["emergencyContact"];
};

function toStoredUser(user: User): StoredUser {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    ...(user.image ? { image: user.image } : {}),
    ...(user.phone ? { phone: user.phone } : {}),
    ...(user.gender ? { gender: user.gender } : {}),
    ...(user.dob ? { dob: user.dob } : {}),
    ...(user.address ? { address: user.address } : {}),
    ...(user.bloodGroup ? { bloodGroup: user.bloodGroup } : {}),
    ...(user.allergies ? { allergies: user.allergies } : {}),
    ...(user.chronicConditions
      ? { chronicConditions: user.chronicConditions }
      : {}),
    ...(user.emergencyContact
      ? { emergencyContact: user.emergencyContact }
      : {}),
    ...(user.role ? { role: user.role } : {}),
    ...(user.hospitalId ? { hospitalId: user.hospitalId } : {}),
    ...(user.hospitalName ? { hospitalName: user.hospitalName } : {}),
    ...(user.authProvider ? { authProvider: user.authProvider } : {}),
  };
}

function fromStoredUser(stored: StoredUser): User {
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const markOnboardingCompleted = useCallback(async () => {
    setHasSeenOnboarding(true);
    try {
      await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
    } catch (error) {
      console.warn("Unable to persist onboarding completion", error);
    }
  }, []);

  const persistAuth = useCallback(async (nextToken: string, nextUser: User) => {
    tokenRef.current = nextToken;
    setToken(nextToken);
    setUser(nextUser);
    setHasSeenOnboarding(true);
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
      await SecureStore.setItemAsync(
        USER_KEY,
        JSON.stringify(toStoredUser(nextUser)),
      );
      await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
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
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (error) {
      console.warn("Unable to clear stored session", error);
    }
  }, []);

  // Register the token provider for the API client exactly once.
  useEffect(() => {
    registerAuthTokenProvider(() => tokenRef.current);
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
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
          SecureStore.getItemAsync(ONBOARDING_KEY),
        ]);

        if (cancelled) return;

        if (storedOnboarding === "true") {
          setHasSeenOnboarding(true);
        }

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
                const user = panel.doctor
                  ? toUserFromDoctor(panel.doctor)
                  : fromStoredUser(parsedUser);
                setUser(user);
                await SecureStore.setItemAsync(
                  USER_KEY,
                  JSON.stringify(toStoredUser(user)),
                );
              }
            } else {
              const res = await authService.getProfile(userId);
              if (!cancelled) {
                setUser(res.user);
                await SecureStore.setItemAsync(
                  USER_KEY,
                  JSON.stringify(toStoredUser(res.user)),
                );
              }
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
        console.warn("Session restore failed", error);
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
      await SecureStore.setItemAsync(
        USER_KEY,
        JSON.stringify(toStoredUser(next)),
      );
      return next;
    }
    const res = await authService.getProfile(user._id);
    setUser(res.user);
    await SecureStore.setItemAsync(
      USER_KEY,
      JSON.stringify(toStoredUser(res.user)),
    );
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
      await SecureStore.setItemAsync(
        USER_KEY,
        JSON.stringify(toStoredUser(res.user)),
      );
      return res.user;
    },
    [user?._id, user?.role],
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
