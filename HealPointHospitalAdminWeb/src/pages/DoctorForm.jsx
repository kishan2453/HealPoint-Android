import React, { useState, useRef } from "react";
import { FaTimes, FaUserMd, FaUpload, FaTrash } from "react-icons/fa";

const SPECIALITIES = [
  "Cardiologist",
  "Neurologist",
  "Dentist",
  "Orthopedic",
  "Pediatrician",
  "Dermatologist",
  "Psychiatrist",
  "ENT Specialist",
  "Eye Specialist",
  "General Physician",
  "Surgeon",
  "Emergency Specialist",
];

function DoctorForm({ doctor, onSave, onCancel, departments = [] }) {
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState(
    doctor
      ? {
          name: doctor.name || "",
          email: doctor.email || "",
          password: "",
          phone: doctor.phone || "",
          speciality: doctor.speciality || doctor.specialization || "",
          specialization: doctor.specialization || "",
          department: doctor.department || "",
          qualification: doctor.qualification || "",
          experience: doctor.experience || "",
          fees: doctor.fees || "",
          registrationNumber:
            doctor.registrationNumber ||
            doctor.medicalCouncilRegistrationNumber ||
            "",
          availabilitySchedule:
            doctor.availabilitySchedule || "Mon - Sat, 09:00 AM - 05:00 PM",
          isActive: doctor.isActive === undefined ? true : doctor.isActive,
          image: doctor.image || "",
        }
      : {
          name: "",
          email: "",
          password: "",
          phone: "",
          speciality: "",
          specialization: "",
          department: "",
          qualification: "",
          experience: "",
          fees: "",
          registrationNumber: "",
          availabilitySchedule: "Mon - Sat, 09:00 AM - 05:00 PM",
          isActive: true,
          image: "",
        },
  );
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(doctor?.image || "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Please select a valid image file (JPG, PNG, etc.)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setFormError("Image must be less than 8 MB");
      return;
    }
    setFormError("");
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setImagePreview(event.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    // Client-side validation
    if (!formData.name.trim()) return setFormError("Full name is required");
    if (!formData.email.trim()) return setFormError("Email is required");
    if (
      formData.email.includes("..") ||
      !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(
        formData.email.trim(),
      )
    )
      return setFormError("Please enter a valid email address");
    if (!doctor && !formData.password)
      return setFormError("Password is required for new doctors");
    if (!doctor && formData.password.length < 6)
      return setFormError("Password must be at least 6 characters");
    if (!formData.phone.trim()) return setFormError("Phone number is required");
    if (!/^[6-9]\d{9}$/.test(formData.phone.replace(/\D/g, "")))
      return setFormError("Please enter a valid 10-digit Indian mobile number");
    if (!formData.speciality) return setFormError("Specialization is required");
    if (!formData.experience) return setFormError("Experience is required");
    if (Number(formData.experience) < 1 || Number(formData.experience) > 60)
      return setFormError("Experience must be between 1 and 60 years");
    if (!formData.fees) return setFormError("Consultation fee is required");
    if (Number(formData.fees) < 100)
      return setFormError("Consultation fee must be at least 100");

    // Build FormData for multipart upload (supports image file upload)
    const payload = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (key === "password" && !value) return; // Don't send empty password on edit
      if (key === "image") return; // image handled separately
      payload.append(key, value);
    });
    if (imageFile) {
      payload.append("image", imageFile);
    } else if (formData.image && !imageFile) {
      // Keep existing image URL on edit
      payload.append("image", formData.image);
    }

    setSubmitting(true);
    onSave(payload, () => setSubmitting(false));
  };

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div
        className="detail-modal doctor-form-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          onClick={onCancel}
          aria-label="Close"
        >
          <FaTimes />
        </button>
        <div className="doctor-form-header">
          <span className="doctor-form-icon">
            <FaUserMd />
          </span>
          <div>
            <h2>{doctor ? "Edit Doctor" : "Add New Doctor"}</h2>
            <p>
              {doctor
                ? "Update the doctor's professional details."
                : "Register a new doctor to your hospital."}
            </p>
          </div>
        </div>

        {formError && <div className="form-error-banner">{formError}</div>}

        <form onSubmit={handleSubmit} className="doctor-form">
          {/* Profile Photo */}
          <div className="doctor-form-section doctor-form-photo-section">
            <label className="doctor-form-label">Profile Photo</label>
            <div className="doctor-photo-upload">
              {imagePreview ? (
                <div className="doctor-photo-preview">
                  <img src={imagePreview} alt="Doctor profile preview" />
                  <button
                    type="button"
                    className="doctor-photo-remove"
                    onClick={removeImage}
                    title="Remove photo"
                  >
                    <FaTrash />
                  </button>
                </div>
              ) : (
                <div
                  className="doctor-photo-placeholder"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FaUserMd />
                  <span>Click to upload</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />
              {!imagePreview && (
                <button
                  type="button"
                  className="doctor-photo-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FaUpload /> Upload Photo
                </button>
              )}
            </div>
          </div>

          {/* Personal Information */}
          <div className="doctor-form-section">
            <h3>Personal Information</h3>
            <div className="doctor-form-grid">
              <label className="doctor-form-field">
                <span>Full Name *</span>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Dr. John Doe"
                  required
                />
              </label>
              <label className="doctor-form-field">
                <span>Email *</span>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="doctor@hospital.com"
                  required
                />
              </label>
              <label className="doctor-form-field">
                <span>Phone *</span>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10-digit mobile number"
                  required
                />
              </label>
              {!doctor && (
                <label className="doctor-form-field">
                  <span>Password *</span>
                  <input
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                    required={!doctor}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Professional Information */}
          <div className="doctor-form-section">
            <h3>Professional Information</h3>
            <div className="doctor-form-grid">
              <label className="doctor-form-field">
                <span>Specialization *</span>
                <select
                  name="speciality"
                  value={formData.speciality}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select specialization…</option>
                  {SPECIALITIES.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </label>
              <label className="doctor-form-field">
                <span>Sub-specialization</span>
                <input
                  name="specialization"
                  value={formData.specialization}
                  onChange={handleChange}
                  placeholder="e.g. Interventional Cardiology"
                />
              </label>
              <label className="doctor-form-field">
                <span>Department</span>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                >
                  <option value="">Select department…</option>
                  {departments.length > 0 ? (
                    departments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="General Physician">
                        General Physician
                      </option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Neurology">Neurology</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="ENT">ENT</option>
                      <option value="Ophthalmology">Ophthalmology</option>
                    </>
                  )}
                </select>
              </label>
              <label className="doctor-form-field">
                <span>Qualification</span>
                <input
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleChange}
                  placeholder="e.g. MBBS, MD"
                />
              </label>
              <label className="doctor-form-field">
                <span>Experience (years) *</span>
                <input
                  name="experience"
                  type="number"
                  min="1"
                  max="60"
                  value={formData.experience}
                  onChange={handleChange}
                  placeholder="e.g. 10"
                  required
                />
              </label>
              <label className="doctor-form-field">
                <span>Consultation Fee (₹) *</span>
                <input
                  name="fees"
                  type="number"
                  min="100"
                  value={formData.fees}
                  onChange={handleChange}
                  placeholder="e.g. 500"
                  required
                />
              </label>
              <label className="doctor-form-field">
                <span>Medical Registration Number</span>
                <input
                  name="registrationNumber"
                  value={formData.registrationNumber}
                  onChange={handleChange}
                  placeholder="e.g. MCI-123456"
                />
              </label>
            </div>
          </div>

          {/* Availability */}
          <div className="doctor-form-section">
            <h3>Availability / Schedule</h3>
            <div className="doctor-form-grid">
              <label className="doctor-form-field doctor-form-field-full">
                <span>Weekly Schedule</span>
                <input
                  name="availabilitySchedule"
                  value={formData.availabilitySchedule}
                  onChange={handleChange}
                  placeholder="e.g. Mon - Sat, 09:00 AM - 05:00 PM"
                />
              </label>
            </div>
          </div>

          {/* Status */}
          <div className="doctor-form-section">
            <h3>Status</h3>
            <label className="doctor-form-toggle">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
              />
              <span className="doctor-form-toggle-track" />
              <span className="doctor-form-toggle-label">
                {formData.isActive ? "Active" : "Inactive"}
              </span>
            </label>
          </div>

          <div className="doctor-form-actions">
            <button
              type="button"
              className="doctor-form-cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="doctor-form-submit"
              disabled={submitting}
            >
              {submitting ? "Saving…" : doctor ? "Update Doctor" : "Add Doctor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DoctorForm;
