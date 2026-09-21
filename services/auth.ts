/**
 * Authentication & profile API — mirrors routes/userRoutes.js on the backend.
 */
import { api } from "./api";
import type {
  Doctor,
  DoctorLoginResponse,
  DoctorPanelResponse,
  DoctorSignupPayload,
  DoctorSignupResponse,
  FavoriteDoctor,
  FavoriteHospital,
  Hospital,
  LoginResponse,
  RegisterResponse,
  UpdateProfilePayload,
  User,
  VerifyOtpResponse,
} from "@/types";

const RESOURCE = "/user";

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ResetPasswordPayload {
  resetToken: string;
  newPassword: string;
}

export interface UpdatePasswordPayload {
  oldPassword: string;
  newPassword: string;
}

export async function register(
  payload: RegisterPayload,
): Promise<RegisterResponse> {
  return api.post<RegisterResponse>(`${RESOURCE}/register`, payload);
}

/**
 * Login uses a shorter timeout than the general default so a hung backend never
 * keeps the login button spinning for the full default window. Timeouts surface
 * as a clear reachability message (see `networkErrorMessage` in `services/api`),
 * not a fake "wrong password" error.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return api.post<LoginResponse>(`${RESOURCE}/login`, payload, {
    timeout: 12000,
  });
}

/**
 * Doctor portal login. Doctors authenticate against their own record in the
 * `doctors` collection (see `loginDoctor` in `doctorPanelController`) — a
 * completely separate account store from the patient/admin `users` collection.
 *
 * `hospitalId` is the hospital the doctor selected on the login screen. The
 * backend verifies the doctor actually belongs to it and rejects the login with
 * "Doctor account is not registered with the selected hospital." when not.
 */
export interface DoctorLoginPayload {
  email: string;
  password: string;
  hospitalId?: string;
}

export async function doctorLogin(
  payload: DoctorLoginPayload,
): Promise<DoctorLoginResponse> {
  return api.post<DoctorLoginResponse>(`/doctor/login`, payload, {
    timeout: 12000,
  });
}

/** Revalidate a doctor session / fetch the fresh doctor profile (doctorAuth). */
export async function getDoctorProfile(
  doctorId: string,
): Promise<DoctorPanelResponse> {
  return api.get<DoctorPanelResponse>(`/doctor/panel/${doctorId}`, {
    auth: true,
  });
}

/**
 * Doctor self-registration. The backend validates the hospital, creates the
 * doctor record with `verificationStatus: "Pending"` and notifies the hospital
 * admin — it never auto-approves. Mirrors the web doctor panel signup.
 */
export async function doctorSignup(
  payload: DoctorSignupPayload,
): Promise<DoctorSignupResponse> {
  return api.post<DoctorSignupResponse>(`/doctor/signup`, payload, {
    timeout: 15000,
  });
}

/**
 * Doctor password reset request. The backend verifies the email exists and
 * replies with the real next step for doctor accounts (admin-desk issuance).
 */
export async function doctorForgotPassword(
  email: string,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `/doctor/forgot-password`,
    { email },
  );
}

export async function googleLogin(
  code: string,
  redirectUri?: string,
  extra?: { codeVerifier?: string; clientId?: string },
): Promise<LoginResponse> {
  return api.post<LoginResponse>(
    `${RESOURCE}/google/login`,
    {
      code,
      redirectUri,
      codeVerifier: extra?.codeVerifier,
      clientId: extra?.clientId,
    },
    { timeout: 15000 },
  );
}

export async function forgotPassword(
  identifier: string,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `${RESOURCE}/forgot-password`,
    { identifier },
  );
}

export async function verifyOtp(
  identifier: string,
  otp: string,
): Promise<VerifyOtpResponse> {
  return api.post<VerifyOtpResponse>(`${RESOURCE}/verify-otp`, {
    identifier,
    otp,
  });
}

export async function resetPassword(
  payload: ResetPasswordPayload,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `${RESOURCE}/reset-password`,
    payload,
  );
}

export async function logout(): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(
    `${RESOURCE}/logout`,
    undefined,
    { auth: true, timeout: 2000, retry: 0 },
  );
}

export async function getProfile(
  userId: string,
): Promise<{ success: boolean; user: User }> {
  return api.get<{ success: boolean; user: User }>(
    `${RESOURCE}/get-login-user/${userId}`,
    { auth: true },
  );
}

/**
 * Update the patient profile. The backend expects multipart/form-data because
 * `multer` parses an optional `image` file. Pass `null`/undefined for image to
 * keep the existing photo.
 */
export async function updateProfile(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<{ success: boolean; user: User }> {
  const form = new FormData();
  if (payload.name !== undefined) form.append("name", payload.name);
  if (payload.phone !== undefined) form.append("phone", payload.phone);
  if (payload.dob !== undefined) form.append("dob", payload.dob);
  if (payload.gender !== undefined) form.append("gender", payload.gender);
  if (payload.address !== undefined) form.append("address", payload.address);
  if (payload.bloodGroup !== undefined)
    form.append("bloodGroup", payload.bloodGroup);
  if (payload.allergies !== undefined)
    form.append("allergies", JSON.stringify(payload.allergies));
  if (payload.chronicConditions !== undefined)
    form.append("chronicConditions", JSON.stringify(payload.chronicConditions));
  if (payload.emergencyContact !== undefined)
    form.append("emergencyContact", JSON.stringify(payload.emergencyContact));

  const image = payload.image;
  if (image && typeof image === "object" && "uri" in image && image.uri) {
    form.append("image", {
      uri: image.uri,
      name: image.name || "profile.jpg",
      type: image.type || "image/jpeg",
    } as unknown as Blob);
  }

  return api.patch<{ success: boolean; user: User }>(
    `${RESOURCE}/update/${userId}`,
    form,
    {
      isFormData: true,
      auth: true,
    },
  );
}

export async function updatePassword(
  userId: string,
  payload: UpdatePasswordPayload,
): Promise<{ success: boolean; message: string }> {
  return api.patch<{ success: boolean; message: string }>(
    `${RESOURCE}/update-password/${userId}`,
    payload,
    { auth: true },
  );
}

// ---------------------------------------------------------------------------
// Favorite doctors (stored on the user document)
// ---------------------------------------------------------------------------
export async function getFavorites(): Promise<{
  success: boolean;
  favorites: (Doctor & { addedAt?: string; doctorId?: string })[];
  totalCount: number;
}> {
  return api.get<{
    success: boolean;
    favorites: (Doctor & { addedAt?: string; doctorId?: string })[];
    totalCount: number;
  }>(`${RESOURCE}/favorites`, {
    auth: true,
  });
}

export async function addFavorite(
  doctorId: string,
): Promise<{ success: boolean; isFavorite: boolean; doctorId: string }> {
  return api.post<{ success: boolean; isFavorite: boolean; doctorId: string }>(
    `${RESOURCE}/favorites/${doctorId}`,
    undefined,
    {
      auth: true,
    },
  );
}

export async function removeFavorite(
  doctorId: string,
): Promise<{ success: boolean; isFavorite: boolean; doctorId: string }> {
  return api.delete<{
    success: boolean;
    isFavorite: boolean;
    doctorId: string;
  }>(`${RESOURCE}/favorites/${doctorId}`, {
    auth: true,
  });
}

// ---------------------------------------------------------------------------
// Favorite hospitals (stored on the user document)
// ---------------------------------------------------------------------------
export async function getFavoriteHospitals(): Promise<{
  success: boolean;
  favorites: (Hospital & { addedAt?: string; hospitalId?: string })[];
  totalCount: number;
}> {
  return api.get<{
    success: boolean;
    favorites: (Hospital & { addedAt?: string; hospitalId?: string })[];
    totalCount: number;
  }>(`${RESOURCE}/favorites/hospitals`, {
    auth: true,
  });
}

export async function addFavoriteHospital(
  hospitalId: string,
): Promise<{ success: boolean; isFavorite: boolean; hospitalId: string }> {
  return api.post<{
    success: boolean;
    isFavorite: boolean;
    hospitalId: string;
  }>(`${RESOURCE}/favorites/hospitals/${hospitalId}`, undefined, {
    auth: true,
  });
}

export async function removeFavoriteHospital(
  hospitalId: string,
): Promise<{ success: boolean; isFavorite: boolean; hospitalId: string }> {
  return api.delete<{
    success: boolean;
    isFavorite: boolean;
    hospitalId: string;
  }>(`${RESOURCE}/favorites/hospitals/${hospitalId}`, {
    auth: true,
  });
}
