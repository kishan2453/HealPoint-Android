import React from "react";
import {
  FaTimes,
  FaShieldAlt,
  FaArrowRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaUser,
  FaUserMd,
  FaCalendarAlt,
  FaLaptop,
  FaNetworkWired,
} from "react-icons/fa";

export default function AuditDetailModal({ auditEvent, onClose }) {
  if (!auditEvent) return null;

  const severityBadge = (severity) => {
    switch (severity) {
      case "critical":
        return (
          <span className="status-badge status-critical">
            <FaExclamationTriangle /> Critical
          </span>
        );
      case "warning":
        return (
          <span className="status-badge status-warning">
            <FaExclamationTriangle /> Warning
          </span>
        );
      case "notice":
        return (
          <span className="status-badge status-notice">
            <FaInfoCircle /> Notice
          </span>
        );
      default:
        return (
          <span className="status-badge status-info">
            <FaInfoCircle /> Info
          </span>
        );
    }
  };

  const statusBadge = (status) => {
    if (status === "failed") {
      return <span className="status-badge status-failed">Failed</span>;
    }
    if (status === "warning") {
      return <span className="status-badge status-warning">Warning</span>;
    }
    return (
      <span className="status-badge status-confirmed">
        <FaCheckCircle /> Success
      </span>
    );
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} at ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
  };

  const hasTransition =
    auditEvent.stateTransition &&
    (auditEvent.stateTransition.from || auditEvent.stateTransition.to);

  return (
    <div className="premier-modal-overlay" onClick={onClose}>
      <div
        className="premier-modal-content audit-detail-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "780px", width: "95%" }}
      >
        <div className="premier-modal-header">
          <div className="header-title-row">
            <div className="icon-wrapper shield-icon">
              <FaShieldAlt />
            </div>
            <div>
              <h3>{auditEvent.title || "Audit Record Detail"}</h3>
              <p className="subtext">
                Record ID: <code>{auditEvent._id}</code> ·{" "}
                {formatTimestamp(auditEvent.timestamp)}
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
          {/* Status & Severity Bar */}
          <div className="audit-meta-summary-card">
            <div className="meta-pill-group">
              <div>
                <span className="meta-label">Severity</span>
                {severityBadge(auditEvent.severity)}
              </div>
              <div>
                <span className="meta-label">Execution Status</span>
                {statusBadge(auditEvent.status)}
              </div>
              <div>
                <span className="meta-label">Category</span>
                <span className="category-pill">{auditEvent.category}</span>
              </div>
              <div>
                <span className="meta-label">Action</span>
                <code className="action-code">{auditEvent.action}</code>
              </div>
            </div>
          </div>

          {/* Description & Reason */}
          <div className="audit-section">
            <h4 className="section-title">Event Narrative</h4>
            <div className="audit-message-box">
              <p className="narrative-text">
                {auditEvent.description || auditEvent.title}
              </p>
              {auditEvent.reason && (
                <div className="reason-callout">
                  <strong>Stated Reason:</strong> {auditEvent.reason}
                </div>
              )}
            </div>
          </div>

          {/* State Transition Visualizer */}
          {hasTransition && (
            <div className="audit-section">
              <h4 className="section-title">State Change Transition</h4>
              <div className="state-transition-card">
                <div className="state-box prev">
                  <span className="state-label">Previous State</span>
                  <div className="state-value">
                    {auditEvent.stateTransition.from || "Initial / None"}
                  </div>
                  {auditEvent.previousState && (
                    <pre className="state-json-preview">
                      {JSON.stringify(auditEvent.previousState, null, 2)}
                    </pre>
                  )}
                </div>

                <div className="transition-arrow">
                  <FaArrowRight />
                  <span className="field-tag">
                    {auditEvent.stateTransition.field || "State"}
                  </span>
                </div>

                <div className="state-box next">
                  <span className="state-label">Changed To</span>
                  <div className="state-value">
                    {auditEvent.stateTransition.to || "Updated"}
                  </div>
                  {auditEvent.newState && (
                    <pre className="state-json-preview">
                      {JSON.stringify(auditEvent.newState, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Associated Entities Grid */}
          <div className="audit-section">
            <h4 className="section-title">Associated Clinical Entities</h4>
            <div className="entities-grid">
              <div className="entity-card">
                <div className="entity-icon">
                  <FaUser />
                </div>
                <div className="entity-info">
                  <span className="entity-label">Actor</span>
                  <strong>{auditEvent.actor?.name || "System"}</strong>
                  <span className="entity-sub">
                    {auditEvent.actor?.role || "Automated Process"}
                  </span>
                </div>
              </div>

              {auditEvent.appointmentId && (
                <div className="entity-card">
                  <div className="entity-icon">
                    <FaCalendarAlt />
                  </div>
                  <div className="entity-info">
                    <span className="entity-label">Appointment</span>
                    <strong className="mono">{auditEvent.appointmentId}</strong>
                    <span className="entity-sub">Clinical Booking</span>
                  </div>
                </div>
              )}

              {auditEvent.doctor?.name && (
                <div className="entity-card">
                  <div className="entity-icon">
                    <FaUserMd />
                  </div>
                  <div className="entity-info">
                    <span className="entity-label">Doctor</span>
                    <strong>{auditEvent.doctor.name}</strong>
                    <span className="entity-sub">
                      {auditEvent.doctor.speciality || "Attending Physician"}
                    </span>
                  </div>
                </div>
              )}

              {auditEvent.patient?.name && (
                <div className="entity-card">
                  <div className="entity-icon">
                    <FaUser />
                  </div>
                  <div className="entity-info">
                    <span className="entity-label">Patient</span>
                    <strong>{auditEvent.patient.name}</strong>
                    <span className="entity-sub">
                      {auditEvent.patient.phone || "Authorized Record"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Client & Verification Metadata */}
          <div className="audit-section">
            <h4 className="section-title">Environment & Provenance</h4>
            <div className="provenance-grid">
              <div className="provenance-item">
                <FaNetworkWired />
                <span>
                  Client IP:{" "}
                  <code>{auditEvent.client?.ip || "Internal / System"}</code>
                </span>
              </div>
              <div className="provenance-item">
                <FaLaptop />
                <span>
                  Browser:{" "}
                  <strong>
                    {auditEvent.client?.browser || "System Client"}
                  </strong>
                </span>
              </div>
              <div className="provenance-item">
                <span>
                  Device:{" "}
                  <strong>
                    {auditEvent.client?.device || "Standard Workstation"}
                  </strong>
                </span>
              </div>
              <div className="provenance-item">
                <span>
                  Resource Type:{" "}
                  <strong className="mono">{auditEvent.resourceType}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="premier-modal-footer">
          <button className="premier-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
