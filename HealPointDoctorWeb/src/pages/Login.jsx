import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaBuilding,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaHeartbeat,
  FaLock,
  FaPhoneAlt,
  FaStethoscope,
  FaUserMd,
} from "react-icons/fa";
import api from "../services/api";
import "./DoctorLogin.css";
import "../PremiumAuth.css";

const departments = [
  "Cardiology",
  "Orthopedic",
  "Dentist",
  "Neurology",
  "Dermatology",
  "Pediatrics",
  "Psychiatry",
  "ENT Specialist",
  "Eye Specialist",
  "General Physician",
  "Surgeon",
];

const initialSignup = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  hospitalId: "",
  department: "",
  specialization: "",
  experience: "",
};

const isValidEmailFormat = (email) => {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  if (trimmed.includes("..")) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
    trimmed,
  );
};

export default function Login() {
  const [mode, setMode] = useState("login");
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });
  const [pendingAuth, setPendingAuth] = useState(null);
  const [signupData, setSignupData] = useState(initialSignup);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSubmittingRef = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Manual login required on opening portal: do not auto-redirect on mount.
    const loadHospitals = async () => {
      try {
        const res = await api.get("/api/v1/hospital/get-all");
        const list = res.data?.hospitals || [];
        if (list.length > 0) {
          setHospitals(list);
          setSignupData((item) => ({
            ...item,
            hospitalId: item.hospitalId || list[0]._id,
          }));
          return;
        }
      } catch {
        try {
          const directRes = await fetch(
            "http://localhost:8080/api/v1/hospital/get-all",
          );
          const json = await directRes.json();
          const list = json?.hospitals || [];
          if (list.length > 0) {
            setHospitals(list);
            setSignupData((item) => ({
              ...item,
              hospitalId: item.hospitalId || list[0]._id,
            }));
          }
        } catch {
          // Signup can still load or use default
        }
      }
    };

    loadHospitals();
  }, [navigate]);

  const commitSession = (token, doctor, hospital) => {
    const data = JSON.stringify({ token, doctor, hospital });
    sessionStorage.setItem("doctorApp", data);
    localStorage.setItem("doctorApp", data);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    if (isSubmittingRef.current) return;

    if (!loginData.email || !loginData.password) {
      toast.error("Please enter your email and password.");
      return;
    }
    if (!isValidEmailFormat(loginData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const res = await api.post("/api/v1/doctor/login", {
        email: loginData.email.trim().toLowerCase(),
        password: loginData.password,
      });
      const { token, doctor, authorizedHospitals, hospital } = res.data;

      // When doctor has authorized hospitals, show manual selection/confirmation flow
      if (
        Array.isArray(authorizedHospitals) &&
        authorizedHospitals.length > 0
      ) {
        setPendingAuth({
          token,
          doctor,
          authorizedHospitals,
          selectedHospitalId: hospital?._id || authorizedHospitals[0]._id,
        });
        setMode("select-hospital");
        toast.info("Please confirm your hospital workspace.");
      } else {
        commitSession(token, doctor, hospital);
        toast.success("Login successful");
        navigate("/");
      }
    } catch (err) {
      if (err.response?.status === 429) {
        toast.error(
          err.response?.data?.message ||
            "Too many login attempts. Please wait a moment and try again.",
        );
      } else if (err.response?.status === 401) {
        toast.error(
          err.response?.data?.message || "Email or password is incorrect.",
        );
      } else if (err.response?.status === 403) {
        toast.error(
          err.response?.data?.message ||
            "Your doctor account is not authorized for this portal.",
        );
      } else if (err.response?.status === 404) {
        toast.error("Doctor account not found with this email.");
      } else if (!err.response) {
        toast.error("Unable to connect to HealPoint. Please try again.");
      } else {
        toast.error(
          err.response?.data?.message || "Login failed. Please try again.",
        );
      }
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  const handleConfirmHospital = () => {
    if (!pendingAuth?.selectedHospitalId) {
      toast.error("Please select your hospital to continue.");
      return;
    }
    setLoading(true);
    try {
      const chosen =
        pendingAuth.authorizedHospitals.find(
          (h) => String(h._id) === String(pendingAuth.selectedHospitalId),
        ) || pendingAuth.authorizedHospitals[0];

      const updatedDoctor = {
        ...pendingAuth.doctor,
        hospitalId: chosen,
        hospitalName: chosen.name,
      };

      commitSession(pendingAuth.token, updatedDoctor, chosen);
      toast.success(`Welcome to ${chosen.name}`);
      navigate("/");
    } catch {
      toast.error("Failed to set hospital workspace. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    if (!signupData.name.trim()) {
      toast.error("Doctor name is required.");
      return;
    }
    if (!isValidEmailFormat(signupData.email)) {
      toast.error("Valid email address is required.");
      return;
    }
    if (!signupData.phone.trim()) {
      toast.error("Contact phone number is required.");
      return;
    }
    if (!signupData.hospitalId) {
      toast.error("Please select an affiliated hospital.");
      return;
    }
    if (!signupData.department) {
      toast.error("Please select your clinical department.");
      return;
    }
    if (!signupData.password || signupData.password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    if (signupData.password !== signupData.confirmPassword) {
      toast.error("Password and confirm password do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/api/v1/doctor/signup", signupData);
      toast.success(res.data?.message || "Signup successful. Please login.");
      setLoginData({
        email: signupData.email,
        password: "",
      });
      setSignupData(initialSignup);
      setMode("login");
    } catch (err) {
      toast.error(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const syncDepartment = (value) => {
    setSignupData((item) => ({
      ...item,
      department: value,
      specialization: item.specialization || value,
    }));
  };

  return (
    <div className="login-page-container hp-auth-page hp-auth-page-doctor">
      <div className="hp-auth-visual" aria-hidden="true">
        <div className="hp-auth-visual-mark">
          <FaHeartbeat />
        </div>
        <span>HealPoint clinical workspace</span>
        <strong>
          Manage your appointments
          <br />
          and patients.
        </strong>
        <small>Focused tools for better consultations and calmer care.</small>
      </div>
      <section className="login-card doctor-auth-card hp-auth-card">
        <div className="doctor-auth-brand hp-auth-brand">
          <img
            src="/healpoint-favicon.svg"
            alt="HealPoint"
            width={46}
            height={46}
            style={{ borderRadius: 12, flexShrink: 0 }}
          />
          <div>
            <h2>HealPoint Doctor Portal</h2>
            <p>
              {mode === "select-hospital"
                ? "Select your hospital facility workspace."
                : mode === "login"
                  ? "Login with your registered doctor account."
                  : "Create your doctor account for admin verification."}
            </p>
          </div>
        </div>

        {mode !== "select-hospital" && (
          <div className="doctor-auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => setMode("signup")}
            >
              Sign Up
            </button>
          </div>
        )}

        {mode === "select-hospital" ? (
          <div
            className="doctor-hospital-selection-step"
            style={{ padding: "0.5rem 0" }}
          >
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "#e0f2fe",
                  color: "#0284c7",
                  fontSize: "1.35rem",
                  marginBottom: "0.5rem",
                }}
              >
                <FaBuilding />
              </div>
              <h3
                style={{
                  margin: "0 0 0.25rem 0",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                Confirm Hospital Workspace
              </h3>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                Welcome, {pendingAuth?.doctor?.name || "Doctor"}. Confirm the
                hospital facility you are logging into today.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                marginBottom: "1.25rem",
              }}
            >
              {pendingAuth?.authorizedHospitals?.map((hosp) => {
                const isSelected =
                  String(pendingAuth.selectedHospitalId) === String(hosp._id);
                return (
                  <div
                    key={hosp._id}
                    onClick={() =>
                      setPendingAuth({
                        ...pendingAuth,
                        selectedHospitalId: hosp._id,
                      })
                    }
                    style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "10px",
                      border: isSelected
                        ? "2px solid #0284c7"
                        : "1px solid #e2e8f0",
                      background: isSelected ? "#f0f9ff" : "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "8px",
                        background: isSelected ? "#0284c7" : "#f1f5f9",
                        color: isSelected ? "#ffffff" : "#64748b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.05rem",
                        flexShrink: 0,
                      }}
                    >
                      <FaBuilding />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "0.92rem",
                          color: "#0f172a",
                        }}
                      >
                        {hosp.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.76rem",
                          color: "#64748b",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {hosp.location?.address ||
                          hosp.city ||
                          "Verified Facility"}
                      </div>
                    </div>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          color: "#0284c7",
                          background: "#e0f2fe",
                          padding: "2px 8px",
                          borderRadius: "999px",
                        }}
                      >
                        Selected
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="login-button"
              onClick={handleConfirmHospital}
              disabled={loading}
              style={{ width: "100%", marginBottom: "0.75rem" }}
            >
              {loading ? "Entering Workspace..." : "Confirm & Enter Workspace"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("login");
                setPendingAuth(null);
              }}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontSize: "0.82rem",
                cursor: "pointer",
                padding: "0.5rem",
              }}
            >
              ← Sign in with a different account
            </button>
          </div>
        ) : mode === "login" ? (
          <form onSubmit={handleLogin} noValidate>
            <label className="input-group">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                name="email"
                className="input-field"
                placeholder="doctor@gmail.com"
                value={loginData.email}
                onChange={(event) =>
                  setLoginData({ ...loginData, email: event.target.value })
                }
                required
              />
            </label>
            <label className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                className="input-field"
                placeholder="Password"
                value={loginData.password}
                onChange={(event) =>
                  setLoginData({ ...loginData, password: event.target.value })
                }
                required
              />
              <button
                type="button"
                className="password-toggle-icon"
                onClick={() => setShowPassword((item) => !item)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </label>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form
            className="doctor-signup-form"
            onSubmit={handleSignup}
            noValidate
          >
            <label className="input-group">
              <FaUserMd className="input-icon" />
              <input
                className="input-field"
                placeholder="Full Name"
                value={signupData.name}
                onChange={(event) =>
                  setSignupData({ ...signupData, name: event.target.value })
                }
              />
            </label>
            <label className="input-group">
              <FaEnvelope className="input-icon" />
              <input
                type="email"
                className="input-field"
                placeholder="doctor@gmail.com"
                value={signupData.email}
                onChange={(event) =>
                  setSignupData({ ...signupData, email: event.target.value })
                }
              />
            </label>
            <label className="input-group">
              <FaPhoneAlt className="input-icon" />
              <input
                className="input-field"
                placeholder="Mobile Number"
                value={signupData.phone}
                onChange={(event) =>
                  setSignupData({ ...signupData, phone: event.target.value })
                }
              />
            </label>
            <label className="input-group">
              <FaBuilding className="input-icon" />
              <select
                className="input-field"
                value={signupData.hospitalId}
                onChange={(event) =>
                  setSignupData({
                    ...signupData,
                    hospitalId: event.target.value,
                  })
                }
              >
                <option value="">Select Hospital</option>
                {hospitals.map((hospital) => (
                  <option value={hospital._id} key={hospital._id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <FaStethoscope className="input-icon" />
              <select
                className="input-field"
                value={signupData.department}
                onChange={(event) => syncDepartment(event.target.value)}
              >
                <option value="">Department / Category</option>
                {departments.map((item) => (
                  <option value={item} key={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="input-group">
              <FaStethoscope className="input-icon" />
              <input
                className="input-field"
                placeholder="Specialization"
                value={signupData.specialization}
                onChange={(event) =>
                  setSignupData({
                    ...signupData,
                    specialization: event.target.value,
                  })
                }
              />
            </label>
            <label className="input-group">
              <FaStethoscope className="input-icon" />
              <input
                type="number"
                min="1"
                max="60"
                className="input-field"
                placeholder="Years of Experience"
                value={signupData.experience}
                onChange={(event) =>
                  setSignupData({
                    ...signupData,
                    experience: event.target.value,
                  })
                }
              />
            </label>
            <label className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                className="input-field"
                placeholder="Password"
                value={signupData.password}
                onChange={(event) =>
                  setSignupData({ ...signupData, password: event.target.value })
                }
              />
            </label>
            <label className="input-group">
              <FaLock className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                className="input-field"
                placeholder="Confirm Password"
                value={signupData.confirmPassword}
                onChange={(event) =>
                  setSignupData({
                    ...signupData,
                    confirmPassword: event.target.value,
                  })
                }
              />
              <button
                type="button"
                className="password-toggle-icon"
                onClick={() => setShowPassword((item) => !item)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </label>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? "Creating Account..." : "Create Doctor Account"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
