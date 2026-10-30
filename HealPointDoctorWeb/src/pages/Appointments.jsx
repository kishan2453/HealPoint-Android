import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

// Parse "HH:MM AM/PM" into minutes since midnight (null when invalid).
const parseTime = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
};

const formatTime = (minutes) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const dateToWeekday = (slotDate) => {
  const [day, month, year] = String(slotDate || "")
    .split("-")
    .map(Number);
  if (!day || !month || !year) return "";
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
};

// Generate the doctor's available slots for a date based on their stored
// schedule. Already-booked slots are excluded, and past slots are removed when
// the chosen date is today.
const buildAvailableSlots = ({
  doctor,
  slotDate,
  slotDuration,
  booked = [],
}) => {
  if (!doctor) return [];
  const weekday = dateToWeekday(slotDate);
  const daySchedule = (doctor.weeklySchedule || []).find(
    (item) => String(item.day).toLowerCase() === weekday.toLowerCase(),
  );
  if (daySchedule && daySchedule.enabled === false) return [];

  let startTime = "09:00 AM";
  let endTime = "05:00 PM";
  if (daySchedule) {
    startTime = daySchedule.startTime || startTime;
    endTime = daySchedule.endTime || endTime;
  } else if (doctor.availabilitySchedule) {
    const match = String(doctor.availabilitySchedule).match(
      /(\d{1,2}:\d{2}\s?[AP]M)\s*-\s*(\d{1,2}:\d{2}\s?[AP]M)/i,
    );
    if (match) {
      startTime = match[1];
      endTime = match[2];
    }
  }

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start == null || end == null || end <= start) return [];

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const isToday = slotDate === todayStr;

  const slots = [];
  let cursor = start;
  while (cursor < end) {
    if (!isToday || cursor > nowMinutes) {
      const time = formatTime(cursor);
      if (!booked.includes(time)) slots.push(time);
    }
    cursor += Number(slotDuration) || 30;
  }
  return slots;
};

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { id, status, label }
  const [reason, setReason] = useState("");
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [availableSlots, setAvailableSlots] = useState([]);
  const [saving, setSaving] = useState(false);
  const query = useQuery();
  const filter = query.get("filter") || "";
  const stored = JSON.parse(localStorage.getItem("doctorApp") || "null");
  const doctorId = stored?.doctor?._id;
  const doctor = stored?.doctor;
  const navigate = useNavigate();

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/v1/doctor/panel/${doctorId}`);
      const dashboard = res.data.dashboard || {};
      const source =
        filter === "today"
          ? dashboard.todayAppointments
          : filter === "upcoming"
            ? dashboard.upcomingAppointments
            : filter === "pending"
              ? dashboard.pendingAppointments
              : dashboard.allAppointments;
      setAppointments(source || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, doctorId]);

  // Regenerate available slots whenever the reschedule date changes.
  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate) {
      setAvailableSlots([]);
      return;
    }
    const bookedForDate = appointments
      .filter(
        (a) =>
          String(a.slotDate) === rescheduleDate &&
          a._id !== rescheduleTarget._id &&
          ["pending", "confirmed", "rescheduled"].includes(a.status),
      )
      .map((a) => a.slotTime);
    const slots = buildAvailableSlots({
      doctor,
      slotDate: rescheduleDate,
      slotDuration: doctor?.slotDurationMinutes || 30,
      booked: bookedForDate,
    });
    setAvailableSlots(slots);
    setRescheduleTime("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescheduleDate, rescheduleTarget]);

  const requireReason = (status) => ["cancel", "rejected"].includes(status);

  const openAction = (appointment, status, label) => {
    if (status === "rescheduled") {
      setRescheduleTarget(appointment);
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleReason("");
      setAvailableSlots([]);
      return;
    }
    setConfirmAction({ id: appointment._id, status, label });
    setReason("");
  };

  const confirmStatus = async () => {
    if (!confirmAction) return;
    setSaving(true);
    try {
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/appointment/${confirmAction.id}/status`,
        { status: confirmAction.status, reason: reason || "" },
      );
      toast.success(res.data.message || "Updated");
      setConfirmAction(null);
      setReason("");
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleTarget) return;
    if (!rescheduleDate || !rescheduleTime) {
      toast.error("Please select a date and time for the new appointment.");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/appointment/${rescheduleTarget._id}/reschedule`,
        {
          slotDate: rescheduleDate,
          slotTime: rescheduleTime,
          reason: rescheduleReason || "",
        },
      );
      toast.success(res.data.message || "Appointment rescheduled");
      setRescheduleTarget(null);
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleReason("");
      setAvailableSlots([]);
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="appointments-page">
      <h2>Appointments {filter ? `- ${filter}` : ""}</h2>
      {filter === "today" && appointments.length > 0 && (
        <div
          style={{
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 12,
            color: "#166534",
            fontWeight: 600,
          }}
        >
          🏥 Today's Patient Arrivals:{" "}
          <strong>{appointments.filter((a) => a.checkedIn).length}</strong> of{" "}
          <strong>{appointments.length}</strong> patients checked in at the
          hospital
        </div>
      )}
      {loading && <div>Loading...</div>}
      {error && <div className="error">{error}</div>}
      {!loading && !appointments.length && <div>No appointments found</div>}
      <ul>
        {appointments.map((a) => (
          <li
            key={a._id}
            style={{ border: "1px solid #ddd", margin: 8, padding: 8 }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <strong>{a.userId?.name || "Patient"}</strong> - {a.slotDate}{" "}
                {a.slotTime}
              </div>
              {a.checkedIn ? (
                <span
                  style={{
                    backgroundColor: "#ecfdf5",
                    color: "#059669",
                    border: "1px solid #a7f3d0",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                  }}
                >
                  ✓ Arrived (Token: {a.queueToken || "A-001"})
                </span>
              ) : a.status === "confirmed" ? (
                <span
                  style={{
                    backgroundColor: "#fef3c7",
                    color: "#b45309",
                    border: "1px solid #fde68a",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  Expected on arrival
                </span>
              ) : null}
            </div>
            <div>Status: {a.status}</div>
            <div>Amount: {a.amount || 0}</div>
            <div style={{ marginTop: 8 }}>
              <Link to={`/appointments/${a._id}`}>Details</Link>
              {" | "}
              {a.userId?._id && (
                <button onClick={() => navigate(`/patients/${a.userId._id}`)}>
                  Patient Profile
                </button>
              )}{" "}
              {" | "}
              {a.status !== "confirmed" && (
                <button
                  onClick={() =>
                    openAction(a, "confirmed", "accept this appointment")
                  }
                >
                  Accept
                </button>
              )}{" "}
              {a.status !== "cancel" && (
                <button
                  onClick={() =>
                    openAction(a, "rejected", "reject this appointment")
                  }
                >
                  Reject
                </button>
              )}{" "}
              {a.status !== "cancel" && (
                <button
                  onClick={() =>
                    openAction(a, "cancel", "cancel this appointment")
                  }
                >
                  Cancel
                </button>
              )}{" "}
              <button
                onClick={() =>
                  openAction(a, "rescheduled", "reschedule this appointment")
                }
              >
                Reschedule
              </button>{" "}
              {a.status !== "completed" && (
                <button
                  onClick={() =>
                    openAction(a, "completed", "complete this appointment")
                  }
                >
                  Complete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Status confirmation modal */}
      {confirmAction && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setConfirmAction(null)}
        >
          <div
            className="detail-modal"
            style={{ maxWidth: 460 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3>Confirm {confirmAction.label}?</h3>
            <p style={{ marginBottom: 12 }}>
              This will update the appointment status.
            </p>
            {requireReason(confirmAction.status) && (
              <label className="form-label">
                Reason
                <textarea
                  rows={3}
                  placeholder="Optional reason (shown to the patient)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <div className="button-row">
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={confirmStatus}
              >
                {saving ? "Updating..." : "Confirm"}
              </button>
              <button
                className="btn btn-light"
                onClick={() => setConfirmAction(null)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule modal with slot selection */}
      {rescheduleTarget && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setRescheduleTarget(null)}
        >
          <div
            className="detail-modal reschedule-form"
            style={{ maxWidth: 560 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3>Reschedule Appointment</h3>
            <p style={{ marginBottom: 12 }}>
              Current slot:{" "}
              <strong>
                {rescheduleTarget.slotDate} at {rescheduleTarget.slotTime}
              </strong>
            </p>
            <label className="form-label">
              New date (DD-MM-YYYY)
              <input
                type="text"
                placeholder="e.g. 20-08-2026"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </label>

            {availableSlots.length > 0 && (
              <div style={{ margin: "10px 0" }}>
                <span
                  className="form-label"
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Available slots
                </span>
                <div className="slot-grid clean-slot-grid">
                  {availableSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      className={
                        rescheduleTime === slot
                          ? "slot-chip selected"
                          : "slot-chip"
                      }
                      onClick={() => setRescheduleTime(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {rescheduleDate && availableSlots.length === 0 && (
              <p style={{ color: "#b91c1c", margin: "8px 0" }}>
                No available slots for this date. Please pick another date.
              </p>
            )}

            <label className="form-label">
              Reason (optional)
              <textarea
                rows={2}
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
              />
            </label>

            <div className="button-row">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={confirmReschedule}
              >
                {saving ? "Rescheduling..." : "Confirm Reschedule"}
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setRescheduleTarget(null)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
