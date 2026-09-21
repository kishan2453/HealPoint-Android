'use strict';

/**
 * HealPoint — Razorpay payment routes (drop-in for the Express backend).
 *
 * Mount them behind the SAME auth middleware used by the existing
 * `/appointment/*` routes so only a logged-in patient can create orders or
 * verify their own payment. The webhook route is deliberately public (Razorpay
 * signs it with RAZORPAY_WEBHOOK_SECRET instead).
 *
 *   const authMiddleware = require('../middlewares/authMiddleware');
 *   const paymentRouter = createRazorpayPaymentRouter();
 *   router.use('/appointment', authMiddleware, paymentRouter);
 *
 * Because the webhook must receive the RAW body, mount it before
 * `express.json()` in app.js (or capture `req.rawBody`):
 *
 *   app.use('/api/v1/appointment', razorpayWebhookRouter);   // public
 *   app.use(express.json());
 *   app.use('/api/v1/appointment', authMiddleware, paymentRouter);
 */

const express = require('express');
const { createRazorpayAppointmentController } = require('../controllers/razorpayAppointmentController');

/**
 * `{ appointmentModel, notificationModel }` can be injected to skip model
 * auto-detection.
 */
function createRazorpayPaymentRouter(deps = {}) {
  const controller = deps.controller || createRazorpayAppointmentController(deps);
  const router = express.Router();

  // Create / re-create a Razorpay order for an existing appointment (retry-safe).
  router.post('/payment/order/:appointmentId', controller.createPaymentOrder);

  // Verify a completed payment's signature and mark the appointment paid ONLY
  // after a successful server-side check.
  router.post('/verify-payment', controller.verifyPayment);

  return router;
}

/** Public router for Razorpay-signed webhooks (mount BEFORE express.json). */
function createRazorpayWebhookRouter(deps = {}) {
  const controller = deps.controller || createRazorpayAppointmentController(deps);
  const router = express.Router();

  router.post(
    '/payment/webhook',
    express.json({
      verify: (req, _res, buf) => {
        // Preserve the raw bytes so the webhook signature can be verified.
        req.rawBody = buf?.toString('utf8') || '';
      },
    }),
    controller.webhook,
  );

  return router;
}

module.exports = {
  createRazorpayPaymentRouter,
  createRazorpayWebhookRouter,
};