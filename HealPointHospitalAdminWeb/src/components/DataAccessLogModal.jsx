import React from "react";
import {
  FaTimes,
  FaShieldAlt,
  FaUser,
  FaUserMd,
  FaCalendarAlt,
  FaLaptop,
  FaNetworkWired,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaLock,
  FaFileMedical,
} from "react-icons/fa";

export default function DataAccessLogModal({ logItem, onClose }) {
  if (!logItem) return null;

  const formatTimestamp = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })} at ${d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })}`;
  };

  const getOutcomeBadge = (outcome) => {
    switch (outcome) {
      case "allowed":
        return (
          <span className="status-badge status-confirmed">
            <FaCheckCircle /> Access Authorized
          </span>
        );
      case "denied":
        return (
          <span className="status-badge status-critical">
            <FaTimesCircle /> Access Denied / Blocked
          </span>
        );
      case "break_glass_override":
        return (
          <span className="status-badge status-warning">
            <FaExclamationTriangle /> Emergency Break-Glass Override
          </span>
        );
      default:
        return <span className="status-badge status-info">{outcome}</span>;
    }
  };

  const getAccessTypeLabel = (type) => {
    switch (type) {
      case "break_glass_emergency":
        return "Emergency Break-Glass";
      case "encounter_active":
        return "Active Encounter (Appointment-Based)";
      case "explicit_consent":
        return "Explicit Patient Consent";
      case "direct_owner":
        return "Direct Patient Owner";
      default:
        return type || "Standard";
    }
  };

  return (
    <div className="premier-modal-overlay" onClick={onClose}>
      <div
        className="premier-modal-content audit-detail-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "780px", width: "95%" }}
      >
        <div className="premier-modal-header">
          <div className="header-title-row">
            <div
              className="icon-wrapper shield-icon"
              style={{
                background:
                  logItem.accessOutcome === "denied"
                    ? "#fee2e2"
                    : logItem.accessOutcome === "break_glass_override"
                      ? "#fef3c7"
                      : "#dcfce7",
                color:
                  logItem.accessOutcome === "denied"
                    ? "#dc2626"
                    : logItem.accessOutcome === "break_glass_override"
                      ? "#d97706"
                      : "#16a34a",
              }}
            >
              <FaShieldAlt />
            </div>
            <div>
              <h3>Patient Data Access Audit Inspection</h3>
              <p className="subtext">
                Log ID: <code>{logItem._id}</code> ·{" "}
                {formatTimestamp(logItem.timestamp)}
              </p>
            </div>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>

        <div className="premier-modal-body">
          {/* Summary Status Bar */}
          <div className="audit-meta-summary-card">
            <div className="meta-pill-group">
              <div>
                <span className="meta-label">Access Outcome</span>
                {getOutcomeBadge(logItem.accessOutcome)}
              </div>
              <div>
                <span className="meta-label">Access Mechanism</span>
                <span className="category-pill">
                  {getAccessTypeLabel(logItem.accessType)}
                </span>
              </div>
              <div>
                <span className="meta-label">Data Category</span>
                <span
                  className="category-pill"
                  style={{ background: "#e0e7ff", color: "#3730a3" }}
                >
                  {logItem.dataCategory?.replace("_", " ").toUpperCase() ||
                    "MEDICAL RECORDS"}
                </span>
              </div>
              <div>
                <span className="meta-label">Access Level</span>
                <code className="action-code">
                  {logItem.accessLevel || "read_only"}
                </code>
              </div>
            </div>
          </div>

          {/* Emergency Break-Glass Callout */}
          {logItem.breakGlassReason && (
            <div
              className="audit-section"
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "10px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <FaExclamationTriangle
                  style={{ color: "#d97706", fontSize: "1.2rem" }}
                />
                <h4
                  style={{
                    margin: 0,
                    color: "#92400e",
                    fontSize: "1rem",
                    fontWeight: 700,
                  }}
                >
                  Emergency Break-Glass Justification
                </h4>
              </div>
              <p
                style={{
                  margin: 0,
                  color: "#78350f",
                  fontSize: "0.95rem",
                  lineHeight: 1.5,
                }}
              >
                {logItem.breakGlassReason}
              </p>
            </div>
          )}

          {/* Purpose & Denial Reason */}
          <div className="audit-section">
            <h4 className="section-title">Clinical Purpose & Context</h4>
            <div className="audit-message-box">
              <p className="narrative-text">
                <strong>Declared Purpose:</strong>{" "}
                {logItem.purpose || "Clinical Care / Consultation"}
              </p>
              {logItem.denialReason && (
                <div
                  className="reason-callout"
                  style={{
                    background: "#fee2e2",
                    borderLeft: "4px solid #dc2626",
                    color: "#991b1b",
                    marginTop: "10px",
                  }}
                >
                  <strong>Denial Justification:</strong> {logItem.denialReason}
                </div>
              )}
            </div>
          </div>

          {/* Associated Entities */}
          <div className="audit-section">
            <h4 className="section-title">Involved Healthcare Entities</h4>
            <div className="entities-grid">
              <div className="entity-card">
                <div className="entity-icon">
                  <FaUser />
                </div>
                <div className="entity-info">
                  <span className="entity-label">Patient Subject</span>
                  <strong>{logItem.patient?.name || "Patient Record"}</strong>
                  <span className="entity-sub">
                    {logItem.patient?.phone ||
                      logItem.patient?.email ||
                      "Protected Subject"}
                  </span>
                </div>
              </div>

              {logItem.familyMember && (
                <div className="entity-card">
                  <div className="entity-icon">
                    <FaUser />
                  </div>
                  <div className="entity-info">
                    <span className="entity-label">Family Dependent</span>
                    <strong>{logItem.familyMember.name}</strong>
                    <span className="entity-sub">
                      Relationship:{" "}
                      {logItem.familyMember.relationship || "Dependent"}
                    </span>
                  </div>
                </div>
              )}

              <div className="entity-card">
                <div className="entity-icon">
                  <FaUserMd />
                </div>
                <div className="entity-info">
                  <span className="entity-label">Accessing Physician</span>
                  <strong>
                    {logItem.doctor?.name || "Healthcare Provider"}
                  </strong>
                  <span className="entity-sub">
                    {logItem.doctor?.speciality ||
                      logItem.doctor?.email ||
                      "Attending Doctor"}
                  </span>
                </div>
              </div>

              {logItem.encounterAppointmentId && (
                <div className="entity-card">
                  <div className="entity-icon">
                    <FaCalendarAlt />
                  </div>
                  <div className="entity-info">
                    <span className="entity-label">Linked Encounter</span>
                    <strong className="mono">
                      {logItem.encounterAppointmentId}
                    </strong>
                    <span className="entity-sub">
                      Authorized Active Session
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Technical Provenance */}
          <div className="audit-section">
            <h4 className="section-title">Technical Provenance & Security</h4>
            <div className="provenance-grid">
              <div className="provenance-item">
                <FaNetworkWired />
                <span>
                  IP Address:{" "}
                  <code>{logItem.clientIp || "Internal Network"}</code>
                </span>
              </div>
              <div className="provenance-item">
                <FaLaptop />
                <span>
                  User Agent:{" "}
                  <strong
                    style={{ fontSize: "0.8rem", wordBreak: "break-all" }}
                  >
                    {logItem.userAgent || "HealPoint Verified App"}
                  </strong>
                </span>
              </div>
              {logItem.consentId && (
                <div className="provenance-item">
                  <FaLock />
                  <span>
                    Linked Consent Record:{" "}
                    <code className="mono">{logItem.consentId}</code>
                  </span>
                </div>
              )}
              {logItem.resourceId && (
                <div className="provenance-item">
                  <FaFileMedical />
                  <span>
                    Resource ID:{" "}
                    <code className="mono">{logItem.resourceId}</code>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="premier-modal-footer">
          <button className="premier-btn-secondary" onClick={onClose}>
            Close Inspection
          </button>
        </div>
      </div>
    </div>
  );
}
