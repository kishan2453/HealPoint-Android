# HealPoint — Razorpay Backend Module (drop-in)

Complete, production-ready implementation of the Razorpay server-side flow that
the HealPoint mobile app already calls. The code lives here because the actual
Node/Express/MongoDB server lives in a **separate repository**
(`Doctor-apppointment/server-with-client`). Copy these three files into that
repo, wire them in, and online payments work end-to-end.

```
server-razorpay/
├─ services/razorpayClient.js          → Razorpay SDK wrapper + HMAC verification
├─ controllers/razorpayAppointmentController.js → order + verify + webhook logic
└─ routes/razorpayPaymentRoutes.js     → Express routers you can mount
```

---

## 1. Copy into the backend

| From this repo | To (in `Doctor-apppointment/server-with-client`) |
|---|---|
| `server-razorpay/services/razorpayClient.js` | `services/razorpayClient.js` |
| `server-razorpay/controllers/razorpayAppointmentController.js` | `controllers/razorpayAppointmentController.js` |
| `server-razorpay/routes/razorpayPaymentRoutes.js` | `routes/razorpayPaymentRoutes.js` |

Then install the official SDK once:

```bash
npm install razorpay
```

## 2. Mount the routes

In your main express app file (`app.js` / `server.js`), using the **existing**
auth middleware from `routes/appointmentRoutes.js`:

```js
const {
  createRazorpayPaymentRouter,
  createRazorpayWebhookRouter,
} = require('./routes/razorpayPaymentRoutes');

// Pass your real models so no auto-detection is needed:
const paymentRouter = createRazorpayPaymentRouter({
  appointmentModel: require('./models/appointmentModel'),
  notificationModel: require('./models/notificationModel'),
});

// PUBLIC webhook — must be mounted BEFORE express.json() so the raw body is
// available for Razorpay's x-razorpay-signature verification.
app.use('/api/v1/appointment', createRazorpayWebhookRouter());

// These two endpoints reuse the exact same authMiddleware as /appointment/*:
app.use('/api/v1/appointment', require('./middlewares/authMiddleware'), paymentRouter);
```

> If you prefer, keep the auth middleware globally applied and only add
> `app.use('/api/v1/appointment', paymentRouter);` — the webhook router is the
> only one that must stay public (it verifies `RAZORPAY_WEBHOOK_SECRET` instead).

## 3. Backend `.env` additions

```dotenv
# Razorpay — create at https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=<long-secret>     # PRIVATE — never leave the server
# Optional (recommended): https://dashboard.razorpay.com/app/webhooks
RAZORPAY_WEBHOOK_SECRET=<webhook-secret>
```

Installation checklist on the server:

- [ ] `npm install razorpay`
- [ ] `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` in backend `.env`
- [ ] Routes mounted (see §2)
- [ ] `appointmentModel` exposes `appointmentId` / `paymentStatus` / `payment` /
      `bookingStatus` / `razorpayOrderId` fields (default Mongoose schema is fine;
      unknown fields are simply written if defined in your schema)

## 4. What the endpoints do (and the safety guarantees)

### `POST /appointment/payment/order/:appointmentId` (auth)

- Amount is always computed from the **stored appointment**, never the client.
- Already paid → `409`. Booking cancelled/completed/missed → `409`.
  Cash booking → `400`.
- Idempotent retry: reuses a still-valid pending order (`created` / `attempted`);
  expired ones get a fresh order. **Never creates a second appointment.**
- Razorpay not configured → `503` (the app shows a clean message, never a fake
  success).

### `POST /appointment/verify-payment` (auth)

Body (exact names the app sends):

```json
{
  "appointmentId": "64f...",
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "a1b2..."
}
```

1. **HMAC-SHA256 signature verification** with `RAZORPAY_KEY_SECRET`
   (constant-time compare). The mobile "success" callback is never trusted on
   its own.
2. Defence-in-depth: `payments.fetch(...)` must report `captured`/`authorized`,
   matching `order_id` and the exact paise amount.
3. **Atomic guard** `paymentStatus: { $ne: 'SUCCESS' }` — concurrent double
   verify/webhook cannot double-confirm or double-charge; the loser is idempotent.
4. Only then: `payment: true`, `paymentStatus: 'SUCCESS'`,
   `bookingStatus: 'confirmed'`, payment ids + `paidAt` persisted, status
   history appended, in-app notification created (best-effort).

### `POST /appointment/payment/webhook` (public, signature-verified)

Handles `payment.failed` (→ `FAILED`, only when not already SUCCESS),
`payment.captured` / `order.paid` (→ same verified path as above),
`refund.processed` (→ `REFUNDED`).

## 5. Test end-to-end (test mode)

Test card from Razorpay: `4111 1111 1111 1111`, any future expiry, any CVV.

1. Start the backend; confirm `POST /api/v1/appointment/payment/order/:id`
   returns `{ success, razorpayOrder: { id, amount, currency }, razorpayKey }`.
2. Run the Android **development build** (NOT Expo Go) — commands in the repo
   root `README.md`.
3. Book an appointment → **Pay online** → native Razorpay Checkout opens.
4. Pay with the test card → app calls `verify-payment` → **Payment Successful**
   and the appointment shows **Paid / Confirmed**.
5. Cancel inside checkout → **Payment Cancelled** state, appointment not paid.
6. Decline/`401299` card → **Payment failed** state with **Retry Payment** which
   reuses the same appointment and a fresh/reusable order.

## 6. Notes

- `RAZORPAY_KEY_SECRET` is never returned by any endpoint, never logged, and
  must never be added to the mobile app `.env`.
- The mobile repo already contains the entire client side
  (`lib/razorpay.ts`, `app/payment/[appointmentId].tsx`,
  `services/payments.ts`) — nothing else needs to change there.