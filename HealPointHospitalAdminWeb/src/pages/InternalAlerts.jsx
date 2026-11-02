import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaExclamationTriangle,
  FaCheckDouble,
  FaCheckCircle,
  FaPlus,
  FaFilter,
  FaSyncAlt,
  FaInfoCircle,
} from "react-icons/fa";

export default function InternalAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    message: "",
    severity: "warning",
    category: "operations",
  });

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (severityFilter !== "all") params.set("severity", severityFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("isResolved", statusFilter === "resolved" ? "true" : "false");

      const res = await api.get(`/internal-alerts?${params.toString()}`);
      if (res.data?.success) {
        setAlerts(res.data.alerts || []);
        setUnreadCount(res.data.unreadCount || 0);
        setCriticalCount(res.data.criticalCount || 0);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load internal alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [severityFilter, categoryFilter, statusFilter]);

  const handleMarkRead = async (id) => {
    try {
      const res = await api.patch(`/internal-alerts/${id}/read`);
      if (res.data?.success) {
        fetchAlerts();
      }
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.post(`/internal-alerts/mark-all-read`);
      if (res.data?.success) {
        toast.success("All alerts marked as read");
        fetchAlerts();
      }
    } catch (err) {
      toast.error("Failed to mark all as read");
    }
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolvingAlert) return;
    try {
      const res = await api.patch(`/internal-alerts/${resolvingAlert._id}/resolve`, {
        resolutionNotes,
      });
      if (res.data?.success) {
        toast.success("Alert resolved");
        setResolvingAlert(null);
        setResolutionNotes("");
        fetchAlerts();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to resolve alert");
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/internal-alerts", formData);
      if (res.data?.success) {
        toast.success("Internal alert broadcasted");
        setShowCreateModal(false);
        setFormData({ title: "", message: "", severity: "warning", category: "operations" });
        fetchAlerts();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to broadcast alert");
    }
  };

  const getSeverityBadge = (s) => {
    switch (s) {
      case "critical":
        return "bg-red-100 text-red-700 border-red-200";
      case "high":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-blue-100 text-blue-700 border-blue-200";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FaExclamationTriangle className="text-amber-500" /> Smart Alert & Rule-Based Notification Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time automated alerts for scheduling conflicts, overdue tasks, and resource maintenance thresholds.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="border text-gray-700 hover:bg-gray-50 disabled:opacity-50 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
          >
            <FaCheckDouble /> Mark All Read ({unreadCount})
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow"
          >
            <FaPlus /> Broadcast Alert
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 border rounded-xl shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 text-gray-500 font-semibold">
            <FaFilter /> Filters:
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only ({criticalCount})</option>
            <option value="high">High</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
          >
            <option value="all">All Categories</option>
            <option value="scheduling">Scheduling & Pacing</option>
            <option value="operations">Hospital Operations</option>
            <option value="staff">Staff Roster</option>
            <option value="resource">Equipment & Beds</option>
            <option value="support">Support</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Unresolved</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        <button onClick={fetchAlerts} className="text-gray-500 hover:text-gray-800 p-1">
          <FaSyncAlt />
        </button>
      </div>

      {/* Alerts Stream */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading alerts stream...</div>
        ) : alerts.length === 0 ? (
          <div className="py-12 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <FaCheckCircle className="mx-auto text-3xl text-green-500 mb-2" />
            <p className="text-gray-600 font-medium">All clear! No pending operational alerts.</p>
          </div>
        ) : (
          alerts.map((al) => (
            <div
              key={al._id}
              onClick={() => !al.isRead && handleMarkRead(al._id)}
              className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                !al.isRead ? "border-blue-300 bg-blue-50/20" : "border-gray-200"
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${getSeverityBadge(al.severity)}`}>
                    {al.severity}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {al.category} • {al.source}
                  </span>
                  {!al.isRead && (
                    <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                      NEW
                    </span>
                  )}
                  {al.isResolved && (
                    <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FaCheckCircle className="text-[9px]" /> Resolved
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{al.title}</h3>
                <p className="text-xs text-gray-600">{al.message}</p>
                {al.isResolved && al.resolutionNotes && (
                  <p className="text-[11px] text-green-800 bg-green-50 px-2 py-1 rounded inline-block">
                    Resolution: {al.resolutionNotes} (by {al.resolvedBy})
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs flex-shrink-0">
                <span className="text-gray-400 font-mono text-[11px]">
                  {new Date(al.createdAt).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                {!al.isResolved && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setResolvingAlert(al);
                      setResolutionNotes("");
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                  >
                    <FaCheckCircle /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resolve Modal */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Resolve Operational Alert</h3>
                <p className="text-xs text-gray-500">{resolvingAlert.title}</p>
              </div>
              <button
                onClick={() => setResolvingAlert(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleResolve} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Resolution Summary / Action Taken</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Assigned alternate nurse to cover ICU shift; roster updated."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="w-full border rounded-lg p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setResolvingAlert(null)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
                >
                  Mark Resolved
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Alert Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Broadcast Internal Notice</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Alert Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oxygen Manifold Pressure Fluctuation"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Alert Message</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Details of the operational notice..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full border rounded-lg p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Severity</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-white"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border rounded-lg p-2 bg-white"
                  >
                    <option value="operations">Operations</option>
                    <option value="scheduling">Scheduling</option>
                    <option value="staff">Staff Roster</option>
                    <option value="resource">Resource & Equipment</option>
                    <option value="billing">Billing & Desk</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
                >
                  Broadcast Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
