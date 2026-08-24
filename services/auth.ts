/**
 * Authentication & profile API — mirrors routes/userRoutes.js on the backend.
 */
import { api } from './api';
import type {
  FavoriteDoctor,
  LoginResponse,
  RegisterResponse,
  UpdateProfilePayload,
  User,
  VerifyOtpResponse,
} from '@/types';

const RESOURCE = '/user';

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

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return api.post<RegisterResponse>(`${RESOURCE}/register`, payload);
}

/**
 * Login uses a shorter timeout than the general default so a hung backend never
 * keeps the login button spinning for the full default window. Timeouts surface
 * as a clear reachability message (see `networkErrorMessage` in `services/api`),
 * not a fake "wrong password" error.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return api.post<LoginResponse>(`${RESOURCE}/login`, payload, { timeout: 12000 });
}

export async function googleLogin(code: string, redirectUri?: string): Promise<LoginResponse> {
  return api.post<LoginResponse>(`${RESOURCE}/google/login`, { code, redirectUri });
}

export async function forgotPassword(identifier: string): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(`${RESOURCE}/forgot-password`, { identifier });
}

export async function verifyOtp(identifier: string, otp: string): Promise<VerifyOtpResponse> {
  return api.post<VerifyOtpResponse>(`${RESOURCE}/verify-otp`, { identifier, otp });
}

export async function resetPassword(payload: ResetPasswordPayload): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(`${RESOURCE}/reset-password`, payload);
}

export async function logout(): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(`${RESOURCE}/logout`, undefined, { auth: true });
}

export async function getProfile(userId: string): Promise<{ success: boolean; user: User }> {
  return api.get<{ success: boolean; user: User }>(`${RESOURCE}/get-login-user/${userId}`, { auth: true });
}

/**
 * Update the patient profile. The backend expects multipart/form-data because
 * `multer` parses an optional `image` file. Pass `null`/undefined for image to
 * keep the existing photo.
 */
export async function updateProfile(userId: string, payload: UpdateProfilePayload): Promise<{ success: boolean; user: User }> {
  const form = new FormData();
  if (payload.name !== undefined) form.append('name', payload.name);
  if (payload.phone !== undefined) form.append('phone', payload.phone);
  if (payload.dob !== undefined) form.append('dob', payload.dob);
  if (payload.gender !== undefined) form.append('gender', payload.gender);
  if (payload.address !== undefined) form.append('address', payload.address);

  const image = payload.image;
  if (image && typeof image === 'object' && 'uri' in image && image.uri) {
    form.append('image', {
      uri: image.uri,
      name: image.name || 'profile.jpg',
      type: image.type || 'image/jpeg',
    } as unknown as Blob);
  }

  return api.patch<{ success: boolean; user: User }>(`${RESOURCE}/update/${userId}`, form, {
    isFormData: true,
    auth: true,
  });
}

export async function updatePassword(userId: string, payload: UpdatePasswordPayload): Promise<{ success: boolean; message: string }> {
  return api.patch<{ success: boolean; message: string }>(`${RESOURCE}/update-password/${userId}`, payload, { auth: true });
}

// ---------------------------------------------------------------------------
// Favorite doctors (stored on the user document)
// ---------------------------------------------------------------------------
export async function getFavorites(): Promise<{ success: boolean; favorites: (User & FavoriteDoctor)[]; totalCount: number }> {
  return api.get<{ success: boolean; favorites: (User & FavoriteDoctor)[]; totalCount: number }>(`${RESOURCE}/favorites`, {
    auth: true,
  });
}

export async function addFavorite(doctorId: string): Promise<{ success: boolean; isFavorite: boolean; doctorId: string }> {
  return api.post<{ success: boolean; isFavorite: boolean; doctorId: string }>(`${RESOURCE}/favorites/${doctorId}`, undefined, {
    auth: true,
  });
}

export async function removeFavorite(doctorId: string): Promise<{ success: boolean; isFavorite: boolean; doctorId: string }> {
  return api.delete<{ success: boolean; isFavorite: boolean; doctorId: string }>(`${RESOURCE}/favorites/${doctorId}`, {
    auth: true,
  });
}