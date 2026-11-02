import Razorpay from "razorpay";
import crypto from "crypto";

const key_id = process.env.RAZORPAY_KEY_ID || "rzp_test_Spw1C33b1zf044";
const key_secret = process.env.RAZORPAY_KEY_SECRET || "IFO2Zy8PpFKAu7xwicM4Yrgv";

export const razorpayInstance = new Razorpay({
  key_id,
  key_secret,
});

export const createRazorpayOrder = async ({ amount, receipt, notes = {} }) => {
  const options = {
    amount: Math.round(amount * 100), // In paise
    currency: "INR",
    receipt: receipt || `rcpt_demo_${Date.now()}`,
    notes: {
      ...notes,
      isDemo: "true",
      mode: "STANDALONE_DEMO_TRANSACTION",
    },
  };

  try {
    const order = await razorpayInstance.orders.create(options);
    return { ...order, isDemo: true };
  } catch (err) {
    console.warn("[Razorpay] Gateway unavailable, generating fallback simulated demo order:", err.message);
    return {
      id: `order_demo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      entity: "order",
      amount: options.amount,
      currency: "INR",
      receipt: options.receipt,
      status: "created",
      attempts: 0,
      notes: options.notes,
      created_at: Math.floor(Date.now() / 1000),
      isDemo: true,
      simulated: true,
    };
  }
};

export const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  // Allow simulated demo signatures in demo mode
  if (
    process.env.DEMO_MODE !== "false" &&
    (signature === "simulated_demo_signature" ||
      signature === "simulated_success" ||
      (orderId && orderId.startsWith("order_demo_")))
  ) {
    return true;
  }

  const generatedSignature = crypto
    .createHmac("sha256", key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return generatedSignature === signature;
};
