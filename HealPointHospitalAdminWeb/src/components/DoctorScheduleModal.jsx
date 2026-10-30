import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FaTimes,
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlus,
  FaTrash,
  FaCopy,
  FaUndo,
  FaCheck,
  FaCoffee,
  FaUserMd,
  FaBuilding,
  FaStethoscope,
  FaCalendarWeek,
  FaShieldAlt,
  FaInfoCircle,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

const DEFAULT_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SLOT_DURATIONS = [15, 20, 30, 45, 60];

// Standard time options for quick picker
const TIME_OPTIONS = [];
for (let h = 7; h <= 22; h++) {
  for (let m = 0; m < 60; m += 15) {
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    TIME_OPTIONS.push(
      `${String(displayH).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`,
    );
  }
}

// Convert "HH:MM AM/PM" to minutes from midnight
const timeToMinutes = (str) => {
  if (!str) return null;
  const match = String(str)
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
};

// Check if two intervals overlap
const doOverlap = (s1, e1, s2, e2) => {
  return s1 < e2 && s2 < e1;
};

export default function DoctorScheduleModal({ doctor, onClose, onUpdated }) {
  if (!doctor) return null;

  // Initialize schedule from doctor.weeklySchedule or standard defaults
  const buildInitialSchedule = useCallback(() => {
    return DEFAULT_DAYS.map((day) => {
      const existing = doctor.weeklySchedule?.find(
        (s) => s.day?.toLowerCase() === day.toLowerCase(),
      );

      // Default sessions
      let sessions = [];
      if (
        existing &&
        Array.isArray(existing.sessions) &&
        existing.sessions.length > 0
      ) {
        sessions = existing.sessions.map((sess, idx) => ({
          name: sess.name || `Session ${idx + 1}`,
          startTime: sess.startTime || "09:00 AM",
          endTime: sess.endTime || "01:00 PM",
        }));
      } else if (existing && existing.startTime && existing.endTime) {
        sessions = [
          {
            name: "Standard OPD",
            startTime: existing.startTime,
            endTime: existing.endTime,
          },
        ];
      } else {
        const isSunday = day === "Sunday";
        const isSaturday = day === "Saturday";
        sessions = [
          {
            name: "Morning OPD",
            startTime: "09:00 AM",
            endTime: isSunday ? "01:00 PM" : "01:00 PM",
          },
          ...(!isSunday
            ? [
                {
                  name: "Evening OPD",
                  startTime: "02:00 PM",
                  endTime: isSaturday ? "05:00 PM" : "06:00 PM",
                },
              ]
            : []),
        ];
      }

      // Default breaks
      let breaks = [];
      if (existing && Array.isArray(existing.breaks)) {
        breaks = existing.breaks.map((b, idx) => ({
          name: b.name || `Break ${idx + 1}`,
          startTime: b.startTime || "01:00 PM",
          endTime: b.endTime || "02:00 PM",
        }));
      } else if (Array.isArray(doctor.breakTimes)) {
        const matchingDayBreaks = doctor.breakTimes.filter(
          (bt) => !bt.day || bt.day.toLowerCase() === day.toLowerCase(),
        );
        if (matchingDayBreaks.length) {
          breaks = matchingDayBreaks.map((b, idx) => ({
            name: b.name || `Break ${idx + 1}`,
            startTime: b.startTime,
            endTime: b.endTime,
          }));
        }
      }

      const isWeekend = day === "Sunday";
      const enabled = existing ? Boolean(existing.enabled) : !isWeekend;

      return {
        day,
        enabled,
        startTime: sessions[0]?.startTime || "09:00 AM",
        endTime: sessions[sessions.length - 1]?.endTime || "05:00 PM",
        sessions,
        breaks,
      };
    });
  }, [doctor]);

  const [schedule, setSchedule] = useState(buildInitialSchedule);
  const [initialScheduleStr, setInitialScheduleStr] = useState("");
  const [available, setAvailable] = useState(doctor.available ?? true);
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(
    doctor.slotDurationMinutes || 30,
  );

  const [submitting, setSubmitting] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState(null);
  const [copyTargetDays, setCopyTargetDays] = useState([]);

  // Store initial serialized state for dirty checking
  useEffect(() => {
    const init = buildInitialSchedule();
    setSchedule(init);
    setInitialScheduleStr(
      JSON.stringify({
        schedule: init,
        available: doctor.available ?? true,
        slotDurationMinutes: doctor.slotDurationMinutes || 30,
      }),
    );
  }, [buildInitialSchedule, doctor]);

  // Dirty detection
  const isDirty = useMemo(() => {
    if (!initialScheduleStr) return false;
    const currentStr = JSON.stringify({
      schedule,
      available,
      slotDurationMinutes,
    });
    return currentStr !== initialScheduleStr;
  }, [schedule, available, slotDurationMinutes, initialScheduleStr]);

  // Reset to initial
  const handleReset = () => {
    const init = buildInitialSchedule();
    setSchedule(init);
    setAvailable(doctor.available ?? true);
    setSlotDurationMinutes(doctor.slotDurationMinutes || 30);
    toast.info("Schedule reset to last saved state");
  };

  // Safe close with dirty check
  const handleSafeClose = () => {
    if (isDirty) {
      if (
        window.confirm(
          "You have unsaved schedule changes. Are you sure you want to discard them?",
        )
      ) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Toggle Day Working / Off
  const handleToggleDay = (dayIndex) => {
    setSchedule((prev) =>
      prev.map((dayItem, idx) => {
        if (idx !== dayIndex) return dayItem;
        const nextEnabled = !dayItem.enabled;
        return {
          ...dayItem,
          enabled: nextEnabled,
          // If enabling and no sessions, add default session
          sessions:
            nextEnabled && (!dayItem.sessions || dayItem.sessions.length === 0)
              ? [
                  {
                    name: "Morning OPD",
                    startTime: "09:00 AM",
                    endTime: "05:00 PM",
                  },
                ]
              : dayItem.sessions,
        };
      }),
    );
  };

  // Session handlers
  const handleAddSession = (dayIndex) => {
    setSchedule((prev) =>
      prev.map((dayItem, idx) => {
        if (idx !== dayIndex) return dayItem;
        const currentSessions = dayItem.sessions || [];
        const lastSession = currentSessions[currentSessions.length - 1];

        // Suggest a non-overlapping slot after the last session
        let newStart = "02:00 PM";
        let newEnd = "06:00 PM";
        if (lastSession) {
          const lastEndM = timeToMinutes(lastSession.endTime);
          if (lastEndM && lastEndM < 1260) {
            const startM = Math.min(1380, lastEndM + 60);
            const endM = Math.min(1410, startM + 180);
            const sh = Math.floor(startM / 60);
            const sm = startM % 60;
            const eh = Math.floor(endM / 60);
            const em = endM % 60;
            newStart = `${String(sh > 12 ? sh - 12 : sh).padStart(2, "0")}:${String(sm).padStart(2, "0")} ${sh >= 12 ? "PM" : "AM"}`;
            newEnd = `${String(eh > 12 ? eh - 12 : eh).padStart(2, "0")}:${String(em).padStart(2, "0")} ${eh >= 12 ? "PM" : "AM"}`;
          }
        }

        const newSession = {
          name: `Session ${currentSessions.length + 1}`,
          startTime: newStart,
          endTime: newEnd,
        };
        return {
          ...dayItem,
          sessions: [...currentSessions, newSession],
        };
      }),
    );
  };

  const handleUpdateSession = (dayIndex, sessionIndex, field, value) => {
    setSchedule((prev) =>
      prev.map((dayItem, idx) => {
        if (idx !== dayIndex) return dayItem;
        const updatedSessions = dayItem.sessions.map((sess, sIdx) =>
          sIdx === sessionIndex ? { ...sess, [field]: value } : sess,
        );
        return { ...dayItem, sessions: updatedSessions };
      }),
    );
  };

  const handleRemoveSession = (dayIndex, sessionIndex) => {
    setSchedule((prev) =>
      prev.map((dayItem, idx) => {
        if (idx !== dayIndex) return dayItem;
        if (dayItem.sessions.length <= 1) {
          toast.warning(
            "A working day must have at least one session. You can turn off the day instead.",
          );
          return dayItem;
        }
        const updatedSessions = dayItem.sessions.filter(
          (_, sIdx) => sIdx !== sessionIndex,
        );
        return { ...dayItem, sessions: updatedSessions };
      }),
    );
  };

  // Break handlers
  const handleAddBreak = (dayIndex) => {
    setSchedule((prev) =>
      prev.map((dayItem, idx) => {
        if (idx !== dayIndex) return dayItem;
        const currentBreaks = dayItem.breaks || [];
        const firstSession = dayItem.sessions?.[0];

        // Suggest a break inside the first session
        let bStart = "01:00 PM";
        let bEnd = "01:30 PM";
        if (firstSession) {
          const sStart = timeToMinutes(firstSession.startTime);
          const sEnd = timeToMinutes(firstSession.endTime);
          if (sStart && sEnd && sEnd - sStart >= 120) {
            const mid = sStart + Math.floor((sEnd - sStart) / 2);
            const mStart = mid;
            const mEnd = mid + 30;
            const sh = Math.floor(mStart / 60);
            const sm = mStart % 60;
            const eh = Math.floor(mEnd / 60);
            const em = mEnd % 60;
            bStart = `${String(sh > 12 ? sh - 12 : sh).padStart(2, "0")}:${String(sm).padStart(2, "0")} ${sh >= 12 ? "PM" : "AM"}`;
            bEnd = `${String(eh > 12 ? eh - 12 : eh).padStart(2, "0")}:${String(em).padStart(2, "0")} ${eh >= 12 ? "PM" : "AM"}`;
          }
        }

        const newBreak = {
          name: `Break ${currentBreaks.length + 1}`,
          startTime: bStart,
          endTime: bEnd,
        };
        return {
          ...dayItem,
          breaks: [...currentBreaks, newBreak],
        };
      }),
    );
  };

  const handleUpdateBreak = (dayIndex, breakIndex, field, value) => {
    setSchedule((prev) =>
      prev.map((dayItem, idx) => {
        if (idx !== dayIndex) return dayItem;
        const updatedBreaks = dayItem.breaks.map((b, bIdx) =>
          bIdx === breakIndex ? { ...b, [field]: value } : b,
        );
        return { ...dayItem, breaks: updatedBreaks };
      }),
    );
  };

  const handleRemoveBreak = (dayIndex, breakIndex) => {
    setSchedule((prev) =>
      prev.map((dayItem, idx) => {
        if (idx !== dayIndex) return dayItem;
        return {
          ...dayItem,
          breaks: dayItem.breaks.filter((_, bIdx) => bIdx !== breakIndex),
        };
      }),
    );
  };

  // Productivity: Copy schedule
  const handleOpenCopy = (sourceDay) => {
    setCopySourceDay(sourceDay);
    setCopyTargetDays(DEFAULT_DAYS.filter((d) => d !== sourceDay.day));
  };

  const handleToggleCopyTarget = (targetDayName) => {
    setCopyTargetDays((prev) =>
      prev.includes(targetDayName)
        ? prev.filter((d) => d !== targetDayName)
        : [...prev, targetDayName],
    );
  };

  const handleApplyCopy = () => {
    if (!copySourceDay || !copyTargetDays.length) return;
    setSchedule((prev) =>
      prev.map((dayItem) => {
        if (!copyTargetDays.includes(dayItem.day)) return dayItem;
        return {
          ...dayItem,
          enabled: copySourceDay.enabled,
          sessions: copySourceDay.sessions.map((s) => ({ ...s })),
          breaks: copySourceDay.breaks.map((b) => ({ ...b })),
          startTime: copySourceDay.startTime,
          endTime: copySourceDay.endTime,
        };
      }),
    );
    toast.success(
      `Copied ${copySourceDay.day} schedule to ${copyTargetDays.join(", ")}`,
    );
    setCopySourceDay(null);
    setCopyTargetDays([]);
  };

  const handleApplyMondayToWeekdays = () => {
    const monday = schedule.find((d) => d.day === "Monday");
    if (!monday) return;
    const weekdays = ["Tuesday", "Wednesday", "Thursday", "Friday"];
    setSchedule((prev) =>
      prev.map((dayItem) => {
        if (!weekdays.includes(dayItem.day)) return dayItem;
        return {
          ...dayItem,
          enabled: monday.enabled,
          sessions: monday.sessions.map((s) => ({ ...s })),
          breaks: monday.breaks.map((b) => ({ ...b })),
          startTime: monday.startTime,
          endTime: monday.endTime,
        };
      }),
    );
    toast.success("Applied Monday schedule to Tuesday through Friday");
  };

  // Real-time Day Validation Checks
  const getDayErrors = (dayItem) => {
    if (!dayItem.enabled)
      return { hasError: false, sessionErrors: {}, breakErrors: {} };

    const sessionErrors = {};
    const breakErrors = {};
    let hasError = false;

    // 1. Validate sessions
    const sessions = dayItem.sessions || [];
    if (!sessions.length) {
      hasError = true;
      sessionErrors.general =
        "At least one session is required when day is active.";
    }

    const parsedSessions = [];
    sessions.forEach((s, idx) => {
      const sStart = timeToMinutes(s.startTime);
      const sEnd = timeToMinutes(s.endTime);

      if (sStart === null || sEnd === null) {
        sessionErrors[idx] = "Invalid time format. Example: 09:00 AM";
        hasError = true;
      } else if (sStart >= sEnd) {
        sessionErrors[idx] = "End time must be after start time.";
        hasError = true;
      } else {
        parsedSessions.push({ start: sStart, end: sEnd, index: idx });
      }
    });

    // Check session overlaps
    for (let i = 0; i < parsedSessions.length; i++) {
      for (let j = i + 1; j < parsedSessions.length; j++) {
        if (
          doOverlap(
            parsedSessions[i].start,
            parsedSessions[i].end,
            parsedSessions[j].start,
            parsedSessions[j].end,
          )
        ) {
          sessionErrors[parsedSessions[i].index] =
            "Schedule sessions cannot overlap.";
          sessionErrors[parsedSessions[j].index] =
            "Schedule sessions cannot overlap.";
          hasError = true;
        }
      }
    }

    // 2. Validate breaks
    const breaks = dayItem.breaks || [];
    const parsedBreaks = [];
    breaks.forEach((b, idx) => {
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);

      if (bStart === null || bEnd === null) {
        breakErrors[idx] = "Invalid break time format. Example: 01:00 PM";
        hasError = true;
      } else if (bStart >= bEnd) {
        breakErrors[idx] = "Break end time must be after start time.";
        hasError = true;
      } else {
        // Check containment inside at least one session
        const isContained = parsedSessions.some(
          (s) => s.start <= bStart && bEnd <= s.end,
        );
        if (!isContained) {
          breakErrors[idx] = "Break must be within working session hours.";
          hasError = true;
        } else {
          parsedBreaks.push({ start: bStart, end: bEnd, index: idx });
        }
      }
    });

    // Check break overlaps
    for (let i = 0; i < parsedBreaks.length; i++) {
      for (let j = i + 1; j < parsedBreaks.length; j++) {
        if (
          doOverlap(
            parsedBreaks[i].start,
            parsedBreaks[i].end,
            parsedBreaks[j].start,
            parsedBreaks[j].end,
          )
        ) {
          breakErrors[parsedBreaks[i].index] =
            "Breaks cannot overlap each other.";
          breakErrors[parsedBreaks[j].index] =
            "Breaks cannot overlap each other.";
          hasError = true;
        }
      }
    }

    return { hasError, sessionErrors, breakErrors };
  };

  // Overall validation check
  const validateEntireSchedule = () => {
    for (const dayItem of schedule) {
      if (!dayItem.enabled) continue;
      const { hasError, sessionErrors, breakErrors } = getDayErrors(dayItem);
      if (hasError) {
        const firstError =
          Object.values(sessionErrors)[0] ||
          Object.values(breakErrors)[0] ||
          "Please resolve invalid hours";
        toast.error(`${dayItem.day}: ${firstError}`);
        return false;
      }
    }
    return true;
  };

  // Save Flow
  const handleInitiateSave = async () => {
    if (!validateEntireSchedule()) return;

    try {
      setCheckingConflicts(true);
      // Pre-check appointment conflicts
      const conflictRes = await api.post(
        `/api/v1/hospital-admin/scheduling/doctor/${doctor._id}/check-conflicts`,
        { weeklySchedule: schedule },
      );

      if (conflictRes.data.hasConflicts) {
        setConflicts(conflictRes.data.conflicts || []);
        setShowConflictModal(true);
        return;
      }

      // No conflicts -> proceed to save directly
      await executeSave(false);
    } catch (err) {
      console.error("Conflict check error:", err);
      // If endpoint returns conflict directly
      if (err.response?.status === 409 && err.response?.data?.conflicts) {
        setConflicts(err.response.data.conflicts);
        setShowConflictModal(true);
      } else {
        toast.error(
          err.response?.data?.message || "Error validating schedule conflicts",
        );
      }
    } finally {
      setCheckingConflicts(false);
    }
  };

  const executeSave = async (acknowledgeConflicts = false) => {
    try {
      setSubmitting(true);

      // Generate human-readable summary
      const activeDays = schedule
        .filter((s) => s.enabled)
        .map((s) => s.day.slice(0, 3));
      const readableSchedule = activeDays.length
        ? `${activeDays.join(", ")} (Regular OPD Hours)`
        : "Temporarily unavailable";

      const res = await api.put(
        `/api/v1/hospital-admin/scheduling/doctor/${doctor._id}/schedule`,
        {
          available,
          weeklySchedule: schedule,
          availabilitySchedule: readableSchedule,
          slotDurationMinutes,
          acknowledgeConflicts,
        },
      );

      if (res.data.success) {
        toast.success(
          `Weekly schedule successfully saved for ${formatDoctorName(doctor.name)}`,
        );
        setShowConflictModal(false);
        if (onUpdated) onUpdated();
        onClose();
      }
    } catch (err) {
      console.error("Schedule save error:", err);
      if (err.response?.status === 409 && err.response?.data?.conflicts) {
        setConflicts(err.response.data.conflicts);
        setShowConflictModal(true);
      } else {
        toast.error(
          err.response?.data?.message ||
            "Unable to save schedule. Please check inputs and retry.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Status badge styling helper
  const schedStatus =
    doctor.scheduleStatus || (doctor.available ? "active" : "paused");

  return (
    <div className="modal-backdrop" onMouseDown={handleSafeClose}>
      <div
        className="detail-modal doctor-schedule-modal premier-schedule-editor"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="schedule-modal-title"
      >
        {/* Modal Close */}
        <button
          type="button"
          className="modal-close"
          onClick={handleSafeClose}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        {/* Modal Header */}
        <div className="schedule-editor-header">
          <div className="doctor-header-profile">
            <div className="doctor-header-avatar">
              {doctor.image ? (
                <img src={doctor.image} alt={doctor.name} />
              ) : (
                <FaUserMd />
              )}
            </div>
            <div className="doctor-header-info">
              <div className="doctor-name-row">
                <h2 id="schedule-modal-title">
                  {formatDoctorName(doctor.name)}
                </h2>
                <span className={`sched-status-chip ${schedStatus}`}>
                  {schedStatus === "active" ? (
                    <>
                      <FaCheckCircle /> Active Schedule
                    </>
                  ) : schedStatus === "on_leave" ? (
                    <>
                      <FaCalendarAlt /> On Leave Today
                    </>
                  ) : schedStatus === "conflict" ? (
                    <>
                      <FaExclamationTriangle /> Schedule Conflict
                    </>
                  ) : schedStatus === "not_configured" ? (
                    <>
                      <FaInfoCircle /> Not Configured
                    </>
                  ) : (
                    <>
                      <FaClock /> Schedule Paused
                    </>
                  )}
                </span>
                {isDirty && (
                  <span className="unsaved-changes-badge">• Unsaved Edits</span>
                )}
              </div>
              <p className="doctor-header-sub">
                <FaStethoscope />{" "}
                <strong>
                  {doctor.speciality || doctor.specialization || "Doctor"}
                </strong>
                <span className="sub-divider">•</span>
                <FaBuilding />{" "}
                {doctor.department || doctor.hospitalName || "General OPD"}
              </p>
            </div>
          </div>

          {/* Quick Settings: Slot Duration & Availability Switch */}
          <div className="schedule-header-controls">
            {/* Slot Duration */}
            <div className="slot-duration-selector">
              <label>
                <FaClock /> Slot Duration:
              </label>
              <div className="duration-pills">
                {SLOT_DURATIONS.map((dur) => (
                  <button
                    type="button"
                    key={dur}
                    className={`btn-dur-pill ${slotDurationMinutes === dur ? "active" : ""}`}
                    onClick={() => setSlotDurationMinutes(dur)}
                  >
                    {dur}m
                  </button>
                ))}
              </div>
            </div>

            {/* Overall Duty Switch */}
            <div className="duty-toggle-box">
              <label className="doctor-form-toggle">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                />
                <span className="doctor-form-toggle-track" />
                <span className="doctor-form-toggle-label">
                  {available ? "Accepting Bookings" : "Bookings Paused"}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Global Productivity Toolbar */}
        <div className="schedule-productivity-bar">
          <div className="productivity-left">
            <button
              type="button"
              className="btn-toolbar-action"
              onClick={handleApplyMondayToWeekdays}
              title="Copy Monday's schedule to Tuesday, Wednesday, Thursday, and Friday"
            >
              <FaCalendarWeek /> Apply Monday to Weekdays
            </button>
          </div>
          <div className="productivity-right">
            <button
              type="button"
              className="btn-toolbar-action reset"
              onClick={handleReset}
              disabled={!isDirty}
              title="Discard all uncommitted changes and reload existing schedule"
            >
              <FaUndo /> Reset Schedule
            </button>
          </div>
        </div>

        {/* Modal Body: Day-by-Day Editor */}
        <div className="schedule-modal-body">
          <div className="schedule-days-accordion">
            {schedule.map((dayItem, dayIndex) => {
              const { hasError, sessionErrors, breakErrors } =
                getDayErrors(dayItem);
              const isToday =
                new Date().toLocaleDateString("en-US", { weekday: "long" }) ===
                dayItem.day;

              return (
                <div
                  key={dayItem.day}
                  className={`schedule-day-block ${dayItem.enabled ? "is-working" : "is-off"} ${
                    hasError ? "has-validation-error" : ""
                  }`}
                >
                  {/* Day Header Row */}
                  <div className="day-block-header">
                    <div className="day-block-title-group">
                      <label className="day-toggle-switch">
                        <input
                          type="checkbox"
                          checked={dayItem.enabled}
                          onChange={() => handleToggleDay(dayIndex)}
                        />
                        <span className="toggle-slider round" />
                      </label>
                      <span className="day-name-heading">
                        {dayItem.day}
                        {isToday && <span className="today-badge">TODAY</span>}
                      </span>
                      <span
                        className={`day-mode-pill ${dayItem.enabled ? "working" : "off"}`}
                      >
                        {dayItem.enabled ? "Working Day" : "Off Day"}
                      </span>
                    </div>

                    {dayItem.enabled && (
                      <div className="day-block-actions">
                        <button
                          type="button"
                          className="btn-copy-day"
                          onClick={() => handleOpenCopy(dayItem)}
                          title={`Copy ${dayItem.day} schedule to other days`}
                        >
                          <FaCopy /> Copy {dayItem.day} to...
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Day Body */}
                  {dayItem.enabled ? (
                    <div className="day-block-content">
                      {/* 1. Multiple Sessions Builder */}
                      <div className="day-sub-section sessions-sub-section">
                        <div className="sub-section-header">
                          <span className="sub-section-title">
                            <FaClock /> Consultation Sessions
                          </span>
                          <button
                            type="button"
                            className="btn-add-item"
                            onClick={() => handleAddSession(dayIndex)}
                          >
                            <FaPlus /> Add Session
                          </button>
                        </div>

                        {sessionErrors.general && (
                          <div className="field-error-banner">
                            <FaExclamationTriangle /> {sessionErrors.general}
                          </div>
                        )}

                        <div className="sessions-list">
                          {dayItem.sessions.map((sess, sIdx) => {
                            const err = sessionErrors[sIdx];
                            return (
                              <div
                                key={sIdx}
                                className={`session-row-item ${err ? "row-error" : ""}`}
                              >
                                <div className="session-name-col">
                                  <input
                                    type="text"
                                    value={sess.name}
                                    onChange={(e) =>
                                      handleUpdateSession(
                                        dayIndex,
                                        sIdx,
                                        "name",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="e.g. Morning OPD"
                                    className="session-name-input"
                                  />
                                </div>

                                <div className="session-time-col">
                                  <div className="time-select-group">
                                    <input
                                      type="text"
                                      value={sess.startTime}
                                      onChange={(e) =>
                                        handleUpdateSession(
                                          dayIndex,
                                          sIdx,
                                          "startTime",
                                          e.target.value,
                                        )
                                      }
                                      list="standard-times-list"
                                      placeholder="09:00 AM"
                                      className="time-input"
                                    />
                                    <span className="time-arrow">to</span>
                                    <input
                                      type="text"
                                      value={sess.endTime}
                                      onChange={(e) =>
                                        handleUpdateSession(
                                          dayIndex,
                                          sIdx,
                                          "endTime",
                                          e.target.value,
                                        )
                                      }
                                      list="standard-times-list"
                                      placeholder="01:00 PM"
                                      className="time-input"
                                    />
                                  </div>
                                  {err && (
                                    <span className="field-error-text">
                                      <FaExclamationTriangle /> {err}
                                    </span>
                                  )}
                                </div>

                                <div className="session-action-col">
                                  {dayItem.sessions.length > 1 && (
                                    <button
                                      type="button"
                                      className="btn-delete-item"
                                      onClick={() =>
                                        handleRemoveSession(dayIndex, sIdx)
                                      }
                                      title="Remove this session"
                                    >
                                      <FaTrash />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Breaks Builder */}
                      <div className="day-sub-section breaks-sub-section">
                        <div className="sub-section-header">
                          <span className="sub-section-title">
                            <FaCoffee /> Scheduled Breaks (Rounds / Lunch)
                          </span>
                          <button
                            type="button"
                            className="btn-add-item secondary"
                            onClick={() => handleAddBreak(dayIndex)}
                          >
                            <FaPlus /> Add Break
                          </button>
                        </div>

                        {dayItem.breaks?.length === 0 ? (
                          <div className="no-breaks-hint">
                            No breaks scheduled for this day. Patients can book
                            slots continuously.
                          </div>
                        ) : (
                          <div className="breaks-list">
                            {dayItem.breaks.map((brk, bIdx) => {
                              const err = breakErrors[bIdx];
                              return (
                                <div
                                  key={bIdx}
                                  className={`break-row-item ${err ? "row-error" : ""}`}
                                >
                                  <div className="break-name-col">
                                    <input
                                      type="text"
                                      value={brk.name}
                                      onChange={(e) =>
                                        handleUpdateBreak(
                                          dayIndex,
                                          bIdx,
                                          "name",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="e.g. Lunch Break"
                                      className="break-name-input"
                                    />
                                  </div>

                                  <div className="break-time-col">
                                    <div className="time-select-group">
                                      <input
                                        type="text"
                                        value={brk.startTime}
                                        onChange={(e) =>
                                          handleUpdateBreak(
                                            dayIndex,
                                            bIdx,
                                            "startTime",
                                            e.target.value,
                                          )
                                        }
                                        list="standard-times-list"
                                        placeholder="01:00 PM"
                                        className="time-input"
                                      />
                                      <span className="time-arrow">to</span>
                                      <input
                                        type="text"
                                        value={brk.endTime}
                                        onChange={(e) =>
                                          handleUpdateBreak(
                                            dayIndex,
                                            bIdx,
                                            "endTime",
                                            e.target.value,
                                          )
                                        }
                                        list="standard-times-list"
                                        placeholder="01:30 PM"
                                        className="time-input"
                                      />
                                    </div>
                                    {err && (
                                      <span className="field-error-text">
                                        <FaExclamationTriangle /> {err}
                                      </span>
                                    )}
                                  </div>

                                  <div className="break-action-col">
                                    <button
                                      type="button"
                                      className="btn-delete-item"
                                      onClick={() =>
                                        handleRemoveBreak(dayIndex, bIdx)
                                      }
                                      title="Remove this break"
                                    >
                                      <FaTrash />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 3. Visual Schedule Timeline */}
                      <ScheduleVisualTimeline dayItem={dayItem} />
                    </div>
                  ) : (
                    <div className="day-off-banner">
                      <span>
                        Doctor is OFF duty on {dayItem.day}. No consultation
                        sessions or bookings will occur.
                      </span>
                      <button
                        type="button"
                        className="btn-enable-day"
                        onClick={() => handleToggleDay(dayIndex)}
                      >
                        Enable {dayItem.day}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="schedule-editor-footer">
          <div className="footer-left-info">
            <span className="protection-notice">
              <FaShieldAlt /> Protected: Booked appointments cannot be silently
              overwritten.
            </span>
          </div>

          <div className="footer-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSafeClose}
              disabled={submitting || checkingConflicts}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleInitiateSave}
              disabled={submitting || checkingConflicts}
            >
              {submitting
                ? "Saving Schedule…"
                : checkingConflicts
                  ? "Checking Conflicts…"
                  : "Save Changes"}
            </button>
          </div>
        </div>

        {/* COPY SCHEDULE POPOVER / MODAL */}
        {copySourceDay && (
          <div
            className="modal-backdrop-inner"
            onClick={() => setCopySourceDay(null)}
          >
            <div
              className="copy-schedule-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="copy-dialog-header">
                <h3>
                  <FaCopy /> Copy {copySourceDay.day} Schedule
                </h3>
                <button
                  type="button"
                  className="btn-icon-close"
                  onClick={() => setCopySourceDay(null)}
                >
                  <FaTimes />
                </button>
              </div>
              <p className="copy-dialog-desc">
                Select target days to overwrite with{" "}
                <strong>{copySourceDay.day}'s</strong> sessions (
                {copySourceDay.sessions.length}) and breaks (
                {copySourceDay.breaks.length}):
              </p>

              <div className="copy-targets-grid">
                {DEFAULT_DAYS.filter((d) => d !== copySourceDay.day).map(
                  (d) => (
                    <label key={d} className="copy-target-checkbox">
                      <input
                        type="checkbox"
                        checked={copyTargetDays.includes(d)}
                        onChange={() => handleToggleCopyTarget(d)}
                      />
                      <span>{d}</span>
                    </label>
                  ),
                )}
              </div>

              <div className="copy-dialog-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCopySourceDay(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleApplyCopy}
                  disabled={!copyTargetDays.length}
                >
                  Apply to {copyTargetDays.length} Selected Day(s)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* APPOINTMENT CONFLICT PROTECTION MODAL */}
        {showConflictModal && (
          <div
            className="modal-backdrop-inner"
            onClick={() => setShowConflictModal(false)}
          >
            <div
              className="conflict-protection-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="conflict-dialog-header">
                <div className="conflict-icon-wrap">
                  <FaExclamationTriangle />
                </div>
                <div>
                  <h3>Schedule Change Conflicts with Existing Appointments</h3>
                  <p className="conflict-sub">
                    HealPoint detected <strong>{conflicts.length}</strong>{" "}
                    upcoming booked appointment(s) that conflict with the
                    modified schedule.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-icon-close"
                  onClick={() => setShowConflictModal(false)}
                >
                  <FaTimes />
                </button>
              </div>

              <div className="conflict-dialog-body">
                <div className="conflict-alert-callout">
                  <p>
                    <strong>Protection Policy:</strong> Modifying or disabling
                    operational hours must not silently discard or cancel booked
                    appointments without administrator review. Please review the
                    affected bookings below:
                  </p>
                </div>

                <div className="conflict-appointments-table-wrap">
                  <table className="conflict-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Patient Name</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Conflict Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflicts.map((c, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{c.slotDate}</strong>
                            <span className="cell-time">{c.slotTime}</span>
                          </td>
                          <td>{c.patientName || "Patient"}</td>
                          <td>{c.patientPhone || "N/A"}</td>
                          <td>
                            <span className="badge-status-generic">
                              {c.status}
                            </span>
                          </td>
                          <td className="cell-reason">{c.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="conflict-dialog-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowConflictModal(false)}
                >
                  Go Back & Adjust Hours
                </button>
                <button
                  type="button"
                  className="btn-danger-confirm"
                  onClick={() => executeSave(true)}
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving Overrides…"
                    : "Acknowledge & Confirm Schedule"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Standard Time Options Datalist */}
        <datalist id="standard-times-list">
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Visual Schedule Timeline Subcomponent
// -------------------------------------------------------------
function ScheduleVisualTimeline({ dayItem }) {
  const sessions = dayItem.sessions || [];
  const breaks = dayItem.breaks || [];

  if (!sessions.length) return null;

  // Find day span: min 08:00 AM (480) to max 08:00 PM (1200)
  let earliest = 480;
  let latest = 1200;

  sessions.forEach((s) => {
    const startM = timeToMinutes(s.startTime);
    const endM = timeToMinutes(s.endTime);
    if (startM !== null && startM < earliest)
      earliest = Math.max(0, startM - 60);
    if (endM !== null && endM > latest) latest = Math.min(1440, endM + 60);
  });

  const totalMinutes = latest - earliest;
  if (totalMinutes <= 0) return null;

  return (
    <div className="timeline-container">
      <div className="timeline-header">
        <span className="timeline-label">Visual Schedule Representation:</span>
        <div className="timeline-legend">
          <span className="legend-item consultation">
            <span className="legend-dot" /> Consultation
          </span>
          <span className="legend-item break">
            <span className="legend-dot" /> Break
          </span>
          <span className="legend-item off">
            <span className="legend-dot" /> Gap / Off
          </span>
        </div>
      </div>

      <div className="timeline-track">
        {/* Render Consultation Sessions */}
        {sessions.map((sess, idx) => {
          const sStart = timeToMinutes(sess.startTime);
          const sEnd = timeToMinutes(sess.endTime);
          if (sStart === null || sEnd === null || sStart >= sEnd) return null;

          const left = Math.max(0, ((sStart - earliest) / totalMinutes) * 100);
          const width = Math.min(
            100 - left,
            ((sEnd - sStart) / totalMinutes) * 100,
          );

          return (
            <div
              key={`sess-${idx}`}
              className="timeline-block consultation-block"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${sess.name || "Session"}: ${sess.startTime} - ${sess.endTime}`}
            >
              <span className="block-label" numberOfLines={1}>
                {sess.name || "Consultation"} ({sess.startTime} - {sess.endTime}
                )
              </span>
            </div>
          );
        })}

        {/* Render Breaks as Overlays */}
        {breaks.map((brk, idx) => {
          const bStart = timeToMinutes(brk.startTime);
          const bEnd = timeToMinutes(brk.endTime);
          if (bStart === null || bEnd === null || bStart >= bEnd) return null;

          const left = Math.max(0, ((bStart - earliest) / totalMinutes) * 100);
          const width = Math.min(
            100 - left,
            ((bEnd - bStart) / totalMinutes) * 100,
          );

          return (
            <div
              key={`break-${idx}`}
              className="timeline-block break-block"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${brk.name || "Break"}: ${brk.startTime} - ${brk.endTime}`}
            >
              <span className="block-label break-label" numberOfLines={1}>
                {brk.name || "Break"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Timeline Time Labels */}
      <div className="timeline-ticks">
        <span>08:00 AM</span>
        <span>11:00 AM</span>
        <span>02:00 PM</span>
        <span>05:00 PM</span>
        <span>08:00 PM</span>
      </div>
    </div>
  );
}
