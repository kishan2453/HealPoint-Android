/**
 * Notifications API — mirrors routes/notificationRoutes.js on the backend.
 * Provides real-time event orchestration, preference management, and push token registration.
 */
import { API_QUICK_TIMEOUT_MS, API_TIMEOUT_MS } from "@/lib/env";
import { api } from "./api";
import type {
  NotificationCategory,
  NotificationPreferences,
  NotificationPreferencesResponse,
  NotificationPriority,
  NotificationsResponse,
} from "@/types";

export interface GetNotificationsParams {
  status?: "all" | "read" | "unread";
  type?: string;
  category?: NotificationCategory | string;
  priority?: NotificationPriority | string;
  page?: number;
  limit?: number;
}

export async function getNotifications(
  params: GetNotificationsParams = {},
): Promise<NotificationsResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all")
    query.set("status", params.status);
  if (params.type && params.type !== "all") query.set("type", params.type);
  if (params.category && params.category !== "all")
    query.set("category", params.category);
  if (params.priority && params.priority !== "all")
    query.set("priority", params.priority);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();

  return api.get<NotificationsResponse>(
    `/notification/get-all${qs ? `?${qs}` : ""}`,
    {
      auth: true,
      // Badge reads (`limit=1`) are tiny — fail fast instead of holding the
      // Home header hostage behind the 25s catalog budget.
      timeout:
        params.limit === 1 && !params.status && !params.type && !params.category
          ? API_QUICK_TIMEOUT_MS
          : API_TIMEOUT_MS,
    },
  );
}

export async function updateNotificationRead(
  id: string,
  isRead: boolean,
): Promise<NotificationsResponse> {
  return api.patch<NotificationsResponse>(
    `/notification/read/${id}`,
    { isRead },
    { auth: true },
  );
}

export async function markAllNotificationsRead(): Promise<NotificationsResponse> {
  return api.patch<NotificationsResponse>(
    "/notification/mark-all",
    { isRead: true },
    { auth: true },
  );
}

export async function deleteNotification(
  id: string,
): Promise<NotificationsResponse> {
  return api.delete<NotificationsResponse>(`/notification/delete/${id}`, {
    auth: true,
  });
}

/**
 * Fetch current user's notification preferences.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferencesResponse> {
  return api.get<NotificationPreferencesResponse>("/notification/preferences", {
    auth: true,
  });
}

/**
 * Update notification preferences (channels, categories, quiet hours).
 */
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>,
): Promise<NotificationPreferencesResponse> {
  return api.put<NotificationPreferencesResponse>(
    "/notification/preferences",
    preferences,
    {
      auth: true,
    },
  );
}

/**
 * Register Expo device push token.
 */
export async function registerPushToken(
  token: string,
): Promise<{ success: boolean; message?: string }> {
  return api.post<{ success: boolean; message?: string }>(
    "/notification/register-push-token",
    { token },
    { auth: true },
  );
}
