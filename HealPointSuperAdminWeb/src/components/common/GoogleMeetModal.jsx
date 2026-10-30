import React, { useState } from "react";
import { FaVideo, FaExternalLinkAlt, FaTimes, FaKeyboard, FaCalendarAlt, FaCheckCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export const GoogleMeetIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <path d="M14 10.5V7C14 5.9 13.1 5 12 5H4C2.9 5 2 5.9 2 7V17C2 18.1 2.9 19 4 19H12C13.1 19 14 18.1 14 17V13.5L18.5 17.5C19.1 18 20 17.6 20 16.8V7.2C20 6.4 19.1 6 18.5 6.5L14 10.5Z" fill="#00832D" />
    <path d="M14 10.5L19 6V18L14 13.5V10.5Z" fill="#00AC47" />
    <path d="M12 5H4C2.9 5 2 5.9 2 7V13L6 16.5L14 10.5V7C14 5.9 13.1 5 12 5Z" fill="#0066DA" />
    <path d="M2 13V17C2 18.1 2.9 19 4 19H12C13.1 19 14 18.1 14 17V13.5L11 10.5L2 13Z" fill="#2684FC" />
    <path d="M6 16.5L2 13V17C2 18.1 2.9 19 4 19H11L6 16.5Z" fill="#00832D" />
    <path d="M14 7V10.5L19 6V7H14Z" fill="#FFBA00" />
    <path d="M19 17V18L14 13.5V17H19Z" fill="#00AC47" />
    <circle cx="17.5" cy="12" r="1.5" fill="#EA4335" />
  </svg>
);

export const GoogleMeetModal = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleStartInstant = () => {
    window.open("https://meet.google.com/new", "_blank", "noopener,noreferrer");
    onClose();
  };

  const handleJoinWithCode = (e) => {
    e.preventDefault();
    const clean = meetingCode.trim().replace(/^https?:\/\/meet\.google\.com\//i, "").replace(/[^a-zA-Z0-9-]/g, "");
    if (!clean) {
      setError("Please enter a valid Google Meet code or meeting link.");
      return;
    }
    window.open(`https://meet.google.com/${clean}`, "_blank", "noopener,noreferrer");
    setMeetingCode("");
    setError("");
    onClose();
  };

  const handleManageVideoAppointments = () => {
    onClose();
    navigate("/all-appointments");
  };

  return (
    <div className="admin-modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="hp-meet-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "480px",
          padding: "24px 28px",
          boxShadow: "0 20px 40px rgba(15, 23, 42, 0.15), 0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #E2E8F0",
          animation: "hpFadeUp 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                display: "grid",
                placeItems: "center",
              }}
            >
              <GoogleMeetIcon size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#0F172A" }}>
                Google Meet
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#10B981",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "#10B981", fontWeight: 600 }}>
                  Integration Ready · Online Care
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <FaTimes size={16} />
          </button>
        </div>

        <p style={{ fontSize: "0.85rem", color: "#64748B", margin: "0 0 20px", lineHeight: 1.5 }}>
          Launch instant consultations, connect with hospital medical staff, or join scheduled telehealth visits securely with Google Meet.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            type="button"
            onClick={handleStartInstant}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "#0284C7",
              color: "#FFFFFF",
              border: "none",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
              transition: "all 0.15s ease",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <FaVideo size={16} /> Start Instant Google Meet
            </span>
            <FaExternalLinkAlt size={12} style={{ opacity: 0.8 }} />
          </button>

          <form onSubmit={handleJoinWithCode} style={{ marginTop: "4px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <FaKeyboard
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94A3B8",
                  }}
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Enter meet code or link (e.g. abc-defg-hij)"
                  value={meetingCode}
                  onChange={(e) => {
                    setMeetingCode(e.target.value);
                    if (error) setError("");
                  }}
                  style={{
                    width: "100%",
                    padding: "11px 12px 11px 36px",
                    borderRadius: "10px",
                    border: error ? "1px solid #EF4444" : "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  padding: "0 18px",
                  borderRadius: "10px",
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  color: "#0F172A",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Join
              </button>
            </div>
            {error && (
              <span style={{ display: "block", color: "#EF4444", fontSize: "0.75rem", marginTop: "6px" }}>
                {error}
              </span>
            )}
          </form>

          <div
            style={{
              borderTop: "1px solid #E2E8F0",
              marginTop: "8px",
              paddingTop: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "#64748B", display: "flex", alignItems: "center", gap: "6px" }}>
              <FaCalendarAlt size={12} color="#0284C7" /> Scheduled Telehealth Visits
            </span>
            <button
              type="button"
              onClick={handleManageVideoAppointments}
              style={{
                background: "transparent",
                border: "none",
                color: "#0284C7",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
                textDecoration: "none",
              }}
            >
              View Appointments →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

