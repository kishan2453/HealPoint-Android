import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-toastify";
import {
  FaUserClock,
  FaCalendarAlt,
  FaUserPlus,
  FaCheck,
  FaTimes,
  FaCalendarCheck,
  FaExclamationTriangle,
  FaSearch,
  FaSyncAlt,
  FaClock,
} from "react-icons/fa";

export default function StaffRoster() {
  const [activeTab, setActiveTab] = useState("roster"); // roster | staff | shifts | leaves
  const [stats, setStats] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [roster, setRoster] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Forms
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    phone: "",
    employeeId: "",
    role: "nurse",
    department: "General Medicine",
    shiftPreference: "Morning",
  });

  const [shiftForm, setShiftForm] = useState({
    name: "",
    startTime: "08:00 AM",
    endTime: "04:00 PM",
    department: "General Medicine",
    maxStaff: 10,
    colorCode: "#2563EB",
  });

  const [assignForm, setAssignForm] = useState({
    staffId: "",
    shiftId: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, staffRes, shiftsRes, rosterRes, leavesRes] = await Promise.all([
        api.get("/api/v1/roster/dashboard-stats"),
        api.get("/api/v1/roster/staff"),
        api.get("/api/v1/roster/shifts"),
        api.get(`/api/v1/roster/roster?date=${selectedDate}`),
        api.get("/api/v1/roster/leaves"),
      ]);

      if (statsRes.data?.success) setStats(statsRes.data.stats);
      if (staffRes.data?.success) setStaffList(staffRes.data.staff || []);
      if (shiftsRes.data?.success) setShifts(shiftsRes.data.shifts || []);
      if (rosterRes.data?.success) setRoster(rosterRes.data.roster || []);
      if (leavesRes.data?.success) setLeaves(leavesRes.data.leaves || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load staff roster data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/v1/roster/staff", staffForm);
      if (res.data?.success) {
        toast.success("Staff profile added successfully");
        setShowAddStaffModal(false);
        setStaffForm({
          name: "",
          email: "",
          phone: "",
          employeeId: "",
          role: "nurse",
          department: "General Medicine",
          shiftPreference: "Morning",
        });
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add staff member");
    }
  };

  const handleCreateShift = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/v1/roster/shifts", shiftForm);
      if (res.data?.success) {
        toast.success("Shift defined successfully");
        setShowAddShiftModal(false);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create shift");
    }
  };

  const handleAssignShift = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/v1/roster/roster", assignForm);
      if (res.data?.success) {
        toast.success("Shift assigned successfully");
        setShowAssignModal(false);
        fetchData();
      }
    } catch (err) {
      // Highlights shift conflicts or approved leave overlap
      toast.error(err.response?.data?.message || "Failed to assign shift");
    }
  };

  const handleReviewLeave = async (leaveId, status) => {
    try {
      const res = await api.patch(`/api/v1/roster/leaves/${leaveId}/review`, { status });
      if (res.data?.success) {
        toast.success(`Leave request ${status}`);
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to review leave");
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#1E293B", margin: 0 }}>
            Staff & Duty Roster Management
          </h1>
          <p style={{ color: "#64748B", fontSize: "14px", marginTop: "4px" }}>
            Staff directories, shift definitions, conflict-free scheduling and leave approvals
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setShowAssignModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <FaCalendarCheck /> Assign Shift
          </button>
          <button
            onClick={() => setShowAddStaffModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#F1F5F9",
              color: "#1E293B",
              border: "1px solid #CBD5E1",
              borderRadius: "8px",
              padding: "10px 16px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <FaUserPlus /> Add Staff
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>TOTAL STAFF</span>
            <div style={{ fontSize: "26px", fontWeight: "700", color: "#1E293B", marginTop: "4px" }}>{stats.totalStaff || 0}</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>ACTIVE ON DUTY</span>
            <div style={{ fontSize: "26px", fontWeight: "700", color: "#16A34A", marginTop: "4px" }}>{stats.activeStaff || 0}</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>ON LEAVE</span>
            <div style={{ fontSize: "26px", fontWeight: "700", color: "#D97706", marginTop: "4px" }}>{stats.onLeaveStaff || 0}</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>PENDING LEAVES</span>
            <div style={{ fontSize: "26px", fontWeight: "700", color: "#DC2626", marginTop: "4px" }}>{stats.pendingLeaves || 0}</div>
          </div>
          <div style={{ background: "#FFFFFF", padding: "16px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
            <span style={{ color: "#64748B", fontSize: "12px", fontWeight: "600" }}>TODAY'S SHIFTS</span>
            <div style={{ fontSize: "26px", fontWeight: "700", color: "#2563EB", marginTop: "4px" }}>{stats.todayShiftsScheduled || 0}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #E2E8F0", marginBottom: "20px" }}>
        {[
          { id: "roster", label: "Duty Roster Schedule", icon: FaCalendarAlt },
          { id: "staff", label: "Staff Directory", icon: FaUserClock },
          { id: "shifts", label: "Shift Configurations", icon: FaClock },
          { id: "leaves", label: "Leave Requests", icon: FaExclamationTriangle },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 18px",
                border: "none",
                background: "none",
                borderBottom: isActive ? "2px solid #2563EB" : "2px solid transparent",
                color: isActive ? "#2563EB" : "#64748B",
                fontWeight: isActive ? "600" : "500",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              <Icon /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Duty Roster Grid */}
      {activeTab === "roster" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: "600", color: "#475569" }}>Select Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px" }}
              />
            </div>
            <button onClick={fetchData} style={{ background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "8px 12px", cursor: "pointer", color: "#475569" }}>
              <FaSyncAlt /> Refresh
            </button>
          </div>

          <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>Loading duty roster...</div>
            ) : roster.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
                No shifts scheduled for {selectedDate}. Click "Assign Shift" to schedule staff.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B" }}>
                    <th style={{ padding: "14px 16px" }}>STAFF NAME</th>
                    <th style={{ padding: "14px 16px" }}>ROLE</th>
                    <th style={{ padding: "14px 16px" }}>DEPARTMENT</th>
                    <th style={{ padding: "14px 16px" }}>SHIFT</th>
                    <th style={{ padding: "14px 16px" }}>TIMING</th>
                    <th style={{ padding: "14px 16px" }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={r._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "14px 16px", fontWeight: "600", color: "#1E293B" }}>{r.staffName || r.staffId?.name}</td>
                      <td style={{ padding: "14px 16px", textTransform: "capitalize", color: "#475569" }}>{r.staffRole || r.staffId?.role}</td>
                      <td style={{ padding: "14px 16px", color: "#475569" }}>{r.department}</td>
                      <td style={{ padding: "14px 16px", fontWeight: "600", color: "#2563EB" }}>{r.shiftName}</td>
                      <td style={{ padding: "14px 16px", color: "#64748B" }}>{r.startTime} - {r.endTime}</td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", background: "#DCFCE7", color: "#15803D", textTransform: "capitalize" }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Staff Directory */}
      {activeTab === "staff" && (
        <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B" }}>
                <th style={{ padding: "14px 16px" }}>EMP ID</th>
                <th style={{ padding: "14px 16px" }}>NAME</th>
                <th style={{ padding: "14px 16px" }}>ROLE</th>
                <th style={{ padding: "14px 16px" }}>DEPARTMENT</th>
                <th style={{ padding: "14px 16px" }}>PREFERENCE</th>
                <th style={{ padding: "14px 16px" }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "14px 16px", fontWeight: "700", color: "#1E293B" }}>{s.employeeId}</td>
                  <td style={{ padding: "14px 16px", fontWeight: "600", color: "#1E293B" }}>{s.name}</td>
                  <td style={{ padding: "14px 16px", textTransform: "capitalize", color: "#475569" }}>{s.role}</td>
                  <td style={{ padding: "14px 16px", color: "#475569" }}>{s.department}</td>
                  <td style={{ padding: "14px 16px", color: "#64748B" }}>{s.shiftPreference}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "12px", fontWeight: "600", background: s.status === "active" ? "#DCFCE7" : "#FEF3C7", color: s.status === "active" ? "#15803D" : "#B45309", textTransform: "capitalize" }}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Shift Configurations */}
      {activeTab === "shifts" && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <button
              onClick={() => setShowAddShiftModal(true)}
              style={{ background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "8px", padding: "10px 16px", fontWeight: "600", cursor: "pointer" }}
            >
              <FaPlus /> New Shift Template
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {shifts.map((sh) => (
              <div key={sh._id} style={{ background: "#FFFFFF", padding: "20px", borderRadius: "12px", border: "1px solid #E2E8F0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontWeight: "700", fontSize: "16px", color: "#1E293B" }}>{sh.name}</span>
                  <span style={{ width: "12px", height: "12px", borderRadius: "50%", background: sh.colorCode || "#2563EB" }} />
                </div>
                <div style={{ fontSize: "14px", color: "#64748B", marginBottom: "6px" }}>
                  {sh.startTime} - {sh.endTime}
                </div>
                <div style={{ fontSize: "13px", color: "#475569" }}>Department: {sh.department}</div>
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>Max Staff Capacity: {sh.maxStaff}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Leave Requests */}
      {activeTab === "leaves" && (
        <div style={{ background: "#FFFFFF", borderRadius: "12px", border: "1px solid #E2E8F0", overflow: "hidden" }}>
          {leaves.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>No pending or recent leave requests.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B" }}>
                  <th style={{ padding: "14px 16px" }}>STAFF / DOCTOR</th>
                  <th style={{ padding: "14px 16px" }}>TYPE</th>
                  <th style={{ padding: "14px 16px" }}>DURATION</th>
                  <th style={{ padding: "14px 16px" }}>REASON</th>
                  <th style={{ padding: "14px 16px" }}>STATUS</th>
                  <th style={{ padding: "14px 16px", textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "14px 16px", fontWeight: "600", color: "#1E293B" }}>{l.staffName || l.staffId?.name || "Staff Member"}</td>
                    <td style={{ padding: "14px 16px", textTransform: "capitalize", color: "#475569" }}>{l.leaveType}</td>
                    <td style={{ padding: "14px 16px", color: "#64748B" }}>{l.startDate} to {l.endDate}</td>
                    <td style={{ padding: "14px 16px", color: "#475569" }}>{l.reason}</td>
                    <td style={{ padding: "14px 16px" }}>
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: "600",
                          background: l.status === "approved" ? "#DCFCE7" : l.status === "rejected" ? "#FEE2E2" : "#FEF3C7",
                          color: l.status === "approved" ? "#15803D" : l.status === "rejected" ? "#B91C1C" : "#B45309",
                          textTransform: "capitalize",
                        }}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", textAlign: "right" }}>
                      {l.status === "pending" && (
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => handleReviewLeave(l._id, "approved")}
                            style={{ background: "#16A34A", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReviewLeave(l._id, "rejected")}
                            style={{ background: "#DC2626", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "600" }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Assign Shift Modal with Real-Time Conflict Detection */}
      {showAssignModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#FFFFFF", borderRadius: "12px", width: "90%", maxWidth: "500px", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: "#1E293B" }}>Assign Duty Shift</h2>
            <form onSubmit={handleAssignShift} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Select Staff Member *</label>
                <select
                  required
                  value={assignForm.staffId}
                  onChange={(e) => setAssignForm({ ...assignForm, staffId: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", background: "#FFFFFF" }}
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffList.filter(s => s.status === "active").map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.role} - {s.department})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Select Shift Template *</label>
                <select
                  required
                  value={assignForm.shiftId}
                  onChange={(e) => setAssignForm({ ...assignForm, shiftId: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", background: "#FFFFFF" }}
                >
                  <option value="">-- Choose Shift --</option>
                  {shifts.map((sh) => (
                    <option key={sh._id} value={sh._id}>{sh.name} ({sh.startTime} - {sh.endTime})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Duty Date *</label>
                <input
                  type="date"
                  required
                  value={assignForm.date}
                  onChange={(e) => setAssignForm({ ...assignForm, date: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Notes / Instructions</label>
                <input
                  type="text"
                  placeholder="Optional notes or station assignment"
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
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

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#FFFFFF", borderRadius: "12px", width: "90%", maxWidth: "500px", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: "#1E293B" }}>Add Hospital Staff Member</h2>
            <form onSubmit={handleCreateStaff} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Chandra"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Employee ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-1042"
                    value={staffForm.employeeId}
                    onChange={(e) => setStaffForm({ ...staffForm, employeeId: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Role *</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", background: "#FFFFFF" }}
                  >
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="technician">Technician</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="admin_staff">Admin Staff</option>
                    <option value="support">Support</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Department</label>
                  <input
                    type="text"
                    value={staffForm.department}
                    onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Shift Preference</label>
                  <select
                    value={staffForm.shiftPreference}
                    onChange={(e) => setStaffForm({ ...staffForm, shiftPreference: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px", background: "#FFFFFF" }}
                  >
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                    <option value="Rotational">Rotational</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  style={{ background: "#F1F5F9", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Shift Modal */}
      {showAddShiftModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#FFFFFF", borderRadius: "12px", width: "90%", maxWidth: "450px", padding: "24px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: "#1E293B" }}>Create Shift Template</h2>
            <form onSubmit={handleCreateShift} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Shift Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning General, Night Emergency"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Start Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="08:00 AM"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>End Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="04:00 PM"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #CBD5E1", marginTop: "4px" }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowAddShiftModal(false)}
                  style={{ background: "#F1F5F9", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: "#2563EB", color: "#FFFFFF", border: "none", borderRadius: "6px", padding: "8px 16px", cursor: "pointer", fontWeight: "600" }}
                >
                  Create Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
