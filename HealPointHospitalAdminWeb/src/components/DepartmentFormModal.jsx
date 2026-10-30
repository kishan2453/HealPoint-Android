import React, { useState, useEffect } from "react";
import {
  FaTimes,
  FaClinicMedical,
  FaStethoscope,
  FaHeartbeat,
  FaBrain,
  FaBone,
  FaEye,
  FaTooth,
  FaBaby,
  FaLungs,
  FaPills,
  FaMicroscope,
  FaAmbulance,
  FaUserMd,
  FaSave,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

const ICON_PRESETS = [
  { name: "Stethoscope", label: "General Medicine", Icon: FaStethoscope },
  { name: "Heartbeat", label: "Cardiology", Icon: FaHeartbeat },
  { name: "Brain", label: "Neurology", Icon: FaBrain },
  { name: "Bone", label: "Orthopedics", Icon: FaBone },
  { name: "Eye", label: "Ophthalmology", Icon: FaEye },
  { name: "Tooth", label: "Dental", Icon: FaTooth },
  { name: "Baby", label: "Pediatrics", Icon: FaBaby },
  { name: "Lungs", label: "Pulmonology", Icon: FaLungs },
  { name: "Pills", label: "Pharmacy / Internal", Icon: FaPills },
  { name: "Microscope", label: "Pathology / Lab", Icon: FaMicroscope },
  { name: "Ambulance", label: "Emergency / Trauma", Icon: FaAmbulance },
  { name: "ClinicMedical", label: "Outpatient / OPD", Icon: FaClinicMedical },
  { name: "UserMd", label: "Specialist Consultation", Icon: FaUserMd },
];

export default function DepartmentFormModal({
  department,
  onClose,
  onSaved,
  hospitalDoctors = [],
}) {
  const isEditing = Boolean(department?._id);

  const [formData, setFormData] = useState({
    name: department?.name || "",
    description: department?.description || "",
    headOfDepartment: department?.headOfDepartment || "",
    icon: department?.icon || "Stethoscope",
    isActive: department?.isActive !== undefined ? department.isActive : true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Department name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        headOfDepartment: formData.headOfDepartment.trim(),
        icon: formData.icon,
        isActive: formData.isActive,
      };

      if (isEditing) {
        const response = await api.put(
          `/api/v1/hospital-admin/departments/${department._id}`,
          payload,
        );
        toast.success(
          response.data?.message || "Department updated successfully",
        );
      } else {
        const response = await api.post(
          "/api/v1/hospital-admin/departments",
          payload,
        );
        toast.success(
          response.data?.message || "Department created successfully",
        );
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save department:", err);
      const msg =
        err.response?.data?.message ||
        (isEditing
          ? "Failed to update department"
          : "Failed to create department");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal department-form-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "620px", width: "95%" }}
      >
        <div className="modal-header-with-actions">
          <div className="modal-title-wrap">
            <span className="modal-badge-ico">
              <FaClinicMedical />
            </span>
            <div>
              <h2>{isEditing ? "Edit Department" : "Add New Department"}</h2>
              <p className="modal-subtitle">
                {isEditing
                  ? `Update details and clinical leadership for ${department.name}`
                  : "Establish a new specialized medical department within your hospital"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>

        {error && (
          <div className="form-error-banner" style={{ margin: "16px 0 0 0" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="dept-modal-form">
          <div className="form-group-premier">
            <label htmlFor="dept-name">
              Department Name <span className="req-star">*</span>
            </label>
            <input
              id="dept-name"
              type="text"
              className="premier-input"
              placeholder="e.g., Cardiology, Neurology, Orthopedics"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="form-group-premier">
            <label htmlFor="dept-hod">Head of Department (HOD)</label>
            <div className="input-with-suggestions">
              <input
                id="dept-hod"
                type="text"
                className="premier-input"
                placeholder="e.g., Dr. Rajesh Sharma, MD"
                value={formData.headOfDepartment}
                onChange={(e) =>
                  handleChange("headOfDepartment", e.target.value)
                }
              />
              {hospitalDoctors.length > 0 && (
                <div className="quick-hod-picks">
                  <span className="quick-label">Quick select physician:</span>
                  <div className="quick-tags">
                    {hospitalDoctors.slice(0, 5).map((doc) => (
                      <button
                        key={doc._id}
                        type="button"
                        className="quick-tag-btn"
                        onClick={() =>
                          handleChange(
                            "headOfDepartment",
                            formatDoctorName(doc.name),
                          )
                        }
                      >
                        {formatDoctorName(doc.name)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-group-premier">
            <label>Department Clinical Icon</label>
            <div className="dept-icon-grid">
              {ICON_PRESETS.map((item) => {
                const IconComp = item.Icon;
                const isSelected = formData.icon === item.name;
                return (
                  <button
                    key={item.name}
                    type="button"
                    className={`dept-icon-btn ${isSelected ? "selected" : ""}`}
                    onClick={() => handleChange("icon", item.name)}
                    title={item.label}
                  >
                    <IconComp className="dept-icon-glyph" />
                    <span className="dept-icon-label">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group-premier">
            <label htmlFor="dept-desc">Clinical Scope & Description</label>
            <textarea
              id="dept-desc"
              className="premier-textarea"
              rows={3}
              placeholder="Describe clinical services, specialized procedures, diagnostic capabilities, and patient care focus..."
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
            />
          </div>

          <div className="form-group-premier toggle-group-premier">
            <div className="toggle-label-wrap">
              <span className="toggle-title">
                Department Operational Status
              </span>
              <span className="toggle-sub">
                Active departments are visible to patients and can be assigned
                doctors.
              </span>
            </div>
            <label className="switch-premier">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
              />
              <span className="slider-premier round"></span>
            </label>
          </div>

          <div className="modal-actions-premier">
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
              <FaSave />{" "}
              {saving
                ? "Saving…"
                : isEditing
                  ? "Update Department"
                  : "Create Department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
