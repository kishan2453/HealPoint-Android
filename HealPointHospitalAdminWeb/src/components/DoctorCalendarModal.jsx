import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FaTimes,
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaUserMd,
  FaCheckCircle,
  FaVideo,
  FaClinicMedical,
  FaCalendarCheck,
  FaExclamationTriangle,
  FaEdit,
  FaPlus,
  FaBed,
  FaBan,
  FaRegCalendarAlt,
  FaTrash,
  FaPhoneAlt,
  FaEnvelope,
  FaMoneyBillWave,
  FaSync,
  FaBuilding,
  FaCalendarDay,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import DoctorLeaveModal from "./DoctorLeaveModal";
import DoctorOverrideModal from "./DoctorOverrideModal";
import { formatDoctorName } from "../services/doctorFormat";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function DoctorCalendarModal({
  doctor,
  allDoctors = [],
  onClose,
  onManageSchedule,
  onUpdated,
}) {
  if (!doctor) return null;

  const today = new Date();
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctor._id);
  const [currentDoctor, setCurrentDoctor] = useState(doctor);

  // Calendar Date State
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1); // 1-12
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [activeView, setActiveView] = useState("month"); // 'month', 'week', 'day'
  const [weekOffset, setWeekOffset] = useState(0); // 0 = current week

  // Data State
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [daysSummary, setDaysSummary] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [dateOverrides, setDateOverrides] = useState([]);
  const [holidays, setHolidays] = useState([]);

  // Submodals
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [cancellingLeaveId, setCancellingLeaveId] = useState("");
  const [deletingOverrideId, setDeletingOverrideId] = useState("");

  // Fetch Calendar Data for selected doctor and month/year
  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/api/v1/hospital-admin/scheduling/doctor/${selectedDoctorId}/calendar`,
        {
          params: { month: currentMonth, year: currentYear },
        },
      );
      if (res.data.success) {
        setAppointments(res.data.appointments || []);
        setDaysSummary(res.data.daysSummary || []);
        setLeaves(res.data.leaves || []);
        setDateOverrides(res.data.dateOverrides || []);
        setHolidays(res.data.holidays || []);
        if (res.data.doctor) {
          setCurrentDoctor(res.data.doctor);
        }
      }
    } catch (err) {
      console.error("fetchCalendar error:", err);
      toast.error(
        err.response?.data?.message || "Failed to load doctor calendar",
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, currentMonth, currentYear]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // When changing doctor via dropdown
  const handleDoctorChange = (newDocId) => {
    setSelectedDoctorId(newDocId);
    const found = allDoctors.find((d) => d._id === newDocId);
    if (found) setCurrentDoctor(found);
  };

  // Format date helper: "DD-MM-YYYY"
  const formatDayDateStr = (
    dayNum,
    month = currentMonth,
    year = currentYear,
  ) => {
    const dd = String(dayNum).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${dd}-${mm}-${year}`;
  };

  const selectedDateStr = formatDayDateStr(selectedDay);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDay(1);
  };

  // Week navigation
  const handlePrevWeek = () => {
    setWeekOffset((w) => w - 1);
  };
  const handleNextWeek = () => {
    setWeekOffset((w) => w + 1);
  };

  // Day navigation
  const handlePrevDay = () => {
    const d = new Date(currentYear, currentMonth - 1, selectedDay);
    d.setDate(d.getDate() - 1);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth() + 1);
    setSelectedDay(d.getDate());
  };
  const handleNextDay = () => {
    const d = new Date(currentYear, currentMonth - 1, selectedDay);
    d.setDate(d.getDate() + 1);
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth() + 1);
    setSelectedDay(d.getDate());
  };

  // Today shortcut
  const handleGoToday = () => {
    setCurrentMonth(today.getMonth() + 1);
    setCurrentYear(today.getFullYear());
    setSelectedDay(today.getDate());
    setWeekOffset(0);
  };

  // Calculate current week days (7 days)
  const currentWeekDays = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    // Find Monday of base week
    const day = base.getDay();
    const diffToMon = base.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(base.setDate(diffToMon));
    monday.setDate(monday.getDate() + weekOffset * 7);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const dateStr = `${dd}-${mm}-${yyyy}`;
      week.push({
        dateObj: d,
        dayNum: d.getDate(),
        month: d.getMonth() + 1,
        year: yyyy,
        dateStr,
        dayOfWeek: DAY_NAMES[d.getDay()],
        fullDayName: FULL_DAY_NAMES[d.getDay()],
        isToday:
          d.getDate() === today.getDate() &&
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear(),
      });
    }
    return week;
  }, [weekOffset]);

  // Calendar calculations
  const totalDays = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();

  // Selected date info
  const selectedDateObj = new Date(currentYear, currentMonth - 1, selectedDay);
  const selectedDayName = FULL_DAY_NAMES[selectedDateObj.getDay()];

  const selectedDayAppointments = appointments.filter(
    (a) => a.slotDate === selectedDateStr,
  );

  const selectedDaySummary = daysSummary.find((d) => d.day === selectedDay) || {
    status: "AVAILABLE",
    statusLabel: "Available",
    isPast: selectedDateObj < new Date(today.setHours(0, 0, 0, 0)),
    bookedCount: selectedDayAppointments.length,
    availableSlotsCount: 0,
    hasOverride: false,
    hasLeave: false,
    hasHoliday: false,
  };

  const activeLeaveOnSelectedDay = leaves.find((l) => {
    if (l.status === "cancelled") return false;
    if (l.startDate === selectedDateStr) return true;
    if (Array.isArray(l.dates) && l.dates.includes(selectedDateStr))
      return true;
    return false;
  });

  const activeOverrideOnSelectedDay = dateOverrides.find(
    (o) => o.date === selectedDateStr,
  );

  const activeHolidayOnSelectedDay = holidays.find(
    (h) => h.date === selectedDateStr,
  );

  // Cancel leave action
  const handleCancelLeave = async (leaveId) => {
    if (
      !window.confirm(
        "Are you sure you want to cancel this doctor leave? Availability will be recalculated.",
      )
    ) {
      return;
    }
    try {
      setCancellingLeaveId(leaveId);
      const res = await api.delete(
        `/api/v1/hospital-admin/scheduling/doctor/${selectedDoctorId}/leave/${leaveId}`,
      );
      if (res.data.success) {
        toast.success(res.data.message || "Leave cancelled successfully");
        fetchCalendar();
        onUpdated?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel leave");
    } finally {
      setCancellingLeaveId("");
    }
  };

  // Remove override action
  const handleRemoveOverride = async (overrideId) => {
    if (
      !window.confirm(
        "Are you sure you want to remove this date override? Standard weekly schedule will be restored.",
      )
    ) {
      return;
    }
    try {
      setDeletingOverrideId(overrideId);
      const res = await api.delete(
        `/api/v1/hospital-admin/scheduling/doctor/${selectedDoctorId}/override/${overrideId}`,
      );
      if (res.data.success) {
        toast.success(res.data.message || "Date override removed successfully");
        fetchCalendar();
        onUpdated?.();
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to remove date override",
      );
    } finally {
      setDeletingOverrideId("");
    }
  };

  // Header range title
  const headerRangeTitle = useMemo(() => {
    if (activeView === "month") {
      return `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;
    }
    if (activeView === "week") {
      const first = currentWeekDays[0];
      const last = currentWeekDays[6];
      return `${first.dayNum} ${MONTH_NAMES[first.month - 1].slice(0, 3)} - ${last.dayNum} ${MONTH_NAMES[last.month - 1].slice(0, 3)} ${last.year}`;
    }
    if (activeView === "day") {
      return `${selectedDayName}, ${String(selectedDay).padStart(2, "0")} ${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;
    }
    return "";
  }, [
    activeView,
    currentMonth,
    currentYear,
    currentWeekDays,
    selectedDay,
    selectedDayName,
  ]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal doctor-calendar-modal premium-cal-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="calendar-modal-title"
      >
        {/* =========================================================================
            1. DYNAMIC CALENDAR HEADER
           ========================================================================= */}
        <div className="doctor-calendar-header">
          {/* Doctor Switcher & Profile */}
          <div className="doctor-calendar-profile">
            {currentDoctor.image ? (
              <img
                src={currentDoctor.image}
                alt={currentDoctor.name}
                className="doctor-cal-avatar"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <span className="doctor-cal-avatar-fallback">
                <FaUserMd />
              </span>
            )}
            <div>
              <div className="doctor-cal-name-row">
                {allDoctors.length > 1 ? (
                  <select
                    className="doctor-switcher-select"
                    value={selectedDoctorId}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    aria-label="Select doctor"
                  >
                    {allDoctors.map((doc) => (
                      <option key={doc._id} value={doc._id}>
                        {formatDoctorName(doc.name)} (
                        {doc.speciality || doc.specialization})
                      </option>
                    ))}
                  </select>
                ) : (
                  <h2 id="calendar-modal-title">
                    {formatDoctorName(currentDoctor.name)}
                  </h2>
                )}
                <span className="doctor-cal-speciality-pill">
                  {currentDoctor.speciality ||
                    currentDoctor.specialization ||
                    "Specialist"}
                </span>
              </div>
              <p className="doctor-cal-subtext">
                <FaBuilding /> {currentDoctor.department || "Medical Wing"} ·{" "}
                <FaClock /> {currentDoctor.slotDurationMinutes || 30} min OPD
                slots
              </p>
            </div>
          </div>

          {/* View Mode & Header Actions */}
          <div className="doctor-cal-header-actions">
            {/* View Mode Switcher */}
            <div className="cal-view-selector-group">
              <button
                type="button"
                className={`cal-view-btn ${activeView === "month" ? "active" : ""}`}
                onClick={() => setActiveView("month")}
              >
                Month
              </button>
              <button
                type="button"
                className={`cal-view-btn ${activeView === "week" ? "active" : ""}`}
                onClick={() => setActiveView("week")}
              >
                Week
              </button>
              <button
                type="button"
                className={`cal-view-btn ${activeView === "day" ? "active" : ""}`}
                onClick={() => setActiveView("day")}
              >
                Day
              </button>
            </div>

            {/* Quick Action: Schedule Leave */}
            <button
              type="button"
              className="btn-action-badge leave-btn"
              onClick={() => setShowLeaveModal(true)}
              title="Schedule doctor leave (full-day, multi-day, or partial-day)"
            >
              <FaBed /> Add Leave
            </button>

            {/* Quick Action: Date Override */}
            <button
              type="button"
              className="btn-action-badge override-btn"
              onClick={() => setShowOverrideModal(true)}
              title="Create date-specific schedule override or closed day"
            >
              <FaCalendarCheck /> Date Override
            </button>

            {/* Manage Weekly Schedule Editor */}
            <button
              type="button"
              className="btn-secondary cal-edit-btn"
              onClick={() => {
                onClose();
                if (onManageSchedule) onManageSchedule(currentDoctor);
              }}
              title="Edit recurring weekly Mon-Sun schedule"
            >
              <FaEdit /> Weekly Schedule
            </button>

            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* =========================================================================
            2. CALENDAR NAVIGATION TOOLBAR
           ========================================================================= */}
        <div className="calendar-subnav-toolbar">
          <div className="calendar-month-title">
            <FaCalendarAlt className="calendar-icon" />
            <h3>{headerRangeTitle}</h3>
          </div>

          <div className="calendar-nav-buttons">
            <button
              type="button"
              className="cal-arrow-btn"
              onClick={
                activeView === "month"
                  ? handlePrevMonth
                  : activeView === "week"
                    ? handlePrevWeek
                    : handlePrevDay
              }
              aria-label="Previous"
            >
              <FaChevronLeft />
            </button>
            <button
              type="button"
              className="cal-today-shortcut"
              onClick={handleGoToday}
            >
              Today
            </button>
            <button
              type="button"
              className="cal-arrow-btn"
              onClick={
                activeView === "month"
                  ? handleNextMonth
                  : activeView === "week"
                    ? handleNextWeek
                    : handleNextDay
              }
              aria-label="Next"
            >
              <FaChevronRight />
            </button>
            <button
              type="button"
              className="cal-refresh-btn"
              onClick={fetchCalendar}
              disabled={loading}
              title="Refresh calendar data"
            >
              <FaSync className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* =========================================================================
            3. MAIN CALENDAR BODY (VIEW GRID + DAY INSPECTION ROSTER)
           ========================================================================= */}
        <div className="doctor-calendar-body">
          {/* Main Grid Section */}
          <div className="doctor-calendar-grid-section">
            {/* ----------------- VIEW 1: MONTH VIEW ----------------- */}
            {activeView === "month" && (
              <div className="cal-month-view-container">
                {/* Weekday Row */}
                <div className="calendar-weekdays-row">
                  {DAY_NAMES.map((d) => (
                    <span key={d} className="weekday-label">
                      {d}
                    </span>
                  ))}
                </div>

                {/* Days Matrix */}
                <div className="calendar-days-matrix">
                  {/* Empty placeholder boxes before first day */}
                  {Array.from({ length: firstDayIndex }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="calendar-day-box empty"
                    />
                  ))}

                  {/* Day Cells */}
                  {Array.from({ length: totalDays }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const isSelected = selectedDay === dayNum;
                    const dateStr = formatDayDateStr(dayNum);
                    const dayData = daysSummary.find((d) => d.day === dayNum);
                    const dayAppts = appointments.filter(
                      (a) => a.slotDate === dateStr,
                    );
                    const isToday =
                      dayNum === today.getDate() &&
                      currentMonth === today.getMonth() + 1 &&
                      currentYear === today.getFullYear();

                    const status = dayData?.status || "AVAILABLE";

                    return (
                      <button
                        type="button"
                        key={`day-${dayNum}`}
                        className={`calendar-day-box ${isToday ? "is-today" : ""} ${
                          isSelected ? "is-selected" : ""
                        } status-${status.toLowerCase()}`}
                        onClick={() => setSelectedDay(dayNum)}
                      >
                        <div className="cal-day-top">
                          <span className="cal-day-num">{dayNum}</span>
                          {isToday && (
                            <span className="today-badge">Today</span>
                          )}
                        </div>

                        <div className="cal-day-content">
                          {status === "LEAVE" ? (
                            <span
                              className="day-chip leave"
                              title={dayData?.statusLabel}
                            >
                              <FaBed /> Leave
                            </span>
                          ) : status === "BLOCKED" ? (
                            <span
                              className="day-chip off"
                              title={dayData?.statusLabel}
                            >
                              <FaBan /> Closed
                            </span>
                          ) : status === "HOLIDAY" ? (
                            <span
                              className="day-chip holiday"
                              title="Hospital Holiday"
                            >
                              Holiday
                            </span>
                          ) : (
                            <span
                              className="day-chip open"
                              title="OPD Available"
                            >
                              Open
                            </span>
                          )}

                          {dayAppts.length > 0 && (
                            <span
                              className="day-appts-badge"
                              title={`${dayAppts.length} appointments`}
                            >
                              <FaCalendarCheck /> {dayAppts.length}
                            </span>
                          )}
                        </div>

                        {dayData?.hasOverride && (
                          <div
                            className="override-indicator-dot"
                            title="Custom date override active"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Calendar Legend */}
                <div className="calendar-legend-bar">
                  <span className="legend-item">
                    <span className="legend-dot open" /> OPD Open
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot off" /> Closed / Off
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot leave" /> Doctor On Leave
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot holiday" /> Holiday
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot appts" /> Booked Consultations
                  </span>
                  <span className="legend-item">
                    <span className="legend-dot override" /> Special Override
                  </span>
                </div>
              </div>
            )}

            {/* ----------------- VIEW 2: WEEK VIEW ----------------- */}
            {activeView === "week" && (
              <div className="cal-week-view-container">
                <div className="week-columns-grid">
                  {currentWeekDays.map((wDay) => {
                    const isSelected = selectedDateStr === wDay.dateStr;
                    const dayAppts = appointments.filter(
                      (a) => a.slotDate === wDay.dateStr,
                    );
                    const override = dateOverrides.find(
                      (o) => o.date === wDay.dateStr,
                    );
                    const leave = leaves.find(
                      (l) =>
                        l.status !== "cancelled" &&
                        (l.startDate === wDay.dateStr ||
                          (l.dates && l.dates.includes(wDay.dateStr))),
                    );
                    const isHoliday = holidays.some(
                      (h) => h.date === wDay.dateStr,
                    );

                    return (
                      <div
                        key={wDay.dateStr}
                        className={`week-day-column ${wDay.isToday ? "is-today" : ""} ${
                          isSelected ? "is-selected" : ""
                        }`}
                        onClick={() => {
                          setSelectedDay(wDay.dayNum);
                          setCurrentMonth(wDay.month);
                          setCurrentYear(wDay.year);
                        }}
                      >
                        <div className="week-col-header">
                          <span className="week-col-dayname">
                            {wDay.dayOfWeek}
                          </span>
                          <span className="week-col-daynum">{wDay.dayNum}</span>
                        </div>

                        <div className="week-col-body">
                          {leave ? (
                            <div className="week-event-pill leave">
                              <FaBed />{" "}
                              {leave.leaveType === "partial_day"
                                ? `Leave (${leave.startTime})`
                                : "Full Leave"}
                            </div>
                          ) : override?.isClosed ? (
                            <div className="week-event-pill closed">
                              <FaBan /> Closed
                            </div>
                          ) : isHoliday ? (
                            <div className="week-event-pill holiday">
                              Holiday
                            </div>
                          ) : (
                            <div className="week-event-pill open">
                              <FaCheckCircle /> OPD Open
                            </div>
                          )}

                          {dayAppts.map((appt) => (
                            <div
                              key={appt._id}
                              className={`week-appt-card status-${appt.status}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAppointment(appt);
                              }}
                              title={`${appt.slotTime} - ${appt.patientName}`}
                            >
                              <strong>{appt.slotTime}</strong>
                              <span>{appt.patientName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ----------------- VIEW 3: DAY TIMELINE VIEW ----------------- */}
            {activeView === "day" && (
              <div className="cal-day-view-container">
                <div className="day-timeline-banner">
                  <div className="day-banner-left">
                    <h4>
                      {selectedDayName}, {String(selectedDay).padStart(2, "0")}{" "}
                      {MONTH_NAMES[currentMonth - 1]} {currentYear}
                    </h4>
                    <span
                      className={`status-pill ${selectedDaySummary.status.toLowerCase()}`}
                    >
                      {selectedDaySummary.statusLabel}
                    </span>
                  </div>
                  <div className="day-banner-actions">
                    <button
                      type="button"
                      className="btn-outline-action"
                      onClick={() => setShowLeaveModal(true)}
                    >
                      <FaBed /> Apply Leave for Date
                    </button>
                    <button
                      type="button"
                      className="btn-outline-action"
                      onClick={() => setShowOverrideModal(true)}
                    >
                      <FaCalendarCheck /> Override this Date
                    </button>
                  </div>
                </div>

                {/* Day Working Hours Summary */}
                <div className="day-sessions-breakdown">
                  {activeLeaveOnSelectedDay && (
                    <div className="day-special-banner leave">
                      <FaBed />
                      <div>
                        <strong>
                          Doctor Leave Scheduled:{" "}
                          {activeLeaveOnSelectedDay.reason}
                        </strong>
                        <p>
                          {activeLeaveOnSelectedDay.leaveType === "partial_day"
                            ? `Partial Leave: ${activeLeaveOnSelectedDay.startTime} to ${activeLeaveOnSelectedDay.endTime}`
                            : "Full Day Leave active on this date."}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-danger-pill"
                        onClick={() =>
                          handleCancelLeave(activeLeaveOnSelectedDay._id)
                        }
                        disabled={
                          cancellingLeaveId === activeLeaveOnSelectedDay._id
                        }
                      >
                        Cancel Leave
                      </button>
                    </div>
                  )}

                  {activeOverrideOnSelectedDay && (
                    <div
                      className={`day-special-banner ${
                        activeOverrideOnSelectedDay.isClosed
                          ? "closed"
                          : "override"
                      }`}
                    >
                      {activeOverrideOnSelectedDay.isClosed ? (
                        <FaBan />
                      ) : (
                        <FaClock />
                      )}
                      <div>
                        <strong>
                          Date Override:{" "}
                          {activeOverrideOnSelectedDay.isClosed
                            ? "Marked Closed"
                            : "Custom Working Hours"}
                        </strong>
                        <p>
                          {activeOverrideOnSelectedDay.reason ||
                            "Special schedule active."}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary-pill"
                        onClick={() =>
                          handleRemoveOverride(
                            activeOverrideOnSelectedDay._id || selectedDateStr,
                          )
                        }
                        disabled={
                          deletingOverrideId ===
                          (activeOverrideOnSelectedDay._id || selectedDateStr)
                        }
                      >
                        Remove Override
                      </button>
                    </div>
                  )}

                  {activeHolidayOnSelectedDay && (
                    <div className="day-special-banner holiday">
                      <FaCalendarAlt />
                      <div>
                        <strong>
                          Hospital Holiday: {activeHolidayOnSelectedDay.reason}
                        </strong>
                        <p>Facility OPD consultations paused.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Day Appointments Roster List */}
                <div className="day-timeline-appointments-list">
                  <h4 className="section-subtitle">
                    Booked Patient Appointments (
                    {selectedDayAppointments.length})
                  </h4>

                  {selectedDayAppointments.length === 0 ? (
                    <div className="roster-empty-state">
                      <FaCalendarCheck />
                      <strong>
                        No patient appointments booked on this date
                      </strong>
                      <p>
                        {selectedDaySummary.status === "AVAILABLE"
                          ? "OPD slots are ready for patient booking."
                          : "Doctor is unavailable for consultations on this date."}
                      </p>
                    </div>
                  ) : (
                    <div className="day-appts-grid">
                      {selectedDayAppointments.map((appt) => (
                        <div
                          key={appt._id}
                          className="day-appt-card"
                          onClick={() => setSelectedAppointment(appt)}
                        >
                          <div className="day-appt-time">
                            <FaClock /> {appt.slotTime}
                          </div>
                          <div className="day-appt-details">
                            <strong>{appt.patientName}</strong>
                            <small>{appt.patientPhone}</small>
                            <div className="day-appt-meta">
                              <span className="type-badge">
                                {appt.type?.toLowerCase().includes("video") ? (
                                  <>
                                    <FaVideo /> Video
                                  </>
                                ) : (
                                  <>
                                    <FaClinicMedical /> In-Clinic
                                  </>
                                )}
                              </span>
                              <span className={`status-pill ${appt.status}`}>
                                {appt.status}
                              </span>
                              <span className="payment-pill">
                                {appt.paymentStatus === "paid"
                                  ? "₹ Paid"
                                  : "₹ Pending"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              4. RIGHT COLUMN: SELECTED DAY INSPECTION ROSTER
             ========================================================================= */}
          <div className="doctor-calendar-roster-panel">
            <div className="roster-panel-header">
              <div>
                <span className="roster-selected-date">
                  {selectedDayName}, {String(selectedDay).padStart(2, "0")}{" "}
                  {MONTH_NAMES[currentMonth - 1]} {currentYear}
                </span>
                <div className="roster-status-line">
                  <FaClock />{" "}
                  <strong>
                    {activeLeaveOnSelectedDay
                      ? `Leave: ${activeLeaveOnSelectedDay.reason}`
                      : activeOverrideOnSelectedDay?.isClosed
                        ? "Marked Closed by Hospital"
                        : activeHolidayOnSelectedDay
                          ? `Holiday: ${activeHolidayOnSelectedDay.reason}`
                          : selectedDaySummary.status === "BLOCKED"
                            ? "Scheduled Off"
                            : "OPD Available for Consultations"}
                  </strong>
                </div>
              </div>
              <span
                className={`roster-pill status-${selectedDaySummary.status.toLowerCase()}`}
              >
                {selectedDaySummary.statusLabel}
              </span>
            </div>

            {/* Quick Actions Row */}
            <div className="roster-quick-actions">
              <button
                type="button"
                className="btn-roster-action"
                onClick={() => setShowLeaveModal(true)}
              >
                <FaBed /> Add Leave
              </button>
              <button
                type="button"
                className="btn-roster-action"
                onClick={() => setShowOverrideModal(true)}
              >
                <FaCalendarCheck /> Override
              </button>
            </div>

            {/* Booked Patient Appointments */}
            <div className="roster-panel-body">
              <h4 className="roster-section-title">
                <FaCalendarCheck /> Patient Appointments (
                {selectedDayAppointments.length})
              </h4>

              {loading ? (
                <div className="roster-loading-state">
                  <div className="spinner-shimmer" />
                  <span>Loading schedule...</span>
                </div>
              ) : selectedDayAppointments.length > 0 ? (
                <div className="roster-appointments-list">
                  {selectedDayAppointments.map((appt) => (
                    <div
                      className="roster-appt-card"
                      key={appt._id}
                      onClick={() => setSelectedAppointment(appt)}
                      title="Click to view appointment details"
                    >
                      <div className="roster-appt-time">
                        <FaClock />
                        <span>{appt.slotTime}</span>
                      </div>
                      <div className="roster-appt-info">
                        <strong>{appt.patientName}</strong>
                        <small>{appt.patientPhone}</small>
                        <div className="roster-appt-meta">
                          <span className="type-badge">
                            {appt.type?.toLowerCase().includes("video") ? (
                              <>
                                <FaVideo /> Video
                              </>
                            ) : (
                              <>
                                <FaClinicMedical /> In-Clinic
                              </>
                            )}
                          </span>
                          <span className={`status-pill ${appt.status}`}>
                            {appt.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="roster-empty-state">
                  <FaCalendarCheck />
                  <strong>No bookings on this day</strong>
                  <p>
                    {selectedDaySummary.status === "AVAILABLE"
                      ? "Slots are open and ready for patient booking."
                      : "Doctor is unavailable for consultations on this date."}
                  </p>
                </div>
              )}
            </div>

            <div className="roster-panel-footer">
              <button
                type="button"
                className="btn-primary roster-action-btn"
                onClick={() => {
                  onClose();
                  if (onManageSchedule) onManageSchedule(currentDoctor);
                }}
              >
                <FaEdit /> Weekly Schedule Editor
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. SUB-MODALS: LEAVE, OVERRIDE, APPOINTMENT DETAILS
           ========================================================================= */}
        {showLeaveModal && (
          <DoctorLeaveModal
            doctor={currentDoctor}
            initialDate={selectedDateStr}
            onClose={() => setShowLeaveModal(false)}
            onSaved={() => {
              setShowLeaveModal(false);
              fetchCalendar();
              onUpdated?.();
            }}
          />
        )}

        {showOverrideModal && (
          <DoctorOverrideModal
            doctor={currentDoctor}
            initialDate={selectedDateStr}
            onClose={() => setShowOverrideModal(false)}
            onSaved={() => {
              setShowOverrideModal(false);
              fetchCalendar();
              onUpdated?.();
            }}
          />
        )}

        {/* Appointment Details Popover / Modal */}
        {selectedAppointment && (
          <div
            className="modal-backdrop submodal"
            onMouseDown={() => setSelectedAppointment(null)}
          >
            <div
              className="detail-modal appointment-cal-detail-modal"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="doctor-calendar-header">
                <h3>Appointment Details</h3>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setSelectedAppointment(null)}
                >
                  <FaTimes />
                </button>
              </div>
              <div className="appt-detail-content">
                <div className="appt-detail-row">
                  <span>Appointment ID:</span>
                  <strong>{selectedAppointment.appointmentId}</strong>
                </div>
                <div className="appt-detail-row">
                  <span>Patient Name:</span>
                  <strong>{selectedAppointment.patientName}</strong>
                </div>
                <div className="appt-detail-row">
                  <span>Contact:</span>
                  <strong>
                    <FaPhoneAlt /> {selectedAppointment.patientPhone}
                  </strong>
                </div>
                {selectedAppointment.patientEmail && (
                  <div className="appt-detail-row">
                    <span>Email:</span>
                    <strong>
                      <FaEnvelope /> {selectedAppointment.patientEmail}
                    </strong>
                  </div>
                )}
                <div className="appt-detail-row">
                  <span>Date & Time:</span>
                  <strong>
                    <FaClock /> {selectedAppointment.slotDate} at{" "}
                    {selectedAppointment.slotTime}
                  </strong>
                </div>
                <div className="appt-detail-row">
                  <span>Consultation Type:</span>
                  <strong>{selectedAppointment.type}</strong>
                </div>
                <div className="appt-detail-row">
                  <span>Status:</span>
                  <span className={`status-pill ${selectedAppointment.status}`}>
                    {selectedAppointment.status}
                  </span>
                </div>
                <div className="appt-detail-row">
                  <span>Payment:</span>
                  <strong>
                    ₹{selectedAppointment.amount || 0} (
                    {selectedAppointment.paymentStatus})
                  </strong>
                </div>
              </div>
              <div className="leave-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedAppointment(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
