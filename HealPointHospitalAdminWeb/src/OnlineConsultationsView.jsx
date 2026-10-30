import React, { useEffect, useState } from "react";
import { FaVideo } from "react-icons/fa";
import api from "./services/api";

/**
 * HealPoint — Hospital Admin Online Consultations (aggregate, own hospital).
 *
 * Shows the hospital's real online-consultation activity: active online
 * doctors, upcoming / completed / cancelled counts and consultation revenue.
 * Meeting URLs are intentionally NOT exposed here (private consultation data).
 */

const meetingLabel = (status) =>
  ({
    not_created: "Not created",
    ready: "Ready",
    started: "Started",
    completed: "Completed",
  })[status] || "Not created";

export default function OnlineConsultationsView() {
  const [stats, setStats] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/v1/consultation/hospital/stats");
      setStats(res.data.stats || {});
      setDoctors(res.data.doctors || []);
      setRecent(res.data.recent || []);
    } catch (err) {
      console.error("OnlineConsultationsView error:", err);
      setError(
        err.response?.data?.message || "Failed to load online consultation data"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  if (loading) {
    return (
      <div className="portal-loading">
        <span /> Loading online consultation data…
      </div>
    );
  }

  if (error) {
    return (
      <section className="panel">
        <div style={{ padding: "40px", textAlign: "center" }}>
          <FaVideo style={{ fontSize: "2.5rem", color: "#ef4444", marginBottom: "12px" }} />
          <h3 style={{ color: "#ef4444", marginBottom: "8px" }}>Unable to load online consultations</h3>
          <p style={{ color: "#64748b", marginBottom: "16px" }}>{error}</p>
          <button type="button" className="action-btn primary" onClick={load} style={{ margin: "0 auto", display: "inline-block" }}>
            Retry Loading
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Online Consultations</h2>
        <span className="record-count">{doctors.length} online doctors</span>
      </div>

      <div className="online-stat-grid">
        <div className="online-stat-card">
          <h3>{stats?.total || 0}</h3>
          <span>Total online consultations</span>
        </div>
        <div className="online-stat-card">
          <h3>{stats?.upcoming || 0}</h3>
          <span>Upcoming</span>
        </div>
        <div className="online-stat-card">
          <h3>{stats?.completed || 0}</h3>
          <span>Completed</span>
        </div>
        <div className="online-stat-card">
          <h3>{stats?.activeOnlineDoctors || 0}</h3>
          <span>Active online doctors</span>
        </div>
        <div className="online-stat-card">
          <h3>₹{(stats?.revenue || 0).toLocaleString("en-IN")}</h3>
          <span>Consultation revenue</span>
        </div>
      </div>

      <h3 style={{ marginTop: 16 }}>Doctors offering online consultations</h3>
      <table className="data-table">
        <tbody>
          <tr>
            <th>Doctor</th>
            <th>Speciality</th>
            <th>Online status</th>
          </tr>
          {doctors.length ? (
            doctors.map((doc) => (
              <tr key={doc._id}>
                <td>
                  <strong>{doc.name}</strong>
                </td>
                <td>{doc.speciality || doc.department || "—"}</td>
                <td>
                  <span className={`status-badge ${doc.onlineConsultationEnabled ? "available" : "unavailable"}`}>
                    {doc.onlineConsultationEnabled ? "Online" : "Offline"}
                  </span>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="3">No doctors offer online consultations yet.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h3 style={{ marginTop: 16 }}>Recent activity</h3>
      {recent.length ? (
        <table className="data-table">
          <tbody>
            <tr>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Date</th>
              <th>Meeting</th>
            </tr>
            {recent.map((item) => (
              <tr key={item._id}>
                <td>{item.userId?.name || item.patientPhone || "—"}</td>
                <td>{item.doctorId?.name || "—"}</td>
                <td>{item.slotDate} at {item.slotTime}</td>
                <td>{meetingLabel(item.meetingStatus)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="dp-empty">
          <FaVideo />
          <strong>No recent consultation activity</strong>
        </div>
      )}
    </section>
  );
}