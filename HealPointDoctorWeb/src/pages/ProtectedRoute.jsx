import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const raw =
    sessionStorage.getItem("doctorApp") || localStorage.getItem("doctorApp");
  const data = JSON.parse(raw || "null");
  const token = data?.token;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
