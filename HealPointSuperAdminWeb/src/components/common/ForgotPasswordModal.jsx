import React, { useEffect, useRef, useState } from "react";
import { toast } from "../../utils/notify";
import { FaCheckCircle, FaMobileAlt, FaShieldAlt, FaTimes } from "react-icons/fa";
import API from "../../Api/API";
import "./ForgotPasswordModal.css";

const emptyOtp = ["", "", "", "", "", ""];
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(emptyOtp);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setExpiresIn((value) => Math.max(value - 1, 0));
      setResendIn((value) => Math.max(value - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const resetModal = () => {
    setStep(1);
    setPhone("");
    setOtp(emptyOtp);
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setExpiresIn(0);
    setResendIn(0);
    onClose();
  };

  const sendOtp = async (event) => {
    event?.preventDefault();
    const mobile = normalizePhone(phone);

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return toast.error("Enter your registered 10-digit admin mobile number");
    }

    try {
      setLoading(true);
      const response = await API.post("/user/admin/forgot-password/send-otp", { phone: mobile });
      toast.success(response.data?.message || "OTP sent");
      setPhone(mobile);
      setOtp(emptyOtp);
      setResetToken("");
      setStep(2);
      setExpiresIn(response.data?.expiresIn || 300);
      setResendIn(response.data?.resendAfter || 45);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (error) {
      if (error.response?.data?.retryAfter) {
        setResendIn(error.response.data.retryAfter);
      }
      toast.error(error.response?.data?.message || "Unable to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (event) => {
    event?.preventDefault();
    const otpValue = otp.join("");

    if (otpValue.length !== 6) {
      return toast.error("Enter the 6-digit OTP");
    }

    try {
      setLoading(true);
      const response = await API.post("/user/admin/forgot-password/verify-otp", {
        phone: normalizePhone(phone),
        otp: otpValue,
      });
      setResetToken(response.data?.resetToken || "");
      setStep(3);
      toast.success(response.data?.message || "OTP verified");
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event?.preventDefault();

    if (!newPassword || !confirmPassword) {
      return toast.error("Enter and confirm the new password");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Passwords do not match");
    }
    if (!passwordRegex.test(newPassword)) {
      return toast.error("Use 8+ characters with uppercase, lowercase, number, and special character");
    }
    if (!resetToken) {
      return toast.error("OTP verification expired. Please verify again");
    }

    try {
      setLoading(true);
      const response = await API.post("/user/admin/forgot-password/reset", {
        phone: normalizePhone(phone),
        resetToken,
        newPassword,
        confirmPassword,
      });
      toast.success(response.data?.message || "Password reset successfully");
      resetModal();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const otpExpired = step === 2 && expiresIn === 0;

  return (
    <div className="fp-modal-overlay">
      <div className="fp-modal-container">
        <button className="fp-close-btn" type="button" onClick={resetModal} aria-label="Close">
          <FaTimes />
        </button>
        <div className="fp-modal-content">
          <div className="fp-stepper" aria-hidden="true">
            <span className={step >= 1 ? "active" : ""} />
            <span className={step >= 2 ? "active" : ""} />
            <span className={step >= 3 ? "active" : ""} />
          </div>

          {step === 1 && (
            <div className="fp-step">
              <div className="fp-icon"><FaMobileAlt /></div>
              <h2>Forgot Password</h2>
              <p>Enter the mobile number registered with your admin account.</p>
              <form onSubmit={sendOtp}>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Registered mobile number"
                  value={phone}
                  onChange={(event) => setPhone(normalizePhone(event.target.value))}
                  className="fp-input"
                  autoFocus
                />
                <button type="submit" className="fp-btn" disabled={loading}>
                  {loading ? "Sending OTP..." : "Send OTP"}
                </button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="fp-step">
              <div className="fp-icon"><FaShieldAlt /></div>
              <h2>Verify OTP</h2>
              <p>Enter the 6-digit OTP sent to your registered mobile number.</p>
              <form onSubmit={verifyOtp}>
                <div className="fp-otp-container">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      inputMode="numeric"
                      maxLength="1"
                      value={digit}
                      onChange={(event) => handleOtpChange(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      ref={(element) => (otpRefs.current[index] = element)}
                      className="fp-otp-input"
                      disabled={otpExpired || loading}
                    />
                  ))}
                </div>
                <div className="fp-timer">
                  {expiresIn > 0 ? (
                    <span>OTP expires in {Math.floor(expiresIn / 60)}:{String(expiresIn % 60).padStart(2, "0")}</span>
                  ) : (
                    <span>OTP expired. Request a new code.</span>
                  )}
                </div>
                <button type="submit" className="fp-btn" disabled={loading || otpExpired}>
                  {loading ? "Verifying..." : "Verify OTP"}
                </button>
                <button
                  type="button"
                  className="fp-resend-btn"
                  onClick={sendOtp}
                  disabled={loading || resendIn > 0}
                >
                  {resendIn > 0 ? `Resend OTP in ${resendIn}s` : "Resend OTP"}
                </button>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="fp-step">
              <div className="fp-icon"><FaCheckCircle /></div>
              <h2>Create New Password</h2>
              <p>Use a strong password for your admin account.</p>
              <form onSubmit={resetPassword}>
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="fp-input"
                  autoFocus
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="fp-input"
                />
                <p className="fp-policy">Minimum 8 characters with uppercase, lowercase, number, and special character.</p>
                <button type="submit" className="fp-btn" disabled={loading}>
                  {loading ? "Updating password..." : "Update Password"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
