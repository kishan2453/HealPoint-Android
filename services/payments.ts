/**
 * Payment API — Razorpay order creation + signature verification.
 *
 * The Razorpay *order* is always created server-side with the Key Secret; the
 * app only receives the public Key ID + order id, opens the native Checkout,
 * then asks the backend to verify the Razorpay signature before anything is
 * marked paid. The mobile success callback alone is never trusted.
 */
import { verifyAppointmentPayment } from './appointments';
import { api } from './api';
import type { CreatePaymentOrderResponse, VerifyPaymentResponse } from '@/types';

export { verifyAppointmentPayment };

export type { CreatePaymentOrderResponse, VerifyPaymentResponse };

/**
 * Create (or re-create) a Razorpay order for an existing appointment.
 *
 * Backend contract — `POST /appointment/payment/order/:appointmentId` (auth):
 *   → `{ success, appointmentId, razorpayOrder: { id, amount, currency }, razorpayKey }`
 *
 * The backend returns the existing pending order when it is still valid,
 * otherwise a fresh order, and refuses (with an error) once the appointment is
 * already paid or its booking is cancelled/completed.
 */
export async function createPaymentOrder(appointmentId: string): Promise<CreatePaymentOrderResponse> {
  return api.post<CreatePaymentOrderResponse>(
    `/appointment/payment/order/${encodeURIComponent(appointmentId)}`,
    undefined,
    { auth: true },
  );
}
