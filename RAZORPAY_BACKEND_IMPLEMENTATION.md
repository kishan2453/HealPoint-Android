# HealPoint — Razorpay Backend Implementation

> **Audience:** the engineer implementing the backend
> (`Doctor-apppointment/server-with-client`, Node.js + Express + MongoDB).
> The mobile app in this repo is already fully wired — it just needs these
> backend endpoints to exist and behave exactly as documented below.
>
> **Rule:** the Razorpay **Key Secret** lives ONLY in the backend `.env`.
> It must never be returned to the app, logged, or committed.

---

## 1. What the mobile app expects

The app calls **three** endpoints, all under the existing `/api/v1` mount and all
requiring the patient's Bearer token (same `authMiddleware` as `/appointment/*`).

| # | Method + path | Purpose | Defined in the app |
|---|---|---|---|
| 1 | `POST /appointment/create` | Create booking; **when `paymentMethod = "online"`, create a Razorpay Order server-side** and return it | `services/appointments.ts` |
| 2 | `POST /appointment/payment/order/:appointmentId` | Create / re-create an order for an **existing** appointment (retry, pay-later from the payment screen) | `services/payments.ts` |
| 3 | `POST /appointment/verify-payment` | Verify `razorpay_signature` and only then mark paid + confirm | `services/appointments.ts` |

The payment **screen** (`app/payment/[appointmentId].tsx`) drives the whole
flow: it calls (2), opens the Razorpay Checkout with the returned
`razorpayKey` + `razorpayOrder.id`, and calls (3) with the checkout's
`razorpay_payment_id` / `razorpay_order_id` / `razorpay_signature`. The booking
screen (`app/booking/[doctorId].tsx`) calls (1) with `paymentMethod: 'online'`
and immediately navigates to the payment screen.

---

## 2. Exact request / response contracts

### 2.1 `POST /appointment/create` (existing route, extended)

Request body (unchanged shape):
```json
{
  "doctorId": "64f...",
  "slotDate": "19-08-2026",
  "slotTime": "09:00 AM",
  "paymentMethod": "online",
  "consultationType": "clinic"
}
```

When `paymentMethod === "online"`:
1. Validate the slot / create the appointment exactly as today, but store
   `paymentMethod: "online"`, `paymentStatus: "PENDING"`,
   `payment: false`, `bookingStatus: "pending"`.
2. Create a Razorpay Order with **your** Key Secret:
   ```js
   const order = await razorpay.orders.create({
     amount: Math.round(appointment.amount * 100), // paise
     currency: 'INR',
     receipt: `appt_${appointment._id}`,
     notes: { appointmentId: String(appointment._id) },
   });
   ```
3. Save `razorpayOrderId: order.id` on the appointment.
4. Respond **200** with the same shape as today plus the order + public key:

```json
{
  "success": true,
  "message": "Appointment booked. Complete the payment to confirm.",
  "appointment": { "_id": "64f...", "amount": 500, "paymentStatus": "PENDING" },
  "razorpayOrder": { "id": "order_N5l...", "amount": 50000, "currency": "INR" },
  "razorpayKey": "rzp_test_xxxxxxxx"
}
```

- If Razorpay env vars are missing, return **503**
  `{ success: false, message: "Online payment is temporarily unavailable. Please try again later or pay at the clinic." }`
  — the app shows this as a clear failure, never a fake success.
- The duplicate-slot check must run **before** creating the order (same 409 as today).

### 2.2 `POST /appointment/payment/order/:appointmentId` (NEW)

Used by the payment screen for the first attempt **and** every retry, so it
should be idempotent:

Request: empty body.

Response `200`:
```json
{
  "success": true,
  "appointmentId": "64f...",
  "razorpayOrder": { "id": "order_N5l...", "amount": 50000, "currency": "INR" },
  "razorpayKey": "rzp_test_xxxxxxxx"
}
```

Behaviour:
- **Already paid** (`paymentStatus === 'SUCCESS'`): return `409`
  `{ success: false, message: "This appointment is already paid." }`.
- **Booking cancelled/completed/missed**: return `409`
  `{ success: false, message: "This appointment is no longer open for payment." }`.
- **Existing pending order still valid** (Razorpay order lifetime — default ~24h,
  configurable): return it again (don't create a duplicate).
- **Existing order expired / authorization failed**: create a **fresh** order,
  overwrite `razorpayOrderId`, return it.
- Compute the amount from the **stored appointment** (never trust a client amount).

### 2.3 `POST /appointment/verify-payment` (NEW)

Request body (exact field names — the app sends these verbatim):
```json
{
  "appointmentId": "64f...",
  "razorpay_order_id": "order_N5l...",
  "razorpay_payment_id": "pay_N5m...",
  "razorpay_signature": "a1b2c3..."
}
```

Verification (MUST NOT be skipped):
```js
const crypto = require('crypto');

const expected = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest('hex');

if (expected !== razorpay_signature) {
  return res.status(400).json({ success: false, message: 'Payment verification failed. Please try again.' });
}
```

Only after the signature matches:
1. `razorpay.payments.fetch(razorpay_payment_id)` — confirm the payment exists,
   its `status` is `captured` (or `authorized` with auto-capture) and its
   `amount` matches the appointment's expected amount in paise. (Defence-in-depth
   on top of the HMAC.)
2. If the appointment is already `SUCCESS`, return **200** (idempotent — never
   double-charge or double-confirm).
3. Atomically update (with a `paymentStatus: { $ne: 'SUCCESS' }` guard):
   - `payment: true`
   - `paymentStatus: 'SUCCESS'`
   - `bookingStatus: 'confirmed'`
   - `razorpayPaymentId`, `razorpaySignature`, `paidAt: new Date()`
   - push `{ status: 'confirmed', label: 'Confirmed after online payment', at }` to `statusHistory`
4. Create an in-app Notification ("Payment received" / "Appointment confirmed").
5. Respond **200**:
```json
{
  "success": true,
  "message": "Payment verified. Your appointment is confirmed.",
  "appointment": { "payment": true, "paymentStatus": "SUCCESS", "bookingStatus": "confirmed" }
}
```

---

## 3. Payment state machine (server-owned)

The backend owns `paymentStatus`; the app only displays it.

| State | Meaning | When set by the backend |
|---|---|---|
| `PENDING` | Order created / payment not yet verified | on `create` / `payment/order` |
| `SUCCESS` | Signature verified + payment captured | only in `verify-payment` after HMAC + fetch check |
| `FAILED` | A payment attempt errored (bank/network) | on Razorpay `payment.failed` webhook or explicit error sync |
| `CANCELLED` | User abandoned checkout / order expired | on cancel/expiry (`payment.cancelled` / order never paid) |
| `REFUNDED` | Money returned (e.g. cancellation after payment) | on Razorpay `refund.processed` webhook / admin action |

- Never set `SUCCESS` from a webhook alone without the HMAC/fetch checks; never
  trust the mobile callback — it is only used to *trigger* verification.

---

## 4. Duplicate / race / expired-order handling

- **Double-verify:** guarded atomic update (see §2.3 step 3) → the second call
  returns 200 without changing anything.
- **Double-pay:** if a patient pays twice against two orders, the second
  `verify-payment` for the already-`SUCCESS` appointment must **not** charge or
  overwrite; optionally auto-refund the duplicate via webhook logic.
- **Expired order:** `payment/order` creates a new order; the app's retry just
  calls it again.
- **Race (webhook + app verify):** both paths use the same atomic guard, so only
  one wins and the other is idempotent.

---

## 5. Backend `.env` additions

```dotenv
# Razorpay — generate at https://dashboard.razorpay.com/app/keys
RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
RAZORPAY_KEY_SECRET=<long-secret>        # NEVER expose to the client
# Optional: webhook secret for payment.failed / refund.processed events
RAZORPAY_WEBHOOK_SECRET=
```

Add `razorpay` to dependencies: `npm install razorpay`.

Example controller snippet:
```js
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const isRazorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
```

---

## 6. Webhooks (recommended for automation; not required for the app flow)

Register at https://dashboard.razorpay.com/app/webhooks
- `payment.failed` → mark `FAILED` (only if not already `SUCCESS`).
- `payment.captured` / `order.paid` → same logic as `verify-payment` (atomic guard).
- `refund.processed` → mark `REFUNDED`.

The app flow works without webhooks because it always calls `verify-payment`
after checkout; webhooks make statuses robust when the app is closed mid-payment.

---

## 7. Checklist before this integration is "live"

- [ ] `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` set in backend `.env` (Test mode first).
- [ ] `POST /appointment/create` returns `razorpayOrder` + `razorpayKey` for `paymentMethod: "online"`.
- [ ] `POST /appointment/payment/order/:appointmentId` implemented per §2.2.
- [ ] `POST /appointment/verify-payment` implements the HMAC + fetch checks per §2.3.
- [ ] `paymentStatus`/`payment`/`bookingStatus` persisted + returned by
      `GET /appointment/get-user-appointment-details/:id` (the app renders them).
- [ ] `paymentMethod` is returned by `GET /appointment/get-user-appointments/:userId` too.
- [ ] Webhooks configured (optional but recommended).
- [ ] Test card `4111 1111 1111 1111` (any future expiry, any CVV) verifies a
      successful payment; a declined card and the back-button flow verify
      `FAILED` / `CANCELLED` states.


