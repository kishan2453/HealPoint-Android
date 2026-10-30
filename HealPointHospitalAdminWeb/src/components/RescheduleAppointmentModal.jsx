import React, { useState } from "react";
import {
  FaTimes,
  FaCalendarAlt,
  FaClock,
  FaUserMd,
  FaUserInjured,
  FaExclamationTriangle,
  FaSave,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

const PRESET_TIME_SLOTS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
  "05:00 PM",
  "05:30 PM",
  "06:00 PM",
];

const toInputDate = (slotDate = "") => {
  if (!slotDate) return "";
  const parts = slotDate.split("-");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month}-${day}`;
  }
  return slotDate;
};

const toSlotDate = (inputDate = "") => {
  if (!inputDate) return "";
  const [year, month, day] = inputDate.split("-");
  return `${day}-${month}-${year}`;
};

export default function RescheduleAppointmentModal({
  appointment,
  onClose,
  onRescheduled,
}) {
  const [newDate, setNewDate] = useState(toInputDate(appointment.slotDate));
  const [newTime, setNewTime] = useState(appointment.slotTime || "09:00 AM");
  const [customTime, setCustomTime] = useState("");
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!appointment) return null;

  const todayStr = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDate) {
      setError("Please select a valid new appointment date.");
      return;
    }

    const selectedTime = useCustomTime ? customTime.trim() : newTime.trim();
    if (!selectedTime) {
      setError("Please select or enter a valid time slot.");
      return;
    }

    const formattedDate = toSlotDate(newDate);

    try {
      setSaving(true);
      setError("");
      const res = await api.post(
        `/api/v1/hospital-admin/appointments/${appointment._id}/reschedule`,
        {
          slotDate: formattedDate,
          slotTime: selectedTime,
          reason: reason.trim() || "Rescheduled by Hospital Admin",
        },
      );
      toast.success(
        res.data?.message || "Appointment rescheduled successfully",
      );
      onRescheduled();
      onClose();
    } catch (err) {
      console.error("Reschedule error:", err);
      const msg =
        err.response?.data?.message ||
        "Unable to reschedule appointment. Please check for doctor slot conflicts.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal reschedule-appointment-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "560px", width: "95%" }}
      >
        <div className="modal-header-with-actions">
          <div className="modal-title-wrap">
            <span className="modal-badge-ico purple">
              <FaCalendarAlt />
            </span>
            <div>
              <h2>Reschedule Appointment Slot</h2>
              <p className="modal-subtitle">
                Reassign patient to an alternate date or time slot
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        {/* Current Booking Overview */}
        <div className="reschedule-current-box">
          <div className="current-stakeholder-row">
            <span>
              Patient: <strong>{appointment.userId?.name || "Patient"}</strong>
            </span>
            <span>
              Doctor:{" "}
              <strong>
                {formatDoctorName(appointment.doctorId?.name, "Doctor")}
              </strong>
            </span>
          </div>
          <div className="current-slot-tag">
            Current Slot:{" "}
            <strong>
              {appointment.slotDate} · {appointment.slotTime}
            </strong>
          </div>
        </div>

        {error && (
          <div className="form-error-banner" style={{ margin: "14px 0" }}>
            <FaExclamationTriangle /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="reschedule-form">
          <div className="form-group-premier">
            <label htmlFor="new-date">
              New Appointment Date <span className="req-star">*</span>
            </label>
            <input
              id="new-date"
              type="date"
              className="premier-input"
              min={todayStr}
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                if (error) setError("");
              }}
              required
            />
          </div>

          <div className="form-group-premier">
            <div className="label-with-action-row">
              <label>
                Select Time Slot <span className="req-star">*</span>
              </label>
              <button
                type="button"
                className="btn-toggle-custom"
                onClick={() => setUseCustomTime(!useCustomTime)}
              >
                {useCustomTime ? "Use Standard Slots" : "Enter Custom Time"}
              </button>
            </div>

            {useCustomTime ? (
              <input
                type="text"
                className="premier-input"
                placeholder="e.g. 11:15 AM or 04:45 PM"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                required
              />
            ) : (
              <div className="time-slots-picker-grid">
                {PRESET_TIME_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={`time-slot-chip ${newTime === slot ? "selected" : ""}`}
                    onClick={() => {
                      setNewTime(slot);
                      if (error) setError("");
                    }}
                  >
                    <FaClock className="slot-ico" /> {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group-premier">
            <label htmlFor="reschedule-reason">Reason for Rescheduling</label>
            <input
              id="reschedule-reason"
              type="text"
              className="premier-input"
              placeholder="e.g. Doctor emergency surgery / Patient requested later slot"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="modal-actions-premier" style={{ marginTop: "20px" }}>
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
              className="btn-primary-action"
              disabled={saving}
            >
              <FaSave /> {saving ? "Rescheduling…" : "Confirm Reschedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
