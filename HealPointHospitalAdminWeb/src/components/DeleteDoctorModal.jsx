import React from "react";
import {
  FaExclamationTriangle,
  FaShieldAlt,
  FaUserSlash,
  FaTrashAlt,
} from "react-icons/fa";
import { formatDoctorName } from "../services/doctorFormat";

export default function DeleteDoctorModal({
  doctor,
  onCancel,
  onConfirm,
  onDeactivateInstead,
  deleting,
  errorMessage,
}) {
  if (!doctor) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="detail-modal delete-doctor-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-doctor-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="delete-doctor-icon">
          <FaExclamationTriangle />
        </div>

        <h2 id="delete-doctor-title">Remove or Deactivate Doctor</h2>
        <p className="delete-doctor-target">
          Action for{" "}
          <strong>{formatDoctorName(doctor.name, "Selected Doctor")}</strong> (
          {doctor.speciality || doctor.specialization || "Physician"})
        </p>

        {errorMessage ? (
          <div className="delete-warning-callout">
            <div className="warning-callout-header">
              <FaShieldAlt /> Medical Records Protection Notice
            </div>
            <p className="warning-callout-body">{errorMessage}</p>
          </div>
        ) : (
          <div className="delete-doctor-explanation">
            <p>
              In healthcare systems, permanently deleting a doctor with past
              patient appointments is prohibited to maintain medical compliance
              and patient health history.
            </p>
            <p className="recommend-text">
              <strong>Recommended:</strong> Deactivate this doctor instead.
              Deactivation instantly hides the doctor from new patient bookings
              while safely keeping all previous clinical records intact.
            </p>
          </div>
        )}

        <div className="delete-doctor-actions-stacked">
          {onDeactivateInstead && (
            <button
              type="button"
              className="btn-deactivate-recommend"
              onClick={onDeactivateInstead}
              disabled={deleting}
            >
              <FaUserSlash /> Deactivate Doctor Instead (Safe & Recommended)
            </button>
          )}

          <div className="delete-buttons-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger-confirm"
              onClick={onConfirm}
              disabled={deleting}
            >
              <FaTrashAlt /> {deleting ? "Deleting…" : "Permanently Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
