'use strict';

/**
 * HealPoint — Razorpay server-side client.
 *
 * Drop-in for the Node/Express/MongoDB backend (`Doctor-apppointment/
 * server-with-client`). Install the official SDK in that repo once:
 *
 *     npm install razorpay
 *
 * SECURITY CONTRACT:
 *   - RAZORPAY_KEY_ID   → public, may be returned to the app (needed to open
 *                         the native Checkout).
 *   - RAZORPAY_KEY_SECRET → PRIVATE. Read ONLY from the server process env,
 *                         never logged, never returned by a route, never
 *                         committed to a client bundle.
 *
 * Orders are always created HERE (server-side) with the secret; the mobile app
 * only ever receives `{ order_id, key_id }` to open the Checkout.
 */

const crypto = require('crypto');
const Razorpay = require('razorpay');

/** True when the backend `.env` defines a usable Razorpay pair. */
function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** Lazy Razorpay SDK client. Throws a tagged error when not configured. */
function client() {
  if (!isConfigured()) {
    const err = new Error(
      'Online payment is temporarily unavailable (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured on the server).',
    );
    err.code = 'RAZORPAY_NOT_CONFIGURED';
    err.statusCode = 503;
    throw err;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/** PUBLIC key id — the only Razorpay value that may travel to the app. */
function getPublicKeyId() {
  return process.env.RAZORPAY_KEY_ID || '';
}

/**
 * Create a Razorpay Order. `amountPaise` must be the fee in the currency's
 * smallest unit (INR → paise). The amount is ALWAYS derived from the stored
 * appointment/database values by the controller — never from the client.
 */
async function createOrder({ amountPaise, receipt, notes = {}, currency = 'INR' }) {
  const rzp = client();
  return rzp.orders.create({
    amount: amountPaise,
    currency,
    receipt,
    notes,
  });
}

/** Fetch an order (used to reuse a still-valid pending order on retry). */
async function fetchOrder(orderId) {
  const rzp = client();
  return rzp.orders.fetch(orderId);
}

/** Fetch a payment (defence-in-depth check inside verify-payment). */
async function fetchPayment(paymentId) {
  const rzp = client();
  return rzp.payments.fetch(paymentId);
}

/**
 * Constant-time HMAC-SHA256 verification of the Razorpay signature exactly as
 * documented by Razorpay (orderId|paymentId signed with the Key Secret).
 * A mobile "success" callback is NEVER trusted without this check.
 */
function verifySignature({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  secret = process.env.RAZORPAY_KEY_SECRET,
}) {
  if (!secret || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  const given = String(razorpay_signature || '');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(given, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * `Express.json` has already parsed the body by the time the webhook route
 * runs, so re-serialize the raw string we captured before parsing.
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  client,
  getPublicKeyId,
  createOrder,
  fetchOrder,
  fetchPayment,
  verifySignature,
  verifyWebhookSignature,
};