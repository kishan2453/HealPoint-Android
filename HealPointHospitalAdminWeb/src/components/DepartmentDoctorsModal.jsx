import React, { useState, useEffect, useMemo } from "react";
import {
  FaTimes,
  FaUserMd,
  FaSearch,
  FaCheck,
  FaSave,
  FaExclamationCircle,
  FaCheckCircle,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import { formatDoctorName } from "../services/doctorFormat";

export default function DepartmentDoctorsModal({
  department,
  onClose,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allDoctors, setAllDoctors] = useState([]);
  const [selectedDoctorIds, setSelectedDoctorIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!department?._id) return;
    const fetchDeptDoctors = async () => {
      try {
        setLoading(true);
        const res = await api.get(
          `/api/v1/hospital-admin/departments/${department._id}`,
        );
        const assigned = res.data?.assignedDoctors || [];
        const allDocs = res.data?.allHospitalDoctors || [];
        setAllDoctors(allDocs);
        setSelectedDoctorIds(assigned.map((d) => String(d._id)));
      } catch (err) {
        console.error("Error loading department doctor mapping:", err);
        setError(err.response?.data?.message || "Failed to load doctors");
      } finally {
        setLoading(false);
      }
    };
    fetchDeptDoctors();
  }, [department?._id]);

  const toggleDoctor = (docId) => {
    setSelectedDoctorIds((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId],
    );
  };

  const selectAll = () => {
    setSelectedDoctorIds(allDoctors.map((d) => String(d._id)));
  };

  const clearAll = () => {
    setSelectedDoctorIds([]);
  };

  const filteredDoctors = useMemo(() => {
    if (!searchQuery.trim()) return allDoctors;
    const q = searchQuery.toLowerCase().trim();
    return allDoctors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.speciality?.toLowerCase().includes(q) ||
        d.department?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q),
    );
  }, [allDoctors, searchQuery]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError("");
      const res = await api.post(
        `/api/v1/hospital-admin/departments/${department._id}/doctors`,
        { doctorIds: selectedDoctorIds },
      );
      toast.success(
        res.data?.message ||
          `Successfully updated doctor assignments for ${department.name}`,
      );
      onSaved();
      onClose();
    } catch (err) {
      console.error("Error saving doctor mapping:", err);
      const msg =
        err.response?.data?.message || "Failed to save doctor assignments";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal dept-doctors-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: "680px", width: "95%", maxHeight: "90vh" }}
      >
        <div className="modal-header-with-actions">
          <div className="modal-title-wrap">
            <span className="modal-badge-ico">
              <FaUserMd />
            </span>
            <div>
              <h2>Assign Doctors to Department</h2>
              <p className="modal-subtitle">
                Department: <strong>{department?.name}</strong> • Selected:{" "}
                <span className="badge-highlight">
                  {selectedDoctorIds.length} doctor(s)
                </span>
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
            <FaExclamationCircle /> {error}
          </div>
        )}

        <div className="modal-toolbar-row">
          <div className="search-input-pill">
            <FaSearch />
            <input
              type="text"
              placeholder="Search doctors by name, speciality, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery("")}
              >
                <FaTimes />
              </button>
            )}
          </div>
          <div className="quick-selection-btns">
            <button
              type="button"
              className="quick-sel-btn"
              onClick={selectAll}
              disabled={loading || allDoctors.length === 0}
            >
              Select All ({allDoctors.length})
            </button>
            <button
              type="button"
              className="quick-sel-btn text-danger"
              onClick={clearAll}
              disabled={loading || selectedDoctorIds.length === 0}
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="dept-doctors-list-container">
          {loading ? (
            <div className="modal-loading-state">
              <div className="loading-spinner-small"></div>
              <span>Loading hospital doctors…</span>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="empty-doctors-list">
              <FaUserMd className="empty-ico" />
              <p>No doctors found matching your search</p>
            </div>
          ) : (
            <div className="dept-doctors-grid">
              {filteredDoctors.map((doctor) => {
                const isSelected = selectedDoctorIds.includes(
                  String(doctor._id),
                );
                const currentDept = doctor.department || "Unassigned";
                const isSameDept =
                  currentDept.trim().toLowerCase() ===
                  (department?.name || "").trim().toLowerCase();

                return (
                  <div
                    key={doctor._id}
                    className={`doctor-assign-card ${
                      isSelected ? "selected" : ""
                    }`}
                    onClick={() => toggleDoctor(String(doctor._id))}
                  >
                    <div className="assign-card-left">
                      <div className="assign-avatar">
                        {doctor.image ? (
                          <img
                            src={doctor.image}
                            alt={doctor.name}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <FaUserMd />
                        )}
                      </div>
                      <div className="assign-info">
                        <h4>{formatDoctorName(doctor.name)}</h4>
                        <span className="assign-speciality">
                          {doctor.speciality || "General Practitioner"}
                        </span>
                        <div className="assign-meta-row">
                          <span
                            className={`current-dept-tag ${
                              isSameDept ? "current-active" : ""
                            }`}
                          >
                            Dept: {currentDept}
                          </span>
                          {doctor.available ? (
                            <span
                              className="status-dot-active"
                              title="Available"
                            >
                              ● Available
                            </span>
                          ) : (
                            <span className="status-dot-off" title="Off Duty">
                              ○ Off Duty
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="assign-checkbox-wrap">
                      <div
                        className={`custom-checkbox-ui ${
                          isSelected ? "checked" : ""
                        }`}
                      >
                        {isSelected && <FaCheck />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            type="button"
            className="btn-primary-action"
            onClick={handleSave}
            disabled={saving || loading}
          >
            <FaSave />{" "}
            {saving
              ? "Saving Assignments…"
              : `Assign ${selectedDoctorIds.length} Doctor(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
