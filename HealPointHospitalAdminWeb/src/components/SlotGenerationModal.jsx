import React, { useState, useEffect } from "react";
import {
  FaTimes,
  FaMagic,
  FaCalendarAlt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaShieldAlt,
  FaBan,
  FaClock,
  FaArrowRight,
  FaInfoCircle,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

// Helper to convert Date to YYYY-MM-DD for <input type="date" />
const toInputDate = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Helper to convert YYYY-MM-DD to DD-MM-YYYY
const toSlotDate = (inputStr) => {
  if (!inputStr) return "";
  const [y, m, d] = inputStr.split("-");
  return `${d}-${m}-${y}`;
};

export default function SlotGenerationModal({ doctor, onClose, onGenerated }) {
  if (!doctor) return null;

  const [mode, setMode] = useState("range"); // "single" | "range"
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // tomorrow
    return toInputDate(d);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7); // 7 days ahead
    return toInputDate(d);
  });
  const [slotDuration, setSlotDuration] = useState(
    doctor.slotDurationMinutes || 30,
  );
  const [overwriteUnbooked, setOverwriteUnbooked] = useState(false);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Quick Preset Handlers
  const handlePreset = (daysAhead) => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    const end = new Date();
    end.setDate(end.getDate() + daysAhead);
    setMode("range");
    setStartDate(toInputDate(start));
    setEndDate(toInputDate(end));
    setPreviewData(null);
  };

  const handleFetchPreview = async () => {
    try {
      setLoadingPreview(true);
      const payload = {
        startDate: toSlotDate(startDate),
        endDate: mode === "range" ? toSlotDate(endDate) : toSlotDate(startDate),
        slotDuration: Number(slotDuration),
      };

      const res = await api.post(
        `/api/v1/hospital-admin/scheduling/doctor/${doctor._id}/slots/preview`,
        payload,
      );

      if (res.data?.success) {
        setPreviewData(res.data);
        toast.info("Slot generation preview updated.");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to preview slots.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteGeneration = async () => {
    try {
      setGenerating(true);
      const payload = {
        startDate: toSlotDate(startDate),
        endDate: mode === "range" ? toSlotDate(endDate) : toSlotDate(startDate),
        slotDuration: Number(slotDuration),
        overwriteExistingUnbooked: overwriteUnbooked,
      };

      const res = await api.post(
        `/api/v1/hospital-admin/scheduling/doctor/${doctor._id}/slots/generate`,
        payload,
      );

      if (res.data?.success) {
        toast.success(
          res.data.message || "Slots generated and persisted successfully!",
        );
        if (onGenerated) onGenerated(res.data);
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate slots.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal slot-generation-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="gen-modal-title"
      >
        {/* Header */}
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
            <FaMagic />
          </span>
          <div>
            <h2 id="gen-modal-title">Smart Slot Generation Engine</h2>
            <p>
              Generate, preview, and persist OPD appointment slots for{" "}
              <strong>{formatDoctorName(doctor.name)}</strong>
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="schedule-modal-body">
          {/* Generation Mode Tabs */}
          <div className="slot-gen-mode-tabs">
            <button
              type="button"
              className={`mode-tab-btn ${mode === "range" ? "active" : ""}`}
              onClick={() => {
                setMode("range");
                setPreviewData(null);
              }}
            >
              Bulk Date Range
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${mode === "single" ? "active" : ""}`}
              onClick={() => {
                setMode("single");
                setPreviewData(null);
              }}
            >
              Single Date
            </button>
          </div>

          {/* Range Shortcuts */}
          {mode === "range" && (
            <div className="slot-presets-bar">
              <span className="presets-label">Quick Presets:</span>
              <button
                type="button"
                className="preset-chip"
                onClick={() => handlePreset(7)}
              >
                Next 7 Days
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() => handlePreset(14)}
              >
                Next 14 Days
              </button>
              <button
                type="button"
                className="preset-chip"
                onClick={() => handlePreset(30)}
              >
                Next 30 Days
              </button>
            </div>
          )}

          {/* Date Range Inputs */}
          <div className="slot-gen-dates-grid">
            <div className="form-group">
              <label>
                <FaCalendarAlt />{" "}
                {mode === "range" ? "Start Date" : "Target Date"}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPreviewData(null);
                }}
                className="filter-date-input"
              />
            </div>

            {mode === "range" && (
              <div className="form-group">
                <label>
                  <FaCalendarAlt /> End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPreviewData(null);
                  }}
                  className="filter-date-input"
                />
              </div>
            )}

            <div className="form-group">
              <label>
                <FaClock /> Consultation Duration
              </label>
              <select
                value={slotDuration}
                onChange={(e) => {
                  setSlotDuration(Number(e.target.value));
                  setPreviewData(null);
                }}
                className="filter-select"
              >
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes (Standard)</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="slot-gen-options">
            <label className="checkbox-toggle-label">
              <input
                type="checkbox"
                checked={overwriteUnbooked}
                onChange={(e) => setOverwriteUnbooked(e.target.checked)}
              />
              <span>
                Overwrite existing unbooked slots with updated session timings
              </span>
            </label>
            <div className="protection-notice">
              <FaShieldAlt className="shield-icon" />
              <span>
                <strong>Booked Slot Protection:</strong> All active appointments
                are strictly protected and will never be deleted, overwritten,
                or displaced.
              </span>
            </div>
          </div>

          {/* Preview Action */}
          <div className="preview-action-row">
            <button
              type="button"
              className="btn-outline-action"
              onClick={handleFetchPreview}
              disabled={loadingPreview || generating}
            >
              <FaMagic />{" "}
              {loadingPreview
                ? "Calculating Preview…"
                : "Calculate Real-Time Preview"}
            </button>
          </div>

          {/* Preview Results Display */}
          {previewData && (
            <div className="slot-preview-card">
              <h4 className="preview-heading">
                Generation Preview Breakdown ({previewData.summary?.startDate}{" "}
                {mode === "range" && `→ ${previewData.summary?.endDate}`})
              </h4>

              {/* Stats KPIs */}
              <div className="preview-kpi-grid">
                <div className="preview-kpi-box expected">
                  <span className="kpi-num">
                    {previewData.summary?.totalExpectedSlots ?? 0}
                  </span>
                  <span className="kpi-label">Expected Slots</span>
                </div>

                <div className="preview-kpi-box booked">
                  <span className="kpi-num">
                    {previewData.summary?.totalBookedSlots ?? 0}
                  </span>
                  <span className="kpi-label">
                    <FaShieldAlt /> Booked (Protected)
                  </span>
                </div>

                <div className="preview-kpi-box blocked">
                  <span className="kpi-num">
                    {previewData.summary?.totalBlockedSlots ?? 0}
                  </span>
                  <span className="kpi-label">
                    <FaBan /> Blocked by Admin
                  </span>
                </div>

                <div className="preview-kpi-box available">
                  <span className="kpi-num">
                    {previewData.summary?.totalAvailableSlots ?? 0}
                  </span>
                  <span className="kpi-label">
                    <FaCheckCircle /> Open for Booking
                  </span>
                </div>
              </div>

              {/* Days breakdown summary */}
              <div className="preview-days-summary">
                <span>
                  Total Days: <strong>{previewData.summary?.totalDays}</strong>{" "}
                  · Working Days:{" "}
                  <strong>{previewData.summary?.workingDays}</strong> · Skipped
                  Days: <strong>{previewData.summary?.skippedDays}</strong>
                </span>
              </div>

              {/* Skipped Dates Warning Box */}
              {previewData.skippedDates &&
                previewData.skippedDates.length > 0 && (
                  <div className="skipped-dates-box">
                    <div className="skipped-dates-title">
                      <FaInfoCircle /> Skipped Dates (Non-working or On Leave):
                    </div>
                    <div className="skipped-pills-list">
                      {previewData.skippedDates.map((sk) => (
                        <span key={sk.date} className="skipped-date-pill">
                          <strong>{sk.date}</strong> ({sk.day}): {sk.reason}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="doctor-details-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={generating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExecuteGeneration}
            disabled={generating || loadingPreview}
          >
            {generating ? "Generating Slots…" : "Generate & Save Slots"}
          </button>
        </div>
      </div>
    </div>
  );
}
