import React from "react";
import { FaExclamationTriangle, FaTimes } from "react-icons/fa";

const ConfirmDialog = ({
  open,
  title,
  message,
  details,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!open) return null;

  return (
    <div className="app-confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <div
        className="app-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="app-confirm-close"
          aria-label="Close confirmation"
          onClick={onCancel}
          disabled={loading}
        >
          <FaTimes />
        </button>
        <div className="app-confirm-icon">
          <FaExclamationTriangle />
        </div>
        <h3 id="confirm-dialog-title">{title}</h3>
        <p>{message}</p>
        {details && <small>{details}</small>}
        <div className="app-confirm-actions">
          <button type="button" className="btn btn-light" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
