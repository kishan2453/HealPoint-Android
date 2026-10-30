import React, { useState, useEffect, useTransition } from "react";
import api from "../services/api";
import {
  FaPlus,
  FaSearch,
  FaEye,
  FaEdit,
  FaCalendarAlt,
  FaClock,
  FaUserSlash,
  FaUserCheck,
  FaTrashAlt,
  FaUserMd,
  FaCheckCircle,
  FaTimesCircle,
  FaHospitalUser,
  FaFilter,
  FaUndo,
} from "react-icons/fa";
import DoctorForm from "./DoctorForm";
import DoctorDetailsModal from "../components/DoctorDetailsModal";
import DoctorScheduleModal from "../components/DoctorScheduleModal";
import DoctorSlotsModal from "../components/DoctorSlotsModal";
import DeleteDoctorModal from "../components/DeleteDoctorModal";
import { formatDoctorName } from "../services/doctorFormat";
import { toast } from "react-toastify";

function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    available: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter and search states
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [availability, setAvailability] = useState("");
  const [hospitalDepartments, setHospitalDepartments] = useState([]);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDoctorForEdit, setSelectedDoctorForEdit] = useState(null);
  const [selectedDoctorForDetails, setSelectedDoctorForDetails] =
    useState(null);
  const [selectedDoctorForSchedule, setSelectedDoctorForSchedule] =
    useState(null);
  const [selectedDoctorForSlots, setSelectedDoctorForSlots] = useState(null);
  const [doctorToDelete, setDoctorToDelete] = useState(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [, startTransition] = useTransition();

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (department) params.set("department", department);
      if (status) params.set("status", status);
      if (availability) params.set("availability", availability);

      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await api.get(`/api/v1/hospital-admin/doctors${query}`);
      const data = response.data?.doctors || response.data?.data || [];
      setDoctors(data);

      if (response.data?.stats) {
        setStats(response.data.stats);
      } else {
        setStats({
          total: data.length,
          active: data.filter((d) => d.isActive !== false).length,
          inactive: data.filter((d) => d.isActive === false).length,
          available: data.filter((d) => d.available).length,
        });
      }
      setError(null);
    } catch (err) {
      console.error("Failed to fetch doctors:", err);
      setError(err.response?.data?.message || "Failed to load doctors");
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitalInfo = async () => {
    try {
      const response = await api.get("/api/v1/hospital-admin/dashboard");
      const hospital = response.data?.hospital;
      if (hospital?.departments?.length) {
        setHospitalDepartments(hospital.departments);
      }
    } catch (err) {
      // Fallback to empty if not loaded
    }
  };

  // Debounced search & filter effect
  useEffect(() => {
    const handler = setTimeout(() => {
      startTransition(() => {
        fetchDoctors();
      });
    }, 250);
    return () => clearTimeout(handler);
  }, [search, department, status, availability]);

  useEffect(() => {
    fetchHospitalInfo();
  }, []);

  const handleResetFilters = () => {
    setSearch("");
    setDepartment("");
    setStatus("");
    setAvailability("");
  };

  const hasActiveFilters = Boolean(
    search || department || status || availability,
  );

  // Open Add Doctor
  const handleAddDoctor = () => {
    setSelectedDoctorForEdit(null);
    setIsFormOpen(true);
  };

  // Open Edit Doctor
  const handleEditDoctor = (doctor) => {
    setSelectedDoctorForEdit(doctor);
    setIsFormOpen(true);
  };

  // Open Details Modal
  const handleViewDoctorDetails = async (doctor) => {
    try {
      const response = await api.get(
        `/api/v1/hospital-admin/doctors/${doctor._id}`,
      );
      setSelectedDoctorForDetails({
        ...doctor,
        ...response.data?.doctor,
        stats: response.data?.stats,
        appointments: response.data?.appointments,
      });
    } catch (err) {
      // Fallback to current doctor object if detailed fetch fails
      setSelectedDoctorForDetails(doctor);
    }
  };

  // Open Schedule Modal
  const handleManageSchedule = (doctor) => {
    setSelectedDoctorForSchedule(doctor);
  };

  // Open Slots Modal
  const handleManageSlots = (doctor) => {
    setSelectedDoctorForSlots(doctor);
  };

  // Save Doctor (Create or Update)
  const handleSaveDoctor = async (doctorData, done) => {
    try {
      if (selectedDoctorForEdit) {
        await api.put(
          `/api/v1/hospital-admin/doctors/${selectedDoctorForEdit._id}`,
          doctorData,
        );
        toast.success("Doctor profile updated successfully");
      } else {
        await api.post("/api/v1/hospital-admin/doctors", doctorData);
        toast.success("Doctor added to hospital successfully");
      }
      setIsFormOpen(false);
      fetchDoctors();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save doctor");
    } finally {
      if (done) done();
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleActive = async (doctor) => {
    const nextActive = !doctor.isActive;
    try {
      await api.put(`/api/v1/hospital-admin/doctors/${doctor._id}/status`, {
        isActive: nextActive,
      });
      toast.success(
        nextActive
          ? `${formatDoctorName(doctor.name)} activated and available for OPD`
          : `${formatDoctorName(doctor.name)} deactivated (removed from user bookings)`,
      );
      fetchDoctors();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  // Open Delete Modal
  const handleDeleteClick = (doctor) => {
    setDoctorToDelete(doctor);
    setDeleteErrorMessage("");
  };

  // Confirm Delete
  const confirmDeleteDoctor = async () => {
    if (!doctorToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/hospital-admin/doctors/${doctorToDelete._id}`);
      toast.success(`${formatDoctorName(doctorToDelete.name)} was removed`);
      setDoctorToDelete(null);
      setDeleteErrorMessage("");
      fetchDoctors();
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to delete doctor";
      if (err.response?.data?.hasAppointments) {
        setDeleteErrorMessage(msg);
      } else {
        toast.error(msg);
        setDoctorToDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  // Deactivate instead of deleting (Compliance safe action)
  const handleDeactivateInstead = async () => {
    if (!doctorToDelete) return;
    setDeleting(true);
    try {
      await api.put(
        `/api/v1/hospital-admin/doctors/${doctorToDelete._id}/status`,
        {
          isActive: false,
        },
      );
      toast.success(
        `${formatDoctorName(doctorToDelete.name)} deactivated instead. Past appointments preserved.`,
      );
      setDoctorToDelete(null);
      setDeleteErrorMessage("");
      fetchDoctors();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to deactivate doctor");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="portal-page doctor-management-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Doctor Management</h1>
          <p className="page-subtitle">
            Manage hospital medical staff, clinical specialists, availability
            schedules, and OPD appointment slots.
          </p>
        </div>
        <button
          className="btn-primary btn-add-doctor"
          onClick={handleAddDoctor}
        >
          <FaPlus /> Add Doctor
        </button>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="doctor-kpi-grid">
        <div className="doctor-kpi-card total">
          <div className="kpi-icon-wrap">
            <FaHospitalUser />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Doctors</span>
            <strong className="kpi-value">{stats.total}</strong>
            <span className="kpi-sub">Registered medical faculty</span>
          </div>
        </div>

        <div className="doctor-kpi-card active">
          <div className="kpi-icon-wrap">
            <FaCheckCircle />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Active Doctors</span>
            <strong className="kpi-value">{stats.active}</strong>
            <span className="kpi-sub">Eligible for bookings</span>
          </div>
        </div>

        <div className="doctor-kpi-card inactive">
          <div className="kpi-icon-wrap">
            <FaTimesCircle />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Inactive Doctors</span>
            <strong className="kpi-value">{stats.inactive}</strong>
            <span className="kpi-sub">Deactivated / On leave</span>
          </div>
        </div>

        <div className="doctor-kpi-card available">
          <div className="kpi-icon-wrap">
            <FaCalendarAlt />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Available for OPD</span>
            <strong className="kpi-value">{stats.available}</strong>
            <span className="kpi-sub">Accepting patient slots</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel doctor-table-panel">
        <div className="doctor-toolbar">
          <div className="search-box-wrap">
            <FaSearch className="search-icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by doctor name, speciality, email, or phone…"
              className="doctor-search-input"
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="filter-controls-wrap">
            <div className="filter-item">
              <FaFilter className="filter-icon" />
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="filter-select"
              >
                <option value="">All Departments</option>
                {hospitalDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="filter-select"
              >
                <option value="">All Status</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            <div className="filter-item">
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="filter-select"
              >
                <option value="">All Availability</option>
                <option value="available">Available Only</option>
                <option value="unavailable">Unavailable Only</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-reset-filters"
                onClick={handleResetFilters}
                title="Clear all filters"
              >
                <FaUndo /> Reset
              </button>
            )}
          </div>

          <span className="records-count-badge">
            {loading
              ? "Updating…"
              : `Showing ${doctors.length} of ${stats.total} doctors`}
          </span>
        </div>

        {/* Data Table */}
        {loading && doctors.length === 0 ? (
          <div className="portal-loading">
            <span /> Loading hospital doctors…
          </div>
        ) : error ? (
          <div className="empty-state">
            <strong>{error}</strong>
          </div>
        ) : (
          <div className="data-table doctor-table-container">
            <table>
              <thead>
                <tr>
                  <th>Doctor Profile</th>
                  <th>Contact Info</th>
                  <th>Speciality & Dept</th>
                  <th>Exp & Fee</th>
                  <th>Status</th>
                  <th>Availability</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      <FaUserMd className="empty-state-icon" />
                      <strong>No matching doctors found</strong>
                      <span>
                        Try changing your search keywords or clearing active
                        filters.
                      </span>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-outline-sm"
                          style={{ marginTop: 12 }}
                          onClick={handleResetFilters}
                        >
                          Reset Filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  doctors.map((doctor) => (
                    <tr key={doctor._id}>
                      {/* Doctor Profile */}
                      <td>
                        <div className="doctor-cell-profile">
                          {doctor.image ? (
                            <img
                              src={doctor.image}
                              alt={doctor.name}
                              className="doctor-avatar"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="doctor-avatar doctor-avatar-placeholder">
                              <FaUserMd />
                            </div>
                          )}
                          <div className="doctor-cell-info">
                            <strong className="doctor-cell-name">
                              {formatDoctorName(doctor.name)}
                            </strong>
                            <span className="doctor-cell-degree">
                              {doctor.degree || doctor.qualification || "MBBS"}
                            </span>
                            {doctor.registrationNumber && (
                              <span className="doctor-cell-reg">
                                Reg: {doctor.registrationNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td>
                        <div className="doctor-cell-contact">
                          <span className="contact-email">{doctor.email}</span>
                          <span className="contact-phone">
                            {doctor.phone || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Speciality & Dept */}
                      <td>
                        <div className="doctor-cell-spec">
                          <span className="spec-badge">
                            {doctor.speciality ||
                              doctor.specialization ||
                              "General"}
                          </span>
                          <span className="dept-text">
                            {doctor.department || "Clinical OPD"}
                          </span>
                        </div>
                      </td>

                      {/* Experience & Fee */}
                      <td>
                        <div className="doctor-cell-fees">
                          <span className="exp-text">
                            {doctor.experience
                              ? `${doctor.experience} yrs exp`
                              : "—"}
                          </span>
                          <strong className="fee-text">
                            ₹{doctor.fees || 500}
                          </strong>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`status-badge ${doctor.isActive ? "confirmed" : "cancel"}`}
                        >
                          {doctor.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Availability */}
                      <td>
                        <span
                          className={`status-badge ${doctor.available ? "confirmed" : "cancel"}`}
                        >
                          {doctor.available ? "Available" : "Unavailable"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="doctor-actions-cluster">
                          <button
                            type="button"
                            className="btn-action-icon view"
                            onClick={() => handleViewDoctorDetails(doctor)}
                            title="View Full Profile & Performance"
                          >
                            <FaEye /> View
                          </button>

                          <button
                            type="button"
                            className="btn-action-icon edit"
                            onClick={() => handleEditDoctor(doctor)}
                            title="Edit Doctor Details"
                          >
                            <FaEdit /> Edit
                          </button>

                          <button
                            type="button"
                            className="btn-action-icon schedule"
                            onClick={() => handleManageSchedule(doctor)}
                            title="Manage Working Hours & Availability"
                          >
                            <FaCalendarAlt /> Hours
                          </button>

                          <button
                            type="button"
                            className="btn-action-icon slots"
                            onClick={() => handleManageSlots(doctor)}
                            title="Configure OPD Slots"
                          >
                            <FaClock /> Slots
                          </button>

                          <button
                            type="button"
                            className={`btn-action-icon status-toggle ${doctor.isActive ? "deactivate" : "activate"}`}
                            onClick={() => handleToggleActive(doctor)}
                            title={
                              doctor.isActive
                                ? "Deactivate Doctor (Hide from booking)"
                                : "Activate Doctor (Enable booking)"
                            }
                          >
                            {doctor.isActive ? (
                              <FaUserSlash />
                            ) : (
                              <FaUserCheck />
                            )}
                            {doctor.isActive ? "Deactivate" : "Activate"}
                          </button>

                          <button
                            type="button"
                            className="btn-action-icon delete"
                            onClick={() => handleDeleteClick(doctor)}
                            title="Remove or Deactivate Doctor"
                          >
                            <FaTrashAlt />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Doctor Modal */}
      {isFormOpen && (
        <DoctorForm
          doctor={selectedDoctorForEdit}
          onSave={handleSaveDoctor}
          onCancel={() => setIsFormOpen(false)}
          departments={hospitalDepartments}
        />
      )}

      {/* View Doctor Details Modal */}
      {selectedDoctorForDetails && (
        <DoctorDetailsModal
          doctor={selectedDoctorForDetails}
          onClose={() => setSelectedDoctorForDetails(null)}
          onEdit={(doc) => {
            setSelectedDoctorForDetails(null);
            handleEditDoctor(doc);
          }}
          onManageSchedule={(doc) => {
            setSelectedDoctorForDetails(null);
            handleManageSchedule(doc);
          }}
        />
      )}

      {/* Manage Working Hours & Schedule Modal */}
      {selectedDoctorForSchedule && (
        <DoctorScheduleModal
          doctor={selectedDoctorForSchedule}
          onClose={() => setSelectedDoctorForSchedule(null)}
          onUpdated={fetchDoctors}
        />
      )}

      {/* Manage Slots Modal */}
      {selectedDoctorForSlots && (
        <DoctorSlotsModal
          doctor={selectedDoctorForSlots}
          onClose={() => setSelectedDoctorForSlots(null)}
          onUpdated={fetchDoctors}
        />
      )}

      {/* Delete / Deactivate Doctor Modal */}
      {doctorToDelete && (
        <DeleteDoctorModal
          doctor={doctorToDelete}
          deleting={deleting}
          errorMessage={deleteErrorMessage}
          onCancel={() => {
            setDoctorToDelete(null);
            setDeleteErrorMessage("");
          }}
          onConfirm={confirmDeleteDoctor}
          onDeactivateInstead={handleDeactivateInstead}
        />
      )}
    </div>
  );
}

export default Doctors;
