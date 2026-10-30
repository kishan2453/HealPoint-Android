import React from "react";
import {
  FaTimes,
  FaUserMd,
  FaEnvelope,
  FaPhone,
  FaHospital,
  FaCalendarCheck,
  FaStar,
  FaClock,
  FaIdCard,
  FaBriefcase,
  FaRupeeSign,
} from "react-icons/fa";
import { formatDoctorName } from "../services/doctorFormat";

export default function DoctorDetailsModal({
  doctor,
  onClose,
  onEdit,
  onManageSchedule,
}) {
  if (!doctor) return null;

  const stats = doctor.stats || {};
  const weeklySchedule = doctor.weeklySchedule || [];

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="detail-modal doctor-details-modal"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="doctor-details-title"
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <FaTimes />
        </button>

        {/* Modal Header */}
        <div className="doctor-details-header">
          <div className="doctor-details-avatar-wrap">
            {doctor.image ? (
              <img
                src={doctor.image}
                alt={doctor.name}
                className="doctor-details-avatar"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className="doctor-details-avatar-placeholder">
                <FaUserMd />
              </div>
            )}
            <span
              className={`doctor-status-dot ${doctor.isActive ? "active" : "inactive"}`}
              title={doctor.isActive ? "Active" : "Inactive"}
            />
          </div>

          <div className="doctor-details-title-info">
            <div className="doctor-details-badges">
              <span
                className={`status-badge ${doctor.isActive ? "confirmed" : "cancel"}`}
              >
                {doctor.isActive ? "Active Doctor" : "Inactive"}
              </span>
              <span
                className={`status-badge ${doctor.available ? "confirmed" : "cancel"}`}
              >
                {doctor.available ? "Available for Booking" : "Unavailable"}
              </span>
              {doctor.verificationStatus && (
                <span className="badge-verified">
                  {doctor.verificationStatus}
                </span>
              )}
            </div>

            <h2 id="doctor-details-title">{formatDoctorName(doctor.name)}</h2>
            <p className="doctor-details-sub">
              {doctor.degree || doctor.qualification || "MBBS"} •{" "}
              <strong>{doctor.speciality || doctor.specialization}</strong>
              {doctor.department && ` • ${doctor.department} Dept`}
            </p>

            <div className="doctor-details-meta-row">
              {doctor.experience && (
                <span>
                  <FaBriefcase /> {doctor.experience} yrs experience
                </span>
              )}
              <span>
                <FaRupeeSign /> ₹{doctor.fees || 500} Consultation Fee
              </span>
              {doctor.rating ? (
                <span>
                  <FaStar className="star-icon" />{" "}
                  {Number(doctor.rating).toFixed(1)} / 5.0
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="doctor-details-body">
          {/* Quick Metrics Bar */}
          <div className="doctor-metric-grid">
            <div className="doctor-metric-card">
              <span className="metric-icon">
                <FaCalendarCheck />
              </span>
              <div>
                <strong className="metric-val">
                  {stats.totalAppointments ?? 0}
                </strong>
                <span className="metric-lbl">Total Appointments</span>
              </div>
            </div>
            <div className="doctor-metric-card">
              <span className="metric-icon success">
                <FaCalendarCheck />
              </span>
              <div>
                <strong className="metric-val">
                  {stats.completedAppointments ?? 0}
                </strong>
                <span className="metric-lbl">Completed</span>
              </div>
            </div>
            <div className="doctor-metric-card">
              <span className="metric-icon warning">
                <FaClock />
              </span>
              <div>
                <strong className="metric-val">
                  {stats.upcomingAppointments ?? 0}
                </strong>
                <span className="metric-lbl">Upcoming / Pending</span>
              </div>
            </div>
            <div className="doctor-metric-card">
              <span className="metric-icon primary">
                <FaStar />
              </span>
              <div>
                <strong className="metric-val">
                  {stats.avgRating ?? doctor.rating ?? "4.8"} ★
                </strong>
                <span className="metric-lbl">Patient Rating</span>
              </div>
            </div>
          </div>

          {/* Contact & Registration Information */}
          <div className="doctor-details-section">
            <h3>Contact & Credentials</h3>
            <div className="doctor-info-grid">
              <div className="doctor-info-item">
                <FaEnvelope className="info-icon" />
                <div>
                  <span className="info-label">Email Address</span>
                  <span className="info-value">{doctor.email || "—"}</span>
                </div>
              </div>
              <div className="doctor-info-item">
                <FaPhone className="info-icon" />
                <div>
                  <span className="info-label">Phone Number</span>
                  <span className="info-value">{doctor.phone || "—"}</span>
                </div>
              </div>
              <div className="doctor-info-item">
                <FaIdCard className="info-icon" />
                <div>
                  <span className="info-label">Medical Registration No.</span>
                  <span className="info-value">
                    {doctor.registrationNumber ||
                      doctor.medicalCouncilRegistrationNumber ||
                      "Verified Hospital Staff"}
                  </span>
                </div>
              </div>
              <div className="doctor-info-item">
                <FaHospital className="info-icon" />
                <div>
                  <span className="info-label">Hospital Location</span>
                  <span className="info-value">
                    {doctor.address || "Main Hospital Facility"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Biography / About */}
          {doctor.about && (
            <div className="doctor-details-section">
              <h3>Professional Biography</h3>
              <p className="doctor-bio-text">{doctor.about}</p>
            </div>
          )}

          {/* Working Hours / Schedule Preview */}
          <div className="doctor-details-section">
            <div className="section-header-flex">
              <h3>Weekly OPD Schedule</h3>
              {onManageSchedule && (
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => {
                    onClose();
                    onManageSchedule(doctor);
                  }}
                >
                  Edit Schedule
                </button>
              )}
            </div>

            {weeklySchedule.length > 0 ? (
              <div className="schedule-preview-table">
                {weeklySchedule.map((item, idx) => (
                  <div
                    key={idx}
                    className={`schedule-day-row ${item.enabled ? "is-active" : "is-off"}`}
                  >
                    <span className="day-name">{item.day}</span>
                    <span className="day-hours">
                      {item.enabled
                        ? `${item.startTime || "09:00 AM"} - ${item.endTime || "05:00 PM"}`
                        : "Day Off / Not Available"}
                    </span>
                    <span
                      className={`day-tag ${item.enabled ? "tag-on" : "tag-off"}`}
                    >
                      {item.enabled ? "Active" : "Closed"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="schedule-summary-text">
                {doctor.availabilitySchedule ||
                  "Monday to Saturday (09:00 AM – 05:00 PM)"}
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="doctor-details-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                onClose();
                onEdit(doctor);
              }}
            >
              Edit Doctor Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
