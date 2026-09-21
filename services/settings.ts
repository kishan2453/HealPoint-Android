/**
 * Platform settings API — mirrors routes/settingsRoutes.js on the backend.
 * The patient side uses the public endpoint that returns the guide video URL;
 * the Super Admin manages that value through the protected endpoints.
 */
import { api } from './api';

export async function getPublicSettings(): Promise<{ success: boolean; guideVideoUrl?: string }> {
  return api.get<{ success: boolean; guideVideoUrl?: string }>('/settings/public');
}

export interface PlatformSettings {
  key?: string;
  guideVideoUrl?: string;
  updatedBy?: string | null;
  updatedAt?: string;
}

/** Super Admin only — read the current platform settings. */
export async function getPlatformSettings(): Promise<{ success: boolean; settings: PlatformSettings }> {
  return api.get<{ success: boolean; settings: PlatformSettings }>('/settings', { auth: true });
}

/** Super Admin only — persist the patient-side guide video URL. */
export async function updatePlatformSettings(
  payload: { guideVideoUrl?: string },
): Promise<{ success: boolean; message: string; settings: PlatformSettings }> {
  return api.patch<{ success: boolean; message: string; settings: PlatformSettings }>('/settings', payload, {
    auth: true,
  });
}
