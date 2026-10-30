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
    receipt: receipt || `rcpt_${Date.now()}`,
    notes,
  };
  return await razorpayInstance.orders.create(options);
};

export const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const generatedSignature = crypto
    .createHmac("sha256", key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return generatedSignature === signature;
};
