import React, { useEffect, useMemo, useState } from "react";
import { toast } from "../../utils/notify";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout/Layout";
import { resetPassword } from "../../redux/actions/authActions";
import { logout, reset } from "../../redux/slice/authSlice";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaShieldAlt,
  FaSignOutAlt,
} from "react-icons/fa";

const strongPasswordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[a-z]).{8,}$/;
const passwordError =
  "Use 8+ characters with uppercase, lowercase, and a number.";

const PasswordInput = ({ label, value, onChange, visible, onToggle, placeholder }) => (
  <label className="reset-password-field">
    <span>{label}</span>
    <div className="password-field">
      <FaLock />
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <button type="button" onClick={onToggle} title={visible ? "Hide password" : "Show password"}>
        {visible ? <FaEyeSlash /> : <FaEye />}
      </button>
    </div>
  </label>
);

const ResetPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading, success, error } = useSelector((state) => state.auth);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetStarted, setResetStarted] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const strength = useMemo(() => {
    const checks = [
      newPassword.length >= 8,
      /[A-Z]/.test(newPassword),
      /[a-z]/.test(newPassword),
      /[0-9]/.test(newPassword),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [newPassword]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!user?._id) return toast.error("Please login again to reset password");
    if (!oldPassword || !newPassword || !confirmPassword) {
      return toast.error("Please fill all password fields");
    }
    if (!strongPasswordRegex.test(newPassword)) {
      return toast.error(passwordError);
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Confirm password does not match");
    }
    setResetStarted(true);
    dispatch(resetPassword({ id: user._id, oldPassword, newPassword }));
  };

  useEffect(() => {
    if (!resetStarted) return;
    if (success) {
      toast.success("Password reset successfully. Please login again.");
      dispatch(logout());
      localStorage.removeItem("appData");
      dispatch(reset());
      navigate("/", { replace: true });
    }
    if (error) {
      toast.error(error);
      dispatch(reset());
      setResetStarted(false);
    }
  }, [dispatch, error, navigate, resetStarted, success]);

  return (
    <Layout>
      <section className="page-intro reset-password-hero">
        <div>
          <span className="eyebrow">Security center</span>
          <h2>Reset Admin Password</h2>
          <p>Update your admin access password. You will be signed out after a successful reset.</p>
        </div>
        <button type="button" className="btn btn-light" onClick={() => navigate(-1)}>
          <FaArrowLeft /> Back
        </button>
      </section>

      <section className="reset-password-shell">
        <aside className="reset-password-info">
          <FaShieldAlt />
          <h3>Keep admin access secure</h3>
          <p>Your new password should be different from your old password and easy for only you to remember.</p>
          <div>
            <span><FaCheckCircle /> 8 or more characters</span>
            <span><FaCheckCircle /> Uppercase and lowercase letters</span>
            <span><FaCheckCircle /> At least one number</span>
          </div>
        </aside>

        <form className="reset-password-card" onSubmit={handleSubmit}>
          <PasswordInput
            label="Current password"
            value={oldPassword}
            onChange={setOldPassword}
            visible={showOldPassword}
            onToggle={() => setShowOldPassword((value) => !value)}
            placeholder="Enter current password"
          />
          <PasswordInput
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            visible={showNewPassword}
            onToggle={() => setShowNewPassword((value) => !value)}
            placeholder="Create new password"
          />
          <div className="password-strength">
            <div>
              <span>Password strength</span>
              <strong>{strength}%</strong>
            </div>
            <progress value={strength} max="100" />
            {newPassword && (
              <small className={strongPasswordRegex.test(newPassword) ? "valid-text" : "error-text"}>
                {strongPasswordRegex.test(newPassword) ? "Strong password." : passwordError}
              </small>
            )}
          </div>
          <PasswordInput
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((value) => !value)}
            placeholder="Re-enter new password"
          />
          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>
            <FaSignOutAlt /> {loading ? "Resetting..." : "Reset and logout"}
          </button>
        </form>
      </section>
    </Layout>
  );
};

export default ResetPassword;
