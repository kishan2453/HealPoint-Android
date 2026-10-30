import React, { useState } from "react";
import {
  FaExclamationTriangle,
  FaShieldAlt,
  FaToggleOff,
  FaTrashAlt,
  FaTimes,
  FaCheckCircle,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";

export default function DeleteDepartmentModal({
  department,
  onClose,
  onDeleted,
  onToggled,
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!department) return null;

  const doctorCount = department.doctorCount || 0;
  const appointmentCount = department.appointmentCount || 0;
  const hasDependencies = doctorCount > 0 || appointmentCount > 0;

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError("");
      const res = await api.delete(
        `/api/v1/hospital-admin/departments/${department._id}`
      );
      toast.success(res.data?.message || "Department removed successfully");
      onDeleted();
      onClose();
    } catch (err) {
      console.error("Failed to delete department:", err);
      const msg =
        err.response?.data?.message ||
        "Unable to delete department due to active dependencies.";
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeactivateInstead = async () => {
    try {
      setDeleting(true);
      setError("");
      const res = await api.patch(
        `/api/v1/hospital-admin/departments/${department._id}/status`
      );
      toast.success(
        res.data?.message || `Department marked as inactive successfully`
      );
      if (onToggled) onToggled();
      onClose();
    } catch (err) {
      console.error("Failed to deactivate department:", err);
      const msg =
        err.response?.data?.message || "Unable to deactivate department";
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal delete-department-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "520px", width: "95%" }}
      >
        <div className="delete-doctor-icon">
          <FaExclamationTriangle />
        </div>

        <h2 id="delete-dept-title" style={{ textAlign: "center" }}>
          {hasDependencies ? "Cannot Delete Department" : "Delete Department"}
        </h2>
        <p className="delete-doctor-target" style={{ textAlign: "center" }}>
          Target: <strong>{department.name} Department</strong>
        </p>

        {error && (
          <div className="form-error-banner" style={{ margin: "14px 0" }}>
            {error}
          </div>
        )}

        {hasDependencies ? (
          <div className="delete-warning-callout">
            <div className="warning-callout-header">
              <FaShieldAlt /> Clinical Integrity & Dependency Protection
            </div>
            <p className="warning-callout-body">
              This department currently has{" "}
              <strong>
                {doctorCount} assigned doctor(s)
              </strong>{" "}
              and{" "}
              <strong>
                {appointmentCount} patient appointment(s)
              </strong>
              . To preserve audit logs and medical records integrity, active
              departments with linked doctors cannot be deleted.
            </p>
            <p className="recommend-text" style={{ marginTop: "8px" }}>
              <strong>Recommended Action:</strong> Deactivate the department
              instead. This instantly hides the department from patient searches
              and appointment bookings without losing doctor records or clinical data.
            </p>
          </div>
        ) : (
          <div className="delete-doctor-explanation">
            <p>
              Are you sure you want to permanently delete the{" "}
              <strong>{department.name}</strong> department?
            </p>
            <p className="recommend-text">
              This department has 0 assigned doctors and no appointment history.
              This action cannot be undone.
            </p>
          </div>
        )}

        <div className="delete-doctor-actions-stacked" style={{ marginTop: "20px" }}>
          {hasDependencies && (
            <button
              type="button"
              className="btn-deactivate-recommend"
              onClick={handleDeactivateInstead}
              disabled={deleting}
            >
              <FaToggleOff /> Deactivate Department Instead (Safe & Recommended)
            </button>
          )}

          <div className="delete-buttons-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            {!hasDependencies && (
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={handleDelete}
                disabled={deleting}
              >
                <FaTrashAlt />{" "}
                {deleting ? "Deleting…" : "Permanently Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
