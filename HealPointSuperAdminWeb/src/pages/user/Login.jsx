import React, { useEffect, useState } from "react";
import { toast } from "../../utils/notify";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login } from "../../redux/actions/authActions";
import { reset } from "../../redux/slice/authSlice";
import {
  FaEye,
  FaEyeSlash,
  FaHeartbeat,
  FaLock,
  FaUserShield,
} from "react-icons/fa";
import ForgotPasswordModal from "../../components/common/ForgotPasswordModal";

const Login = () => {
  const [email, setEmail] = useState(
    localStorage.getItem("adminRememberEmail") || "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(
    Boolean(localStorage.getItem("adminRememberEmail")),
  );
  const [touched, setTouched] = useState({});
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();

  const handleLogin = () => {
    if (!email || !password) {
      setTouched({ email: true, password: true });
      return toast.error("Please provide email and password");
    }
    const trimmedEmail = email.trim();
    const emailRegex =
      /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (
      !trimmedEmail ||
      trimmedEmail.includes("..") ||
      trimmedEmail.includes("@.") ||
      !emailRegex.test(trimmedEmail)
    ) {
      setTouched({ email: true });
      return toast.error("Please enter a valid admin email");
    }
    // Login accepts any existing DB password. Strength checks belong to register/reset only.
    if (remember) {
      localStorage.setItem("adminRememberEmail", email);
    } else {
      localStorage.removeItem("adminRememberEmail");
    }
    dispatch(login({ email, password }));
  };

  const { success, error, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    document.body.classList.remove("admin-dark");
    document.body.dataset.theme = "light";
    localStorage.removeItem("adminTheme");
    dispatch(reset());

    const localStr = localStorage.getItem("appData");
    try {
      const appData = localStr ? JSON.parse(localStr) : null;
      if (
        appData?.token &&
        appData?.user?.isAdmin &&
        appData?.user?.role === "Super Admin"
      ) {
        navigate("/home", { replace: true });
      }
    } catch {
      localStorage.removeItem("appData");
    }
  }, [dispatch, navigate]);

  useEffect(() => {
    const adminData = searchParams.get("adminData");
    if (!adminData) {
      return;
    }

    try {
      const session = JSON.parse(adminData);
      const isSuperAdmin =
        session?.user?.isAdmin && session.user.role === "Super Admin";
      if (!session?.token || !isSuperAdmin) {
        toast.error("Only HealPoint Super Admin users can access this portal");
        navigate("/", { replace: true });
        return;
      }

      localStorage.setItem("appData", JSON.stringify(session));
      navigate("/home", { replace: true });
    } catch {
      toast.error("Admin login failed");
      navigate("/", { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    if (success) {
      toast.success("Login Successfully");
      navigate("/home");
      dispatch(reset());
    }
    if (error) {
      toast.error(error);
      dispatch(reset());
    }
  }, [success, error, dispatch, navigate]);
  return (
    <>
      <main className="admin-login-page hp-auth-page hp-auth-page-admin">
        <div className="login-orb one" />
        <div className="login-orb two" />
        <div className="hp-auth-visual" aria-hidden="true">
          <div className="hp-auth-visual-mark">
            <FaHeartbeat />
          </div>
          <span>HealPoint platform control</span>
          <strong>
            Manage the network.
            <br />
            Protect every journey.
          </strong>
          <small>
            Hospitals · Doctors · Appointments · Platform intelligence
          </small>
        </div>
        <section className="admin-login-card hp-auth-card">
          <div
            className="login-logo"
            style={{ background: "transparent", padding: 0 }}
          >
            <img
              src="/logo.png"
              alt="HealPoint"
              width={56}
              height={56}
              style={{ borderRadius: 14 }}
            />
          </div>
          <span className="eyebrow">HealPoint platform access</span>
          <h1>HealPoint Super Admin</h1>
          <p>Manage the HealPoint platform with secure, role-aware access.</p>

          <div className="form-group">
            <label className="form-label">Super Admin email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onBlur={() => setTouched((value) => ({ ...value, email: true }))}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@domain.com"
            />
            {touched.email && !email && <small>Email is required.</small>}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="password-field">
              <FaLock />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onBlur={() =>
                  setTouched((value) => ({ ...value, password: true }))
                }
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {touched.password && !password && (
              <small>Password is required.</small>
            )}
            <small className="login-helper">
              Use your existing database password.
            </small>
          </div>
          <div className="login-options">
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember me
            </label>
            <button type="button" onClick={() => setIsForgotModalOpen(true)}>
              Forgot password?
            </button>
          </div>
          <button
            className="btn btn-primary login-submit"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : "Login securely"}
          </button>
        </section>
      </main>

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
      />
    </>
  );
};

export default Login;
