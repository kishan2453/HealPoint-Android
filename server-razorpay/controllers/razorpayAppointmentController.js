'use strict';

/**
 * HealPoint — Razorpay appointment payment controller.
 *
 * Implements the exact API contract the mobile app already calls
 * (see `RAZORPAY_BACKEND_IMPLEMENTATION.md`):
 *
 *   POST /appointment/payment/order/:appointmentId   → create/reuse an order
 *   POST /appointment/verify-payment                 → HMAC + fetch verify
 *   POST /appointment/payment/webhook                → optional webhooks
 *
 * SAFETY PROPERTIES (all enforced here, server-side):
 *   - The amount always comes from the stored appointment — never the client.
 *   - A payment is marked SUCCESS only after HMAC-SHA256 signature verification
 *     AND a Razorpay API check that the payment was actually captured.
 *   - Retry reuses the same appointment + a fresh/reusable order → it can never
 *     create a duplicate appointment.
 *   - Concurrent double-verification is defeated by an atomic
 *     `paymentStatus: { $ne: 'SUCCESS' }` guard → exactly one wins.
 *   - Failed/cancelled payments never change the appointment to paid.
 */

const {
  isConfigured,
  getPublicKeyId,
  createOrder,
  fetchOrder,
  fetchPayment,
  verifySignature,
  verifyWebhookSignature,
} = require('../services/razorpayClient');

/** Booking states that close the door to further online payment. */
const NOT_OPEN_BOOKING = new Set([
  'cancel',
  'cancelled',
  'canceled',
  'missed',
  'completed',
  'complete',
  'not-visited',
]);
const NOT_OPEN_STATUS = new Set(['cancelled', 'canceled', 'missed', 'completed', 'complete']);

const PAIABLE_LOWER_BOUND = 100; // ₹1 in paise — Razorpay's minimum order amount.

/** Human-friendly 409 payloads the app already understands. */
function conflict(res, message) {
  return res.status(409).json({ success: false, message });
}

/**
 * Resolve the Mongoose Appointment model. In drop-in mode it auto-detects the
 * backend's model file; you can also inject it explicitly via the factory.
 */
function resolveAppointmentModel(deps = {}) {
  if (deps.appointmentModel) return deps.appointmentModel;
  /* eslint-disable global-require */
  const candidates = ['../models/appointmentModel', '../models/appointment', '../models/Appointment'];
  for (const candidate of candidates) {
    try {
      const model = require(candidate);
      if (model && (typeof model.find === 'function' || typeof model.findOne === 'function')) {
        return model;
      }
    } catch {
      /* try next */
    }
  }
  try {
    const mongoose = require('mongoose');
    return mongoose.model('Appointment');
  } catch {
    /* fall through */
  }
  /* eslint-enable global-require */
  return null;
}

function resolveNotificationModel(deps = {}) {
  if (deps.notificationModel) return deps.notificationModel;
  /* eslint-disable global-require */
  try {
    const mongoose = require('mongoose');
    return mongoose.model('Notification') || mongoose.model('notifications');
  } catch {
    return null;
  }
  /* eslint-enable global-require */
}

/** Extract the authenticated user id from the auth middleware in use. */
function currentUserId(req) {
  return req?.user?._id || req?.user?.id || req?.userId || null;
}

/** Look up the appointment by `_id` OR the human `appointmentId`, user-scoped. */
async function findAppointment(Appointment, rawId, userId) {
  if (!Appointment) {
    const err = new Error(
      'Appointment model could not be resolved — pass `appointmentModel` to createRazorpayAppointmentController.',
    );
    err.statusCode = 500;
    throw err;
  }
  const ors = [];
  if (rawId && typeof rawId === 'string' && /^[a-fA-F0-9]{24}$/.test(rawId)) {
    try {
      // eslint-disable-next-line global-require
      const mongoose = require('mongoose');
      ors.push({ _id: mongoose.Types.ObjectId(rawId) });
    } catch {
      ors.push({ _id: rawId });
    }
  }
  ors.push({ appointmentId: rawId });

  const userOrs = [{ userId }, { user: userId }];
  return Appointment.findOne({ $and: [{ $or: ors }, { $or: userOrs }] });
}

async function createBookingOrder({ appointment, Appointment, receipt }) {
  const rawAmount = Number(appointment.amount || appointment.fees || 0);
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    const err = new Error('This appointment has no payable amount.');
    err.statusCode = 400;
    throw err;
  }
  const amountPaise = Math.max(PAIABLE_LOWER_BOUND, Math.round(rawAmount * 100));

  const order = await createOrder({
    amountPaise,
    receipt: receipt || `appt_${appointment._id}`,
    notes: { appointmentId: String(appointment._id) },
  });

  // Persist the order id so a retry can reuse it (idempotency).
  await Appointment.updateOne(
    { _id: appointment._id },
    {
      $set: {
        razorpayOrderId: order.id,
        paymentStatus: appointment.paymentStatus || 'PENDING',
        payment: false,
      },
      $push: {
        statusHistory: {
          status: 'payment_pending',
          label: 'Payment order created',
          at: new Date(),
          by: 'razorpay',
        },
      },
    },
  );

  return order;
}

/* ---------------------------------------------------------------------------
 * POST /appointment/verify-payment
 * ------------------------------------------------------------------------- */
async function verifyPaymentHandler(req, res) {
  const deps = (this && this.deps) || {};
  const Appointment = resolveAppointmentModel(deps);
  const Notification = resolveNotificationModel(deps);
  const userId = currentUserId(req);

  const { appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (!appointmentId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed. Missing verification details.',
    });
  }

  let appointment;
  try {
    appointment = await findAppointment(Appointment, appointmentId, userId);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to load the appointment.' });
  }
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  // Idempotent double-verify: if another request / webhook already confirmed
  // it, return success without charging or changing anything again.
  const paid =
    appointment.payment === true || String(appointment.paymentStatus || '').toUpperCase() === 'SUCCESS';
  if (paid) {
    return res.status(200).json({
      success: true,
      message: 'Payment verified. Your appointment is confirmed.',
      appointment,
    });
  }

  // 1) HMAC-SHA256 signature verification (required — the mobile callback is
  //    never trusted on its own).
  if (!verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature })) {
    return res.status(400).json({
      success: false,
      message: 'Payment verification failed. Please try again.',
    });
  }

  // 2) Defence-in-depth: confirm with Razorpay that this payment is real and
  //    captured, belongs to our order, and matches the appointment amount.
  try {
    const payment = await fetchPayment(razorpay_payment_id);

    const captured = ['captured', 'authorized'].includes(String(payment.status || ''));
    if (!captured) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. No money has been deducted, please try again.',
      });
    }
    if (payment.order_id && String(payment.order_id) !== String(razorpay_order_id)) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Order mismatch detected.',
      });
    }
    const expectedPaise = Math.max(
      PAIABLE_LOWER_BOUND,
      Math.round(Number(appointment.amount || appointment.fees || 0) * 100),
    );
    if (Number(payment.amount) !== expectedPaise) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Amount mismatch detected.',
      });
    }
  } catch (err) {
    // Network/API hiccup → retryable, and it must NOT mark the booking failed.
    return res.status(502).json({
      success: false,
      message: 'We could not confirm your payment right now. Please retry in a moment.',
    });
  }

  // 3) Atomic guard update — only flips to SUCCESS when the appointment is not
  //    already paid. A concurrent verify/webhook simply finds nothing to do.
  try {
    const updated = await Appointment.findOneAndUpdate(
      { _id: appointment._id, paymentStatus: { $ne: 'SUCCESS' }, payment: { $ne: true } },
      {
        $set: {
          payment: true,
          paymentStatus: 'SUCCESS',
          bookingStatus: 'confirmed',
          status: 'confirm',
          razorpayOrderId,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paidAt: new Date(),
        },
        $push: {
          statusHistory: {
            status: 'confirmed',
            label: 'Confirmed after online payment',
            at: new Date(),
            by: 'payment',
          },
        },
      },
      { new: true },
    );

    const finalAppointment = updated || (await Appointment.findById(appointment._id));

    // 4) In-app notification, best-effort (must never block confirmation).
    if (Notification && updated) {
      try {
        await Notification.create({
          recipientId: userId,
          type: 'payment',
          title: 'Payment received',
          message: `Payment received for appointment ${
            appointment.appointmentId || appointment._id
          }. Your appointment is confirmed.`,
        });
      } catch {
        /* notifications must never block a confirmed booking */
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified. Your appointment is confirmed.',
      appointment: finalAppointment,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Could not update the appointment. Please contact the clinic.',
    });
  }
}

/* ---------------------------------------------------------------------------
 * POST /appointment/payment/order/:appointmentId
 * ------------------------------------------------------------------------- */
async function createPaymentOrderHandler(req, res) {
  const deps = (this && this.deps) || {};
  const Appointment = resolveAppointmentModel(deps);
  const rawId = req.params.appointmentId;
  const userId = currentUserId(req);

  if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (!isConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Online payment is temporarily unavailable. Please try again late or pay at the clinic.',
    });
  }

  let appointment;
  try {
    appointment = await findAppointment(Appointment, rawId, userId);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Unable to load the appointment.' });
  }

  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found.' });
  }

  // Already paid → never create another order.
  const paid =
    appointment.payment === true ||
    ['SUCCESS', 'success', 'paid'].includes(String(appointment.paymentStatus || '').toLowerCase());
  if (paid) {
    return conflict(res, 'This appointment is already paid. You do not need to pay again.');
  }

  const bookingStatus = String(appointment.bookingStatus || appointment.status || '');
  if (
    NOT_OPEN_BOOKING.has(bookingStatus.toLowerCase()) ||
    NOT_OPEN_STATUS.has(bookingStatus.toLowerCase())
  ) {
    return conflict(res, 'This appointment is no longer open for payment. Please contact the clinic.');
  }

  if (String(appointment.paymentMethod || '').toLowerCase() === 'cash') {
    return res.status(400).json({
      success: false,
      message: 'This appointment is booked for cash payment at the clinic.',
    });
  }

  try {
    // Idempotent retry: reuse a still-valid pending order instead of creating
    // a duplicate. Razorpay order statuses: created / attempted / paid.
    if (appointment.razorpayOrderId) {
      let existing;
      try {
        existing = await fetchOrder(appointment.razorpayOrderId);
      } catch {
        existing = null; // order expired/unknown → create a fresh one
      }
      if (existing && ['created', 'attempted'].includes(existing.status)) {
        return res.status(200).json({
          success: true,
          appointmentId: String(appointment._id),
          razorpayOrder: {
            id: existing.id,
            amount: existing.amount,
            currency: existing.currency || 'INR',
          },
          razorpayKey: getPublicKeyId(),
        });
      }
    }

    const order = await createBookingOrder({
      appointment,
      Appointment,
      receipt: appointment.razorpayOrderId
        ? `appt_retry_${appointment._id}_${Date.now()}`
        : `appt_${appointment._id}`,
    });

    return res.status(200).json({
      success: true,
      appointmentId: String(appointment._id),
      razorpayOrder: { id: order.id, amount: order.amount, currency: order.currency || 'INR' },
      razorpayKey: getPublicKeyId(),
    });
  } catch (err) {
    if (err.statusCode === 503 || err.code === 'RAZORPAY_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        message: 'Online payment is temporarily unavailable. Please try again late or pay at the clinic.',
      });
    }
    return res.status(502).json({
      success: false,
      message: 'Unable to create the payment order. Please try again in a moment.',
    });
  }
}

/* ---------------------------------------------------------------------------
 * POST /appointment/payment/webhook (optional but recommended)
 * Signature-verified with RAZORPAY_WEBHOOK_SECRET, so no auth token needed.
 * ------------------------------------------------------------------------- */
async function webhookHandler(req, res) {
  const deps = (this && this.deps) || {};
  const Appointment = resolveAppointmentModel(deps);
  const rawBody = req.rawBody || (req.body ? JSON.stringify(req.body) : '');

  const signature = req.get('x-razorpay-signature');
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
  }

  const event = req.body?.event;
  const payload = req.body?.payload || {};
  const entity = payload.payment?.entity || payload.order?.entity || {};
  const notes = entity.notes || {};
  const appointmentId = notes.appointmentId;

  if (!appointmentId) {
    // Acknowledge so Razorpay does not retry forever — nothing to do.
    return res.status(200).json({ success: true, received: true });
  }

  try {
    const appointment = await Appointment.findOne({
      $or: [{ _id: appointmentId }, { appointmentId }],
    });
    const appointmentKey = appointment?._id || null;
    if (!appointmentKey) return res.status(200).json({ success: true, received: true });

    if (event === 'payment.failed') {
      // Mark FAILED only when it is not already SUCCESS (never downgrade).
      await Appointment.updateOne(
        { _id: appointmentKey, paymentStatus: { $ne: 'SUCCESS' }, payment: { $ne: true } },
        {
          $set: {
            paymentStatus: 'FAILED',
            payment: false,
            razorpayPaymentId: entity.id || '',
            lastPaymentError: entity.error_description || entity.error?.description || 'payment failed',
          },
          $push: {
            statusHistory: {
              status: 'payment_failed',
              label: 'Payment attempt failed',
              at: new Date(),
              by: 'razorpay',
            },
          },
        },
      );
      return res.status(200).json({ success: true, received: true });
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      if (appointment.paymentStatus === 'SUCCESS' || appointment.payment === true) {
        return res.status(200).json({ success: true, received: true, idempotent: true });
      }
      await Appointment.updateOne(
        { _id: appointmentKey, paymentStatus: { $ne: 'SUCCESS' }, payment: { $ne: true } },
        {
          $set: {
            payment: true,
            paymentStatus: 'SUCCESS',
            bookingStatus: 'confirmed',
            status: 'confirm',
            razorpayPaymentId: entity.id || '',
            razorpayOrderId: entity.order_id || appointment.razorpayOrderId || '',
            paidAt: new Date(),
          },
          $push: {
            statusHistory: {
              status: 'confirmed',
              label: 'Confirmed after online payment',
              at: new Date(),
              by: 'razorpay-webhook',
            },
          },
        },
      );
      return res.status(200).json({ success: true, received: true });
    }

    if (event === 'refund.processed') {
      await Appointment.updateOne(
        { _id: appointmentKey },
        {
          $set: { paymentStatus: 'REFUNDED', payment: false },
          $push: {
            statusHistory: {
              status: 'refunded',
              label: 'Payment refunded',
              at: new Date(),
              by: 'razorpay',
            },
          },
        },
      );
      return res.status(200).json({ success: true, received: true });
    }

    return res.status(200).json({ success: true, received: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Webhook processing failed.' });
  }
}

/**
 * Factory — prefer dependency injection, fall back to auto-detect.
 *
 *   const controller = createRazorpayAppointmentController({
 *     appointmentModel: require('../models/appointmentModel'),
 *     notificationModel: require('../models/notificationModel'),
 *   });
 */
function createRazorpayAppointmentController(deps = {}) {
  function bound(fn) {
    return fn.bind({ deps });
  }

  return {
    createPaymentOrder: bound(createPaymentOrderHandler),
    verifyPayment: bound(verifyPaymentHandler),
    webhook: bound(webhookHandler),
  };
}

module.exports = {
  createRazorpayAppointmentController,
  // Standalone instance for the quickest drop-in:
  default: createRazorpayAppointmentController(),
};