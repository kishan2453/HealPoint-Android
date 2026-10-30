import React, { useState } from "react";
import {
  FaTimes,
  FaCalendarCheck,
  FaPlus,
  FaTrash,
  FaMagic,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

export default function DoctorSlotsModal({ doctor, onClose, onUpdated }) {
  if (!doctor) return null;

  const [slotDurationMinutes, setSlotDurationMinutes] = useState(
    doctor.slotDurationMinutes || 30,
  );
  const [timeSlots, setTimeSlots] = useState(doctor.timeSlots || []);
  const [newSlotInput, setNewSlotInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddCustomSlot = (e) => {
    e?.preventDefault();
    const trimmed = newSlotInput.trim().toUpperCase();
    if (!trimmed) return;
    if (timeSlots.includes(trimmed)) {
      toast.warning("This slot already exists");
      return;
    }
    setTimeSlots((prev) => [...prev, trimmed]);
    setNewSlotInput("");
  };

  const handleRemoveSlot = (slotToRemove) => {
    setTimeSlots((prev) => prev.filter((s) => s !== slotToRemove));
  };

  const handleGenerateStandardSlots = () => {
    // Generate slots from 09:00 AM to 05:00 PM based on slot duration
    const generated = [];
    const duration = Number(slotDurationMinutes) || 30;

    // Morning Session: 09:00 AM to 01:00 PM (540 to 780 mins)
    for (let m = 540; m < 780; m += duration) {
      const hh = Math.floor(m / 60);
      const mm = m % 60;
      const formatted = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} AM`;
      generated.push(formatted);
    }

    // Afternoon Session: 02:00 PM to 05:00 PM (840 to 1020 mins)
    for (let m = 840; m < 1020; m += duration) {
      const hh = Math.floor(m / 60) - 12;
      const mm = m % 60;
      const formatted = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} PM`;
      generated.push(formatted);
    }

    setTimeSlots(generated);
    toast.info(
      `Generated ${generated.length} slots for ${duration} min intervals`,
    );
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      await api.put(`/api/v1/hospital-admin/doctors/${doctor._id}/slots`, {
        slotDurationMinutes: Number(slotDurationMinutes),
        timeSlots,
      });

      toast.success(`Slots updated for ${formatDoctorName(doctor.name)}`);
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update slots");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal doctor-slots-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="slots-modal-title"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        <div className="doctor-form-header">
          <span className="doctor-form-icon">
            <FaCalendarCheck />
          </span>
          <div>
            <h2 id="slots-modal-title">OPD Appointment Slots</h2>
            <p>
              Configure appointment slot duration and active booking windows for{" "}
              <strong>{formatDoctorName(doctor.name)}</strong>
            </p>
          </div>
        </div>

        <div className="schedule-modal-body">
          {/* Duration Selector & Auto Generator */}
          <div className="slots-config-card">
            <div className="slot-duration-group">
              <label>Consultation Duration per Patient</label>
              <select
                value={slotDurationMinutes}
                onChange={(e) => setSlotDurationMinutes(Number(e.target.value))}
                className="filter-select"
              >
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes (Recommended)</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-outline-action"
              onClick={handleGenerateStandardSlots}
              title="Auto-generate standard OPD slots based on selected duration"
            >
              <FaMagic /> Auto-Generate Daily Slots
            </button>
          </div>

          {/* Add custom slot input */}
          <form onSubmit={handleAddCustomSlot} className="add-slot-form">
            <input
              type="text"
              value={newSlotInput}
              onChange={(e) => setNewSlotInput(e.target.value)}
              placeholder="e.g. 10:30 AM or 04:15 PM"
              className="slot-input-field"
            />
            <button type="submit" className="btn-add-slot">
              <FaPlus /> Add Slot
            </button>
          </form>

          {/* Slots List */}
          <div className="slots-list-section">
            <div className="section-header-flex">
              <span className="schedule-section-label">
                Configured Slots ({timeSlots.length})
              </span>
              {timeSlots.length > 0 && (
                <button
                  type="button"
                  className="btn-link-danger"
                  onClick={() => setTimeSlots([])}
                >
                  Clear All
                </button>
              )}
            </div>

            {timeSlots.length === 0 ? (
              <div className="empty-slots-box">
                <p>No specific slots configured yet.</p>
                <span>
                  Click <strong>"Auto-Generate Daily Slots"</strong> above to
                  populate standard morning and evening OPD slots.
                </span>
              </div>
            ) : (
              <div className="slots-chips-grid">
                {timeSlots.map((slot) => (
                  <div key={slot} className="slot-chip">
                    <span className="slot-text">{slot}</span>
                    <button
                      type="button"
                      className="slot-remove-btn"
                      onClick={() => handleRemoveSlot(slot)}
                      title={`Remove ${slot}`}
                    >
                      <FaTimes />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="doctor-details-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? "Saving Slots…" : "Save Appointment Slots"}
          </button>
        </div>
      </div>
    </div>
  );
}
