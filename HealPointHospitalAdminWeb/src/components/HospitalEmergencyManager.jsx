/**
 * HealPoint Hospital Admin — Emergency SOS Management Dashboard (Task 5).
 * Real-time monitoring, ambulance dispatch, and emergency resolution.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  FaAmbulance,
  FaCheckCircle,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaTimesCircle,
  FaUserInjured,
  FaClock,
  FaSync,
} from "react-icons/fa";
import api from "../services/api";

export function HospitalEmergencyManager({ hospital }) {
  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [ambulanceModalOpen, setAmbulanceModalOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);

  // Ambulance form state
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [etaMinutes, setEtaMinutes] = useState("15");
  const [submitting, setSubmitting] = useState(false);

  // Resolve form state
  const [outcome, setOutcome] = useState("Patient treated and stabilized");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const loadEmergencies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/emergency/hospital?status=${filter}`);
      if (res.data?.success) {
        setEmergencies(res.data.emergencies || []);
      }
    } catch (err) {
      console.error("[HospitalEmergencyManager] Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadEmergencies();
    const interval = setInterval(loadEmergencies, 15000);
    return () => clearInterval(interval);
  }, [loadEmergencies]);

  const handleAccept = async (emergencyId) => {
    try {
      await api.patch(`/api/v1/emergency/${emergencyId}/status`, {
        status: "accepted",
        note: `Accepted by hospital emergency desk: ${hospital?.name || "Hospital Admin"}`,
      });
      loadEmergencies();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to accept emergency");
    }
  };

  const openAmbulanceModal = (emg) => {
    setSelectedEmergency(emg);
    setVehicleNumber(emg.ambulance?.vehicleNumber || "GJ-01-AMB-");
    setDriverName(emg.ambulance?.driverName || "");
    setDriverPhone(emg.ambulance?.driverPhone || "");
    setEtaMinutes(String(emg.ambulance?.etaMinutes || "15"));
    setAmbulanceModalOpen(true);
  };

  const handleDispatchAmbulance = async (e) => {
    e.preventDefault();
    if (!vehicleNumber.trim() || !driverName.trim() || !driverPhone.trim()) {
      alert("Please fill in vehicle number, driver name, and driver phone");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/v1/emergency/${selectedEmergency._id}/ambulance`, {
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        driverName: driverName.trim(),
        driverPhone: driverPhone.trim(),
        etaMinutes: Number(etaMinutes) || 15,
      });
      setAmbulanceModalOpen(false);
      setSelectedEmergency(null);
      loadEmergencies();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to dispatch ambulance");
    } finally {
      setSubmitting(false);
    }
  };

  const openResolveModal = (emg) => {
    setSelectedEmergency(emg);
    setOutcome("Patient treated and stabilized");
    setClinicalNotes("");
    setResolveModalOpen(true);
  };

  const handleResolve = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/api/v1/emergency/${selectedEmergency._id}/status`, {
        status: "resolved",
        outcome,
        clinicalNotes,
      });
      setResolveModalOpen(false);
      setSelectedEmergency(null);
      loadEmergencies();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to resolve emergency");
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = emergencies.filter(
    (e) => e.status === "pending" || e.status === "accepted" || e.status === "in_progress"
  ).length;

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto" }}>
      {/* Top Banner Alert */}
      <div
        style={{
          background: activeCount > 0 ? "linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)" : "#eff6ff",
          border: `2px solid ${activeCount > 0 ? "#ef4444" : "#3b82f6"}`,
          borderRadius: "16px",
          padding: "20px 24px",
          marginBottom: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: activeCount > 0 ? "#dc2626" : "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "24px",
            }}
          >
            <FaAmbulance />
          </div>
          <div>
            <h2
              style={{
                fontSize: "1.4rem",
                fontWeight: "800",
                color: activeCount > 0 ? "#991b1b" : "#1e40af",
                margin: "0 0 4px 0",
              }}
            >
              Emergency SOS Response Center
            </h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
              {activeCount > 0
                ? `🚨 ${activeCount} active emergency SOS request(s) requiring response!`
                : "All emergency queues clear. Live monitoring active 24/7."}
            </p>
          </div>
        </div>
        <button
          onClick={loadEmergencies}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#fff",
            border: "1px solid #cbd5e1",
            padding: "10px 16px",
            borderRadius: "8px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          <FaSync className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {[
          { key: "active", label: `Active (${activeCount})` },
          { key: "pending", label: "Pending Acceptance" },
          { key: "in_progress", label: "Ambulance En Route" },
          { key: "resolved", label: "Resolved Cases" },
          { key: "all", label: "All Cases" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: "8px 18px",
              borderRadius: "20px",
              border: filter === tab.key ? "none" : "1px solid #cbd5e1",
              background: filter === tab.key ? "#2563eb" : "#fff",
              color: filter === tab.key ? "#fff" : "#475569",
              fontWeight: "700",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Emergencies List */}
      {loading && emergencies.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#64748b" }}>
          Loading emergency queue...
        </div>
      ) : emergencies.length === 0 ? (
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            padding: "48px",
            textAlign: "center",
            border: "1px solid #e2e8f0",
          }}
        >
          <FaCheckCircle size={40} color="#10b981" style={{ marginBottom: "12px" }} />
          <h3 style={{ margin: "0 0 8px 0", color: "#0f172a" }}>No Emergency Requests Found</h3>
          <p style={{ margin: 0, color: "#64748b" }}>
            There are currently no emergency cases under this status filter.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {emergencies.map((emg) => {
            const isPending = emg.status === "pending";
            const isAccepted = emg.status === "accepted";
            const isInProgress = emg.status === "in_progress";
            const isResolved = emg.status === "resolved";

            return (
              <div
                key={emg._id}
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: isPending ? "2px solid #ef4444" : "1px solid #e2e8f0",
                  padding: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    borderBottom: "1px solid #f1f5f9",
                    paddingBottom: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span
                      style={{
                        background: "#fee2e2",
                        color: "#dc2626",
                        fontWeight: "800",
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {emg.emergencyCode}
                    </span>
                    <span
                      style={{
                        background:
                          isResolved
                            ? "#ecfdf5"
                            : isPending
                            ? "#fee2e2"
                            : "#eff6ff",
                        color:
                          isResolved
                            ? "#059669"
                            : isPending
                            ? "#dc2626"
                            : "#2563eb",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {emg.status.toUpperCase().replace("_", " ")}
                    </span>
                    <span
                      style={{
                        background: "#f1f5f9",
                        color: "#334155",
                        fontWeight: "700",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                      }}
                    >
                      NATURE: {emg.emergencyType.toUpperCase().replace("_", " ")}
                    </span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                    <FaClock style={{ marginRight: "4px" }} />
                    {new Date(emg.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* Patient & Vitals Information */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "16px",
                  }}
                >
                  {/* Column 1: Patient Identity */}
                  <div>
                    <h4
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "0.95rem",
                        color: "#0f172a",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <FaUserInjured color="#2563eb" /> Patient Details
                    </h4>
                    <p style={{ margin: "0 0 4px 0", fontWeight: "700", color: "#1e293b" }}>
                      {emg.patientSnapshot?.name || "Patient"}
                    </p>
                    <p style={{ margin: "0 0 4px 0", color: "#64748b", fontSize: "0.9rem" }}>
                      Phone: <a href={`tel:${emg.patientSnapshot?.phone}`}>{emg.patientSnapshot?.phone || "N/A"}</a>
                    </p>
                    {emg.patientSnapshot?.gender && (
                      <p style={{ margin: "0", color: "#64748b", fontSize: "0.85rem" }}>
                        Gender: {emg.patientSnapshot.gender}
                        {emg.patientSnapshot.age ? ` (${emg.patientSnapshot.age} yrs)` : ""}
                      </p>
                    )}
                  </div>

                  {/* Column 2: Clinical Vitals */}
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#0f172a" }}>
                      Medical Tags
                    </h4>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                      {emg.patientSnapshot?.bloodGroup && (
                        <span
                          style={{
                            background: "#fee2e2",
                            color: "#dc2626",
                            fontWeight: "800",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                          }}
                        >
                          BLOOD: {emg.patientSnapshot.bloodGroup.toUpperCase()}
                        </span>
                      )}
                      {(emg.patientSnapshot?.allergies || []).map((a) => (
                        <span
                          key={a}
                          style={{
                            background: "#fef3c7",
                            color: "#b45309",
                            fontWeight: "600",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                          }}
                        >
                          Allergy: {a}
                        </span>
                      ))}
                      {(emg.patientSnapshot?.chronicConditions || []).map((c) => (
                        <span
                          key={c}
                          style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontWeight: "600",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                          }}
                        >
                          Condition: {c}
                        </span>
                      ))}
                    </div>
                    {emg.notes && (
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569", fontStyle: "italic" }}>
                        Note: "{emg.notes}"
                      </p>
                    )}
                  </div>

                  {/* Column 3: GPS & Emergency Contacts */}
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "#0f172a" }}>
                      Location & Contacts
                    </h4>
                    {emg.location?.address && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "6px" }}>
                        <FaMapMarkerAlt color="#ef4444" style={{ marginTop: "3px", flexShrink: 0 }} />
                        <span style={{ fontSize: "0.85rem", color: "#334155" }}>
                          {emg.location.address}
                          {emg.location.latitude && emg.location.longitude && (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${emg.location.latitude},${emg.location.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ marginLeft: "6px", color: "#2563eb", fontWeight: "700" }}
                            >
                              [Open Maps]
                            </a>
                          )}
                        </span>
                      </div>
                    )}
                    {(emg.emergencyContacts || []).map((c) => (
                      <div key={c.phone} style={{ fontSize: "0.85rem", color: "#475569" }}>
                        Contact: {c.name} ({c.relation}) — <a href={`tel:${c.phone}`}>{c.phone}</a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ambulance Status Bar if Dispatched */}
                {emg.ambulance?.isDispatched && (
                  <div
                    style={{
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <FaAmbulance color="#2563eb" size={20} />
                      <div>
                        <strong style={{ color: "#1e40af" }}>
                          Ambulance: {emg.ambulance.vehicleNumber}
                        </strong>
                        <span style={{ marginLeft: "12px", color: "#475569", fontSize: "0.9rem" }}>
                          Driver: {emg.ambulance.driverName} (<a href={`tel:${emg.ambulance.driverPhone}`}>{emg.ambulance.driverPhone}</a>)
                        </span>
                      </div>
                    </div>
                    {emg.ambulance.etaMinutes && (
                      <span
                        style={{
                          background: "#dbeafe",
                          color: "#1e40af",
                          fontWeight: "800",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "0.85rem",
                        }}
                      >
                        ETA: ~{emg.ambulance.etaMinutes} MINS
                      </span>
                    )}
                  </div>
                )}

                {/* Resolution Outcome if Resolved */}
                {isResolved && emg.resolutionDetails?.outcome && (
                  <div
                    style={{
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      fontSize: "0.9rem",
                      color: "#065f46",
                    }}
                  >
                    <strong>Resolution Outcome:</strong> {emg.resolutionDetails.outcome}
                  </div>
                )}

                {/* Action Buttons */}
                {!isResolved && emg.status !== "cancelled" && (
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    {isPending && (
                      <button
                        onClick={() => handleAccept(emg._id)}
                        style={{
                          background: "#2563eb",
                          color: "#fff",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: "8px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        Acknowledge & Accept SOS
                      </button>
                    )}

                    <button
                      onClick={() => openAmbulanceModal(emg)}
                      style={{
                        background: "#0284c7",
                        color: "#fff",
                        border: "none",
                        padding: "8px 18px",
                        borderRadius: "8px",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <FaAmbulance />
                      {emg.ambulance?.isDispatched ? "Update Ambulance" : "Dispatch Ambulance"}
                    </button>

                    <button
                      onClick={() => openResolveModal(emg)}
                      style={{
                        background: "#059669",
                        color: "#fff",
                        border: "none",
                        padding: "8px 18px",
                        borderRadius: "8px",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                      }}
                    >
                      <FaCheckCircle /> Mark Case Resolved
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ambulance Dispatch Modal */}
      {ambulanceModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <FaAmbulance color="#2563eb" /> Dispatch Ambulance
            </h3>
            <form onSubmit={handleDispatchAmbulance}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", marginBottom: "4px" }}>
                  Vehicle Plate / Reg Number *
                </label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g. GJ-01-AMB-4521"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", marginBottom: "4px" }}>
                  Driver Name *
                </label>
                <input
                  type="text"
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Ramesh Bhai"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", marginBottom: "4px" }}>
                  Driver Phone (10 Digits) *
                </label>
                <input
                  type="tel"
                  required
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", marginBottom: "4px" }}>
                  Estimated Arrival Time (Minutes) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="120"
                  value={etaMinutes}
                  onChange={(e) => setEtaMinutes(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setAmbulanceModalOpen(false)}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    padding: "8px 20px",
                    borderRadius: "6px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "Dispatching..." : "Confirm Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve Case Modal */}
      {resolveModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <FaCheckCircle color="#059669" /> Mark Emergency Case Resolved
            </h3>
            <form onSubmit={handleResolve}>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", marginBottom: "4px" }}>
                  Clinical Outcome *
                </label>
                <input
                  type="text"
                  required
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="e.g. Patient stabilized and admitted to ICU"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "700", marginBottom: "4px" }}>
                  Clinical Notes / Attending Summary
                </label>
                <textarea
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Attending doctor notes, emergency procedures completed..."
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    background: "#059669",
                    color: "#fff",
                    border: "none",
                    padding: "8px 20px",
                    borderRadius: "6px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  {submitting ? "Resolving..." : "Mark Resolved"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

