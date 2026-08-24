/**
 * Web messages API — mirrors routes/webMessageRoutes.js on the backend.
 * Super Admin and Hospital Admin share the admin list.
 */
import { api } from './api';
import type { WebMessagesResponse } from '@/types';

export async function getAllWebMessages(params: { search?: string; status?: string } = {}): Promise<WebMessagesResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  const qs = query.toString();
  return api.get<WebMessagesResponse>(`/webmessage/get-all${qs ? `?${qs}` : ''}`, { auth: true });
}

export async function setMessageRead(id: string, isRead: boolean): Promise<WebMessagesResponse> {
  return api.patch<WebMessagesResponse>(`/webmessage/read/${id}`, { isRead }, { auth: true });
}

export async function deleteWebMessage(id: string): Promise<WebMessagesResponse> {
  return api.delete<WebMessagesResponse>(`/webmessage/delete/${id}`, { auth: true });
}

export async function replyWebMessage(id: string, reply: string): Promise<WebMessagesResponse> {
  return api.patch<WebMessagesResponse>(`/webmessage/reply/${id}`, { adminReply: reply }, { auth: true });
}