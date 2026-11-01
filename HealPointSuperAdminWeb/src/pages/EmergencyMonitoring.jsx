import React, { useEffect, useState, useCallback } from "react";
import Layout from "../components/Layout/Layout";
import API from "../Api/API";
import { toast } from "../utils/notify";
import {
  FaAmbulance,
  FaExclamationTriangle,
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSync,
  FaHospital,
  FaUserShield,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaFilter,
} from "react-icons/fa";

export default function EmergencyMonitoring() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({
    stats: {
      total: 0,
      active: 0,
      resolved: 0,
      cancelled: 0,
      byType: [],
      byHospital: [],
    },
    recentEmergencies: [],
  });
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOverview = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await API.get("/emergency/superadmin/overview");
      if (res.data?.success) {
        setData({
          stats: res.data.stats || {
            total: 0,
            active: 0,
            resolved: 0,
            cancelled: 0,
            byType: [],
            byHospital: [],
          },
          recentEmergencies: res.data.recentEmergencies || [],
        });
        if (isManual) toast.success("Emergency platform overview updated");
      }
    } catch (err) {
      console.error("[EmergencyMonitoring] Fetch failed:", err);
      toast.error(err.response?.data?.message || "Failed to load emergency data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(() => {
      fetchOverview();
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const stats = data.stats || {};
  const emergencies = data.recentEmergencies || [];

  const filteredEmergencies = emergencies.filter((item) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") {
      return item.status === "pending" || item.status === "accepted" || item.status === "in_progress";
    }
    return item.status === statusFilter;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span style={{ backgroundColor: "#FEE2E2", color: "#DC2626", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <FaExclamationTriangle /> PENDING
          </span>
        );
      case "accepted":
        return (
          <span style={{ backgroundColor: "#FEF3C7", color: "#D97706", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <FaClock /> ACCEPTED
          </span>
        );
      case "in_progress":
        return (
          <span style={{ backgroundColor: "#DBEAFE", color: "#2563EB", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <FaAmbulance /> IN PROGRESS
          </span>
        );
      case "resolved":
        return (
          <span style={{ backgroundColor: "#D1FAE5", color: "#059669", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <FaCheckCircle /> RESOLVED
          </span>
        );
      case "cancelled":
        return (
          <span style={{ backgroundColor: "#F1F5F9", color: "#64748B", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <FaTimesCircle /> CANCELLED
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <Layout>
      <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ backgroundColor: "#EF4444", color: "#FFFFFF", padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FaUserShield /> PLATFORM RESCUE
              </span>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", margin: 0 }}>
                Emergency SOS Platform Monitoring
              </h1>
            </div>
            <p style={{ margin: "6px 0 0 0", color: "#64748B", fontSize: 14 }}>
              Real-time central emergency telemetry, ambulance dispatch monitoring, and cross-hospital audit records.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 10,
              fontWeight: 600,
              cursor: refreshing ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
            }}
          >
            <FaSync className={refreshing ? "fa-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh Feed"}
          </button>
        </div>

        {/* Executive KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 28 }}>
          <div style={{ backgroundColor: "#FFFFFF", padding: "20px", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ color: "#64748B", fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>Total Platform SOS</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#0F172A", marginTop: 8 }}>{stats.total ?? 0}</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Cumulative nationwide alerts</div>
          </div>

          <div style={{ backgroundColor: "#FEF2F2", padding: "20px", borderRadius: 14, border: "2px solid #FCA5A5", boxShadow: "0 4px 14px rgba(239,68,68,0.12)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#991B1B", fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Active Critical SOS</span>
              <span style={{ backgroundColor: "#EF4444", color: "#FFF", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>LIVE</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#DC2626", marginTop: 8 }}>{stats.active ?? 0}</div>
            <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 4 }}>Pending, accepted, or in route</div>
          </div>

          <div style={{ backgroundColor: "#FFFFFF", padding: "20px", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ color: "#64748B", fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>Resolved Cases</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#059669", marginTop: 8 }}>{stats.resolved ?? 0}</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Successfully admitted / treated</div>
          </div>

          <div style={{ backgroundColor: "#FFFFFF", padding: "20px", borderRadius: 14, border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div style={{ color: "#64748B", fontSize: 13, fontWeight: 600, textTransform: "uppercase" }}>Cancelled / False</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#64748B", marginTop: 8 }}>{stats.cancelled ?? 0}</div>
            <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>Dismissed or false alarms</div>
          </div>
        </div>

        {/* Aggregations: By Type & By Hospital */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20, marginBottom: 28 }}>
          {/* By Emergency Type */}
          <div style={{ backgroundColor: "#FFFFFF", padding: "20px", borderRadius: 14, border: "1px solid #E2E8F0" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <FaExclamationTriangle style={{ color: "#EF4444" }} /> Emergencies by Clinical Category
            </h3>
            {Array.isArray(stats.byType) && stats.byType.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {stats.byType.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#F8FAFC", borderRadius: 8 }}>
                    <span style={{ textTransform: "capitalize", fontWeight: 600, color: "#334155" }}>
                      {item.type || "General Emergency"}
                    </span>
                    <span style={{ backgroundColor: "#2563EB", color: "#FFFFFF", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#94A3B8", fontSize: 13 }}>No emergency categories logged yet.</p>
            )}
          </div>

          {/* By Hospital Network */}
          <div style={{ backgroundColor: "#FFFFFF", padding: "20px", borderRadius: 14, border: "1px solid #E2E8F0" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <FaHospital style={{ color: "#2563EB" }} /> Distribution Across Hospitals
            </h3>
            {Array.isArray(stats.byHospital) && stats.byHospital.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {stats.byHospital.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", backgroundColor: "#F8FAFC", borderRadius: 8 }}>
                    <span style={{ fontWeight: 600, color: "#334155" }}>
                      {item.hospitalName || "Unassigned"}
                    </span>
                    <span style={{ backgroundColor: "#0F172A", color: "#FFFFFF", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#94A3B8", fontSize: 13 }}>No hospital distribution logged yet.</p>
            )}
          </div>
        </div>

        {/* Recent Emergencies Table */}
        <div style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E2E8F0", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0F172A", margin: 0 }}>
              Live Emergency SOS Feed ({filteredEmergencies.length})
            </h3>
            <div style={{ display: "flex", gap: 8 }}>
              {["all", "active", "resolved", "cancelled"].map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    border: statusFilter === filter ? "1px solid #2563EB" : "1px solid #E2E8F0",
                    backgroundColor: statusFilter === filter ? "#EFF6FF" : "#FFFFFF",
                    color: statusFilter === filter ? "#2563EB" : "#64748B",
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p style={{ color: "#64748B", textAlign: "center", padding: "30px 0" }}>Loading emergency overview...</p>
          ) : filteredEmergencies.length === 0 ? (
            <p style={{ color: "#94A3B8", textAlign: "center", padding: "30px 0" }}>No emergencies matching criteria.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: "#F8FAFC", borderBottom: "2px solid #E2E8F0", color: "#475569" }}>
                    <th style={{ padding: "12px 14px", fontWeight: 700 }}>Code</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700 }}>Patient</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700 }}>Category</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700 }}>Hospital</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700 }}>Status</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700 }}>Ambulance</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700 }}>Location</th>
                    <th style={{ padding: "12px 14px", fontWeight: 700 }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmergencies.map((emg) => (
                    <tr key={emg._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#0F172A" }}>
                        {emg.emergencyCode}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, color: "#1E293B" }}>
                          {emg.patientSnapshot?.name || emg.patientId?.name || "Patient"}
                        </div>
                        <div style={{ color: "#64748B", fontSize: 12 }}>
                          {emg.patientSnapshot?.phone || emg.patientId?.phone || "No phone"}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", textTransform: "capitalize", fontWeight: 600 }}>
                        {emg.emergencyType || "General"}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#334155" }}>
                        {emg.hospitalId?.name || "Unassigned"}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {getStatusBadge(emg.status)}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {emg.ambulance?.vehicleNumber ? (
                          <div style={{ fontSize: 12 }}>
                            <strong style={{ color: "#0F172A" }}>{emg.ambulance.vehicleNumber}</strong>
                            <div style={{ color: "#2563EB", textTransform: "capitalize" }}>
                              {emg.ambulance.status || "dispatched"}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: "#94A3B8", fontSize: 12 }}>Not Dispatched</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {emg.location?.latitude && emg.location?.longitude ? (
                          <a
                            href={`https://maps.google.com/?q=${emg.location.latitude},${emg.location.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "#2563EB",
                              fontWeight: 600,
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <FaMapMarkerAlt /> View Map
                          </a>
                        ) : (
                          <span style={{ color: "#94A3B8" }}>No GPS</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#64748B", fontSize: 12 }}>
                        {emg.createdAt ? new Date(emg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }) : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

