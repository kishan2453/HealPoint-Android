import React, { useState } from "react";
import {
  FaTimes,
  FaExclamationTriangle,
  FaTimesCircle,
  FaCalendarAlt,
  FaUserInjured,
  FaUserMd,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

export default function CancelAppointmentModal({
  appointment,
  onClose,
  onCancelled,
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!appointment) return null;

  const handleCancel = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for cancelling this appointment.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const res = await api.post(
        `/api/v1/hospital-admin/appointments/${appointment._id}/cancel`,
        { reason: reason.trim() },
      );
      toast.success(res.data?.message || "Appointment cancelled successfully");
      onCancelled();
      onClose();
    } catch (err) {
      console.error("Cancel appointment error:", err);
      const msg =
        err.response?.data?.message || "Unable to cancel appointment.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal cancel-appointment-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "520px", width: "95%" }}
      >
        <div
          className="delete-doctor-icon"
          style={{ background: "#fef2f2", color: "#ef4444" }}
        >
          <FaExclamationTriangle />
        </div>

        <h2 style={{ textAlign: "center", margin: "10px 0 4px 0" }}>
          Cancel Appointment
        </h2>
        <p className="modal-subtitle" style={{ textAlign: "center" }}>
          This will revoke the appointment slot and notify the patient.
        </p>

        <div className="reschedule-current-box" style={{ margin: "16px 0" }}>
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
            Scheduled Slot:{" "}
            <strong>
              {appointment.slotDate} · {appointment.slotTime}
            </strong>
          </div>
        </div>

        {error && (
          <div className="form-error-banner" style={{ margin: "12px 0" }}>
            <FaExclamationTriangle /> {error}
          </div>
        )}

        <form onSubmit={handleCancel}>
          <div className="form-group-premier">
            <label htmlFor="cancel-reason">
              Cancellation Reason <span className="req-star">*</span>
            </label>
            <textarea
              id="cancel-reason"
              className="premier-textarea"
              rows={3}
              placeholder="e.g. Doctor had to attend an emergency surgery / Patient requested cancellation / Inclement weather"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              required
            />
          </div>

          <div className="modal-actions-premier" style={{ marginTop: "20px" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Keep Appointment
            </button>
            <button
              type="submit"
              className="btn-danger-confirm"
              disabled={saving}
            >
              <FaTimesCircle />{" "}
              {saving ? "Cancelling…" : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
