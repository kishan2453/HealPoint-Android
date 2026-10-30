import React, { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout/Layout";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "../utils/notify";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  updateNotificationReadStatus,
} from "../redux/actions/notificationActions";
import {
  FaBell,
  FaCalendarTimes,
  FaCheckDouble,
  FaEnvelope,
  FaMoneyBillWave,
  FaRegBell,
  FaShieldAlt,
  FaStar,
  FaStethoscope,
  FaTrash,
  FaUserPlus,
  FaSearch,
  FaExternalLinkAlt,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaCheck,
} from "react-icons/fa";
import ConfirmDialog from "../components/common/ConfirmDialog";

const typeMeta = {
  appointment_new: { label: "New Appointment", icon: <FaBell /> },
  appointment_cancelled: {
    label: "Cancelled Booking",
    icon: <FaCalendarTimes />,
  },
  payment_success: { label: "Payment Received", icon: <FaMoneyBillWave /> },
  patient_registered: { label: "Patient Registration", icon: <FaUserPlus /> },
  doctor_added: { label: "Doctor Added", icon: <FaStethoscope /> },
  doctor_updated: { label: "Doctor Updated", icon: <FaStethoscope /> },
  doctor_deleted: { label: "Doctor Removed", icon: <FaStethoscope /> },
  review_submitted: { label: "Patient Review", icon: <FaStar /> },
  review_reported: { label: "Review Flagged", icon: <FaShieldAlt /> },
  message_received: { label: "Support Ticket", icon: <FaEnvelope /> },
  admin_action: { label: "System Action", icon: <FaShieldAlt /> },
};

const PAGE_SIZE = 10;

const NotificationsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notifications, unreadCount, loading } = useSelector(
    (state) => state.notifications,
  );
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    dispatch(getNotifications({ status, type }));
    const interval = setInterval(() => {
      dispatch(getNotifications({ status, type }));
    }, 8000);
    return () => clearInterval(interval);
  }, [dispatch, status, type]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, type]);

  const stats = useMemo(() => {
    const list = notifications || [];
    const high = list.filter((item) => item.priority === "high").length;
    return [
      { label: "Unread Alerts", value: unreadCount, icon: <FaBell /> },
      { label: "Total Visible", value: list.length, icon: <FaRegBell /> },
      { label: "High Priority", value: high, icon: <FaShieldAlt /> },
    ];
  }, [notifications, unreadCount]);

  const filteredNotifications = useMemo(() => {
    const list = notifications || [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((item) => {
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchMsg = (item.message || "").toLowerCase().includes(q);
      const matchActor = (item.actorName || "").toLowerCase().includes(q);
      return matchTitle || matchMsg || matchActor;
    });
  }, [notifications, search]);

  const totalPages = Math.ceil(filteredNotifications.length / PAGE_SIZE) || 1;
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredNotifications.slice(start, start + PAGE_SIZE);
  }, [filteredNotifications, currentPage]);

  const resolveTargetLink = (item) => {
    if (item.link) return item.link;
    switch (item.type) {
      case "appointment_new":
      case "appointment_cancelled":
      case "patient_registered":
        return "/all-appointments";
      case "payment_success":
        return "/subscriptions";
      case "doctor_added":
      case "doctor_updated":
      case "doctor_deleted":
        return "/all-doctors";
      case "review_submitted":
      case "review_reported":
        return "/reviews";
      case "message_received":
        return "/support";
      case "admin_action":
        return "/audit-logs";
      default:
        return "/home";
    }
  };

  const handleOpenNotification = async (notification) => {
    if (!notification.isRead) {
      try {
        await dispatch(
          updateNotificationReadStatus({
            id: notification._id,
            isRead: true,
          }),
        ).unwrap();
      } catch (err) {
        // silent
      }
    }
    const target = resolveTargetLink(notification);
    if (target) {
      navigate(target);
    }
  };

  const toggleRead = async (notification) => {
    try {
      await dispatch(
        updateNotificationReadStatus({
          id: notification._id,
          isRead: !notification.isRead,
        }),
      ).unwrap();
    } catch (error) {
      toast.error(error);
    }
  };

  const markAll = async () => {
    try {
      await dispatch(markAllNotificationsRead(true)).unwrap();
      dispatch(getNotifications({ status, type }));
      toast.success("Notifications marked as read");
    } catch (error) {
      toast.error(error);
    }
  };

  const removeNotification = async () => {
    if (!deleteTarget?._id) return;

    try {
      await dispatch(deleteNotification(deleteTarget._id)).unwrap();
      toast.success("Notification deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setType("all");
  };

  const hasActiveFilters =
    Boolean(search.trim()) || status !== "all" || type !== "all";

  return (
    <Layout>
      <section className="page-intro notifications-hero">
        <div>
          <span className="eyebrow">Platform Signal Center</span>
          <h2>Notifications & Live Alerts</h2>
          <p>
            Real-time operational alerts, appointment events, doctor actions,
            and security logs.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={markAll}
          disabled={!unreadCount}
          style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
        >
          <FaCheckDouble /> Mark All Read ({unreadCount})
        </button>
      </section>

      <div className="notification-stats">
        {stats.map((item) => (
          <article className="metric-card" key={item.label}>
            <div className="metric-icon">{item.icon}</div>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      <div className="notif-quick-chips">
        <button
          type="button"
          className={`notif-chip-btn ${status === "all" && type === "all" ? "active" : ""}`}
          onClick={() => {
            setStatus("all");
            setType("all");
          }}
        >
          All Alerts ({notifications?.length || 0})
        </button>
        <button
          type="button"
          className={`notif-chip-btn ${status === "unread" ? "active" : ""}`}
          onClick={() => {
            setStatus("unread");
            setType("all");
          }}
        >
          Unread ({unreadCount})
        </button>
        <button
          type="button"
          className={`notif-chip-btn ${type === "appointment_new" || type === "appointment_cancelled" ? "active" : ""}`}
          onClick={() => {
            setStatus("all");
            setType("appointment_new");
          }}
        >
          Appointments
        </button>
        <button
          type="button"
          className={`notif-chip-btn ${type === "payment_success" ? "active" : ""}`}
          onClick={() => {
            setStatus("all");
            setType("payment_success");
          }}
        >
          Payments
        </button>
        <button
          type="button"
          className={`notif-chip-btn ${type === "doctor_added" || type === "doctor_updated" ? "active" : ""}`}
          onClick={() => {
            setStatus("all");
            setType("doctor_added");
          }}
        >
          Doctors
        </button>
        <button
          type="button"
          className={`notif-chip-btn ${type === "review_submitted" || type === "review_reported" ? "active" : ""}`}
          onClick={() => {
            setStatus("all");
            setType("review_submitted");
          }}
        >
          Reviews
        </button>
        <button
          type="button"
          className={`notif-chip-btn ${type === "message_received" ? "active" : ""}`}
          onClick={() => {
            setStatus("all");
            setType("message_received");
          }}
        >
          Support Tickets
        </button>
      </div>

      <div className="filters-row page-search-row">
        <div className="admin-search grow" style={{ position: "relative" }}>
          <FaSearch />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search alerts by title, description, or actor..."
          />
        </div>

        {hasActiveFilters && (
          <button
            className="btn btn-light"
            type="button"
            onClick={clearFilters}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <FaTimes /> Clear
          </button>
        )}

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="unread">Unread Only</option>
          <option value="read">Read Only</option>
        </select>

        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All Categories</option>
          {Object.entries(typeMeta).map(([value, meta]) => (
            <option value={value} key={value}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div className="search-summary-row">
        <span>
          Showing <strong>{filteredNotifications.length}</strong> alerts
          {search.trim() ? ` matching "${search.trim()}"` : ""}
        </span>
      </div>

      <div className="notification-list">
        {paginatedNotifications.map((notification) => {
          const meta = typeMeta[notification.type] || {
            label: "System Alert",
            icon: <FaBell />,
          };
          const targetUrl = resolveTargetLink(notification);

          return (
            <article
              className={`notification-card ${notification.isRead ? "read" : "unread"}`}
              key={notification._id}
              style={{
                transition: "box-shadow 0.2s, transform 0.2s",
                position: "relative",
              }}
            >
              <div className="notification-icon">{meta.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="notification-title-row">
                  <h3
                    onClick={() => handleOpenNotification(notification)}
                    style={{ cursor: "pointer" }}
                    title="Click to open related module"
                  >
                    {notification.title}
                  </h3>
                  <span>
                    {new Date(notification.createdAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p
                  onClick={() => handleOpenNotification(notification)}
                  style={{ cursor: "pointer" }}
                >
                  {notification.message}
                </p>
                <div
                  className="notification-meta"
                  style={{ flexWrap: "wrap", gap: "8px" }}
                >
                  <span className="notif-tag category-tag">{meta.label}</span>
                  {notification.priority === "high" && (
                    <span
                      className="notif-tag priority-tag"
                      style={{
                        background: "#fee2e2",
                        color: "#b91c1c",
                        fontWeight: 700,
                      }}
                    >
                      High Priority
                    </span>
                  )}
                  {notification.actorName && (
                    <span className="notif-tag actor-tag">
                      By: {notification.actorName}
                    </span>
                  )}
                  {!notification.isRead && (
                    <span
                      className="notif-tag unread-dot-tag"
                      style={{
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 600,
                      }}
                    >
                      New
                    </span>
                  )}
                </div>
              </div>
              <div
                className="notification-actions"
                style={{ flexShrink: 0, gap: "8px" }}
              >
                {targetUrl && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenNotification(notification)}
                    title="Open related module"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "6px 12px",
                      fontSize: "0.82rem",
                    }}
                  >
                    <FaExternalLinkAlt /> Open
                  </button>
                )}
                <button
                  className="btn btn-light btn-sm"
                  onClick={() => toggleRead(notification)}
                  title={
                    notification.isRead ? "Mark as unread" : "Mark as read"
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    fontSize: "0.82rem",
                  }}
                >
                  {notification.isRead ? (
                    "Mark unread"
                  ) : (
                    <>
                      <FaCheck /> Read
                    </>
                  )}
                </button>
                <button
                  className="icon-btn danger-icon"
                  onClick={() => setDeleteTarget(notification)}
                  title="Delete notification"
                  style={{
                    padding: "7px 10px",
                    borderRadius: "8px",
                  }}
                >
                  <FaTrash />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div
          className="pagination-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "24px",
            padding: "12px 16px",
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(currentPage * PAGE_SIZE, filteredNotifications.length)} of{" "}
            {filteredNotifications.length} alerts
          </span>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-light btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <FaChevronLeft /> Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                type="button"
                key={num}
                className={`btn btn-sm ${num === currentPage ? "btn-primary" : "btn-light"}`}
                onClick={() => setCurrentPage(num)}
                style={{ minWidth: "32px", padding: "4px 8px" }}
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-light btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
      )}

      {!filteredNotifications.length && (
        <div className="empty-state">
          {loading
            ? "Loading notifications..."
            : hasActiveFilters
              ? "No alerts match the current filter criteria."
              : "No notifications found."}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Notification"
        message={`Are you sure you want to delete "${deleteTarget?.title || "this notification"}"?`}
        details="This notification will be removed from the admin notification center."
        confirmLabel="Delete Notification"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={removeNotification}
        loading={loading}
      />
    </Layout>
  );
};

export default NotificationsPage;
