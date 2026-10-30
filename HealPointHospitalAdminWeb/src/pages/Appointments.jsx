import React, { useState, useEffect, useTransition } from "react";
import {
  FaCalendarAlt,
  FaSearch,
  FaFilter,
  FaUndo,
  FaUserMd,
  FaUserInjured,
  FaCheck,
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaPrint,
  FaFilePdf,
  FaClock,
  FaRupeeSign,
  FaSyncAlt,
  FaClinicMedical,
  FaVideo,
  FaCreditCard,
  FaMoneyBillWave,
  FaClipboardList,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaDownload,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { jsPDF } from "jspdf";
import AppointmentDetailsModal from "../components/AppointmentDetailsModal";
import RescheduleAppointmentModal from "../components/RescheduleAppointmentModal";
import CancelAppointmentModal from "../components/CancelAppointmentModal";
import { formatDoctorName } from "../services/doctorFormat";

export default function Appointments({ hospital }) {
  const [activeTab, setActiveTab] = useState("appointments"); // "appointments" | "reports"

  // Data & State
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    upcoming: 0,
    completed: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    paid: 0,
    unpaid: 0,
    totalRevenue: 0,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState("");

  // Filter criteria
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Filter options loaded from hospital
  const [doctorsList, setDoctorsList] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);

  // Modals state
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState(null);
  const [cancelAppointment, setCancelAppointment] = useState(null);

  const [, startTransition] = useTransition();

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage);
      params.set("limit", "10");
      if (search.trim()) params.set("search", search.trim());
      if (dateFilter !== "all") params.set("dateFilter", dateFilter);
      if (dateFilter === "custom") {
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
      }
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      if (doctorFilter !== "all") params.set("doctorId", doctorFilter);
      if (departmentFilter !== "all")
        params.set("department", departmentFilter);
      if (sortBy) params.set("sortBy", sortBy);

      const res = await api.get(
        `/api/v1/hospital-admin/appointments?${params.toString()}`,
      );
      setAppointments(res.data?.appointments || []);
      setTotalRecords(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);
      if (res.data?.stats) {
        setStats(res.data.stats);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to load appointments:", err);
      setError(err.response?.data?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [docsRes, deptsRes] = await Promise.all([
        api.get("/api/v1/hospital-admin/doctors"),
        api.get("/api/v1/hospital-admin/departments"),
      ]);
      setDoctorsList(docsRes.data?.doctors || []);
      setDepartmentsList(deptsRes.data?.departments || []);
    } catch (err) {
      console.error("Failed to load doctor/department filter choices:", err);
    }
  };

  useEffect(() => {
    fetchDropdownData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        fetchAppointments();
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [
    currentPage,
    search,
    dateFilter,
    startDate,
    endDate,
    statusFilter,
    paymentFilter,
    doctorFilter,
    departmentFilter,
    sortBy,
  ]);

  const handleStatusChange = async (appointment, newStatus) => {
    try {
      setBusyId(appointment._id);
      const res = await api.patch(
        `/api/v1/hospital-admin/appointments/${appointment._id}/status`,
        { status: newStatus },
      );
      toast.success(res.data?.message || `Appointment marked as ${newStatus}`);
      fetchAppointments();
      if (selectedAppointment?._id === appointment._id) {
        setSelectedAppointment(res.data?.appointment || null);
      }
    } catch (err) {
      console.error("Status change error:", err);
      toast.error(
        err.response?.data?.message || "Failed to update appointment status",
      );
    } finally {
      setBusyId("");
    }
  };

  const handleQuickCheckIn = async (appointment) => {
    try {
      setBusyId(appointment._id);
      const res = await api.post("/api/v1/checkin/scan", {
        manualReference:
          appointment.appointmentId ||
          appointment.displayAppointmentId ||
          appointment._id,
      });
      if (res.data?.success) {
        toast.success(
          `✓ Patient Checked In! Assigned Token: ${res.data.assignedToken || res.data.queueToken || "A-001"}`,
        );
        fetchAppointments();
      } else {
        toast.warn(res.data?.message || "Check-in could not be completed");
      }
    } catch (err) {
      console.error("Quick check-in error:", err);
      toast.error(err.response?.data?.message || "Failed to check in patient");
    } finally {
      setBusyId("");
    }
  };

  const resetFilters = () => {
    setSearch("");
    setDateFilter("all");
    setStartDate("");
    setEndDate("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setDoctorFilter("all");
    setDepartmentFilter("all");
    setSortBy("newest");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    dateFilter !== "all" ||
    statusFilter !== "all" ||
    paymentFilter !== "all" ||
    doctorFilter !== "all" ||
    departmentFilter !== "all" ||
    sortBy !== "newest";

  const formatMoney = (val) => `₹${Number(val || 0).toLocaleString("en-IN")}`;

  const statusPillClass = (st) => {
    switch (st) {
      case "confirmed":
        return "status-pill status-blue";
      case "completed":
        return "status-pill status-green";
      case "cancel":
        return "status-pill status-danger";
      case "rescheduled":
        return "status-pill status-purple";
      case "missed":
        return "status-pill status-gray";
      case "pending":
      default:
        return "status-pill status-amber";
    }
  };

  const statusLabelText = (st) => {
    switch (st) {
      case "confirmed":
        return "Confirmed";
      case "completed":
        return "Completed";
      case "cancel":
        return "Cancelled";
      case "rescheduled":
        return "Rescheduled";
      case "missed":
        return "Missed";
      case "pending":
      default:
        return "Pending";
    }
  };

  // Export PDF functionality
  const handleExportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("HealPoint Healthcare - Hospital Appointments Report", 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 25);
    doc.text(
      `Total Records: ${totalRecords} | Revenue: ${formatMoney(stats.totalRevenue)}`,
      14,
      32,
    );

    let y = 42;
    appointments.forEach((item, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      const pName = item.userId?.name || "Patient";
      const dName = item.doctorId?.name || "Doctor";
      const line = `${idx + 1}. [${item.appointmentId || item._id.slice(-6)}] ${item.slotDate} ${item.slotTime} - ${pName} with ${formatDoctorName(dName, "Doctor")} | Status: ${item.status.toUpperCase()} | Fee: ${formatMoney(item.amount)}`;
      doc.text(line, 14, y);
      y += 8;
    });

    doc.save(`appointments-report-${Date.now()}.pdf`);
    toast.success("Appointments PDF downloaded successfully");
  };

  // Extract all medical reports across current appointments
  const allReports = appointments.flatMap((item) =>
    (item.medicalReports || []).map((report) => ({
      ...report,
      appointmentId: item.appointmentId || item._id,
      patientName: item.userId?.name || "Patient",
      doctorName: item.doctorId?.name || "Doctor",
      slotDate: item.slotDate,
    })),
  );

  return (
    <div className="premier-page-container appointment-management-page">
      {/* 1. Header Section */}
      <div className="premier-page-header">
        <div className="header-text-group">
          <div className="header-badge-row">
            <span className="badge-pill">Operational Center</span>
            <span className="badge-live-pulse">
              <span className="pulse-dot"></span> Live Isolation Scoped
            </span>
          </div>
          <h1>Appointments</h1>
          <p className="header-subtext">
            {hospital?.name || "Hospital"} · Live patient visits, clinical
            consultations & booking schedules.
          </p>
        </div>

        <div className="header-actions-group">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportPdf}
            disabled={loading || appointments.length === 0}
            title="Download PDF report of appointments"
          >
            <FaDownload /> Export
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.print()}
            title="Print appointments view"
          >
            <FaPrint /> Print
          </button>
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => {
              fetchAppointments();
              fetchDropdownData();
            }}
            disabled={loading}
            title="Refresh appointments data"
          >
            <FaSyncAlt className={loading ? "spin-icon" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="hp-sub-tabs-bar" style={{ margin: "0 0 4px 0" }}>
        <button
          type="button"
          className={activeTab === "appointments" ? "selected" : ""}
          onClick={() => setActiveTab("appointments")}
        >
          <FaClipboardList /> Appointments Roster ({totalRecords})
        </button>
        <button
          type="button"
          className={activeTab === "reports" ? "selected" : ""}
          onClick={() => setActiveTab("reports")}
        >
          <FaFilePdf /> Medical Reports ({allReports.length})
        </button>
      </div>

      {/* 2. Real KPI Stat Cards */}
      <div
        className="premier-stats-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        <div className="stat-card">
          <div className="stat-icon-box blue">
            <FaCalendarAlt />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Bookings</span>
            <h3 className="stat-number">{stats.total}</h3>
            <span className="stat-hint">All-time hospital records</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box green">
            <FaClock />
          </div>
          <div className="stat-content">
            <span className="stat-label">Today's Visits</span>
            <h3 className="stat-number">{stats.today}</h3>
            <span className="stat-hint text-success">Scheduled for today</span>
          </div>
        </div>

        <div
          className={`stat-card ${dateFilter === "arrivals" ? "selected" : ""}`}
          onClick={() => {
            setDateFilter("arrivals");
            setCurrentPage(1);
          }}
          style={{
            cursor: "pointer",
            border: dateFilter === "arrivals" ? "2px solid #0E9F8E" : undefined,
          }}
          title="Click to view today's checked-in patients"
        >
          <div className="stat-icon-box green">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <span className="stat-label">Today's Arrivals</span>
            <h3 className="stat-number">{stats.arrivalsToday || 0}</h3>
            <span className="stat-hint text-success">
              Checked in at hospital
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box purple">
            <FaCalendarAlt />
          </div>
          <div className="stat-content">
            <span className="stat-label">Upcoming</span>
            <h3 className="stat-number">{stats.upcoming}</h3>
            <span className="stat-hint text-primary">Future consultations</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box indigo">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <span className="stat-label">Completed</span>
            <h3 className="stat-number">{stats.completed}</h3>
            <span className="stat-hint text-success">Fulfilled visits</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box amber">
            <FaClock />
          </div>
          <div className="stat-content">
            <span className="stat-label">Pending Approval</span>
            <h3 className="stat-number">{stats.pending}</h3>
            <span className="stat-hint text-amber">Awaiting confirmation</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box danger">
            <FaTimesCircle />
          </div>
          <div className="stat-content">
            <span className="stat-label">Cancelled</span>
            <h3 className="stat-number">{stats.cancelled}</h3>
            <span className="stat-hint text-danger">Revoked appointments</span>
          </div>
        </div>
      </div>

      {/* Revenue & Collections Strip */}
      <div className="financial-summary-strip">
        <div className="strip-item">
          <FaRupeeSign className="strip-ico green" />
          <span>Realized Collections:</span>
          <strong>{formatMoney(stats.totalRevenue)}</strong>
        </div>
        <div className="strip-item">
          <FaCreditCard className="strip-ico blue" />
          <span>Paid Transactions:</span>
          <strong>{stats.paid} appointments</strong>
        </div>
        <div className="strip-item">
          <FaMoneyBillWave className="strip-ico amber" />
          <span>Pending Collections:</span>
          <strong>{stats.unpaid} appointments</strong>
        </div>
      </div>

      {activeTab === "appointments" ? (
        <>
          {/* 3. Search & Comprehensive Filter Controls */}
          <div className="premier-filter-card">
            {/* Quick Date Range Tabs */}
            <div className="range-tabs-row">
              <span className="filter-group-title">Date Period:</span>
              <div className="range-chips">
                {[
                  ["all", "All Dates"],
                  ["today", "Today"],
                  ["arrivals", "Today's Arrivals"],
                  ["tomorrow", "Tomorrow"],
                  ["upcoming", "Upcoming"],
                  ["past", "Past"],
                  ["custom", "Custom Range"],
                ].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`range-chip-btn ${dateFilter === val ? "selected" : ""}`}
                    onClick={() => {
                      setDateFilter(val);
                      setCurrentPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {dateFilter === "custom" && (
                <div className="custom-range-inputs">
                  <input
                    type="date"
                    className="premier-input-sm"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Start date"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    className="premier-input-sm"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="End date"
                  />
                </div>
              )}
            </div>

            {/* Search + Multi-Criteria Dropdowns */}
            <div className="filter-row" style={{ marginTop: "14px" }}>
              <div className="search-field-wrapper">
                <FaSearch className="search-ico" />
                <input
                  type="text"
                  placeholder="Search patient, phone, doctor, or appointment ID…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="premier-input-search"
                />
                {search && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setSearch("")}
                  >
                    <FaTimes />
                  </button>
                )}
              </div>

              <div className="filter-dropdowns-group">
                {/* Status Filter */}
                <div className="select-pill-wrapper">
                  <FaFilter className="filter-ico" />
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="premier-select"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Confirmation</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="rescheduled">Rescheduled</option>
                    <option value="cancel">Cancelled</option>
                  </select>
                </div>

                {/* Payment Status Filter */}
                <div className="select-pill-wrapper">
                  <FaRupeeSign className="filter-ico" />
                  <select
                    value={paymentFilter}
                    onChange={(e) => {
                      setPaymentFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="premier-select"
                  >
                    <option value="all">All Payments</option>
                    <option value="paid">Paid & Settled</option>
                    <option value="cash_pending">Cash Pending</option>
                    <option value="online_pending">Online Pending</option>
                    <option value="failed">Payment Failed</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>

                {/* Doctor Filter */}
                <div className="select-pill-wrapper">
                  <FaUserMd className="filter-ico" />
                  <select
                    value={doctorFilter}
                    onChange={(e) => {
                      setDoctorFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="premier-select"
                  >
                    <option value="all">All Doctors</option>
                    {doctorsList.map((doc) => (
                      <option key={doc._id} value={doc._id}>
                        {formatDoctorName(doc.name)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department Filter */}
                <div className="select-pill-wrapper">
                  <FaClinicMedical className="filter-ico" />
                  <select
                    value={departmentFilter}
                    onChange={(e) => {
                      setDepartmentFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="premier-select"
                  >
                    <option value="all">All Departments</option>
                    {departmentsList.map((dept) => (
                      <option key={dept._id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Order */}
                <div className="select-pill-wrapper">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="premier-select"
                  >
                    <option value="newest">Newest Bookings</option>
                    <option value="oldest">Oldest Bookings</option>
                    <option value="date_asc">Slot Date (Upcoming First)</option>
                    <option value="date_desc">Slot Date (Latest First)</option>
                    <option value="amount_desc">Highest Fee</option>
                  </select>
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn-reset-filters"
                    onClick={resetFilters}
                    title="Reset all filters"
                  >
                    <FaUndo /> Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 4. Appointments Roster Table */}
          {loading ? (
            <div className="premier-loading-container">
              <div className="loading-spinner-large"></div>
              <p>Loading hospital appointments…</p>
            </div>
          ) : error ? (
            <div className="premier-error-card">
              <FaTimesCircle className="error-ico" />
              <h3>Error loading appointments</h3>
              <p>{error}</p>
              <button
                type="button"
                className="btn-primary-action"
                onClick={fetchAppointments}
              >
                Retry
              </button>
            </div>
          ) : appointments.length === 0 ? (
            <div className="premier-empty-card">
              <div className="empty-icon-bubble">
                <FaCalendarAlt />
              </div>
              <h3>No appointments found</h3>
              <p>
                {hasActiveFilters
                  ? "No appointments match your search and filter criteria."
                  : "No appointments have been booked for this hospital yet."}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={resetFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="premier-table-wrapper">
              <table className="premier-table">
                <thead>
                  <tr>
                    <th>Appointment ID</th>
                    <th>Patient</th>
                    <th>Doctor & Specialty</th>
                    <th>Department</th>
                    <th>Date & Time</th>
                    <th>Consultation Mode</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((item) => {
                    const isPaid =
                      item.paymentStatus === "paid" || item.payment === true;
                    const deptName =
                      item.department ||
                      item.doctorId?.department ||
                      item.doctorId?.speciality ||
                      "General";
                    return (
                      <tr key={item._id}>
                        <td>
                          <span
                            className="table-id-link"
                            onClick={() => setSelectedAppointment(item)}
                            title="Click to view full appointment details"
                          >
                            {item.appointmentId || item._id.slice(-6)}
                          </span>
                        </td>
                        <td>
                          <div className="table-user-cell">
                            <div className="table-user-avatar">
                              {item.userId?.image ? (
                                <img
                                  src={item.userId.image}
                                  alt={item.userId.name}
                                />
                              ) : (
                                <FaUserInjured />
                              )}
                            </div>
                            <div>
                              <strong>{item.userId?.name || "Patient"}</strong>
                              <small>
                                {item.patientPhone ||
                                  item.userId?.phone ||
                                  item.userId?.email ||
                                  "—"}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="table-doctor-cell">
                            <strong>
                              {formatDoctorName(item.doctorId?.name, "Doctor")}
                            </strong>
                            <small>
                              {item.doctorId?.speciality || "Specialist"}
                            </small>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color: "#334155",
                              fontSize: "0.84rem",
                            }}
                          >
                            {deptName}
                          </span>
                        </td>
                        <td>
                          <div className="table-date-cell">
                            <strong>{item.slotDate}</strong>
                            <small>{item.slotTime}</small>
                          </div>
                        </td>
                        <td>
                          {item.consultationType === "video" ? (
                            <span
                              className="mode-pill video"
                              title="Video Consultation"
                            >
                              <FaVideo /> Video
                            </span>
                          ) : (
                            <span
                              className="mode-pill opd"
                              title="In-Hospital Visit"
                            >
                              <FaClinicMedical /> In-Person
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="table-payment-cell">
                            <strong>{formatMoney(item.amount)}</strong>
                            <small
                              className={isPaid ? "text-success" : "text-amber"}
                            >
                              {item.paymentMethod === "online"
                                ? "Online"
                                : "Cash"}{" "}
                              · {isPaid ? "Paid" : "Pending"}
                            </small>
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                            }}
                          >
                            <span className={statusPillClass(item.status)}>
                              <span className="status-dot"></span>
                              {statusLabelText(item.status)}
                            </span>
                            {item.checkedIn ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: "0.74rem",
                                  fontWeight: 700,
                                  color: "#059669",
                                  backgroundColor: "#ecfdf5",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #a7f3d0",
                                }}
                                title={`Checked in at ${item.checkInAt ? new Date(item.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today"}`}
                              >
                                ✓ Arrived ({item.queueToken || "Token"})
                              </span>
                            ) : item.status === "confirmed" &&
                              item.consultationType !== "video" ? (
                              <button
                                type="button"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 4,
                                  fontSize: "0.72rem",
                                  fontWeight: 700,
                                  color: "#0E9F8E",
                                  backgroundColor: "rgba(14, 159, 142, 0.08)",
                                  padding: "3px 8px",
                                  borderRadius: "4px",
                                  border: "1px solid rgba(14, 159, 142, 0.3)",
                                  cursor: "pointer",
                                }}
                                disabled={busyId === item._id}
                                onClick={() => handleQuickCheckIn(item)}
                                title="1-click patient arrival check-in"
                              >
                                {busyId === item._id
                                  ? "Checking in..."
                                  : "+ Check In"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <div className="table-row-actions">
                            <button
                              type="button"
                              className="btn-table-action view"
                              onClick={() => setSelectedAppointment(item)}
                              title="View full appointment details"
                            >
                              <FaEye />
                            </button>

                            {["pending", "rescheduled"].includes(
                              item.status,
                            ) && (
                              <button
                                type="button"
                                className="btn-table-action confirm"
                                disabled={busyId === item._id}
                                onClick={() =>
                                  handleStatusChange(item, "confirmed")
                                }
                                title="Confirm appointment"
                              >
                                <FaCheck />
                              </button>
                            )}

                            {item.status === "confirmed" && (
                              <button
                                type="button"
                                className="btn-table-action complete"
                                disabled={busyId === item._id}
                                onClick={() =>
                                  handleStatusChange(item, "completed")
                                }
                                title="Mark as Completed"
                              >
                                <FaCheckCircle />
                              </button>
                            )}

                            {!["completed", "cancel", "missed"].includes(
                              item.status,
                            ) && (
                              <button
                                type="button"
                                className="btn-table-action reschedule"
                                disabled={busyId === item._id}
                                onClick={() => setRescheduleAppointment(item)}
                                title="Reschedule appointment slot"
                              >
                                <FaCalendarAlt />
                              </button>
                            )}

                            {!["completed", "cancel", "missed"].includes(
                              item.status,
                            ) && (
                              <button
                                type="button"
                                className="btn-table-action cancel"
                                disabled={busyId === item._id}
                                onClick={() => setCancelAppointment(item)}
                                title="Cancel appointment"
                              >
                                <FaTimes />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 5. Pagination Bar */}
          {totalPages > 1 && (
            <div className="premier-pagination-bar">
              <span className="pagination-info">
                Showing {Math.min((currentPage - 1) * 10 + 1, totalRecords)} to{" "}
                {Math.min(currentPage * 10, totalRecords)} of {totalRecords}{" "}
                appointments
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn-pagination-nav"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <FaChevronLeft /> Prev
                </button>
                <div className="pagination-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(
                      Math.max(0, currentPage - 3),
                      Math.min(totalPages, currentPage + 2),
                    )
                    .map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`page-num-btn ${currentPage === num ? "active" : ""}`}
                        onClick={() => setCurrentPage(num)}
                      >
                        {num}
                      </button>
                    ))}
                </div>
                <button
                  type="button"
                  className="btn-pagination-nav"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next <FaChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Medical Reports Tab */
        <div className="premier-section-card">
          <div className="section-card-header">
            <div className="section-title-wrap">
              <span className="section-badge-ico blue">
                <FaFilePdf />
              </span>
              <div>
                <h3>Medical Reports & Diagnostic Attachments</h3>
                <p className="section-subtitle">
                  Patient clinical documents, lab reports, and imaging records
                  attached to hospital consultations.
                </p>
              </div>
            </div>
            <span className="record-count">{allReports.length} Reports</span>
          </div>

          {allReports.length === 0 ? (
            <div className="premier-empty-card" style={{ padding: "40px" }}>
              <FaFilePdf
                style={{
                  fontSize: "2.5rem",
                  color: "#94a3b8",
                  marginBottom: "12px",
                }}
              />
              <h4>No medical reports attached</h4>
              <p>
                No reports have been shared with this hospital's appointments
                yet.
              </p>
            </div>
          ) : (
            <div
              className="premier-table-wrapper"
              style={{ marginTop: "16px" }}
            >
              <table className="premier-table">
                <thead>
                  <tr>
                    <th>Appointment</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Document Name</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allReports.map((report, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong>{report.appointmentId}</strong>
                        <small>{report.slotDate}</small>
                      </td>
                      <td>{report.patientName}</td>
                      <td>{formatDoctorName(report.doctorName)}</td>
                      <td>
                        <FaFilePdf
                          style={{ color: "#ef4444", marginRight: "6px" }}
                        />
                        {report.name || `Medical Report ${idx + 1}`}
                      </td>
                      <td>
                        <a
                          href={report.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-download-report"
                        >
                          <FaDownload /> View Document
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onRescheduleClick={(appt) => {
            setSelectedAppointment(null);
            setRescheduleAppointment(appt);
          }}
          onCancelClick={(appt) => {
            setSelectedAppointment(null);
            setCancelAppointment(appt);
          }}
          busyId={busyId}
        />
      )}

      {rescheduleAppointment && (
        <RescheduleAppointmentModal
          appointment={rescheduleAppointment}
          onClose={() => setRescheduleAppointment(null)}
          onRescheduled={() => {
            fetchAppointments();
          }}
        />
      )}

      {cancelAppointment && (
        <CancelAppointmentModal
          appointment={cancelAppointment}
          onClose={() => setCancelAppointment(null)}
          onCancelled={() => {
            fetchAppointments();
          }}
        />
      )}
    </div>
  );
}
