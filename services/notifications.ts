/**
 * Notifications API — mirrors routes/notificationRoutes.js on the backend.
 */
import { api } from './api';
import type { NotificationsResponse } from '@/types';

export interface GetNotificationsParams {
  status?: 'all' | 'read' | 'unread';
  type?: string;
  limit?: number;
}

export async function getNotifications(
  params: GetNotificationsParams = {},
): Promise<NotificationsResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.type && params.type !== 'all') query.set('type', params.type);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();

  return api.get<NotificationsResponse>(`/notification/get-all${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function updateNotificationRead(
  id: string,
  isRead: boolean,
): Promise<NotificationsResponse> {
  return api.patch<NotificationsResponse>(`/notification/read/${id}`, { isRead }, { auth: true });
}

export async function markAllNotificationsRead(): Promise<NotificationsResponse> {
  return api.patch<NotificationsResponse>('/notification/mark-all', { isRead: true }, { auth: true });
}

export async function deleteNotification(id: string): Promise<NotificationsResponse> {
  return api.delete<NotificationsResponse>(`/notification/delete/${id}`, { auth: true });
}