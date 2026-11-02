import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaLayerGroup,
  FaBed,
  FaProcedures,
  FaTools,
  FaPlus,
  FaCheckCircle,
  FaExclamationTriangle,
  FaSearch,
  FaSyncAlt,
  FaUserCheck,
  FaCheck,
  FaTimes,
} from "react-icons/fa";

export default function ResourcesCapacity() {
  const [resources, setResources] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    identifier: "",
    category: "equipment",
    department: "General Medicine",
    capacity: 1,
    location: "",
    notes: "",
  });

  const [assignData, setAssignData] = useState({
    assignedName: "",
    notes: "",
  });

  const fetchResources = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (categoryFilter !== "all") q.set("category", categoryFilter);
      if (statusFilter !== "all") q.set("status", statusFilter);
      if (search) q.set("search", search);

      const [resRes, anaRes] = await Promise.all([
        api.get(`/api/v1/resources?${q.toString()}`),
        api.get("/api/v1/resources/analytics"),
      ]);

      if (resRes.data?.success) {
        setResources(resRes.data.resources || []);
      }
      if (anaRes.data?.success) {
        setAnalytics(anaRes.data.summary || null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load hospital resources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [categoryFilter, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchResources();
  };

  const handleCreateResource = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/v1/resources", formData);
      if (res.data?.success) {
        toast.success("Resource registered successfully");
        setShowAddModal(false);
        setFormData({
          name: "",
          identifier: "",
          category: "equipment",
          department: "General Medicine",
          capacity: 1,
          location: "",
          notes: "",
        });
        fetchResources();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create resource");
    }
  };

  const handleAssignResource = async (e) => {
    e.preventDefault();
    if (!selectedResource) return;
    try {
      const res = await api.post(`/api/v1/resources/${selectedResource._id}/assign`, assignData);
      if (res.data?.success) {
        toast.success("Resource assigned successfully");
        setShowAssignModal(false);
        setSelectedResource(null);
        setAssignData({ assignedName: "", notes: "" });
        fetchResources();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign resource");
    }
  };

  const handleReleaseResource = async (resId) => {
    if (!window.confirm("Release this resource and mark as available?")) return;
    try {
      const res = await api.post(`/api/v1/resources/${resId}/release`);
      if (res.data?.success) {
        toast.success("Resource released successfully");
        fetchResources();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to release resource");
    }
  };

  const handleToggleMaintenance = async (resource) => {
    const newStatus = resource.status === "under_maintenance" ? "available" : "under_maintenance";
    try {
      const res = await api.put(`/api/v1/resources/${resource._id}`, { status: newStatus });
      if (res.data?.success) {
        toast.success(`Resource status updated to ${newStatus}`);
        fetchResources();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update maintenance status");
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1E293B", margin: 0 }}>
            Resource & Capacity Management
          </h1>
          <p style={{ color: "#64748B", fontSize: "14px", marginTop: "4px" }}>
            Real-time tracking of hospital rooms, beds, diagnostic equipment, and operational capacity
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#2563EB",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "8px",
            padding: "10px 18px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          <FaPlus /> Add Resource
        </button>
      </div>

      {/* Analytics KPI Cards */}
      {analytics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <span style={{ color: "#64748B", fontSize: "13px", fontWeight: "600" }}>TOTAL RESOURCES</span>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#1E293B", marginTop: "4px" }}>{analytics.totalResources || 0}</div>
            <span style={{ color: "#2563EB", fontSize: "12px" }}>Active inventory</span>
          </div>
          <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <span style={{ color: "#64748B", fontSize: "13px", fontWeight: "600" }}>AVAILABLE</span>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#16A34A", marginTop: "4px" }}>{analytics.available || 0}</div>
            <span style={{ color: "#16A34A", fontSize: "12px" }}>Ready for assignment</span>
          </div>
          <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <span style={{ color: "#64748B", fontSize: "13px", fontWeight: "600" }}>OCCUPIED / IN-USE</span>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#2563EB", marginTop: "4px" }}>{analytics.occupied || 0}</div>
            <span style={{ color: "#2563EB", fontSize: "12px" }}>Currently in service</span>
          </div>
          <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <span style={{ color: "#64748B", fontSize: "13px", fontWeight: "600" }}>MAINTENANCE</span>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#D97706", marginTop: "4px" }}>{analytics.underMaintenance || 0}</div>
            <span style={{ color: "#D97706", fontSize: "12px" }}>Service / Inspection</span>
          </div>
          <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <span style={{ color: "#64748B", fontSize: "13px", fontWeight: "600" }}>UTILIZATION RATE</span>
            <div style={{ fontSize: "28px", fontWeight: "700", color: "#7C3AED", marginTop: "4px" }}>{analytics.utilizationRatePercent || 0}%</div>
            <span style={{ color: "#7C3AED", fontSize: "12px" }}>Overall workload load</span>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0", marginBottom: "20px" }}>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px", alignItems: "center", flex: "1", minWidth: "260px" }}>
          <input
            type="text"
            placeholder="Search resources by name, ID, or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", border: "1px solid #CBD5E1", borderRadius: "8px", fontSize: "14px" }}
          />
          <button type="submit" style={{ background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "8px", padding: "10px 14px", cursor: "pointer" }}>
            <FaSearch />
          </button>
        </form>

        <div style={{ display: "flex", gap: "12px" }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", background: "#FFFFFF" }}
          >
            <option value="all">All Categories</option>
            <option value="equipment">Equipment</option>
            <option value="room">Rooms</option>
            <option value="bed">Beds</option>
            <option value="facility">Facilities</option>
            <option value="vehicle">Vehicles</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", background: "#FFFFFF" }}
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="occupied">Occupied</option>
            <option value="under_maintenance">Under Maintenance</option>
            <option value="reserved">Reserved</option>
          </select>

          <button onClick={fetchResources} style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", color: "#475569" }}>
            <FaSyncAlt />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>Loading hospital resources...</div>
        ) : resources.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>No resources found matching the selected filters.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B" }}>
                <th style={{ padding: "14px 16px" }}>IDENTIFIER</th>
                <th style={{ padding: "14px 16px" }}>RESOURCE NAME</th>
                <th style={{ padding: "14px 16px" }}>CATEGORY</th>
                <th style={{ padding: "14px 16px" }}>DEPARTMENT</th>
                <th style={{ padding: "14px 16px" }}>STATUS</th>
                <th style={{ padding: "14px 16px" }}>ASSIGNMENT / NOTES</th>
                <th style={{ padding: "14px 16px", textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((item) => (
                <tr key={item._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "14px 16px", fontWeight: "700", color: "#1E293B" }}>{item.identifier}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: "600", color: "#1E293B" }}>{item.name}</div>
                    <div style={{ fontSize: "12px", color: "#64748B" }}>{item.location || "Main Hospital Complex"}</div>
                  </td>
                  <td style={{ padding: "14px 16px", textTransform: "capitalize", color: "#475569" }}>{item.category}</td>
                  <td style={{ padding: "14px 16px", color: "#475569" }}>{item.department}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: "600",
                        background:
                          item.status === "available"
                            ? "#DCFCE7"
                            : item.status === "occupied"
                            ? "#DBEAFE"
                            : item.status === "under_maintenance"
                            ? "#FEF3C7"
                            : "#F1F5F9",
                        color:
                          item.status === "available"
                            ? "#15803D"
                            : item.status === "occupied"
                            ? "#1D4ED8"
                            : item.status === "under_maintenance"
                            ? "#B45309"
                            : "#475569",
                        textTransform: "capitalize",
                      }}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", color: "#64748B", fontSize: "13px" }}>
                    {item.assignedName ? (
                      <span style={{ color: "#1E293B", fontWeight: "500" }}>Assigned: {item.assignedName}</span>
                    ) : (
                      item.notes || "—"
                    )}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      {item.status === "available" && (
                        <button
                          onClick={() => {
                            setSelectedResource(item);
                            setShowAssignModal(true);
                          }}
                          style={{
                            background: "#2563EB",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Assign
                        </button>
                      )}
                      {item.status === "occupied" && (
                        <button
                          onClick={() => handleReleaseResource(item._id)}
                          style={{
                            background: "#16A34A",
                            color: "#FFFFFF",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                          }}
                        >
                          Release
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleMaintenance(item)}
                        style={{
                          background: item.status === "under_maintenance" ? "#16A34A" : "#D97706",
                          color: "#FFFFFF",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        {item.status === "under_maintenance" ? "Mark Ready" : "Maintenance"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Resource Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#FFFFFF", borderRadius: "12px", width: "90%", maxWidth: "500px", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: "#1E293B" }}>Register Hospital Resource</h2>
            <form onSubmit={handleCreateResource} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Resource Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECG Machine Model X, ICU Bed 04"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Identifier / Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EQ-ECG-01"
                    value={formData.identifier}
                    onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", background: "#FFFFFF" }}
                  >
                    <option value="equipment">Equipment</option>
                    <option value="room">Room</option>
                    <option value="bed">Bed</option>
                    <option value="facility">Facility</option>
                    <option value="vehicle">Vehicle</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Department</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Block A, Room 201"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "#F1F5F9", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Resource Modal */}
      {showAssignModal && selectedResource && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#FFFFFF", borderRadius: "12px", width: "90%", maxWidth: "450px", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px", color: "#1E293B" }}>
              Assign Resource: {selectedResource.name}
            </h2>
            <p style={{ color: "#64748B", fontSize: "13px", marginBottom: "16px" }}>ID: {selectedResource.identifier}</p>
            <form onSubmit={handleAssignResource} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Assigned To / Patient / Clinical Purpose *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Patient OPD Consultation, Dr. Sharma OT"
                  value={assignData.assignedName}
                  onChange={(e) => setAssignData({ ...assignData, assignedName: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Notes / Instructions</label>
                <textarea
                  placeholder="Clinical purpose, duration, special requirements..."
                  value={assignData.notes}
                  onChange={(e) => setAssignData({ ...assignData, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", minHeight: "70px" }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  style={{ background: "#F1F5F9", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
