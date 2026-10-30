import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout/Layout";
import API from "../Api/API";
import { toast } from "../utils/notify";
import {
  FaHistory,
  FaSyncAlt,
  FaDownload,
  FaSearch,
  FaTimes,
  FaFilter,
  FaEye,
  FaShieldAlt,
  FaUserShield,
  FaCalendarDay,
  FaListAlt,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaDesktop,
  FaMobileAlt,
  FaCopy,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaHospital,
  FaUserMd,
  FaCog,
  FaUser,
} from "react-icons/fa";

const MODULE_OPTIONS = [
  { value: "all", label: "All Modules" },
  { value: "auth", label: "Auth & Security" },
  { value: "doctor", label: "Doctor Management" },
  { value: "hospital", label: "Hospital Management" },
  { value: "admin", label: "Admin Management" },
  { value: "settings", label: "System Settings" },
  { value: "user", label: "Patient / User" },
];

const ROLE_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "Super Admin", label: "Super Admin" },
  { value: "Hospital Admin", label: "Hospital Admin" },
  { value: "Patient", label: "Patient / User" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "warning", label: "Warning" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
];

const formatDateTime = (dateStr) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const getModuleIcon = (module) => {
  switch (String(module || "").toLowerCase()) {
    case "doctor":
      return <FaUserMd />;
    case "hospital":
      return <FaHospital />;
    case "admin":
      return <FaUserShield />;
    case "settings":
      return <FaCog />;
    case "user":
      return <FaUser />;
    default:
      return <FaShieldAlt />;
  }
};

const getStatusBadge = (status) => {
  const norm = String(status || "success").toLowerCase();
  if (norm === "success") {
    return (
      <span className="sa-audit-status success">
        <FaCheckCircle /> Success
      </span>
    );
  }
  if (norm === "failed" || norm === "error") {
    return (
      <span className="sa-audit-status failed">
        <FaTimesCircle /> Failed
      </span>
    );
  }
  return (
    <span className="sa-audit-status warning">
      <FaExclamationTriangle /> Warning
    </span>
  );
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({
    total: 0,
    today: 0,
    adminActions: 0,
    securityEvents: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("all");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  // Details Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch real audit logs from backend
  const fetchLogs = useCallback(
    async (isSilent = false) => {
      if (isSilent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const params = {
          page,
          limit,
          dateRange,
        };
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
        if (role !== "all") params.role = role;
        if (moduleFilter !== "all") params.module = moduleFilter;
        if (statusFilter !== "all") params.status = statusFilter;

        const response = await API.get("/user/admin/audit-logs", { params });

        if (response.data?.success) {
          setLogs(response.data.logs || []);
          setTotalCount(response.data.totalCount || 0);
          setTotalPages(response.data.totalPages || 1);
          if (response.data.summary) {
            setSummary(response.data.summary);
          }
          if (isSilent) {
            toast.success("Audit logs refreshed");
          }
        } else {
          throw new Error(response.data?.message || "Failed to load audit logs");
        }
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Unable to load audit logs from backend.";
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, limit, dateRange, debouncedSearch, role, moduleFilter, statusFilter]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(search.trim()) ||
      role !== "all" ||
      moduleFilter !== "all" ||
      statusFilter !== "all" ||
      dateRange !== "all"
    );
  }, [search, role, moduleFilter, statusFilter, dateRange]);

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setRole("all");
    setModuleFilter("all");
    setStatusFilter("all");
    setDateRange("all");
    setPage(1);
  };

  // Safe CSV export
  const handleExportCsv = () => {
    if (!logs.length) {
      toast.error("No logs available to export");
      return;
    }

    const headers = [
      "Activity ID",
      "Date & Time (IST)",
      "Actor Name",
      "Actor Email",
      "Actor Role",
      "Module",
      "Action",
      "Status",
      "Title",
      "Description",
      "Related Entity",
      "Reference ID",
      "IP Address",
      "Browser",
      "Device",
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = logs.map((log) => [
      escapeCsv(log.activityId || log.id),
      escapeCsv(formatDateTime(log.createdAt)),
      escapeCsv(log.adminName || "System"),
      escapeCsv(log.adminEmail || ""),
      escapeCsv(log.adminRole || "Admin"),
      escapeCsv(log.module || "general"),
      escapeCsv(log.action || log.type || ""),
      escapeCsv(log.status || "success"),
      escapeCsv(log.title || ""),
      escapeCsv(log.message || ""),
      escapeCsv(log.relatedEntity || ""),
      escapeCsv(log.refId || ""),
      escapeCsv(log.ip || ""),
      escapeCsv(log.browser || ""),
      escapeCsv(log.device || ""),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `healpoint_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Audit logs exported to CSV");
  };

  // Copy Reference ID
  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    toast.success("Reference ID copied to clipboard");
  };

  return (
    <Layout>
      <div className="sa-audit-container">
        {/* Header */}
        <header className="sa-heading">
          <div>
            <p className="sa-eyebrow">System / Audit & Activity Logs</p>
            <h2>Audit & Activity Logs</h2>
            <span>
              Real-time security and administrative audit trail across HealPoint operations.
            </span>
          </div>
          <div className="sa-heading-actions">
            <select
              className="sa-range-select"
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by date range"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="sa-btn sa-btn-outline"
              onClick={() => fetchLogs(true)}
              disabled={loading || refreshing}
              title="Refresh audit activity"
            >
              <FaSyncAlt className={refreshing ? "sa-spin" : ""} /> Refresh
            </button>
            <button
              type="button"
              className="sa-btn sa-btn-primary"
              onClick={handleExportCsv}
              disabled={loading || !logs.length}
              title="Export current audit logs to CSV"
            >
              <FaDownload /> Export CSV
            </button>
          </div>
        </header>

        {/* Real KPI Summary Cards */}
        <section className="sa-kpi-grid">
          <article className="sa-kpi sa-kpi-blue">
            <div className="sa-kpi-icon-wrap">
              <FaListAlt />
            </div>
            <div>
              <p>Total Activities</p>
              <strong>{loading ? "…" : Number(summary.total || totalCount).toLocaleString("en-IN")}</strong>
              <small>Recorded across the platform</small>
            </div>
          </article>

          <article className="sa-kpi sa-kpi-teal">
            <div className="sa-kpi-icon-wrap">
              <FaCalendarDay />
            </div>
            <div>
              <p>Today's Activities</p>
              <strong>{loading ? "…" : Number(summary.today || 0).toLocaleString("en-IN")}</strong>
              <small>Events logged today</small>
            </div>
          </article>

          <article className="sa-kpi sa-kpi-amber">
            <div className="sa-kpi-icon-wrap">
              <FaUserShield />
            </div>
            <div>
              <p>Admin Actions</p>
              <strong>{loading ? "…" : Number(summary.adminActions || 0).toLocaleString("en-IN")}</strong>
              <small>Operations performed by admins</small>
            </div>
          </article>

          <article className="sa-kpi sa-kpi-red">
            <div className="sa-kpi-icon-wrap">
              <FaShieldAlt />
            </div>
            <div>
              <p>Security Events</p>
              <strong>{loading ? "…" : Number(summary.securityEvents || 0).toLocaleString("en-IN")}</strong>
              <small>Logins, logouts & credentials</small>
            </div>
          </article>
        </section>

        {/* Filter and Search Bar */}
        <section className="sa-audit-filter-bar">
          <div className="sa-audit-search">
            <FaSearch />
            <input
              type="text"
              placeholder="Search by actor name, email, action, module, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="sa-audit-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search text"
              >
                <FaTimes />
              </button>
            )}
          </div>

          <div className="sa-audit-filters-row">
            <div className="sa-audit-filter-item">
              <label>Role:</label>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value);
                  setPage(1);
                }}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sa-audit-filter-item">
              <label>Module:</label>
              <select
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value);
                  setPage(1);
                }}
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sa-audit-filter-item">
              <label>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="sa-btn sa-btn-outline sa-audit-reset-btn"
                onClick={handleResetFilters}
              >
                <FaTimes /> Reset Filters
              </button>
            )}
          </div>
        </section>

        {/* Error Banner */}
        {error && (
          <div className="sa-audit-error-banner">
            <FaExclamationTriangle />
            <span>{error}</span>
            <button type="button" onClick={() => fetchLogs()}>
              Retry
            </button>
          </div>
        )}

        {/* Main Table Card */}
        <section className="sa-audit-table-card">
          {loading && !refreshing ? (
            <div className="sa-audit-loading">
              <div className="sa-audit-skeleton-row" />
              <div className="sa-audit-skeleton-row" />
              <div className="sa-audit-skeleton-row" />
              <div className="sa-audit-skeleton-row" />
              <div className="sa-audit-skeleton-row" />
            </div>
          ) : !logs.length ? (
            <div className="sa-audit-empty">
              <FaHistory />
              <h3>{hasActiveFilters ? "No activities match your filters" : "No activity recorded yet"}</h3>
              <p>
                {hasActiveFilters
                  ? "Try resetting your search query or adjusting your filters to see more results."
                  : "All system activities, logins, and administrative changes will be safely logged and tracked here."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="sa-btn sa-btn-primary"
                  onClick={handleResetFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="sa-audit-table-wrap">
              <table className="sa-audit-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Actor</th>
                    <th>Module</th>
                    <th>Action / Description</th>
                    <th>Status</th>
                    <th>Client Info</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((item, index) => {
                    const rowKey =
                      item.activityId || `${item.id}-${item.createdAt}-${index}`;
                    return (
                      <tr key={rowKey}>
                        {/* Date & Time */}
                        <td className="sa-audit-td-time">
                          <strong>{formatDateTime(item.createdAt)}</strong>
                        </td>

                        {/* Actor */}
                        <td className="sa-audit-td-actor">
                          <div className="sa-actor-cell">
                            <div className="sa-actor-avatar">
                              {item.adminImage ? (
                                <img src={item.adminImage} alt={item.adminName || "User"} />
                              ) : (
                                <span>{(item.adminName || "A")[0].toUpperCase()}</span>
                              )}
                            </div>
                            <div className="sa-actor-info">
                              <span className="sa-actor-name">{item.adminName || "System Actor"}</span>
                              <span className="sa-actor-email">{item.adminEmail || "Internal"}</span>
                              <span className="sa-actor-badge">{item.adminRole || "Admin"}</span>
                            </div>
                          </div>
                        </td>

                        {/* Module */}
                        <td className="sa-audit-td-module">
                          <span className="sa-module-pill">
                            {getModuleIcon(item.module)}
                            <span>{item.module || "General"}</span>
                          </span>
                        </td>

                        {/* Description */}
                        <td className="sa-audit-td-desc">
                          <div className="sa-desc-cell">
                            <strong>{item.title || item.action || "Activity Event"}</strong>
                            <p>{item.message || "Activity recorded by system."}</p>
                            {item.refId && (
                              <span className="sa-ref-pill">
                                Ref: <code>{item.refId}</code>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="sa-audit-td-status">
                          {getStatusBadge(item.status)}
                        </td>

                        {/* Client Info */}
                        <td className="sa-audit-td-client">
                          <div className="sa-client-cell">
                            <span className="sa-client-device">
                              {/mobile/i.test(item.device || "") ? (
                                <FaMobileAlt />
                              ) : (
                                <FaDesktop />
                              )}
                              <span>{item.device || "Desktop"}</span>
                            </span>
                            <span className="sa-client-browser">{item.browser || "Browser"}</span>
                            <code className="sa-client-ip">{item.ip || "127.0.0.1"}</code>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="sa-audit-td-action">
                          <button
                            type="button"
                            className="sa-btn-icon"
                            onClick={() => setSelectedLog(item)}
                            title="View complete activity details"
                            aria-label="View activity details"
                          >
                            <FaEye />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalCount > 0 && (
            <footer className="sa-audit-pagination">
              <div className="sa-audit-page-info">
                <span>
                  Showing{" "}
                  <strong>
                    {Math.min((page - 1) * limit + 1, totalCount)} –{" "}
                    {Math.min(page * limit, totalCount)}
                  </strong>{" "}
                  of <strong>{totalCount}</strong> activities
                </span>
                <div className="sa-audit-page-limit">
                  <label>Rows per page:</label>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="sa-audit-page-controls">
                <button
                  type="button"
                  className="sa-btn sa-btn-outline sa-page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <FaChevronLeft /> Previous
                </button>
                <span className="sa-page-indicator">
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  type="button"
                  className="sa-btn sa-btn-outline sa-page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next <FaChevronRight />
                </button>
              </div>
            </footer>
          )}
        </section>

        {/* Activity Details Modal */}
        {selectedLog && (
          <div
            className="sa-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="sa-modal-content sa-audit-details-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sa-modal-header">
                <div className="sa-modal-header-title">
                  <span className="sa-modal-icon">
                    <FaHistory />
                  </span>
                  <div>
                    <h3 id="audit-modal-title">Activity Details</h3>
                    <span>Complete audit log record</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="sa-modal-close"
                  onClick={() => setSelectedLog(null)}
                  aria-label="Close details"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="sa-modal-body">
                {/* Event Status Bar */}
                <div className="sa-detail-status-bar">
                  <div>
                    <label>Event Status</label>
                    <div>{getStatusBadge(selectedLog.status)}</div>
                  </div>
                  <div>
                    <label>Timestamp (IST)</label>
                    <strong>{formatDateTime(selectedLog.createdAt)}</strong>
                  </div>
                </div>

                {/* Section 1: Actor Details */}
                <div className="sa-detail-card">
                  <h4>
                    <FaUserShield /> Performed By
                  </h4>
                  <div className="sa-detail-grid">
                    <div>
                      <label>Name</label>
                      <p>{selectedLog.adminName || "System Actor"}</p>
                    </div>
                    <div>
                      <label>Email</label>
                      <p>{selectedLog.adminEmail || "Internal"}</p>
                    </div>
                    <div>
                      <label>Account Role</label>
                      <p>
                        <span className="sa-actor-badge">
                          {selectedLog.adminRole || "Admin"}
                        </span>
                      </p>
                    </div>
                    <div>
                      <label>Actor ID</label>
                      <p>
                        <code>{selectedLog.id || "system"}</code>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2: Action Information */}
                <div className="sa-detail-card">
                  <h4>
                    <FaListAlt /> Action Details
                  </h4>
                  <div className="sa-detail-grid">
                    <div>
                      <label>Module</label>
                      <p>
                        <span className="sa-module-pill">
                          {getModuleIcon(selectedLog.module)}
                          <span>{selectedLog.module || "General"}</span>
                        </span>
                      </p>
                    </div>
                    <div>
                      <label>Action Key</label>
                      <p>
                        <code>{selectedLog.action || selectedLog.type || "action"}</code>
                      </p>
                    </div>
                    <div className="sa-detail-span-2">
                      <label>Title</label>
                      <p className="sa-detail-title">
                        {selectedLog.title || "Activity"}
                      </p>
                    </div>
                    <div className="sa-detail-span-2">
                      <label>Description / Message</label>
                      <div className="sa-detail-message">
                        {selectedLog.message || "No additional message provided."}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Entity Reference */}
                {(selectedLog.relatedEntity || selectedLog.refId) && (
                  <div className="sa-detail-card">
                    <h4>
                      <FaHospital /> Related Entity
                    </h4>
                    <div className="sa-detail-grid">
                      <div>
                        <label>Entity Type</label>
                        <p>{selectedLog.relatedEntity || "Entity"}</p>
                      </div>
                      <div>
                        <label>Reference ID</label>
                        <div className="sa-copy-row">
                          <code>{selectedLog.refId || "—"}</code>
                          {selectedLog.refId && (
                            <button
                              type="button"
                              className="sa-btn-icon-small"
                              onClick={() => handleCopy(selectedLog.refId)}
                              title="Copy Reference ID"
                            >
                              {copiedId ? <FaCheck style={{ color: "#10b981" }} /> : <FaCopy />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 4: Client & Security Environment */}
                <div className="sa-detail-card">
                  <h4>
                    <FaDesktop /> Client & Security Metadata
                  </h4>
                  <div className="sa-detail-grid">
                    <div>
                      <label>IP Address</label>
                      <p>
                        <code>{selectedLog.ip || "127.0.0.1"}</code>
                      </p>
                    </div>
                    <div>
                      <label>Device Type</label>
                      <p>{selectedLog.device || "Unknown device"}</p>
                    </div>
                    <div className="sa-detail-span-2">
                      <label>Browser</label>
                      <p>{selectedLog.browser || "Unknown browser"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sa-modal-footer">
                <button
                  type="button"
                  className="sa-btn sa-btn-primary"
                  onClick={() => setSelectedLog(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
