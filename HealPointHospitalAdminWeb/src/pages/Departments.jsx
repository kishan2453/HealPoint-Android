import React, { useState, useEffect, useTransition } from "react";
import {
  FaClinicMedical,
  FaPlus,
  FaSearch,
  FaFilter,
  FaUndo,
  FaUserMd,
  FaCheckCircle,
  FaTimesCircle,
  FaEdit,
  FaTrashAlt,
  FaUserPlus,
  FaToggleOn,
  FaToggleOff,
  FaLayerGroup,
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
  FaShieldAlt,
  FaClipboardList,
  FaTimes,
  FaCheck,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";
import DepartmentFormModal from "../components/DepartmentFormModal";
import DepartmentDoctorsModal from "../components/DepartmentDoctorsModal";
import DeleteDepartmentModal from "../components/DeleteDepartmentModal";
import { formatDoctorName } from "../services/doctorFormat";

const ICON_MAP = {
  Stethoscope: FaStethoscope,
  Heartbeat: FaHeartbeat,
  Brain: FaBrain,
  Bone: FaBone,
  Eye: FaEye,
  Tooth: FaTooth,
  Baby: FaBaby,
  Lungs: FaLungs,
  Pills: FaPills,
  Microscope: FaMicroscope,
  Ambulance: FaAmbulance,
  ClinicMedical: FaClinicMedical,
  UserMd: FaUserMd,
};

export default function Departments({ hospital, reloadHospital }) {
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    withDoctors: 0,
    withoutDoctors: 0,
    totalDoctors: 0,
  });
  const [hospitalDoctors, setHospitalDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [doctorFilter, setDoctorFilter] = useState("all");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [departmentToEdit, setDepartmentToEdit] = useState(null);
  const [departmentToMap, setDepartmentToMap] = useState(null);
  const [departmentToDelete, setDepartmentToDelete] = useState(null);

  // Companion Services state
  const [services, setServices] = useState(
    (hospital?.services || []).map((s) => String(s)),
  );
  const [serviceInput, setServiceInput] = useState("");
  const [savingServices, setSavingServices] = useState(false);

  const [, startTransition] = useTransition();

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);

      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await api.get(`/api/v1/hospital-admin/departments${query}`);
      const data = res.data?.departments || [];
      setDepartments(data);

      if (res.data?.stats) {
        setStats(res.data.stats);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to fetch departments:", err);
      setError(err.response?.data?.message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitalDoctors = async () => {
    try {
      const res = await api.get("/api/v1/hospital-admin/doctors");
      setHospitalDoctors(res.data?.doctors || []);
    } catch (err) {
      console.error("Failed to fetch doctors list for department picker:", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        fetchDepartments();
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchHospitalDoctors();
  }, []);

  const handleToggleStatus = async (dept) => {
    try {
      const res = await api.patch(
        `/api/v1/hospital-admin/departments/${dept._id}/status`,
      );
      toast.success(
        res.data?.message || `Department status updated successfully`,
      );
      fetchDepartments();
      if (reloadHospital) reloadHospital();
    } catch (err) {
      console.error("Failed to toggle department status:", err);
      toast.error(
        err.response?.data?.message || "Unable to change department status",
      );
    }
  };

  // Filter departments locally by doctor count if doctorFilter is set
  const displayedDepartments = departments.filter((dept) => {
    if (doctorFilter === "withDoctors") return (dept.doctorCount || 0) > 0;
    if (doctorFilter === "withoutDoctors") return (dept.doctorCount || 0) === 0;
    return true;
  });

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDoctorFilter("all");
  };

  const hasActiveFilters =
    search.trim() !== "" || statusFilter !== "all" || doctorFilter !== "all";

  // Service Management handlers
  const handleAddService = async () => {
    const clean = serviceInput.trim();
    if (!clean || services.includes(clean)) return;
    const updated = [...services, clean];
    setServices(updated);
    setServiceInput("");
    await saveHospitalServices(updated);
  };

  const handleRemoveService = async (serviceToRemove) => {
    const updated = services.filter((s) => s !== serviceToRemove);
    setServices(updated);
    await saveHospitalServices(updated);
  };

  const saveHospitalServices = async (newServices) => {
    try {
      setSavingServices(true);
      await api.patch("/api/v1/hospital-admin/profile", {
        services: newServices,
      });
      toast.success("Hospital services updated");
      if (reloadHospital) reloadHospital();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update services");
    } finally {
      setSavingServices(false);
    }
  };

  return (
    <div className="premier-page-container department-management-page">
      {/* 1. Header Section */}
      <div className="premier-page-header">
        <div className="header-text-group">
          <div className="header-badge-row">
            <span className="badge-pill">Clinical Governance</span>
            <span className="badge-live-pulse">
              <span className="pulse-dot"></span> Live Isolation Scoped
            </span>
          </div>
          <h1>Departments & Services</h1>
          <p className="header-subtext">
            {hospital?.name || "Hospital"} · Clinical departments, medical staff
            governance, and specialized clinical facilities.
          </p>
        </div>
        <div className="header-actions-group">
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => {
              setDepartmentToEdit(null);
              setIsFormOpen(true);
            }}
          >
            <FaPlus /> Add Department
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar (6 Real KPI Stat Cards) */}
      <div
        className="premier-stats-grid"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        <div className="stat-card">
          <div className="stat-icon-box blue">
            <FaClinicMedical />
          </div>
          <div className="stat-content">
            <span className="stat-label">Total Departments</span>
            <h3 className="stat-number">{stats.total}</h3>
            <span className="stat-hint">Registered units</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box green">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <span className="stat-label">Active Departments</span>
            <h3 className="stat-number">{stats.active}</h3>
            <span className="stat-hint text-success">Operational units</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box amber">
            <FaTimesCircle />
          </div>
          <div className="stat-content">
            <span className="stat-label">Inactive Departments</span>
            <h3 className="stat-number">{stats.inactive}</h3>
            <span className="stat-hint text-amber">Temporarily disabled</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box purple">
            <FaShieldAlt />
          </div>
          <div className="stat-content">
            <span className="stat-label">Publicly Bookable</span>
            <h3 className="stat-number">{stats.active}</h3>
            <span className="stat-hint text-primary">Visible in catalog</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box indigo">
            <FaUserMd />
          </div>
          <div className="stat-content">
            <span className="stat-label">With Doctors</span>
            <h3 className="stat-number">{stats.withDoctors}</h3>
            <span className="stat-hint text-primary">
              Staffed clinical units
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-box danger">
            <FaLayerGroup />
          </div>
          <div className="stat-content">
            <span className="stat-label">Without Doctors</span>
            <h3 className="stat-number">{stats.withoutDoctors}</h3>
            <span className="stat-hint text-danger">Awaiting assignment</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="premier-filter-card">
        <div className="filter-row">
          <div className="search-field-wrapper">
            <FaSearch className="search-ico" />
            <input
              type="text"
              placeholder="Search by department name, HOD, or clinical scope…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="premier-input-search"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch("")}
              >
                <FaTimes />
              </button>
            )}
          </div>

          <div className="filter-dropdowns-group">
            <div className="select-pill-wrapper">
              <FaFilter className="filter-ico" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="premier-select"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            <div className="select-pill-wrapper">
              <FaUserMd className="filter-ico" />
              <select
                value={doctorFilter}
                onChange={(e) => setDoctorFilter(e.target.value)}
                className="premier-select"
              >
                <option value="all">All Staffing</option>
                <option value="withDoctors">Staffed (With Doctors)</option>
                <option value="withoutDoctors">Unstaffed (No Doctors)</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn-reset-filters"
                onClick={resetFilters}
                title="Reset all filters"
              >
                <FaUndo /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Departments Grid */}
      {loading ? (
        <div className="premier-loading-container">
          <div className="loading-spinner-large"></div>
          <p>Loading hospital departments…</p>
        </div>
      ) : error ? (
        <div className="premier-error-card">
          <FaTimesCircle className="error-ico" />
          <h3>Error loading departments</h3>
          <p>{error}</p>
          <button
            type="button"
            className="btn-primary-action"
            onClick={fetchDepartments}
          >
            Retry
          </button>
        </div>
      ) : displayedDepartments.length === 0 ? (
        <div className="premier-empty-card">
          <div className="empty-icon-bubble">
            <FaClinicMedical />
          </div>
          <h3>No departments found</h3>
          <p>
            {hasActiveFilters
              ? "No departments match your search and filter criteria."
              : "No clinical departments configured for this hospital yet. Add your first department to start assigning doctors and services."}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={resetFilters}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary-action"
              onClick={() => {
                setDepartmentToEdit(null);
                setIsFormOpen(true);
              }}
            >
              <FaPlus /> Add First Department
            </button>
          )}
        </div>
      ) : (
        <div className="dept-cards-grid">
          {displayedDepartments.map((dept) => {
            const IconComp = ICON_MAP[dept.icon] || FaStethoscope;
            const doctorCount = dept.doctorCount || 0;
            const appointmentCount = dept.appointmentCount || 0;

            return (
              <div
                key={dept._id}
                className={`dept-card ${!dept.isActive ? "dept-card-inactive" : ""}`}
              >
                <div className="dept-card-header">
                  <div className="dept-card-icon-title">
                    <div className="dept-icon-avatar">
                      <IconComp />
                    </div>
                    <div>
                      <h3 className="dept-title">{dept.name}</h3>
                      <div className="dept-hod-row">
                        <span className="hod-label">HOD:</span>
                        <span className="hod-name">
                          {dept.headOfDepartment || "Not Appointed"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="dept-status-badge-wrap"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "4px",
                    }}
                  >
                    <span
                      className={`status-pill ${
                        dept.isActive ? "status-active" : "status-inactive"
                      }`}
                    >
                      <span className="status-dot"></span>
                      {dept.isActive ? "Active" : "Inactive"}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 650,
                        color: dept.isActive ? "#16a34a" : "#94a3b8",
                      }}
                    >
                      {dept.isActive
                        ? "✓ Publicly Bookable"
                        : "Booking Disabled"}
                    </span>
                  </div>
                </div>

                <div className="dept-card-body">
                  <p className="dept-description">
                    {dept.description ||
                      "No clinical description provided for this department yet."}
                  </p>

                  <div className="dept-stats-row">
                    <div className="dept-stat-item">
                      <FaUserMd className="dept-stat-ico" />
                      <div>
                        <strong>{doctorCount}</strong>
                        <span>Doctor{doctorCount === 1 ? "" : "s"}</span>
                      </div>
                    </div>

                    <div className="dept-stat-item">
                      <FaClipboardList className="dept-stat-ico" />
                      <div>
                        <strong>{appointmentCount}</strong>
                        <span>
                          Appointment{appointmentCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assigned doctors avatar preview */}
                  {dept.doctors && dept.doctors.length > 0 && (
                    <div className="dept-doctors-preview">
                      <span className="preview-label">Doctors:</span>
                      <div className="avatar-stack">
                        {dept.doctors.slice(0, 4).map((doc) => (
                          <div
                            key={doc._id}
                            className="avatar-stack-item"
                            title={`${formatDoctorName(doc.name)} (${doc.speciality || "Specialist"})`}
                          >
                            {doc.image ? (
                              <img
                                src={doc.image}
                                alt={doc.name}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                }}
                              />
                            ) : (
                              <span>{doc.name?.charAt(0) || "D"}</span>
                            )}
                          </div>
                        ))}
                        {dept.doctors.length > 4 && (
                          <div className="avatar-stack-more">
                            +{dept.doctors.length - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="dept-card-footer">
                  <div className="dept-actions-left">
                    <button
                      type="button"
                      className="dept-btn-action btn-assign-docs"
                      onClick={() => setDepartmentToMap(dept)}
                      title="Assign or reassign doctors to this department"
                    >
                      <FaUserPlus /> Doctors ({doctorCount})
                    </button>
                    <button
                      type="button"
                      className="dept-btn-action btn-edit-dept"
                      onClick={() => {
                        setDepartmentToEdit(dept);
                        setIsFormOpen(true);
                      }}
                      title="Edit department details"
                    >
                      <FaEdit /> Edit
                    </button>
                  </div>

                  <div className="dept-actions-right">
                    <button
                      type="button"
                      className={`btn-icon-toggle ${
                        dept.isActive ? "toggle-on" : "toggle-off"
                      }`}
                      onClick={() => handleToggleStatus(dept)}
                      title={
                        dept.isActive
                          ? "Click to deactivate department"
                          : "Click to activate department"
                      }
                    >
                      {dept.isActive ? <FaToggleOn /> : <FaToggleOff />}
                    </button>

                    <button
                      type="button"
                      className="btn-icon-delete"
                      onClick={() => setDepartmentToDelete(dept)}
                      title="Delete department"
                    >
                      <FaTrashAlt />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. General Hospital Services Companion Section */}
      <div className="premier-section-card" style={{ marginTop: "36px" }}>
        <div className="section-card-header">
          <div className="section-title-wrap">
            <span className="section-badge-ico">
              <FaShieldAlt />
            </span>
            <div>
              <h3>General Clinical Facilities & Services</h3>
              <p className="section-subtitle">
                Configure patient-facing hospital amenities, diagnostic
                facilities, and 24/7 care capabilities.
              </p>
            </div>
          </div>
          <span className="record-count">{services.length} Services</span>
        </div>

        <div className="services-tag-manager">
          <div className="services-tag-cloud">
            {services.length ? (
              services.map((service) => (
                <span className="service-pill" key={service}>
                  <FaCheck className="check-ico" />
                  {service}
                  <button
                    type="button"
                    aria-label={`Remove ${service}`}
                    onClick={() => handleRemoveService(service)}
                    disabled={savingServices}
                  >
                    <FaTimes />
                  </button>
                </span>
              ))
            ) : (
              <span className="no-services-notice">
                No general hospital services configured yet.
              </span>
            )}
          </div>

          <div className="add-service-input-group">
            <input
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              placeholder="e.g. 24x7 Trauma Care, MRI & CT Scan, Blood Bank, NICU, Dialysis Unit"
              className="premier-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddService();
                }
              }}
              disabled={savingServices}
            />
            <button
              type="button"
              className="btn-primary-action"
              onClick={handleAddService}
              disabled={savingServices || !serviceInput.trim()}
            >
              <FaPlus /> {savingServices ? "Saving…" : "Add Service"}
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isFormOpen && (
        <DepartmentFormModal
          department={departmentToEdit}
          onClose={() => {
            setIsFormOpen(false);
            setDepartmentToEdit(null);
          }}
          onSaved={() => {
            fetchDepartments();
            if (reloadHospital) reloadHospital();
          }}
          hospitalDoctors={hospitalDoctors}
        />
      )}

      {departmentToMap && (
        <DepartmentDoctorsModal
          department={departmentToMap}
          onClose={() => setDepartmentToMap(null)}
          onSaved={() => {
            fetchDepartments();
            fetchHospitalDoctors();
            if (reloadHospital) reloadHospital();
          }}
        />
      )}

      {departmentToDelete && (
        <DeleteDepartmentModal
          department={departmentToDelete}
          onClose={() => setDepartmentToDelete(null)}
          onDeleted={() => {
            fetchDepartments();
            if (reloadHospital) reloadHospital();
          }}
          onToggled={() => {
            fetchDepartments();
            if (reloadHospital) reloadHospital();
          }}
        />
      )}
    </div>
  );
}
