import React, { useState } from "react";
import {
  FaTimes,
  FaBed,
  FaCalendarAlt,
  FaClock,
  FaExclamationTriangle,
  FaCheckCircle,
  FaSave,
  FaSearch,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

export default function DoctorLeaveModal({
  doctor,
  initialDate,
  onClose,
  onSaved,
}) {
  if (!doctor) return null;

  // Format today as YYYY-MM-DD for native date input
  const todayIso = new Date().toISOString().split("T")[0];
  const initialIso = initialDate
    ? (() => {
        const [d, m, y] = initialDate.split("-");
        return `${y}-${m}-${d}`;
      })()
    : todayIso;

  const [leaveType, setLeaveType] = useState("full_day"); // full_day, multi_day, partial_day
  const [startDateIso, setStartDateIso] = useState(initialIso);
  const [endDateIso, setEndDateIso] = useState(initialIso);
  const [startTime, setStartTime] = useState("02:00 PM");
  const [endTime, setEndTime] = useState("06:00 PM");
  const [reason, setReason] = useState("");

  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflictResult, setConflictResult] = useState(null);
  const [saving, setSaving] = useState(false);

  // Convert YYYY-MM-DD to DD-MM-YYYY
  const isoToSlotDate = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  };

  const startDateFormatted = isoToSlotDate(startDateIso);
  const endDateFormatted =
    leaveType === "multi_day" ? isoToSlotDate(endDateIso) : startDateFormatted;

  // Check appointment conflicts before saving
  const handleCheckConflicts = async () => {
    try {
      setCheckingConflicts(true);
      const res = await api.post(
        `/api/v1/hospital-admin/scheduling/doctor/${doctor._id}/leave/check-conflicts`,
        {
          leaveType,
          startDate: startDateFormatted,
          endDate: endDateFormatted,
          startTime: leaveType === "partial_day" ? startTime : undefined,
          endTime: leaveType === "partial_day" ? endTime : undefined,
          reason,
        },
      );

      if (res.data.success) {
        setConflictResult(res.data);
        if (res.data.hasConflict) {
          toast.warning(
            `${res.data.count} booked appointment(s) conflict with this leave! Review preview below.`,
          );
        } else {
          toast.success("✓ No appointment conflicts detected. Safe to apply.");
        }
      }
    } catch (err) {
      console.error("Conflict check error:", err);
      toast.error(
        err.response?.data?.message || "Failed to check appointment conflicts",
      );
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Submit Leave
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!startDateFormatted) {
      toast.error("Please select a valid date");
      return;
    }

    try {
      setSaving(true);
      const res = await api.post(
        `/api/v1/hospital-admin/scheduling/doctor/${doctor._id}/leave`,
        {
          leaveType,
          startDate: startDateFormatted,
          endDate: endDateFormatted,
          startTime: leaveType === "partial_day" ? startTime : undefined,
          endTime: leaveType === "partial_day" ? endTime : undefined,
          reason: reason.trim() || "Personal Leave",
          acknowledgeConflict: conflictResult?.hasConflict || false,
        },
      );

      if (res.data.success) {
        toast.success(
          `Leave created successfully for ${formatDoctorName(doctor.name)}. Availability recalculated.`,
        );
        if (onSaved) onSaved();
        onClose();
      }
    } catch (err) {
      console.error("Save leave error:", err);
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
          err.response?.data?.message || "Failed to schedule doctor leave",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal doctor-leave-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="leave-modal-title"
      >
        <div className="doctor-calendar-header">
          <div className="doctor-calendar-profile">
            <span className="doctor-cal-avatar-fallback">
              <FaBed />
            </span>
            <div>
              <div className="doctor-cal-name-row">
                <h2 id="leave-modal-title">Schedule Doctor Leave</h2>
                <span className="doctor-cal-speciality-pill">
                  {doctor.speciality || "Specialist"}
                </span>
              </div>
              <p className="doctor-cal-subtext">
                {formatDoctorName(doctor.name)} ·{" "}
                {doctor.department || "OPD Wing"}
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

        <form onSubmit={handleSubmit} className="leave-modal-form">
          <div className="leave-form-body">
            {/* 1. Leave Type Selector */}
            <div className="leave-type-cards">
              <button
                type="button"
                className={`leave-type-card ${leaveType === "full_day" ? "selected" : ""}`}
                onClick={() => {
                  setLeaveType("full_day");
                  setConflictResult(null);
                }}
              >
                <FaCalendarAlt className="type-icon" />
                <strong>Full-Day Leave</strong>
                <span>Entire day unavailable</span>
              </button>

              <button
                type="button"
                className={`leave-type-card ${leaveType === "multi_day" ? "selected" : ""}`}
                onClick={() => {
                  setLeaveType("multi_day");
                  setConflictResult(null);
                }}
              >
                <FaCalendarAlt className="type-icon" />
                <strong>Multi-Day Leave</strong>
                <span>Consecutive dates range</span>
              </button>

              <button
                type="button"
                className={`leave-type-card ${leaveType === "partial_day" ? "selected" : ""}`}
                onClick={() => {
                  setLeaveType("partial_day");
                  setConflictResult(null);
                }}
              >
                <FaClock className="type-icon" />
                <strong>Partial-Day Leave</strong>
                <span>Specific time window only</span>
              </button>
            </div>

            {/* 2. Date & Time Inputs */}
            <div className="leave-inputs-grid">
              <div className="form-group">
                <label>
                  {leaveType === "multi_day" ? "Start Date" : "Leave Date"}
                </label>
                <input
                  type="date"
                  value={startDateIso}
                  min={todayIso}
                  onChange={(e) => {
                    setStartDateIso(e.target.value);
                    if (leaveType !== "multi_day") {
                      setEndDateIso(e.target.value);
                    }
                    setConflictResult(null);
                  }}
                  required
                />
                <small className="form-hint">
                  Selected: {startDateFormatted}
                </small>
              </div>

              {leaveType === "multi_day" && (
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={endDateIso}
                    min={startDateIso || todayIso}
                    onChange={(e) => {
                      setEndDateIso(e.target.value);
                      setConflictResult(null);
                    }}
                    required
                  />
                  <small className="form-hint">
                    Selected: {endDateFormatted}
                  </small>
                </div>
              )}

              {leaveType === "partial_day" && (
                <>
                  <div className="form-group">
                    <label>Leave Start Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 02:00 PM"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        setConflictResult(null);
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Leave End Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 06:00 PM"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        setConflictResult(null);
                      }}
                      required
                    />
                  </div>
                </>
              )}
            </div>

            {/* 3. Reason Field */}
            <div className="form-group full-width">
              <label>Reason for Leave</label>
              <input
                type="text"
                placeholder="e.g. Attending Annual Cardiology Conference / Personal Emergency"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            {/* 4. Conflict Check & Review Box */}
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
                  HealPoint protects booked patients from silent cancellation.
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
                          with this Leave!
                        </strong>
                      </div>
                      <p className="conflict-alert-desc">
                        Applying this leave will close hours with active patient
                        bookings. Review affected patients below before
                        proceeding:
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
                ? "Saving Leave…"
                : conflictResult?.hasConflict
                  ? "Acknowledge & Confirm Leave"
                  : "Confirm & Schedule Leave"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
