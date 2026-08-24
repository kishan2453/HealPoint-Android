/**
 * Reviews API — mirrors routes/reviewRoutes.js on the backend.
 * Submitting a review requires auth; reading public reviews does not.
 */
import { api } from './api';
import type { CreateReviewPayload, Review } from '@/types';

export async function createReview(
  payload: CreateReviewPayload,
): Promise<{ success: boolean; message: string; review: Review }> {
  return api.post<{ success: boolean; message: string; review: Review }>('/review/create', payload, {
    auth: true,
  });
}

export async function getPublicReviews(): Promise<{ success: boolean; reviews: Review[] }> {
  return api.get<{ success: boolean; reviews: Review[] }>('/review/public');
}

// ---- Admin / Super Admin review list ----------------------------------------
export interface AdminReviewsResponse {
  success: boolean;
  message?: string;
  privacyRestricted?: boolean;
  totalCount: number;
  summary?: { approvedCount: number; pendingCount: number; hiddenCount: number };
  reviews: Review[];
}

/** Admin review list. Hospital Admins get their hospital's reviews; Super Admin gets the full platform list when `platform: true`. */
export async function getAllAdminReviews(
  params: { platform?: boolean; search?: string; status?: string; limit?: number } = {},
): Promise<AdminReviewsResponse> {
  const query = new URLSearchParams();
  if (params.platform) query.set('platform', '1');
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return api.get<AdminReviewsResponse>(`/review/get-all${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function updateReviewStatus(
  id: string,
  payload: { isApproved?: boolean; isHidden?: boolean },
): Promise<{ success: boolean; message: string }> {
  return api.patch<{ success: boolean; message: string }>(`/review/status/${id}`, payload, { auth: true });
}