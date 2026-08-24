/**
 * Appointment API — mirrors routes/appointmentRoutes.js on the backend.
 * All endpoints below require a Bearer token except the public slot lookup.
 *
 * Date format for slots is `DD-MM-YYYY` and time format is `"09:00 AM"` (both
 * enforced by the server).
 */
import { api } from './api';
import type {
  Appointment,
  AppointmentDetailsResponse,
  AvailableSlotsResponse,
  BookAppointmentPayload,
  BookAppointmentResponse,
  ReschedulePayload,
  UserAppointmentsResponse,
  VerifyPaymentResponse,
} from '@/types';

export async function getAvailableSlots(
  doctorId: string,
  date: string,
): Promise<AvailableSlotsResponse> {
  // The live backend reads `slotDate`; the source-of-truth controller accepts
  // `date` as a fallback. Sending both keeps the booking flow working against
  // any deployed backend version.
  const query = new URLSearchParams();
  query.set('date', date);
  query.set('slotDate', date);
  return api.get<AvailableSlotsResponse>(
    `/appointment/get-available-slots/${doctorId}?${query.toString()}`,
  );
}

export async function validateSlot(
  doctorId: string,
  slotDate: string,
  slotTime: string,
): Promise<{ success: boolean; available?: boolean; message?: string }> {
  return api.post<{ success: boolean; available?: boolean; message?: string }>(
    `/appointment/validate-slot/${doctorId}`,
    { slotDate, slotTime },
    { auth: true },
  );
}

export async function bookAppointment(
  payload: BookAppointmentPayload,
): Promise<BookAppointmentResponse> {
  return api.post<BookAppointmentResponse>('/appointment/create', payload, { auth: true });
}

export async function getUserAppointments(userId: string): Promise<UserAppointmentsResponse> {
  return api.get<UserAppointmentsResponse>(`/appointment/get-user-appointments/${userId}`, { auth: true });
}

export async function getUserAppointmentDetails(
  appointmentId: string,
): Promise<AppointmentDetailsResponse> {
  return api.get<AppointmentDetailsResponse>(
    `/appointment/get-user-appointment-details/${appointmentId}`,
    { auth: true },
  );
}

export async function cancelAppointment(
  appointmentId: string,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>(`/appointment/cancel/${appointmentId}`, undefined, {
    auth: true,
  });
}

export async function rescheduleAppointment(
  appointmentId: string,
  payload: ReschedulePayload,
): Promise<{ success: boolean; message: string; appointment: unknown }> {
  return api.patch<{ success: boolean; message: string; appointment: unknown }>(
    `/appointment/reschedule/${appointmentId}`,
    payload,
    { auth: true },
  );
}

export async function verifyAppointmentPayment(payload: {
  appointmentId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<VerifyPaymentResponse> {
  return api.post<VerifyPaymentResponse>(
    '/appointment/verify-payment',
    payload,
    { auth: true },
  );
}

// ---- Admin / Super Admin platform view --------------------------------------
export interface AdminAppointmentsResponse {
  success: boolean;
  message?: string;
  privacyRestricted?: boolean;
  totalCount: number;
  statusCounts?: { _id: string; count: number }[];
  appointments: Appointment[];
}

/**
 * Admin appointment list. Hospital Admins get their hospital's appointments;
 * Super Admin gets the full platform list when `platform: true` is sent.
 */
export async function getAllAdminAppointments(
  params: { platform?: boolean; limit?: number } = {},
): Promise<AdminAppointmentsResponse> {
  const query = new URLSearchParams();
  if (params.platform) query.set('platform', '1');
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return api.get<AdminAppointmentsResponse>(`/appointment/get-all${qs ? `?${qs}` : ''}`, { auth: true });
}