import React, { useState } from "react";
import {
  FaTimes,
  FaCalendarCheck,
  FaClock,
  FaPlus,
  FaTrash,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSave,
  FaSearch,
  FaBan,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

export default function DoctorOverrideModal({
  doctor,
  initialDate,
  onClose,
  onSaved,
}) {
  if (!doctor) return null;

  // Format today as YYYY-MM-DD
  const todayIso = new Date().toISOString().split("T")[0];
  const initialIso = initialDate
    ? (() => {
        const [d, m, y] = initialDate.split("-");
        return `${y}-${m}-${d}`;
      })()
    : todayIso;

  const [dateIso, setDateIso] = useState(initialIso);
  const [isClosed, setIsClosed] = useState(false);
  const [reason, setReason] = useState("");
  const [sessions, setSessions] = useState([
    { name: "Special OPD Session", startTime: "10:00 AM", endTime: "02:00 PM" },
  ]);
  const [breaks, setBreaks] = useState([]);

  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflictResult, setConflictResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // Convert YYYY-MM-DD to DD-MM-YYYY
  const isoToSlotDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  };

  const formattedDate = isoToSlotDate(dateIso);

  // Sessions handlers
  const handleAddSession = () => {
    setSessions((prev) => [
      ...prev,
      {
        name: `Session ${prev.length + 1}`,
        startTime: "03:00 PM",
        endTime: "07:00 PM",
      },
    ]);
    setConflictResult(null);
  };

  const handleUpdateSession = (index, field, value) => {
    setSessions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
    setConflictResult(null);
  };

  const handleRemoveSession = (index) => {
    setSessions((prev) => prev.filter((_, i) => i !== index));
    setConflictResult(null);
  };

  // Breaks handlers
  const handleAddBreak = () => {
    setBreaks((prev) => [
      ...prev,
      {
        name: `Break ${prev.length + 1}`,
        startTime: "01:00 PM",
        endTime: "01:30 PM",
      },
    ]);
    setConflictResult(null);
  };

  const handleUpdateBreak = (index, field, value) => {
    setBreaks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    );
    setConflictResult(null);
  };

  const handleRemoveBreak = (index) => {
    setBreaks((prev) => prev.filter((_, i) => i !== index));
    setConflictResult(null);
  };

  // Conflict Check
  const handleCheckConflicts = async () => {
    try {
      setCheckingConflicts(true);
      const res = await api.post(
        `/api/v1/hospital-admin/scheduling/doctor/${doctor._id}/override/check-conflicts`,
        {
          date: formattedDate,
          isClosed,
          sessions: isClosed ? [] : sessions,
          breaks: isClosed ? [] : breaks,
          reason,
        },
      );

      if (res.data.success) {
        setConflictResult(res.data);
        if (res.data.hasConflict) {
          toast.warning(
            `${res.data.count} booked appointment(s) conflict with this override! Review preview below.`,
          );
        } else {
          toast.success("✓ No appointment conflicts detected. Safe to apply.");
        }
      }
    } catch (err) {
      console.error("Override conflict check error:", err);
      toast.error(
        err.response?.data?.message || "Failed to check appointment conflicts",
      );
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Save Override
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!formattedDate) {
      toast.error("Please select a valid date");
      return;
    }

    if (!isClosed && sessions.length === 0) {
      toast.error(
        "Please add at least one working session or mark the date closed",
      );
      return;
    }

    try {
      setSaving(true);
      const res = await api.post(
        `/api/v1/hospital-admin/scheduling/doctor/${doctor._id}/override`,
        {
          date: formattedDate,
          isClosed,
          sessions: isClosed ? [] : sessions,
          breaks: isClosed ? [] : breaks,
          reason:
            reason.trim() ||
            (isClosed ? "Marked Closed by Hospital" : "Special Schedule"),
          acknowledgeConflict: conflictResult?.hasConflict || false,
        },
      );

      if (res.data.success) {
        toast.success(
          `Date-specific override saved for ${formattedDate}. Patient availability updated.`,
        );
        if (onSaved) onSaved();
        onClose();
      }
    } catch (err) {
      console.error("Save override error:", err);
      if (err.response?.status === 409 && err.response?.data?.conflicts) {
        setConflictResult({
          hasConflict: true,
          conflicts: err.response.data.conflicts,
          count: err.response.data.conflicts.length,
        });
        toast.error(
          err.response.data.message ||
            "Conflict detected with booked appointments.",
        );
      } else {
        toast.error(
          err.response?.data?.message || "Failed to save date override",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal doctor-override-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="override-modal-title"
      >
        <div className="doctor-calendar-header">
          <div className="doctor-calendar-profile">
            <span className="doctor-cal-avatar-fallback">
              <FaCalendarCheck />
            </span>
            <div>
              <div className="doctor-cal-name-row">
                <h2 id="override-modal-title">
                  Date-Specific Schedule Override
                </h2>
                <span className="doctor-cal-speciality-pill">
                  {doctor.speciality || "Specialist"}
                </span>
              </div>
              <p className="doctor-cal-subtext">
                {formatDoctorName(doctor.name)} · Override weekly schedule for a
                single date
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="override-modal-form">
          <div className="override-form-body">
            {/* 1. Date and Mode Selector */}
            <div className="override-top-row">
              <div className="form-group">
                <label>Target Date for Override</label>
                <input
                  type="date"
                  value={dateIso}
                  min={todayIso}
                  onChange={(e) => {
                    setDateIso(e.target.value);
                    setConflictResult(null);
                  }}
                  required
                />
                <small className="form-hint">Selected: {formattedDate}</small>
              </div>

              <div className="override-mode-toggle-group">
                <label>Date Status</label>
                <div className="override-mode-buttons">
                  <button
                    type="button"
                    className={`mode-btn ${!isClosed ? "active working" : ""}`}
                    onClick={() => {
                      setIsClosed(false);
                      setConflictResult(null);
                    }}
                  >
                    <FaClock /> Custom Working Hours (e.g. Sunday OPD)
                  </button>
                  <button
                    type="button"
                    className={`mode-btn ${isClosed ? "active closed" : ""}`}
                    onClick={() => {
                      setIsClosed(true);
                      setConflictResult(null);
                    }}
                  >
                    <FaBan /> Mark Date Fully Closed
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Reason Input */}
            <div className="form-group full-width">
              <label>Reason / Note for Override</label>
              <input
                type="text"
                placeholder={
                  isClosed
                    ? "e.g. Hospital Clinic Renovation / Doctor Attending Seminar"
                    : "e.g. Sunday Special Cardiac Health Camp / Emergency OPD Shift"
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            {/* 3. Sessions and Breaks (if custom working day) */}
            {!isClosed && (
              <div className="override-sessions-section">
                {/* Working Sessions */}
                <div className="sessions-sub-block">
                  <div className="section-head-row">
                    <h4>
                      <FaClock /> Working Consultation Sessions
                    </h4>
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={handleAddSession}
                    >
                      <FaPlus /> Add Session
                    </button>
                  </div>

                  <div className="sessions-list">
                    {sessions.map((sess, idx) => (
                      <div className="session-edit-card" key={idx}>
                        <input
                          type="text"
                          className="session-name-input"
                          placeholder="Session Name"
                          value={sess.name}
                          onChange={(e) =>
                            handleUpdateSession(idx, "name", e.target.value)
                          }
                        />
                        <div className="session-time-fields">
                          <input
                            type="text"
                            placeholder="Start (09:00 AM)"
                            value={sess.startTime}
                            onChange={(e) =>
                              handleUpdateSession(
                                idx,
                                "startTime",
                                e.target.value,
                              )
                            }
                            required
                          />
                          <span>to</span>
                          <input
                            type="text"
                            placeholder="End (01:00 PM)"
                            value={sess.endTime}
                            onChange={(e) =>
                              handleUpdateSession(
                                idx,
                                "endTime",
                                e.target.value,
                              )
                            }
                            required
                          />
                        </div>
                        {sessions.length > 1 && (
                          <button
                            type="button"
                            className="btn-trash-icon"
                            onClick={() => handleRemoveSession(idx)}
                            title="Remove Session"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Breaks */}
                <div className="breaks-sub-block">
                  <div className="section-head-row">
                    <h4>Break Intervals (Optional)</h4>
                    <button
                      type="button"
                      className="btn-text-action"
                      onClick={handleAddBreak}
                    >
                      <FaPlus /> Add Break
                    </button>
                  </div>

                  {breaks.length === 0 ? (
                    <p className="no-breaks-hint">
                      No breaks configured for this date.
                    </p>
                  ) : (
                    <div className="breaks-list">
                      {breaks.map((b, idx) => (
                        <div className="break-edit-card" key={idx}>
                          <input
                            type="text"
                            className="break-name-input"
                            placeholder="Break Name"
                            value={b.name}
                            onChange={(e) =>
                              handleUpdateBreak(idx, "name", e.target.value)
                            }
                          />
                          <div className="session-time-fields">
                            <input
                              type="text"
                              placeholder="Start"
                              value={b.startTime}
                              onChange={(e) =>
                                handleUpdateBreak(
                                  idx,
                                  "startTime",
                                  e.target.value,
                                )
                              }
                              required
                            />
                            <span>to</span>
                            <input
                              type="text"
                              placeholder="End"
                              value={b.endTime}
                              onChange={(e) =>
                                handleUpdateBreak(
                                  idx,
                                  "endTime",
                                  e.target.value,
                                )
                              }
                              required
                            />
                          </div>
                          <button
                            type="button"
                            className="btn-trash-icon"
                            onClick={() => handleRemoveBreak(idx)}
                            title="Remove Break"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Conflict Checking Section */}
            <div className="leave-conflict-check-section">
              <div className="conflict-check-head">
                <button
                  type="button"
                  className="btn-outline-action"
                  onClick={handleCheckConflicts}
                  disabled={checkingConflicts}
                >
                  <FaSearch />{" "}
                  {checkingConflicts
                    ? "Checking Booked Appointments…"
                    : "Check Appointment Conflicts"}
                </button>
                <span className="conflict-tip">
                  HealPoint detects if booked patients fall outside proposed
                  hours.
                </span>
              </div>

              {conflictResult && (
                <div
                  className={`conflict-result-alert ${
                    conflictResult.hasConflict ? "has-conflict" : "safe"
                  }`}
                >
                  {conflictResult.hasConflict ? (
                    <div>
                      <div className="conflict-alert-title">
                        <FaExclamationTriangle />
                        <strong>
                          {conflictResult.count} Booked Appointment(s) Conflict
                          with this Override!
                        </strong>
                      </div>
                      <p className="conflict-alert-desc">
                        These patient appointments fall outside the new schedule
                        or into a closed time. Review before saving:
                      </p>
                      <div className="conflict-appointments-preview">
                        {conflictResult.conflicts.map((c, i) => (
                          <div className="conflict-item" key={i}>
                            <strong>{c.slotTime}</strong> ·{" "}
                            <span>{c.patientName}</span> ({c.patientPhone}) ·{" "}
                            <span className="conflict-reason">{c.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="conflict-alert-title safe">
                      <FaCheckCircle />
                      <strong>
                        0 Appointment Conflicts! No existing bookings will be
                        displaced.
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="leave-modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn-primary ${
                conflictResult?.hasConflict ? "btn-warning-action" : ""
              }`}
              disabled={saving || checkingConflicts}
            >
              <FaSave />{" "}
              {saving
                ? "Saving Override…"
                : conflictResult?.hasConflict
                  ? "Acknowledge & Save Override"
                  : "Save Date-Specific Override"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
