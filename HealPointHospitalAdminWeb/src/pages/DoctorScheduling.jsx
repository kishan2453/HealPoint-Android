import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FaCalendarAlt,
  FaUserMd,
  FaClock,
  FaCalendarCheck,
  FaCalendarTimes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSearch,
  FaFilter,
  FaSync,
  FaBuilding,
  FaShieldAlt,
  FaClinicMedical,
  FaCalendarDay,
  FaRegCalendarAlt,
  FaArrowRight,
  FaBed,
  FaRegClock,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import DoctorScheduleModal from "../components/DoctorScheduleModal";
import DoctorCalendarModal from "../components/DoctorCalendarModal";
import { formatDoctorName } from "../services/doctorFormat";

export default function DoctorScheduling() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({
    totalDoctors: 0,
    activeSchedules: 0,
    noScheduleDoctors: 0,
    availableToday: 0,
    doctorsOnLeave: 0,
    todayAvailableSlots: 0,
    todayBookedSlots: 0,
  });
  const [hospitalName, setHospitalName] = useState("");
  const [todayStr, setTodayStr] = useState("");
  const [todayDayName, setTodayDayName] = useState("");

  // Filters state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [scheduleStatus, setScheduleStatus] = useState("all");
  const [quickFilter, setQuickFilter] = useState("all"); // all, availableToday, onLeave, noSchedule

  // Modals state
  const [scheduleModalDoctor, setScheduleModalDoctor] = useState(null);
  const [calendarModalDoctor, setCalendarModalDoctor] = useState(null);
  const [togglingDoctorId, setTogglingDoctorId] = useState("");

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch scheduling data from backend
  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (department !== "all") params.department = department;
      if (scheduleStatus !== "all") params.scheduleStatus = scheduleStatus;
      if (quickFilter === "availableToday") params.availableToday = "true";
      if (quickFilter === "onLeave") params.onLeave = "true";
      if (quickFilter === "noSchedule")
        params.scheduleStatus = "not_configured";

      const res = await api.get("/api/v1/hospital-admin/scheduling/overview", {
        params,
      });
      if (res.data.success) {
        setDoctors(res.data.doctors || []);
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.hospitalName) setHospitalName(res.data.hospitalName);
        if (res.data.todayStr) setTodayStr(res.data.todayStr);
        if (res.data.todayDayName) setTodayDayName(res.data.todayDayName);
      }
    } catch (err) {
      console.error("fetchOverview error:", err);
      setError(
        err.response?.data?.message || "Failed to load doctor scheduling data",
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, department, scheduleStatus, quickFilter]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Extract unique departments for filter dropdown
  const departmentsList = useMemo(() => {
    const set = new Set();
    doctors.forEach((doc) => {
      if (doc.department) set.add(doc.department);
      if (doc.speciality) set.add(doc.speciality);
    });
    return Array.from(set).filter(Boolean);
  }, [doctors]);

  // Quick toggle availability (duty on/off)
  const handleToggleAvailability = async (doctor, e) => {
    e?.stopPropagation();
    try {
      setTogglingDoctorId(doctor._id);
      const newStatus = !doctor.available;
      const res = await api.put(
        `/api/v1/hospital-admin/doctors/${doctor._id}/availability`,
        {
          available: newStatus,
          weeklySchedule: doctor.weeklySchedule,
          availabilitySchedule: doctor.availabilitySchedule,
        },
      );
      if (res.data.success) {
        toast.success(
          `${formatDoctorName(doctor.name)} marked ${newStatus ? "available on duty" : "off duty / paused"}`,
        );
        fetchOverview();
      }
    } catch (err) {
      console.error("handleToggleAvailability error:", err);
      toast.error(
        err.response?.data?.message || "Failed to toggle doctor availability",
      );
    } finally {
      setTogglingDoctorId("");
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setDepartment("all");
    setScheduleStatus("all");
    setQuickFilter("all");
  };

  const DAYS_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="doctor-scheduling-workspace">
      {/* 1. Page Header & Security Scope */}
      <div className="sched-page-header">
        <div className="sched-header-left">
          <div className="sched-scope-badge">
            <span className="sched-scope-pulse" />
            <FaShieldAlt />
            <span>
              Hospital Isolation Active · {hospitalName || "Hospital Facility"}
            </span>
          </div>
          <h1>Doctor Scheduling</h1>
          <p className="sched-subtitle">
            Manage doctor availability, schedules and appointment slots.
          </p>
        </div>

        <div className="sched-header-actions">
          <button
            type="button"
            className="btn-calendar-planner-header"
            onClick={() => {
              if (doctors.length > 0) {
                setCalendarModalDoctor(doctors[0]);
              } else {
                toast.info("No doctors available to open calendar");
              }
            }}
            title="Open Interactive Calendar & Schedule Planner"
          >
            <FaCalendarAlt />
            <span>Calendar Planner</span>
          </button>
          <div className="sched-today-indicator">
            <FaCalendarDay />
            <span>
              Today:{" "}
              <strong>
                {todayDayName || "Today"}, {todayStr || "Live"}
              </strong>
            </span>
          </div>
          <button
            type="button"
            className="btn-refresh"
            onClick={fetchOverview}
            disabled={loading}
            title="Refresh scheduling data"
          >
            <FaSync className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. 7 Real KPI Cards */}
      <div className="sched-kpi-grid">
        {/* Card 1: Total Doctors */}
        <div className="sched-kpi-card">
          <div className="kpi-icon-wrap primary">
            <FaUserMd />
          </div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.totalDoctors}</span>
            <span className="kpi-label">Total Doctors</span>
            <small className="kpi-hint">Registered in facility</small>
          </div>
        </div>

        {/* Card 2: Active Schedules */}
        <div className="sched-kpi-card success">
          <div className="kpi-icon-wrap success">
            <FaCalendarCheck />
          </div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.activeSchedules}</span>
            <span className="kpi-label">Active Schedules</span>
            <small className="kpi-hint">Configured & available</small>
          </div>
        </div>

        {/* Card 3: Doctors Without Schedule */}
        <div
          className={`sched-kpi-card ${stats.noScheduleDoctors > 0 ? "warning" : ""}`}
        >
          <div className="kpi-icon-wrap warning">
            <FaExclamationTriangle />
          </div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.noScheduleDoctors}</span>
            <span className="kpi-label">Without Schedule</span>
            <small className="kpi-hint">Require OPD setup</small>
          </div>
        </div>

        {/* Card 4: Available Today */}
        <div className="sched-kpi-card teal">
          <div className="kpi-icon-wrap teal">
            <FaCalendarDay />
          </div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.availableToday}</span>
            <span className="kpi-label">Available Today</span>
            <small className="kpi-hint">On duty for OPD today</small>
          </div>
        </div>

        {/* Card 5: Doctors On Leave */}
        <div className="sched-kpi-card purple">
          <div className="kpi-icon-wrap purple">
            <FaBed />
          </div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.doctorsOnLeave}</span>
            <span className="kpi-label">Doctors On Leave</span>
            <small className="kpi-hint">Approved leave today</small>
          </div>
        </div>

        {/* Card 6: Today's Available Slots */}
        <div className="sched-kpi-card cyan">
          <div className="kpi-icon-wrap cyan">
            <FaRegClock />
          </div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.todayAvailableSlots}</span>
            <span className="kpi-label">Today's Open Slots</span>
            <small className="kpi-hint">Ready for patient booking</small>
          </div>
        </div>

        {/* Card 7: Today's Booked Slots */}
        <div className="sched-kpi-card amber">
          <div className="kpi-icon-wrap amber">
            <FaClinicMedical />
          </div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.todayBookedSlots}</span>
            <span className="kpi-label">Booked Slots Today</span>
            <small className="kpi-hint">Active consultations</small>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="sched-filter-toolbar">
        {/* Search */}
        <div className="sched-search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search doctors by name or specialization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}
        </div>

        {/* Department Filter */}
        <div className="sched-select-filter">
          <FaBuilding className="filter-select-icon" />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Filter by department"
          >
            <option value="all">All Departments</option>
            {departmentsList.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Schedule Status Filter */}
        <div className="sched-select-filter">
          <FaFilter className="filter-select-icon" />
          <select
            value={scheduleStatus}
            onChange={(e) => setScheduleStatus(e.target.value)}
            aria-label="Filter by schedule status"
          >
            <option value="all">All Statuses</option>
            <option value="active">✓ Schedule Active</option>
            <option value="not_configured">⚠ Not Configured</option>
            <option value="on_leave">🏖 Doctor On Leave</option>
            <option value="conflict">⚠ Conflict Detected</option>
            <option value="paused">⏸ Schedule Paused</option>
          </select>
        </div>

        {/* Quick Filter Tabs */}
        <div className="sched-quick-tabs">
          <button
            type="button"
            className={`quick-tab ${quickFilter === "all" ? "active" : ""}`}
            onClick={() => setQuickFilter("all")}
          >
            All Doctors
          </button>
          <button
            type="button"
            className={`quick-tab ${quickFilter === "availableToday" ? "active" : ""}`}
            onClick={() => setQuickFilter("availableToday")}
          >
            Available Today
          </button>
          <button
            type="button"
            className={`quick-tab ${quickFilter === "onLeave" ? "active" : ""}`}
            onClick={() => setQuickFilter("onLeave")}
          >
            On Leave
          </button>
          <button
            type="button"
            className={`quick-tab ${quickFilter === "noSchedule" ? "active" : ""}`}
            onClick={() => setQuickFilter("noSchedule")}
          >
            Needs Setup
          </button>
        </div>

        {(search ||
          department !== "all" ||
          scheduleStatus !== "all" ||
          quickFilter !== "all") && (
          <button
            type="button"
            className="btn-reset-filters"
            onClick={handleResetFilters}
          >
            Reset
          </button>
        )}
      </div>

      {/* 4. Doctors Schedule Roster Content */}
      <div className="sched-content-area">
        {loading ? (
          /* Skeleton Loading Cards */
          <div className="sched-cards-grid">
            {[1, 2, 3, 4, 5, 6].map((k) => (
              <div key={k} className="sched-doctor-card skeleton">
                <div className="card-top-shimmer">
                  <div className="avatar-shimmer" />
                  <div className="lines-shimmer">
                    <div className="line-sm" />
                    <div className="line-md" />
                  </div>
                </div>
                <div className="body-shimmer" />
                <div className="footer-shimmer" />
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="sched-error-card">
            <FaExclamationTriangle />
            <h3>Unable to load scheduling information</h3>
            <p>{error}</p>
            <button
              type="button"
              className="btn-primary"
              onClick={fetchOverview}
            >
              <FaSync /> Retry Loading
            </button>
          </div>
        ) : doctors.length === 0 ? (
          /* Empty State */
          <div className="sched-empty-card">
            <FaRegCalendarAlt />
            <h3>No doctors found matching filters</h3>
            <p>
              Adjust your search keywords or reset filter criteria to see
              doctors.
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleResetFilters}
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          /* Real Doctors Schedule Cards */
          <div className="sched-cards-grid">
            {doctors.map((doctor) => {
              const schedStatus = doctor.scheduleStatus || "active";
              const isAvailableToday =
                doctor.todayAvailability?.isAvailableToday;
              const isOnLeave = doctor.todayAvailability?.isOnLeave;

              return (
                <div
                  className={`sched-doctor-card status-${schedStatus}`}
                  key={doctor._id}
                >
                  {/* Card Header: Profile, Department, Status */}
                  <div className="sched-card-head">
                    <div className="sched-doc-profile">
                      {doctor.image ? (
                        <img
                          src={doctor.image}
                          alt={doctor.name}
                          className="sched-doc-avatar"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="sched-doc-avatar-fallback">
                          <FaUserMd />
                        </span>
                      )}

                      <div className="sched-doc-info">
                        <div className="sched-name-line">
                          <h4>{formatDoctorName(doctor.name)}</h4>
                          <span className="sched-degree">
                            {doctor.degree || "MBBS"}
                          </span>
                        </div>
                        <span className="sched-speciality">
                          {doctor.specialization || doctor.speciality}
                        </span>
                        <small className="sched-department">
                          <FaBuilding />{" "}
                          {doctor.department || "General Medicine"}
                        </small>
                      </div>
                    </div>

                    {/* Schedule Status Badge */}
                    <div className="sched-status-badge-container">
                      {schedStatus === "active" ? (
                        <span
                          className="sched-badge active"
                          title="Doctor is configured and active for consultations"
                        >
                          <FaCheckCircle /> Schedule Active
                        </span>
                      ) : schedStatus === "on_leave" ? (
                        <span
                          className="sched-badge on-leave"
                          title="Doctor is marked on leave today"
                        >
                          <FaBed /> Doctor On Leave
                        </span>
                      ) : schedStatus === "not_configured" ? (
                        <span
                          className="sched-badge not-configured"
                          title="Weekly OPD hours have not been configured yet"
                        >
                          <FaExclamationTriangle /> Schedule Not Configured
                        </span>
                      ) : schedStatus === "conflict" ? (
                        <span
                          className="sched-badge conflict"
                          title="Conflicting slot timings or dates detected"
                        >
                          <FaExclamationTriangle /> Conflict Detected
                        </span>
                      ) : (
                        <span
                          className="sched-badge paused"
                          title="Booking schedule paused by hospital"
                        >
                          <FaClock /> Schedule Paused
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Weekly Schedule Mini Grid */}
                  <div className="sched-weekly-overview">
                    <span className="sched-weekly-label">
                      Weekly Working Days:
                    </span>
                    <div className="sched-days-pills">
                      {DAYS_ORDER.map((dayShort) => {
                        const weeklyItem = (doctor.weeklySchedule || []).find(
                          (s) =>
                            s.day
                              ?.toLowerCase()
                              .startsWith(dayShort.toLowerCase()),
                        );
                        const isEnabled = weeklyItem
                          ? Boolean(weeklyItem.enabled)
                          : false;
                        const isDayToday = todayDayName
                          ?.toLowerCase()
                          .startsWith(dayShort.toLowerCase());

                        return (
                          <span
                            key={dayShort}
                            className={`day-pill ${isEnabled ? "enabled" : "disabled"} ${
                              isDayToday ? "is-today" : ""
                            }`}
                            title={`${dayShort}: ${
                              isEnabled
                                ? `${weeklyItem.startTime} - ${weeklyItem.endTime}`
                                : "Off"
                            }`}
                          >
                            {dayShort}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Operational Details Strip */}
                  <div className="sched-metrics-box">
                    {/* Today's Availability */}
                    <div className="sched-metric-row">
                      <span className="metric-row-label">
                        <FaClock /> Today's Status:
                      </span>
                      <strong
                        className={`metric-row-val ${isAvailableToday ? "open" : "closed"}`}
                      >
                        {isOnLeave
                          ? "On Leave Today"
                          : isAvailableToday
                            ? `Available (${doctor.todayAvailability?.workingHours})`
                            : "Off Duty Today"}
                      </strong>
                    </div>

                    {/* Next Available Time */}
                    <div className="sched-metric-row">
                      <span className="metric-row-label">
                        <FaCalendarCheck /> Next Available:
                      </span>
                      <span className="metric-row-val next-time">
                        {doctor.nextAvailableTime || "Check Schedule"}
                      </span>
                    </div>

                    {/* Slot Info */}
                    <div className="sched-metric-row">
                      <span className="metric-row-label">
                        <FaRegClock /> Slot Configuration:
                      </span>
                      <span className="metric-row-val slots-detail">
                        {doctor.slotDurationMinutes || 30} min OPD slots ·{" "}
                        <strong>
                          {doctor.todayAvailability?.availableSlotsCount ?? 0}{" "}
                          open
                        </strong>{" "}
                        ({doctor.todayAvailability?.bookedSlotsCount ?? 0}{" "}
                        booked)
                      </span>
                    </div>
                  </div>

                  {/* Card Actions: Manage Schedule, View Calendar, Duty Toggle */}
                  <div className="sched-card-actions">
                    <button
                      type="button"
                      className="btn-card-action primary"
                      onClick={() => setScheduleModalDoctor(doctor)}
                    >
                      <FaClock /> Manage Schedule
                    </button>

                    <button
                      type="button"
                      className="btn-card-action secondary"
                      onClick={() => setCalendarModalDoctor(doctor)}
                    >
                      <FaCalendarAlt /> View Calendar
                    </button>

                    <button
                      type="button"
                      className={`btn-duty-toggle ${doctor.available ? "on" : "off"}`}
                      onClick={(e) => handleToggleAvailability(doctor, e)}
                      disabled={togglingDoctorId === doctor._id}
                      title={
                        doctor.available
                          ? "Turn duty availability OFF"
                          : "Turn duty availability ON"
                      }
                    >
                      {togglingDoctorId === doctor._id
                        ? "..."
                        : doctor.available
                          ? "On Duty"
                          : "Off Duty"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Interactive Modals */}
      {/* Manage Weekly Schedule Modal */}
      {scheduleModalDoctor && (
        <DoctorScheduleModal
          doctor={scheduleModalDoctor}
          onClose={() => setScheduleModalDoctor(null)}
          onUpdated={fetchOverview}
        />
      )}

      {/* View Interactive Calendar Modal */}
      {calendarModalDoctor && (
        <DoctorCalendarModal
          doctor={calendarModalDoctor}
          allDoctors={doctors}
          onClose={() => setCalendarModalDoctor(null)}
          onManageSchedule={(doc) => setScheduleModalDoctor(doc)}
          onUpdated={fetchOverview}
        />
      )}
    </div>
  );
}
