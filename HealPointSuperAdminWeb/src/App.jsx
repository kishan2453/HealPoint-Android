import { Route, Routes } from "react-router-dom";
import "./App.css";
import Login from "./pages/user/Login";
import ResetPassword from "./pages/user/ResetPassword";
import { Toaster } from "react-hot-toast";
import Home from "./pages/Home";
import NotificationsPage from "./pages/NotificationsPage";
import AdminAccount from "./pages/AdminAccount";
import GalleryManagement from "./pages/GalleryManagement";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AdminPreloader from "./components/AIExperience/AdminPreloader";
import HospitalManagement from "./pages/HospitalManagement";
import HospitalAdminManagement from "./pages/HospitalAdminManagement";
import VideoManagement from "./pages/VideoManagement";
import Allusers from "./pages/user/Allusers";
import UserDetails from "./pages/user/UserDetails";
import AllDoctors from "./pages/doctors/AllDoctors";
import AddDoctor from "./pages/doctors/AddDoctor";
import DoctorDetails from "./pages/doctors/DoctorDetails";
import DoctorVerification from "./pages/doctors/DoctorVerification";
import DoctorVerificationDetails from "./pages/doctors/DoctorVerificationDetails";
import AllAppointments from "./pages/appointments/AllAppointments";
import AppontementDetails from "./pages/appointments/AppontementDetails";
import ReviewsManagement from "./pages/ReviewsManagement";
import EarningsDashboard from "./pages/EarningsDashboard";
import SupportManagement from "./pages/SupportManagement";
import Subscriptions from "./pages/subscriptions/Subscriptions";
import SubscriptionPlans from "./pages/subscriptions/SubscriptionPlans";
import HospitalSubscriptions from "./pages/HospitalSubscriptions";
import GlobalResourceCapacity from "./pages/GlobalResourceCapacity";
import PlatformAnalytics from "./pages/PlatformAnalytics";
import EmergencyMonitoring from "./pages/EmergencyMonitoring";
import SystemHealth from "./pages/SystemHealth";
import AuditLogs from "./pages/AuditLogs";
import NotFound from "./pages/NotFound";
import { hasPermission } from "./utils/permissions";
import { initAdminSocket, subscribeAdminSync } from "./services/socket";
import toast from "react-hot-toast";

const ProtectedRoute = ({ children, requiredPermission }) => {
  const localStr = localStorage.getItem("appData");
  let appData = null;
  try {
    appData = localStr ? JSON.parse(localStr) : null;
  } catch {
    appData = null;
  }
  const isSuperAdmin =
    Boolean(appData?.token) &&
    Boolean(appData?.user?.isAdmin) &&
    appData.user.role === "Super Admin" &&
    appData.user.isActive !== false;

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requiredPermission && !hasPermission(appData.user, requiredPermission)) {
    return <Navigate to="/home" replace />;
  }

  return children;
};

function App() {
  const [loadingExperience, setLoadingExperience] = useState(true);

  useEffect(() => {
    document.body.classList.remove("admin-dark");
    document.body.dataset.theme = "light";
    localStorage.removeItem("adminTheme");

    // Guard against back-button restore from browser bfcache after logout
    const handlePageShow = (event) => {
      const localStr = localStorage.getItem("appData");
      let appData = null;
      try {
        appData = localStr ? JSON.parse(localStr) : null;
      } catch {
        appData = null;
      }
      const isSuper =
        Boolean(appData?.token) &&
        Boolean(appData?.user?.isAdmin) &&
        appData.user.role === "Super Admin";

      if (!isSuper && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoadingExperience(false), 1250);
    return () => clearTimeout(timer);
  }, []);

  // Real-time synchronization for Super Admin
  useEffect(() => {
    const localStr = localStorage.getItem("appData");
    let appData = null;
    try {
      appData = localStr ? JSON.parse(localStr) : null;
    } catch {
      appData = null;
    }

    if (appData?.token) {
      initAdminSocket(appData.token);
    }

    const unsubscribe = subscribeAdminSync({
      onNotification: (notif) => {
        if (notif?.title) {
          toast(notif.title, { icon: "🔔" });
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      <AdminPreloader show={loadingExperience} />
      <Toaster
        position="top-right"
        toastOptions={{
          className: "premium-toast",
          style: {
            borderRadius: "12px",
            background: "var(--bg-card, #ffffff)",
            color: "var(--text-primary, #1e293b)",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            padding: "16px",
            fontWeight: "500",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: "#fff" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#fff" },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute requiredPermission="dashboard">
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/platform-analytics"
          element={
            <ProtectedRoute requiredPermission="reports">
              <PlatformAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/emergencies"
          element={
            <ProtectedRoute>
              <EmergencyMonitoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospitals"
          element={
            <ProtectedRoute requiredPermission="hospitals">
              <HospitalManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital-admins"
          element={
            <ProtectedRoute requiredPermission="hospital_admins">
              <HospitalAdminManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/earnings"
          element={
            <ProtectedRoute requiredPermission="reports">
              <EarningsDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital-subscriptions"
          element={
            <ProtectedRoute requiredPermission="subscriptions">
              <HospitalSubscriptions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/global-resources"
          element={
            <ProtectedRoute requiredPermission="hospitals">
              <GlobalResourceCapacity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions"
          element={
            <ProtectedRoute requiredPermission="subscriptions">
              <Subscriptions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription-plans"
          element={
            <ProtectedRoute requiredPermission="subscriptions">
              <SubscriptionPlans />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute requiredPermission="support">
              <SupportManagement />
            </ProtectedRoute>
          }
        />
        <Route path="/messages" element={<Navigate to="/support" replace />} />
        <Route
          path="/reviews"
          element={
            <ProtectedRoute requiredPermission="reviews">
              <ReviewsManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/all-users"
          element={
            <ProtectedRoute requiredPermission="patients">
              <Allusers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-details/:id"
          element={
            <ProtectedRoute requiredPermission="patients">
              <UserDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/all-doctors"
          element={
            <ProtectedRoute requiredPermission="doctors">
              <AllDoctors />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-doctor"
          element={
            <ProtectedRoute requiredPermission="doctors">
              <AddDoctor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor-details/:id"
          element={
            <ProtectedRoute requiredPermission="doctors">
              <DoctorDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor-verification"
          element={
            <ProtectedRoute requiredPermission="doctors">
              <DoctorVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctors/verification/:doctorId"
          element={
            <ProtectedRoute requiredPermission="doctors">
              <DoctorVerificationDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/all-appointments"
          element={
            <ProtectedRoute requiredPermission="appointments">
              <AllAppointments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/appointment-details/:id"
          element={
            <ProtectedRoute requiredPermission="appointments">
              <AppontementDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute requiredPermission="notifications">
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <ProtectedRoute>
              <ResetPassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-profile"
          element={
            <ProtectedRoute>
              <AdminAccount defaultTab="profile" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requiredPermission="settings">
              <AdminAccount defaultTab="settings" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles-permissions"
          element={
            <ProtectedRoute requiredPermission="settings">
              <AdminAccount defaultTab="roles" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-health"
          element={
            <ProtectedRoute requiredPermission="system_health">
              <SystemHealth />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute requiredPermission="audit_logs">
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manage-account"
          element={
            <ProtectedRoute>
              <AdminAccount defaultTab="security" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-management"
          element={
            <ProtectedRoute requiredPermission="hospital_admins">
              <HospitalAdminManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gallery-management"
          element={
            <ProtectedRoute requiredPermission="gallery">
              <GalleryManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/video-guide"
          element={
            <ProtectedRoute requiredPermission="video_guide">
              <VideoManagement />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
