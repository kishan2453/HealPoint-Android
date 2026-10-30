import React, { useEffect, useState, useCallback } from "react";
import {
  FaShieldAlt,
  FaFileDownload,
  FaSyncAlt,
  FaFilter,
  FaSearch,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaArrowRight,
  FaUserMd,
  FaUser,
  FaClinicMedical,
  FaLock,
  FaEye,
  FaChevronLeft,
  FaChevronRight,
  FaCircle,
  FaTimesCircle,
  FaUserShield,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import AuditDetailModal from "../components/AuditDetailModal";
import DataAccessLogModal from "../components/DataAccessLogModal";
import { subscribeHospitalSync } from "../services/socket";
import "./ComplianceCenter.css";

export default function ComplianceGovernanceCenter({ hospital }) {
  const [activeTab, setActiveTab] = useState("audit"); // 'audit' | 'clinical' | 'security' | 'transitions' | 'privacy'
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [privacyMetrics, setPrivacyMetrics] = useState(null);
  const [events, setEvents] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
  });
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedAccessLog, setSelectedAccessLog] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [actorRoleFilter, setActorRoleFilter] = useState("all");
  const [accessTypeFilter, setAccessTypeFilter] = useState("all");
  const [rangeFilter, setRangeFilter] = useState("all"); // 'all' | 'today' | '7days' | '30days'
  const [socketLive, setSocketLive] = useState(true);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load Overview Metrics
  const loadOverview = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/hospital-admin/compliance/overview");
      if (res.data.success) {
        setOverview(res.data);
      }
    } catch (err) {
      console.error("Failed to load compliance overview:", err);
    }
  }, []);

  // Load Audit Events based on tab and filters
  const loadEvents = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      try {
        let endpoint = "/api/v1/hospital-admin/compliance/audit-trail";
        const params = {
          page: pageToLoad,
          limit: pagination.limit,
          search: debouncedSearch,
          range: rangeFilter,
        };

        if (activeTab === "clinical") {
          endpoint = "/api/v1/hospital-admin/compliance/clinical-governance";
          if (severityFilter !== "all") params.severity = severityFilter;
          if (actorRoleFilter !== "all") params.actorRole = actorRoleFilter;
        } else if (activeTab === "security") {
          endpoint = "/api/v1/hospital-admin/compliance/security-events";
          if (severityFilter !== "all") params.severity = severityFilter;
        } else if (activeTab === "privacy") {
          endpoint = "/api/v1/hospital-admin/compliance/data-access-governance";
          if (accessTypeFilter !== "all") params.accessType = accessTypeFilter;
        } else {
          // Standard audit trail tab & state transitions tab
          if (categoryFilter !== "all") params.category = categoryFilter;
          if (severityFilter !== "all") params.severity = severityFilter;
          if (actorRoleFilter !== "all") params.actorRole = actorRoleFilter;
        }

        const res = await api.get(endpoint, { params });
        if (res.data.success) {
          if (activeTab === "privacy") {
            setEvents(res.data.accessLogs || []);
            if (res.data.metrics) {
              setPrivacyMetrics(res.data.metrics);
            }
          } else {
            let loaded = res.data.events || [];
            if (activeTab === "transitions") {
              loaded = loaded.filter(
                (e) =>
                  e.stateTransition &&
                  (e.stateTransition.from || e.stateTransition.to),
              );
            }
            setEvents(loaded);
          }
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        }
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Failed to load audit records",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      activeTab,
      debouncedSearch,
      categoryFilter,
      severityFilter,
      actorRoleFilter,
      accessTypeFilter,
      rangeFilter,
      pagination.limit,
    ],
  );

  // Initial load
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadEvents(1);
  }, [loadEvents]);

  // Socket.IO real-time sync
  useEffect(() => {
    const unsub = subscribeHospitalSync({
      onAuditSync: (newAudit) => {
        setSocketLive(true);
        toast.info(`Audit logged: ${newAudit.title || newAudit.action}`);
        loadOverview();
        loadEvents(pagination.page);
      },
    });

    return () => {
      unsub();
    };
  }, [loadOverview, loadEvents, pagination.page]);

  // Export CSV Handler with active filter parameters
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = {
        format: "csv",
        search: debouncedSearch || undefined,
        range: rangeFilter !== "all" ? rangeFilter : undefined,
      };

      if (activeTab === "clinical") {
        params.category = "clinical";
        if (severityFilter !== "all") params.severity = severityFilter;
        if (actorRoleFilter !== "all") params.actorRole = actorRoleFilter;
      } else if (activeTab === "security") {
        params.category = "security";
        if (severityFilter !== "all") params.severity = severityFilter;
      } else {
        if (categoryFilter !== "all") params.category = categoryFilter;
        if (severityFilter !== "all") params.severity = severityFilter;
        if (actorRoleFilter !== "all") params.actorRole = actorRoleFilter;
      }

      const res = await api.get(
        "/api/v1/hospital-admin/compliance/export",
        {
          params,
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(
        new Blob([res.data], { type: "text/csv" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `healpoint-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Filtered audit trail exported successfully");
    } catch {
      toast.error("Export failed. Please check permissions.");
    } finally {
      setExporting(false);
    }
  };

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

  const formatTimestamp = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
  };

  const metrics = overview?.metrics || {};

  return (
    <div className="premier-page-container compliance-center">
      {/* Header */}
      <div className="premier-page-header">
        <div className="header-left">
          <div className="breadcrumb-line">
            <span>Hospital Operations</span>
            <span className="separator">/</span>
            <span className="current">Compliance & Governance</span>
          </div>
          <h1>Hospital Compliance & Governance Center</h1>
          <p>
            Immutable audit trail, clinical accountability, state change
            provenance & access oversight for{" "}
            {hospital?.name || "this hospital"}
          </p>
        </div>

        <div className="header-right actions-row">
          <div className="live-socket-badge">
            <FaCircle
              className={socketLive ? "pulse-dot active" : "pulse-dot"}
            />
            <span>
              Audit Stream: <strong>Live</strong>
            </span>
          </div>

          <button
            className="premier-btn-secondary"
            onClick={() => {
              loadOverview();
              loadEvents(pagination.page);
            }}
            title="Refresh logs"
          >
            <FaSyncAlt className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            className="premier-btn-primary"
            onClick={handleExportCSV}
            disabled={exporting}
            title="Export full filtered audit trail to CSV"
          >
            <FaFileDownload />
            <span>{exporting ? "Exporting…" : "Export Log (CSV)"}</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      {activeTab === "privacy" ? (
        <div className="premier-kpi-grid">
          <div className="kpi-card">
            <div
              className="kpi-icon-box"
              style={{ background: "#e0f2fe", color: "#0284c7" }}
            >
              <FaShieldAlt />
            </div>
            <div className="kpi-details">
              <span className="kpi-title">Total Access Events</span>
              <div className="kpi-value">
                {privacyMetrics?.totalAccessEvents ?? "0"}
              </div>
              <span className="kpi-subtext">Clinical records accessed</span>
            </div>
          </div>

          <div className="kpi-card">
            <div
              className="kpi-icon-box"
              style={{ background: "#dcfce7", color: "#16a34a" }}
            >
              <FaCheckCircle />
            </div>
            <div className="kpi-details">
              <span className="kpi-title">Active Patient Consents</span>
              <div className="kpi-value">
                {privacyMetrics?.activeConsentsCount ?? "0"}
              </div>
              <span className="kpi-subtext">Authorized patient grants</span>
            </div>
          </div>

          <div className="kpi-card">
            <div
              className="kpi-icon-box"
              style={{ background: "#fee2e2", color: "#dc2626" }}
            >
              <FaExclamationTriangle />
            </div>
            <div className="kpi-details">
              <span className="kpi-title">Emergency Break-Glass</span>
              <div className="kpi-value">
                {privacyMetrics?.breakGlassEventsCount ?? "0"}
              </div>
              <span className="kpi-subtext">Critical override events</span>
            </div>
          </div>

          <div className="kpi-card">
            <div
              className="kpi-icon-box"
              style={{ background: "#fef3c7", color: "#d97706" }}
            >
              <FaLock />
            </div>
            <div className="kpi-details">
              <span className="kpi-title">Blocked / Denied Access</span>
              <div className="kpi-value">
                {privacyMetrics?.deniedAccessCount ?? "0"}
              </div>
              <span className="kpi-subtext">Unauthorized attempts</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="premier-kpi-grid">
          <div className="kpi-card">
            <div
              className="kpi-icon-box"
              style={{ background: "#e0f2fe", color: "#0284c7" }}
            >
              <FaShieldAlt />
            </div>
            <div className="kpi-details">
              <span className="kpi-title">Total Operations Logged</span>
              <div className="kpi-value">{metrics.totalEvents ?? "—"}</div>
              <span className="kpi-subtext">
                Immutable chronological entries
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div
              className="kpi-icon-box"
              style={{ background: "#dcfce7", color: "#16a34a" }}
            >
              <FaUserMd />
            </div>
            <div className="kpi-details">
              <span className="kpi-title">Clinical Governance</span>
              <div className="kpi-value">{metrics.clinicalCount ?? "—"}</div>
              <span className="kpi-subtext">Consultations & prescriptions</span>
            </div>
          </div>

          <div className="kpi-card">
            <div
              className="kpi-icon-box"
              style={{ background: "#ede9fe", color: "#7c3aed" }}
            >
              <FaLock />
            </div>
            <div className="kpi-details">
              <span className="kpi-title">Security & Admin</span>
              <div className="kpi-value">
                {metrics.securityAdminCount ?? "—"}
              </div>
              <span className="kpi-subtext">Auth & operational changes</span>
            </div>
          </div>

          <div className="kpi-card">
            <div
              className="kpi-icon-box"
              style={{ background: "#fee2e2", color: "#dc2626" }}
            >
              <FaExclamationTriangle />
            </div>
            <div className="kpi-details">
              <span className="kpi-title">Critical & Warnings</span>
              <div className="kpi-value">
                {metrics.criticalWarningCount ?? "—"}
              </div>
              <span className="kpi-subtext">Security & operational alerts</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="compliance-tab-nav">
        <button
          className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          <FaShieldAlt /> Full Audit Trail
        </button>
        <button
          className={`tab-btn ${activeTab === "clinical" ? "active" : ""}`}
          onClick={() => setActiveTab("clinical")}
        >
          <FaUserMd /> Clinical Governance
        </button>
        <button
          className={`tab-btn ${activeTab === "security" ? "active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <FaLock /> Security & Admin Oversight
        </button>
        <button
          className={`tab-btn ${activeTab === "transitions" ? "active" : ""}`}
          onClick={() => setActiveTab("transitions")}
        >
          <FaArrowRight /> State Transitions
        </button>
        <button
          className={`tab-btn ${activeTab === "privacy" ? "active" : ""}`}
          onClick={() => setActiveTab("privacy")}
        >
          <FaUserShield /> Patient Data Privacy & Consent
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="premier-filter-card">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder={
              activeTab === "privacy"
                ? "Search by patient, doctor, category, purpose, or reason…"
                : "Search by action, actor, doctor, appointment ID or keyword…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-controls-row">
          {activeTab === "privacy" && (
            <div className="filter-item">
              <label>Access Type</label>
              <select
                value={accessTypeFilter}
                onChange={(e) => setAccessTypeFilter(e.target.value)}
              >
                <option value="all">All Access Mechanisms</option>
                <option value="encounter_active">
                  Active Encounter (Appointment)
                </option>
                <option value="explicit_consent">
                  Explicit Patient Consent
                </option>
                <option value="break_glass_emergency">
                  Emergency Break-Glass
                </option>
                <option value="direct_owner">Direct Patient Owner</option>
              </select>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="filter-item">
              <label>Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="appointment">Appointment</option>
                <option value="clinical">Clinical</option>
                <option value="consent">Patient Consent</option>
                <option value="doctor">Doctor</option>
                <option value="hospital">Hospital Facility</option>
                <option value="security">Security</option>
                <option value="administrative">Administrative</option>
                <option value="financial">Financial</option>
              </select>
            </div>
          )}

          {activeTab !== "privacy" && (
            <div className="filter-item">
              <label>Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="all">All Severities</option>
                <option value="info">Info</option>
                <option value="notice">Notice</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          )}

          {(activeTab === "audit" || activeTab === "clinical") && (
            <div className="filter-item">
              <label>Actor Role</label>
              <select
                value={actorRoleFilter}
                onChange={(e) => setActorRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="Hospital Admin">Hospital Admin</option>
                <option value="Doctor">Doctor</option>
                <option value="Patient">Patient</option>
                <option value="Reception">Reception / Staff</option>
                <option value="System">System</option>
              </select>
            </div>
          )}

          <div className="filter-item">
            <label>Time Range</label>
            <select
              value={rangeFilter}
              onChange={(e) => setRangeFilter(e.target.value)}
            >
              <option value="all">All History</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Audit Events Table */}
      <div className="premier-table-card">
        {loading ? (
          <div className="premier-loading-skeleton">
            <div className="skeleton-row header" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : events.length === 0 ? (
          <div className="premier-empty-state">
            <FaShieldAlt className="empty-icon" />
            <h3>No Audit Records Found</h3>
            <p>No compliance events match your current filter selection.</p>
            <button
              className="premier-btn-secondary"
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
                setSeverityFilter("all");
                setActorRoleFilter("all");
                setRangeFilter("all");
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            {activeTab === "privacy" ? (
              <table className="premier-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Patient Subject</th>
                    <th>Doctor / Requester</th>
                    <th>Data Category</th>
                    <th>Access Mechanism</th>
                    <th>Outcome</th>
                    <th>Purpose & Reason</th>
                    <th style={{ textAlign: "right" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((log) => (
                    <tr
                      key={log._id}
                      className="audit-row"
                      onClick={() => setSelectedAccessLog(log)}
                    >
                      <td className="timestamp-cell">
                        <span className="time-text">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </td>

                      <td>
                        <div className="actor-cell">
                          <strong>
                            {log.patient?.name || "Patient Record"}
                          </strong>
                          <span className="role-sub">
                            {log.familyMember?.name
                              ? `Dependent: ${log.familyMember.name} (${log.familyMember.relationship || "Family"})`
                              : log.patient?.phone || "Primary Subject"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="actor-cell">
                          <strong>
                            {log.doctor?.name || "Attending Doctor"}
                          </strong>
                          <span className="role-sub">
                            {log.doctor?.speciality || "Healthcare Provider"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className="category-tag category-clinical"
                          style={{ textTransform: "capitalize" }}
                        >
                          {log.dataCategory?.replace("_", " ") || "All Data"}
                        </span>
                      </td>

                      <td>
                        <span
                          className="resource-chip"
                          style={{
                            background:
                              log.accessType === "break_glass_emergency"
                                ? "#fee2e2"
                                : log.accessType === "explicit_consent"
                                  ? "#e0f2fe"
                                  : "#f0fdf4",
                            color:
                              log.accessType === "break_glass_emergency"
                                ? "#991b1b"
                                : log.accessType === "explicit_consent"
                                  ? "#075985"
                                  : "#166534",
                            borderColor:
                              log.accessType === "break_glass_emergency"
                                ? "#fecaca"
                                : log.accessType === "explicit_consent"
                                  ? "#bae6fd"
                                  : "#bbf7d0",
                          }}
                        >
                          {log.accessType === "break_glass_emergency"
                            ? "Emergency Break-Glass"
                            : log.accessType === "encounter_active"
                              ? "Encounter-Based"
                              : log.accessType === "explicit_consent"
                                ? "Explicit Consent"
                                : "Direct Owner"}
                        </span>
                      </td>

                      <td>
                        {log.accessOutcome === "allowed" ? (
                          <span className="status-badge status-confirmed">
                            <FaCheckCircle /> Allowed
                          </span>
                        ) : log.accessOutcome === "break_glass_override" ? (
                          <span className="status-badge status-warning">
                            <FaExclamationTriangle /> Override
                          </span>
                        ) : (
                          <span className="status-badge status-critical">
                            <FaTimesCircle /> Denied
                          </span>
                        )}
                      </td>

                      <td>
                        <div
                          className="event-desc"
                          style={{ maxWidth: "260px" }}
                        >
                          {log.breakGlassReason ? (
                            <strong style={{ color: "#b45309" }}>
                              Emergency: {log.breakGlassReason}
                            </strong>
                          ) : log.denialReason ? (
                            <span style={{ color: "#dc2626" }}>
                              {log.denialReason}
                            </span>
                          ) : (
                            log.purpose || "Clinical Consultation"
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <button
                          className="inspect-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAccessLog(log);
                          }}
                          title="View complete data access inspection"
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="premier-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action & Title</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Actor</th>
                    <th>Entity / Appointment</th>
                    <th>State Transition</th>
                    <th style={{ textAlign: "right" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const hasStateChange =
                      event.stateTransition &&
                      (event.stateTransition.from || event.stateTransition.to);

                    return (
                      <tr
                        key={event._id}
                        className="audit-row"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <td className="timestamp-cell">
                          <span className="time-text">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </td>

                        <td className="action-cell">
                          <strong className="event-title">{event.title}</strong>
                          <div className="event-desc">
                            {event.description || event.action}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`category-tag category-${event.category}`}
                          >
                            {event.category}
                          </span>
                        </td>

                        <td>{severityBadge(event.severity)}</td>

                        <td>
                          <div className="actor-cell">
                            <strong>{event.actor?.name || "System"}</strong>
                            <span className="role-sub">
                              {event.actor?.role || "Staff"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="resource-cell">
                            {event.appointmentId ? (
                              <span className="appointment-chip">
                                {event.appointmentId}
                              </span>
                            ) : (
                              <span className="resource-chip">
                                {event.resourceType}
                              </span>
                            )}
                            {event.doctor?.name && (
                              <span className="doctor-hint">
                                {event.doctor.name}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          {hasStateChange ? (
                            <div className="transition-preview">
                              <span className="transition-from">
                                {event.stateTransition.from || "None"}
                              </span>
                              <FaArrowRight className="transition-arrow-icon" />
                              <span className="transition-to">
                                {event.stateTransition.to}
                              </span>
                            </div>
                          ) : (
                            <span className="muted-text">—</span>
                          )}
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <button
                            className="inspect-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                            }}
                            title="View complete event details"
                          >
                            <FaEye />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Server Pagination */}
        {!loading && events.length > 0 && (
          <div className="premier-pagination">
            <span className="pagination-info">
              Showing page <strong>{pagination.page}</strong> of{" "}
              <strong>{pagination.totalPages}</strong> ({pagination.total}{" "}
              records total)
            </span>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={pagination.page <= 1}
                onClick={() => loadEvents(pagination.page - 1)}
              >
                <FaChevronLeft /> Previous
              </button>
              <button
                className="pagination-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadEvents(pagination.page + 1)}
              >
                Next <FaChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedEvent && (
        <AuditDetailModal
          auditEvent={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Patient Data Access Log Modal */}
      {selectedAccessLog && (
        <DataAccessLogModal
          logItem={selectedAccessLog}
          onClose={() => setSelectedAccessLog(null)}
        />
      )}
    </div>
  );
}
