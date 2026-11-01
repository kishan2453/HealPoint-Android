import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaBuilding,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaHeartbeat,
  FaLock,
  FaUserShield,
} from "react-icons/fa";
import api from "../services/api";
import "./HospitalLogin.css";
import "../PremiumAuth.css";

export default function HospitalLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ hospital: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/api/v1/hospital-admin/login", form);
      localStorage.setItem("hospitalAdminApp", JSON.stringify(data));
      toast.success("Login successful");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="hospital-login-page hp-auth-page hp-auth-page-hospital">
      <div className="hp-auth-visual" aria-hidden="true">
        <div className="hp-auth-visual-mark">
          <FaHeartbeat />
        </div>
        <span>HealPoint care network</span>
        <strong>
          Manage appointments
          <br />
          for your hospital.
        </strong>
        <small>Keep every doctor, patient and booking moving together.</small>
      </div>
      <section className="hospital-login-card hp-auth-card">
        <div className="hospital-login-brand hp-auth-brand">
          <img
            src="/logo.png"
            alt="HealPoint"
            width={44}
            height={44}
            style={{ borderRadius: 12, flexShrink: 0 }}
          />
          <div>
            <h1>HealPoint Hospital Admin</h1>
            <p>Sign in to manage your hospital workspace securely.</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>
            Hospital ID or Name
            <div className="hospital-input">
              <FaBuilding />
              <input
                required
                value={form.hospital}
                onChange={(e) => setForm({ ...form, hospital: e.target.value })}
              />
            </div>
          </label>
          <label>
            Email
            <div className="hospital-input">
              <FaEnvelope />
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </label>
          <label>
            Password
            <div className="hospital-input">
              <FaLock />
              <input
                required
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>
          <button className="hospital-login-submit" disabled={loading}>
            {loading ? "Signing in…" : "Login securely"}
          </button>
        </form>
      </section>
    </main>
  );
}
