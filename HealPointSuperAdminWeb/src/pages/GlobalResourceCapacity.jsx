import React, { useState, useEffect } from "react";
import Layout from "../components/Layout/Layout";
import API from "../Api/API";
import { toast } from "react-hot-toast";
import {
  FaLayerGroup,
  FaHospital,
  FaBed,
  FaTools,
  FaSearch,
  FaSyncAlt,
} from "react-icons/fa";

export default function GlobalResourceCapacity() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await API.get("/resources/global-overview");
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load global resource data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1E293B", margin: 0 }}>
              Global Hospital Resource & Capacity Analytics
            </h1>
            <p style={{ color: "#64748B", fontSize: "14px", marginTop: "4px" }}>
              Multi-hospital bed capacity, diagnostic machinery inventory, and facility utilization rates
            </p>
          </div>
          <button
            onClick={fetchData}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#F1F5F9",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: "600",
              color: "#475569",
            }}
          >
            <FaSyncAlt /> Refresh Data
          </button>
        </div>

        {/* Global KPIs */}
        {data?.summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>PLATFORM TOTAL RESOURCES</span>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#1E293B", marginTop: "4px" }}>{data.summary.totalResources || 0}</div>
              <span style={{ color: "#2563EB", fontSize: "12px" }}>Across all partner facilities</span>
            </div>
            <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>CURRENTLY OCCUPIED</span>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#2563EB", marginTop: "4px" }}>{data.summary.occupiedResources || 0}</div>
              <span style={{ color: "#2563EB", fontSize: "12px" }}>In active clinical use</span>
            </div>
            <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>UNDER MAINTENANCE</span>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#D97706", marginTop: "4px" }}>{data.summary.maintenanceResources || 0}</div>
              <span style={{ color: "#D97706", fontSize: "12px" }}>Routine or critical servicing</span>
            </div>
            <div style={{ background: "#FFFFFF", padding: "18px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>OVERALL UTILIZATION</span>
              <div style={{ fontSize: "28px", fontWeight: "700", color: "#7C3AED", marginTop: "4px" }}>{data.summary.overallUtilizationPercent || 0}%</div>
              <span style={{ color: "#7C3AED", fontSize: "12px" }}>Multi-hospital load</span>
            </div>
          </div>
        )}

        {/* Hospital-wise Table */}
        <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #E2E8F0" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#1E293B" }}>Facility-Wise Capacity & Equipment Distribution</h3>
          </div>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>Loading global hospital capacity data...</div>
          ) : !data?.hospitalStats || data.hospitalStats.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>No hospital resource statistics found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B" }}>
                  <th style={{ padding: "14px 16px" }}>HOSPITAL FACILITY</th>
                  <th style={{ padding: "14px 16px" }}>TOTAL RESOURCES</th>
                  <th style={{ padding: "14px 16px" }}>IN USE / OCCUPIED</th>
                  <th style={{ padding: "14px 16px" }}>UNDER MAINTENANCE</th>
                  <th style={{ padding: "14px 16px" }}>ESTIMATED UTILIZATION</th>
                </tr>
              </thead>
              <tbody>
                {data.hospitalStats.map((h) => {
                  const util = h.total > 0 ? Math.round((h.occupied / h.total) * 100) : 0;
                  return (
                    <tr key={h._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: "600", color: "#1E293B" }}>
                        {h.hospitalName || "Partner Hospital"}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#1E293B", fontWeight: "600" }}>{h.total}</td>
                      <td style={{ padding: "14px 16px", color: "#2563EB" }}>{h.occupied}</td>
                      <td style={{ padding: "14px 16px", color: "#D97706" }}>{h.maintenance}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ flex: 1, background: "#E2E8F0", borderRadius: "999px", height: "8px", overflow: "hidden", maxWidth: "120px" }}>
                            <div style={{ background: "#2563EB", width: `${util}%`, height: "100%" }} />
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>{util}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
