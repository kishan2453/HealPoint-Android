import React from "react";
import { Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Login from "./pages/Login";
import ProtectedRoute from "./pages/ProtectedRoute";
import DoctorPortal from "./pages/DoctorPortal";
import LogoutConfirmation from "./components/LogoutConfirmation";
import "./PremiumWorkspace.css";
import "./DoctorSaaSMaster.css";

export default function App() {
  return (
    <React.Fragment>
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
