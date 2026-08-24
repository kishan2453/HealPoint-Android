/**
 * App-level types for the Razorpay Checkout bridge (`lib/razorpay.ts`).
 *
 * These describe the payload we pass to the native Razorpay Checkout and the
 * values it returns (payment id / order id / signature). They intentionally do
 * NOT contain any secret — the Key ID is public and is sourced from the
 * backend's order response (or the optional EXPO_PUBLIC_RAZORPAY_KEY_ID).
 */

export interface RazorpayPrefill {
  name?: string;
  email?: string;
  contact?: string;
}

export interface RazorpayTheme {
  color?: string;
  hide_topbar?: boolean;
}

export interface RazorpayModal {
  backdropclose?: boolean;
  escape?: boolean;
  handleback?: boolean;
  confirm_close?: boolean;
  animation?: boolean;
}

export interface RazorpayCheckoutOptions {
  /** Razorpay Key ID (public). Never a secret. */
  key: string;
  /** Amount in the currency's smallest unit (paise for INR). */
  amount: number;
  currency?: string;
  /** Order id created by the backend via the Orders API — required. */
  order_id?: string;
  name?: string;
  description?: string;
  image?: string;
  prefill?: RazorpayPrefill;
  theme?: RazorpayTheme;
  modal?: RazorpayModal;
  notes?: Record<string, string>;
  remember_customer?: boolean;
  timeout?: number;
  readonly?: { email?: boolean; contact?: boolean; name?: boolean };
  hidden?: { email?: boolean; contact?: boolean };
}

/** Resolved (or rejected) once the native Checkout closes. */
export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface RazorpayPaymentError {
  code: number;
  description: string;
  source?: string;
  step?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/** Native module surface exposed by the `RNRazorpayCheckout` bridge. */
export interface RazorpayNativeModule {
  open(options: RazorpayCheckoutOptions): void;
}
