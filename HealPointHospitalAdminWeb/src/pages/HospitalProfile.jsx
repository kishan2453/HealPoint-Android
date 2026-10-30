import React, { useState, useEffect, useRef } from "react";
import {
  FaHospital,
  FaClinicMedical,
  FaPhoneAlt,
  FaEnvelope,
  FaGlobe,
  FaMapMarkerAlt,
  FaClock,
  FaAmbulance,
  FaProcedures,
  FaUpload,
  FaTrash,
  FaCheckCircle,
  FaExclamationTriangle,
  FaShieldAlt,
  FaBed,
  FaSave,
  FaUndo,
  FaUserMd,
  FaBriefcaseMedical,
} from "react-icons/fa";
import api from "../services/api";
import { toast } from "react-toastify";

const DEFAULT_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const STANDARD_FACILITIES = [
  "24/7 Emergency & Trauma",
  "ICU / Critical Care",
  "Advanced Operation Theatres",
  "24/7 Advanced Life Support Ambulance",
  "In-House Pharmacy",
  "Diagnostic Imaging (CT/MRI/X-Ray)",
  "Pathology & Microbiology Laboratory",
  "Blood Bank & Component Facility",
  "Dialysis Center",
  "Cafeteria & Patient Dining",
  "Ample Parking Facility",
];

export default function HospitalProfile({ hospital: initialHospital, reload }) {
  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hospital, setHospital] = useState(initialHospital || {});
  const [stats, setStats] = useState({
    doctorCount: 0,
    departmentCount: 0,
    servicesCount: 0,
    appointmentCount: 0,
    completeness: { percentage: 0, missing: [] },
  });

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    hospitalType: "Multispeciality Hospital",
    about: "",
    opdTimings: "Mon - Sat, 09:00 AM - 06:00 PM",
    logo: "",
    coverImage: "",
    beds: 120,
    icuBeds: 24,
    emergencyFacility: true,
    departments: "",
    services: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
    mapsUrl: "",
    email: "",
    reception: "",
    emergency: "",
    website: "",
    ambulance: true,
    icu: true,
    operationTheatre: true,
    facilities: [],
    operatingHours: DEFAULT_DAYS.map((day) => ({
      day,
      isOpen: day !== "Sunday",
      openTime: "09:00 AM",
      closeTime: day === "Saturday" ? "02:00 PM" : "06:00 PM",
    })),
  });

  // File Upload Previews
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Fetch full profile from backend
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/v1/hospital-admin/profile");
      const h = res.data?.hospital || {};
      setHospital(h);
      if (res.data?.stats) {
        setStats(res.data.stats);
      }

      // Initialize form with backend data
      const opHours =
        Array.isArray(h.operatingHours) && h.operatingHours.length
          ? h.operatingHours
          : DEFAULT_DAYS.map((day) => ({
              day,
              isOpen: day !== "Sunday",
              openTime: "09:00 AM",
              closeTime: day === "Saturday" ? "02:00 PM" : "06:00 PM",
            }));

      setFormData({
        name: h.name || "",
        hospitalType: h.hospitalType || "Multispeciality Hospital",
        about: h.about || "",
        opdTimings: h.opdTimings || "Mon - Sat, 09:00 AM - 06:00 PM",
        logo: h.logo || "",
        coverImage: h.coverImage || "",
        beds: h.beds ?? 120,
        icuBeds: h.icuBeds ?? 24,
        emergencyFacility: h.emergencyFacility ?? true,
        departments: (h.departments || []).join(", "),
        services: (h.services || []).join(", "),
        address: h.location?.address || "",
        city: h.location?.city || "",
        state: h.location?.state || "",
        country: h.location?.country || "India",
        pincode: h.location?.pincode || "",
        mapsUrl: h.location?.mapsUrl || "",
        email: h.contact?.email || "",
        reception: h.contact?.reception || "",
        emergency: h.contact?.emergency || "",
        website: h.contact?.website || "",
        ambulance: h.facilitiesInfo?.ambulance ?? true,
        icu: h.facilitiesInfo?.icu ?? true,
        operationTheatre: h.facilitiesInfo?.operationTheatre ?? true,
        facilities:
          h.facilitiesInfo?.facilities || STANDARD_FACILITIES.slice(0, 6),
        operatingHours: opHours,
      });

      setLogoPreview(h.logo || "");
      setCoverPreview(h.coverImage || "");
      setIsDirty(false);
    } catch (err) {
      console.error("Failed to load hospital profile:", err);
      toast.error(
        err.response?.data?.message || "Failed to load hospital profile",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setIsDirty(true);
  };

  // Operating Hours Change
  const handleDayToggle = (index) => {
    setFormData((prev) => {
      const updated = [...prev.operatingHours];
      updated[index] = { ...updated[index], isOpen: !updated[index].isOpen };
      return { ...prev, operatingHours: updated };
    });
    setIsDirty(true);
  };

  const handleTimeChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.operatingHours];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, operatingHours: updated };
    });
    setIsDirty(true);
  };

  // Facilities Checkbox Toggle
  const handleFacilityToggle = (facName) => {
    setFormData((prev) => {
      const exists = prev.facilities.includes(facName);
      const updated = exists
        ? prev.facilities.filter((f) => f !== facName)
        : [...prev.facilities, facName];
      return { ...prev, facilities: updated };
    });
    setIsDirty(true);
  };

  // Image Upload Handlers
  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Logo file size must be less than 8 MB");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
    setIsDirty(true);
  };

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Cover banner file size must be less than 8 MB");
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target.result);
    reader.readAsDataURL(file);
    setIsDirty(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    // Frontend Validations
    if (!formData.name.trim()) {
      return toast.error("Hospital Name is required");
    }
    if (!formData.address.trim()) {
      return toast.error("Street Address is required");
    }
    if (!formData.reception.trim()) {
      return toast.error("Reception Phone number is required");
    }
    if (!formData.emergency.trim()) {
      return toast.error("Emergency Contact number is required");
    }
    if (
      formData.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      return toast.error("Please provide a valid official email address");
    }

    try {
      setSubmitting(true);

      const payload = new FormData();
      payload.append("name", formData.name.trim());
      payload.append("hospitalType", formData.hospitalType.trim());
      payload.append("about", formData.about.trim());
      payload.append("opdTimings", formData.opdTimings.trim());
      payload.append("beds", String(formData.beds));
      payload.append("icuBeds", String(formData.icuBeds));
      payload.append("emergencyFacility", String(formData.emergencyFacility));

      // Operating Hours array
      payload.append("operatingHours", JSON.stringify(formData.operatingHours));

      // Location object
      payload.append(
        "location",
        JSON.stringify({
          address: formData.address.trim(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          country: formData.country.trim(),
          pincode: formData.pincode.trim(),
          mapsUrl: formData.mapsUrl.trim(),
        }),
      );

      // Contact object
      payload.append(
        "contact",
        JSON.stringify({
          reception: formData.reception.trim(),
          emergency: formData.emergency.trim(),
          email: formData.email.trim().toLowerCase(),
          website: formData.website.trim(),
        }),
      );

      // Departments & Services
      payload.append("departments", formData.departments);
      payload.append("services", formData.services);

      // Facilities Info
      payload.append(
        "facilitiesInfo",
        JSON.stringify({
          ambulance: formData.ambulance,
          icu: formData.icu,
          operationTheatre: formData.operationTheatre,
          facilities: formData.facilities,
        }),
      );

      // Media Uploads
      if (logoFile) {
        payload.append("logo", logoFile);
      } else if (formData.logo) {
        payload.append("logo", formData.logo);
      }

      if (coverFile) {
        payload.append("coverImage", coverFile);
      } else if (formData.coverImage) {
        payload.append("coverImage", formData.coverImage);
      }

      const res = await api.put("/api/v1/hospital-admin/profile", payload);
      toast.success("Hospital profile updated successfully!");

      if (res.data?.hospital) {
        setHospital(res.data.hospital);
      }
      if (res.data?.stats) {
        setStats((prev) => ({ ...prev, ...res.data.stats }));
      }

      setIsDirty(false);
      if (reload) reload();
    } catch (err) {
      console.error("Save profile error:", err);
      toast.error(
        err.response?.data?.message || "Failed to update hospital profile",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !hospital.name) {
    return (
      <div className="portal-loading">
        <span /> Loading hospital profile…
      </div>
    );
  }

  const completeness = stats.completeness || { percentage: 80, missing: [] };

  return (
    <div className="portal-page hospital-profile-page">
      {/* 1. Hero Identity Banner */}
      <div className="profile-hero-card">
        <div className="profile-cover-wrap">
          {coverPreview ? (
            <img
              src={coverPreview}
              alt="Hospital Cover"
              className="profile-cover-img"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <div className="profile-cover-fallback" />
          )}
          <button
            type="button"
            className="btn-change-cover"
            onClick={() => coverInputRef.current?.click()}
            title="Change cover banner"
          >
            <FaUpload /> Change Banner
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleCoverSelect}
          />
        </div>

        <div className="profile-header-meta">
          <div className="profile-logo-container">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Hospital Logo"
                className="profile-logo-img"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className="profile-logo-placeholder">
                <FaHospital />
              </div>
            )}
            <button
              type="button"
              className="profile-logo-upload-badge"
              onClick={() => logoInputRef.current?.click()}
              title="Upload logo"
            >
              <FaUpload />
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleLogoSelect}
            />
          </div>

          <div className="profile-hero-title-area">
            <div className="hero-status-pills">
              <span
                className={`status-badge ${
                  hospital.isActive ? "confirmed" : "cancel"
                }`}
              >
                {hospital.isActive ? "Active Hospital Facility" : "Suspended"}
              </span>
              <span className="badge-tier">
                {hospital.subscriptionPlan
                  ? `${hospital.subscriptionPlan.toUpperCase()} TIER`
                  : "PREMIER NETWORK"}
              </span>
              <span className="badge-rating">
                ★ {Number(hospital.rating || 4.8).toFixed(1)} Patient Trust
              </span>
            </div>

            <h1 className="profile-hospital-name">
              {hospital.name || "Hospital Facility"}
            </h1>
            <p className="profile-hospital-tagline">
              {hospital.hospitalType || "Multispeciality Hospital"} •{" "}
              {hospital.location?.city
                ? `${hospital.location.city}, ${hospital.location.state || "India"}`
                : "Licensed Healthcare Provider"}
            </p>

            {/* Completeness Bar */}
            <div className="completeness-bar-container">
              <div className="completeness-bar-header">
                <span className="completeness-label">
                  Profile Completeness:{" "}
                  <strong>{completeness.percentage}%</strong>
                </span>
                {completeness.percentage === 100 ? (
                  <span className="completeness-badge ok">
                    <FaCheckCircle /> 100% Ready
                  </span>
                ) : (
                  <span className="completeness-badge warn">
                    <FaExclamationTriangle />{" "}
                    {completeness.missing?.length || 0} fields missing
                  </span>
                )}
              </div>
              <div className="completeness-track">
                <div
                  className="completeness-fill"
                  style={{ width: `${completeness.percentage}%` }}
                />
              </div>
              {completeness.missing?.length > 0 && (
                <small className="completeness-missing-text">
                  To achieve 100% patient booking score, please add:{" "}
                  {completeness.missing.join(", ")}
                </small>
              )}
            </div>
          </div>
        </div>

        {/* Real Hospital KPI Counters */}
        <div className="profile-metrics-bar">
          <div className="metric-item">
            <span className="m-icon">
              <FaUserMd />
            </span>
            <div className="m-data">
              <strong>{stats.doctorCount || 0}</strong>
              <span>Medical Faculty</span>
            </div>
          </div>
          <div className="metric-item">
            <span className="m-icon">
              <FaClinicMedical />
            </span>
            <div className="m-data">
              <strong>{stats.departmentCount || 0}</strong>
              <span>Departments</span>
            </div>
          </div>
          <div className="metric-item">
            <span className="m-icon">
              <FaBed />
            </span>
            <div className="m-data">
              <strong>{hospital.beds || 120}</strong>
              <span>Inpatient Beds</span>
            </div>
          </div>
          <div className="metric-item">
            <span className="m-icon">
              <FaProcedures />
            </span>
            <div className="m-data">
              <strong>{hospital.icuBeds || 24}</strong>
              <span>ICU Capacity</span>
            </div>
          </div>
          <div className="metric-item">
            <span className="m-icon">
              <FaAmbulance />
            </span>
            <div className="m-data">
              <strong>
                {hospital.emergencyFacility ? "24x7" : "Day-only"}
              </strong>
              <span>Emergency Trauma</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Form Formations */}
      <form onSubmit={handleSubmit} className="hospital-profile-form">
        {/* Unsaved Changes Banner */}
        {isDirty && (
          <div className="unsaved-changes-sticky">
            <div className="unsaved-text">
              <FaShieldAlt /> You have unsaved changes to your hospital profile.
            </div>
            <div className="unsaved-actions">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={fetchProfile}
                disabled={submitting}
              >
                <FaUndo /> Discard
              </button>
              <button
                type="submit"
                className="btn-primary btn-sm"
                disabled={submitting}
              >
                <FaSave /> {submitting ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* Section A: General Facility Information */}
        <div className="profile-form-section">
          <div className="section-head">
            <FaHospital className="section-icon" />
            <div>
              <h3>General Facility Information</h3>
              <p>
                Core hospital identity, facility classification, and patient
                promise
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <label>Hospital Registered Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Anand Multi-Speciality Hospital"
                required
              />
            </div>

            <div className="form-field">
              <label>Hospital Classification / Category</label>
              <select
                name="hospitalType"
                value={formData.hospitalType}
                onChange={handleChange}
              >
                <option value="Multispeciality Hospital">
                  Multispeciality Hospital
                </option>
                <option value="Super Specialty Hospital">
                  Super Specialty Hospital
                </option>
                <option value="General Hospital">General Hospital</option>
                <option value="Children & Maternity Hospital">
                  Children & Maternity Hospital
                </option>
                <option value="Cardiology Institute">
                  Cardiology Institute
                </option>
                <option value="Orthopedic & Trauma Care">
                  Orthopedic & Trauma Care
                </option>
                <option value="Eye & Laser Center">Eye & Laser Center</option>
                <option value="Cancer Care & Research Center">
                  Cancer Care & Research Center
                </option>
              </select>
            </div>

            <div className="form-field full-width">
              <label>Hospital About / Public Description</label>
              <textarea
                name="about"
                rows="4"
                value={formData.about}
                onChange={handleChange}
                placeholder="Describe your hospital, clinical history, key milestones, and commitment to healthcare quality…"
              />
            </div>
          </div>
        </div>

        {/* Section B: Contact & Emergency Communications */}
        <div className="profile-form-section">
          <div className="section-head">
            <FaPhoneAlt className="section-icon" />
            <div>
              <h3>Contact & Emergency Hotlines</h3>
              <p>
                Communication channels displayed on the patient portal and
                appointment receipts
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-field">
              <label>Reception / OPD Desk Phone *</label>
              <input
                type="text"
                name="reception"
                value={formData.reception}
                onChange={handleChange}
                placeholder="e.g. +91 79 2658 1234 / 079-26581234"
                required
              />
            </div>

            <div className="form-field">
              <label>24/7 Emergency Hotline *</label>
              <input
                type="text"
                name="emergency"
                value={formData.emergency}
                onChange={handleChange}
                placeholder="e.g. 1066 / +91 98765 00000"
                required
              />
            </div>

            <div className="form-field">
              <label>Official Contact Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@hospital.com"
                required
              />
            </div>

            <div className="form-field">
              <label>Hospital Website URL</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://www.hospital.org"
              />
            </div>
          </div>
        </div>

        {/* Section C: Location & Physical Campus */}
        <div className="profile-form-section">
          <div className="section-head">
            <FaMapMarkerAlt className="section-icon" />
            <div>
              <h3>Location & Physical Campus</h3>
              <p>
                Accurate geographical details for patient navigation and
                directions
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-field full-width">
              <label>Street Address & Landmark *</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="e.g. Sector 12, Riverfront Road, Near Ellisbridge"
                required
              />
            </div>

            <div className="form-field">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g. Ahmedabad"
              />
            </div>

            <div className="form-field">
              <label>State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="e.g. Gujarat"
              />
            </div>

            <div className="form-field">
              <label>Postal Pincode</label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="e.g. 380009"
              />
            </div>

            <div className="form-field">
              <label>Country</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="e.g. India"
              />
            </div>

            <div className="form-field full-width">
              <label>Google Maps Directions URL</label>
              <input
                type="url"
                name="mapsUrl"
                value={formData.mapsUrl}
                onChange={handleChange}
                placeholder="https://maps.google.com/?q=..."
              />
            </div>
          </div>
        </div>

        {/* Section D: Operating Hours & OPD Timings */}
        <div className="profile-form-section">
          <div className="section-head">
            <FaClock className="section-icon" />
            <div>
              <h3>OPD Operating Hours & Weekly Schedule</h3>
              <p>Configure OPD consulting hours and emergency availability</p>
            </div>
          </div>

          <div className="form-grid-2" style={{ marginBottom: 16 }}>
            <div className="form-field full-width">
              <label>General OPD Schedule Summary String</label>
              <input
                type="text"
                name="opdTimings"
                value={formData.opdTimings}
                onChange={handleChange}
                placeholder="e.g. Mon - Sat, 09:00 AM - 06:00 PM (Emergency 24x7)"
              />
            </div>
          </div>

          <div className="operating-hours-table">
            <span className="table-caption">Day-by-Day OPD Timing Config</span>
            <div className="schedule-grid-list">
              {formData.operatingHours.map((item, idx) => (
                <div
                  key={item.day}
                  className={`schedule-day-card ${item.isOpen ? "is-enabled" : "is-disabled"}`}
                >
                  <div className="day-card-header">
                    <label className="day-checkbox-label">
                      <input
                        type="checkbox"
                        checked={item.isOpen}
                        onChange={() => handleDayToggle(idx)}
                      />
                      <span className="day-label-text">{item.day}</span>
                    </label>
                    <span
                      className={`day-status-indicator ${item.isOpen ? "open" : "closed"}`}
                    >
                      {item.isOpen ? "Open" : "Closed"}
                    </span>
                  </div>

                  {item.isOpen ? (
                    <div className="day-time-pickers">
                      <div className="time-field">
                        <label>Opening Time</label>
                        <input
                          type="text"
                          value={item.openTime}
                          onChange={(e) =>
                            handleTimeChange(idx, "openTime", e.target.value)
                          }
                          placeholder="09:00 AM"
                        />
                      </div>
                      <span className="time-separator">to</span>
                      <div className="time-field">
                        <label>Closing Time</label>
                        <input
                          type="text"
                          value={item.closeTime}
                          onChange={(e) =>
                            handleTimeChange(idx, "closeTime", e.target.value)
                          }
                          placeholder="06:00 PM"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="day-off-notice">
                      OPD Consultations Closed on {item.day}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section E: Clinical Infrastructure & Facilities */}
        <div className="profile-form-section">
          <div className="section-head">
            <FaBriefcaseMedical className="section-icon" />
            <div>
              <h3>Clinical Infrastructure & Inpatient Capacity</h3>
              <p>
                Bed counts, critical care units, and clinical utility features
              </p>
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-field">
              <label>Total Inpatient Beds</label>
              <input
                type="number"
                min="0"
                name="beds"
                value={formData.beds}
                onChange={handleChange}
                placeholder="120"
              />
            </div>

            <div className="form-field">
              <label>ICU & CCU Critical Beds</label>
              <input
                type="number"
                min="0"
                name="icuBeds"
                value={formData.icuBeds}
                onChange={handleChange}
                placeholder="24"
              />
            </div>

            <div className="form-field">
              <label>24/7 Emergency Wing</label>
              <div className="toggle-switch-wrapper">
                <input
                  type="checkbox"
                  id="emergencySwitch"
                  name="emergencyFacility"
                  checked={formData.emergencyFacility}
                  onChange={handleChange}
                />
                <label htmlFor="emergencySwitch" className="switch-label">
                  {formData.emergencyFacility ? "24/7 Active" : "Disabled"}
                </label>
              </div>
            </div>
          </div>

          <div className="facilities-checkbox-container">
            <label className="facilities-section-title">
              Available Hospital Facilities
            </label>
            <div className="facilities-grid">
              {STANDARD_FACILITIES.map((facility) => {
                const checked = formData.facilities.includes(facility);
                return (
                  <label
                    key={facility}
                    className={`facility-chip-card ${checked ? "is-selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleFacilityToggle(facility)}
                    />
                    <span className="facility-name">{facility}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="form-grid-2" style={{ marginTop: 16 }}>
            <div className="form-field full-width">
              <label>Clinical Departments (Comma Separated)</label>
              <input
                type="text"
                name="departments"
                value={formData.departments}
                onChange={handleChange}
                placeholder="Cardiology, Neurology, Orthopedics, Pediatrics, Oncology, Dermatology"
              />
            </div>

            <div className="form-field full-width">
              <label>Clinical & Surgical Services (Comma Separated)</label>
              <input
                type="text"
                name="services"
                value={formData.services}
                onChange={handleChange}
                placeholder="Open Heart Surgery, Joint Replacement, MRI Scan, Dialysis, Chemotherapy"
              />
            </div>
          </div>
        </div>

        {/* 3. Footer Action Controls */}
        <div className="profile-form-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={fetchProfile}
            disabled={submitting}
          >
            Reset Form
          </button>
          <button
            type="submit"
            className="btn-primary btn-save-profile"
            disabled={submitting}
          >
            <FaSave />{" "}
            {submitting ? "Saving Profile…" : "Save Hospital Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
