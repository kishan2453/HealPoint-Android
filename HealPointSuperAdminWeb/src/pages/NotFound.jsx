import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout/Layout";
import { FaExclamationTriangle, FaHome } from "react-icons/fa";

export default function NotFound() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || localStorage.getItem("appData");

  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          backgroundColor: "#FEF3C7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <FaExclamationTriangle style={{ fontSize: 36, color: "#D97706" }} />
      </div>
      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: "#0F172A",
          marginBottom: 8,
          letterSpacing: "-0.02em",
        }}
      >
        404 - Page Not Found
      </h1>
      <p
        style={{
          fontSize: 16,
          color: "#64748B",
          maxWidth: 480,
          lineHeight: 1.6,
          marginBottom: 28,
        }}
      >
        The page you are looking for does not exist in the Super Admin Portal or
        has been relocated.
      </p>
      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid #CBD5E1",
            background: "#FFFFFF",
            color: "#334155",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Go Back
        </button>
        <Link
          to="/home"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 22px",
            borderRadius: 8,
            background: "#0D9488",
            color: "#FFFFFF",
            fontWeight: 600,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          <FaHome /> Return to Dashboard
        </Link>
      </div>
    </div>
  );

  if (token) {
    return <Layout>{content}</Layout>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8FAFC",
      }}
    >
      {content}
    </div>
  );
}

