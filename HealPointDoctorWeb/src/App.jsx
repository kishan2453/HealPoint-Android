import React from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Login from "./pages/Login";
import ProtectedRoute from "./pages/ProtectedRoute";
import DoctorPortal from "./pages/DoctorPortal";
import LogoutConfirmation from "./components/LogoutConfirmation";
import "./PremiumWorkspace.css";

export default function App() {
  return (
    <React.Fragment>
      <div
        role="alert"
        aria-label="HealPoint Demo Mode Announcement"
        style={{
          background: "#0284C7",
          color: "#FFFFFF",
          padding: "6px 16px",
          fontSize: "12px",
          fontWeight: "600",
          textAlign: "center",
          letterSpacing: "0.4px",
          zIndex: 9999,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            background: "#F59E0B",
            color: "#0F172A",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "10px",
            fontWeight: "800",
          }}
        >
          DEMO MODE
        </span>
        <span>HealPoint Doctor Portal · Educational simulation only · Not a real healthcare provider</span>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <LogoutConfirmation />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <DoctorPortal />
            </ProtectedRoute>
          }
        />
      </Routes>
    </React.Fragment>
  );
}
