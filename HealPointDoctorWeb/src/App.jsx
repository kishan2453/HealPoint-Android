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
        aria-label="Anand HealPoint Educational Simulation Notice"
        style={{
          background: "#1E40AF",
          color: "#FFFFFF",
          padding: "5px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          fontSize: "12px",
          fontWeight: "600",
          letterSpacing: "0.02em",
          zIndex: 9999,
        }}
      >
        <span>Anand HealPoint Doctor Portal · Educational simulation only. This is not a real healthcare provider or emergency service.</span>
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
