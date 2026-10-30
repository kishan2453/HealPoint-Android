import React, { useEffect, useMemo, useState } from "react";
import Menus from "./Menus";
import Footer from "./Footer";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { disconnectAdminSocket } from "../../services/socket";
import { getAnalytics, getStats } from "../../redux/actions/userAction";
import {
  getNotifications,
  markAllNotificationsRead,
  updateNotificationReadStatus,
} from "../../redux/actions/notificationActions";
import {
  FaBars,
  FaBell,
  FaCalendarTimes,
  FaCheckDouble,
  FaChevronDown,
  FaCog,
  FaEnvelope,
  FaImages,
  FaMoneyBillWave,
  FaPowerOff,
  FaShieldAlt,
  FaSignOutAlt,
  FaStar,
  FaStethoscope,
  FaUserCircle,
  FaUserPlus,
} from "react-icons/fa";
import { logout } from "../../redux/slice/authSlice";
import toast from "../../utils/notify";
import AdminActionButton from "../common/AdminActionButton";
import API from "../../Api/API";
import { GlobalAdminSearch } from "../common/GlobalAdminSearch";
import { GoogleMeetModal, GoogleMeetIcon } from "../common/GoogleMeetModal";

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [meetModalOpen, setMeetModalOpen] = useState(false);

  const { user } = useSelector((state) => state.auth);
  const { notifications, unreadCount } = useSelector(
    (state) => state.notifications,
  );

  const notificationIcons = {
    appointment_new: <FaBell />,
    appointment_cancelled: <FaCalendarTimes />,
    payment_success: <FaMoneyBillWave />,
    patient_registered: <FaUserPlus />,
    doctor_added: <FaStethoscope />,
    doctor_updated: <FaStethoscope />,
    doctor_deleted: <FaStethoscope />,
    review_submitted: <FaStar />,
    review_reported: <FaShieldAlt />,
    message_received: <FaEnvelope />,
    admin_action: <FaShieldAlt />,
  };

  useEffect(() => {
    document.body.classList.remove("admin-dark");
    document.body.dataset.theme = "light";
    localStorage.removeItem("adminTheme");
  }, []);

  const [loggingOut, setLoggingOut] = useState(false);

  const confirmLogout = async () => {
    setLoggingOut(true);
    try {
      await API.post("/user/logout");
    } catch {
      // Local logout still completes even if server session expired or offline
    } finally {
      // 1. Clear all authentication and user persistence
      try {
        disconnectAdminSocket();
        localStorage.removeItem("appData");
        localStorage.removeItem("adminTheme");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        sessionStorage.clear();
        // Clear potential cookie tokens
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(
              /=.*/,
              "=;expires=" + new Date().toUTCString() + ";path=/",
            );
        });
      } catch (storageErr) {
        console.warn("Error clearing storage on logout:", storageErr);
      }

      // 2. Clear Redux auth state
      dispatch(logout());
      setLogoutOpen(false);
      setLoggingOut(false);
      toast.success("Logged out successfully");

      // 3. Clean transition to login and prevent back-button restore
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", "/");
      }
      navigate("/", { replace: true });
    }
  };

  const markNotificationRead = (notification) => {
    if (!notification?.isRead) {
      dispatch(
        updateNotificationReadStatus({ id: notification._id, isRead: true }),
      );
    }
  };

  const markAllRead = () => {
    dispatch(markAllNotificationsRead(true));
  };

  useEffect(() => {
    if (location.pathname !== "/earnings") {
      dispatch(getAnalytics());
      dispatch(getStats());
    }
    dispatch(getNotifications({ limit: 20 }));
    const interval = setInterval(() => {
      if (location.pathname !== "/notifications") {
        dispatch(getNotifications({ limit: 20 }));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [dispatch, location.pathname]);

  return (
    <div
      className={`admin-shell ${sidebarCollapsed ? "sa-shell-collapsed" : ""}`}
      data-sa-portal="true"
    >
      <aside
        className={`admin-sidebar ${sidebarCollapsed ? "admin-sidebar-collapsed" : ""}`}
      >
        <Menus
          onLogoutRequest={() => setLogoutOpen(true)}
          collapsed={sidebarCollapsed}
        />
      </aside>

      <main className="admin-main">
        <header className="admin-topbar sa-topbar-modern">
          {/* Topbar Left: Hamburger Toggle + Global Search */}
          <div className="admin-topbar-left sa-topbar-left-modern">
            <button
              type="button"
              className="sa-sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed((c) => !c)}
              aria-label="Toggle navigation"
              title="Toggle navigation"
            >
              <FaBars />
            </button>
            <div className="sa-topbar-search-slot">
              <GlobalAdminSearch />
            </div>
          </div>

          {/* Topbar Right: Google Meet Pill + Notification + Profile */}
          <div className="admin-topbar-actions sa-topbar-right-modern">
            {/* Google Meet Quick-Access Pill */}
            <button
              type="button"
              className="sa-topbar-meet-pill"
              onClick={() => setMeetModalOpen(true)}
              title="Google Meet — Start or join instant consultation"
            >
              <GoogleMeetIcon size={20} />
              <div className="sa-meet-pill-text">
                <span className="sa-meet-pill-title">Google Meet</span>
                <span className="sa-meet-pill-sub">Start / Join / Manage</span>
              </div>
            </button>

            {/* Notification Menu */}
            <div
              className={`admin-notification-menu sa-notification-modern ${notificationsOpen ? "open" : ""}`}
            >
              <button
                type="button"
                className="sa-icon-pill-btn sa-notify-pill"
                onClick={() => setNotificationsOpen((value) => !value)}
                aria-expanded={notificationsOpen}
                title="Notifications"
              >
                <FaBell />
                {!!unreadCount && (
                  <span className="sa-badge-count">{unreadCount}</span>
                )}
              </button>

              <div className="notification-dropdown">
                <div className="notification-dropdown-head">
                  <div>
                    <strong>Notifications</strong>
                    <small>{unreadCount} unread platform alerts</small>
                  </div>
                  <AdminActionButton
                    icon={<FaCheckDouble />}
                    onClick={markAllRead}
                    disabled={!unreadCount}
                    variant="primary"
                  >
                    Read all
                  </AdminActionButton>
                </div>
                <div className="notification-dropdown-list">
                  {(notifications || []).slice(0, 6).map((notification) => (
                    <button
                      type="button"
                      className={`notification-dropdown-item ${notification.isRead ? "read" : "unread"}`}
                      key={notification._id}
                      onClick={() => {
                        markNotificationRead(notification);
                        if (notification.link) navigate(notification.link);
                      }}
                    >
                      <span>
                        {notificationIcons[notification.type] || <FaBell />}
                      </span>
                      <div>
                        <strong>{notification.title}</strong>
                        <small>{notification.message}</small>
                        <em>
                          {new Date(notification.createdAt).toLocaleString()}
                        </em>
                      </div>
                    </button>
                  ))}
                  {!notifications?.length && (
                    <div className="notification-dropdown-empty">
                      No notifications yet.
                    </div>
                  )}
                </div>
                <button
                  className="notification-dropdown-footer"
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate("/notifications");
                  }}
                >
                  View notification center
                </button>
              </div>
            </div>

            {/* Super Admin Profile Pill */}
            <div
              className={`admin-profile-menu sa-profile-modern ${profileOpen ? "open" : ""}`}
            >
              <button
                type="button"
                className="sa-profile-chip-btn"
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
              >
                <div className="sa-profile-avatar-circle">
                  <FaUserCircle />
                </div>
                <div className="sa-profile-meta">
                  <strong className="sa-profile-name">
                    {user?.name || "Admin"}
                  </strong>
                  <small className="sa-profile-role">
                    {user?.role || "Super Admin"}
                  </small>
                </div>
                <FaChevronDown className="sa-profile-chevron" />
              </button>

              <div className="profile-dropdown">
                <div className="profile-dropdown-head">
                  <FaUserCircle />
                  <div>
                    <strong>{user?.name || "Admin"}</strong>
                    <small>{user?.role || "Super Admin"}</small>
                  </div>
                </div>
                <AdminActionButton
                  icon={<FaUserCircle />}
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/admin-profile");
                  }}
                  variant="primary"
                >
                  View Profile
                </AdminActionButton>
                <AdminActionButton
                  icon={<FaCog />}
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/settings");
                  }}
                  variant="primary"
                >
                  Settings
                </AdminActionButton>
                <AdminActionButton
                  icon={<FaShieldAlt />}
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/settings?tab=roles");
                  }}
                  variant="primary"
                >
                  Roles & Permissions
                </AdminActionButton>
                <AdminActionButton
                  icon={<FaImages />}
                  onClick={() => {
                    setProfileOpen(false);
                    navigate("/gallery-management");
                  }}
                  variant="primary"
                >
                  Gallery Management
                </AdminActionButton>
                <AdminActionButton
                  icon={<FaSignOutAlt />}
                  onClick={() => {
                    setProfileOpen(false);
                    setLogoutOpen(true);
                  }}
                  variant="primary"
                >
                  Logout
                </AdminActionButton>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content">{children}</div>
        <Footer />
      </main>

      {/* Google Meet Modal Dialog */}
      <GoogleMeetModal
        isOpen={meetModalOpen}
        onClose={() => setMeetModalOpen(false)}
      />

      {/* Sign Out Confirmation Modal */}
      {logoutOpen && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-confirm-modal hp-logout-modal">
            <div className="admin-logout-icon">
              <FaPowerOff />
            </div>
            <h3>Sign out of HealPoint?</h3>
            <p>
              Your Super Admin session will be closed and you will return to the
              login page.
            </p>
            <div className="admin-inline-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setLogoutOpen(false)}
                disabled={loggingOut}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
