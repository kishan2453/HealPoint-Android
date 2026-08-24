/**
 * Platform settings API — mirrors routes/settingsRoutes.js on the backend.
 * The patient side uses the public endpoint that returns the guide video URL.
 */
import { api } from './api';

export async function getPublicSettings(): Promise<{ success: boolean; guideVideoUrl?: string }> {
  return api.get<{ success: boolean; guideVideoUrl?: string }>('/settings/public');
}