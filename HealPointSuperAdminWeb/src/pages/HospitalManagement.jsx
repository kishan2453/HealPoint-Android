import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaEdit,
  FaHospital,
  FaPause,
  FaPlay,
  FaPlus,
  FaTrash,
  FaUpload,
  FaImage,
  FaGlobe,
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaBuilding,
  FaStethoscope,
  FaCogs,
  FaEye,
  FaSearch,
  FaTimes,
  FaChevronLeft,
  FaChevronRight,
  FaSyncAlt,
} from "react-icons/fa";
import Layout from "../components/Layout/Layout";
import ConfirmDialog from "../components/common/ConfirmDialog";
import API from "../Api/API";
import toast from "../utils/notify";

const emptyForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  mapsUrl: "",
  phone: "",
  email: "",
  website: "",
  logo: "",
  coverImage: "",
  departments: "",
  services: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
};

const HospitalManagement = () => {
  const [hospitals, setHospitals] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    city: "all",
  });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [page, setPage] = useState(1);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const PAGE_SIZE = 8;

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await API.get("/hospital/get-all");
      setHospitals(data.hospitals || []);
    } catch (error) {
      setLoadError(error.response?.data?.message || "Unable to load hospitals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cityOptions = useMemo(
    () =>
      [
        ...new Set(
          (hospitals || [])
            .map((hospital) => hospital.location?.city)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [hospitals],
  );

  const filteredHospitals = useMemo(
    () =>
      hospitals.filter((hospital) => {
        const search = filters.search.trim().toLowerCase();
        const matchesSearch =
          !search ||
          [
            hospital.name,
            hospital.slug,
            hospital.location?.address,
            hospital.location?.city,
            hospital.location?.state,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search));
        const matchesStatus =
          filters.status === "all" ||
          (filters.status === "active"
            ? hospital.isActive
            : !hospital.isActive);
        const matchesCity =
          filters.city === "all" || hospital.location?.city === filters.city;
        return matchesSearch && matchesStatus && matchesCity;
      }),
    [hospitals, filters],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredHospitals.length / PAGE_SIZE),
  );
  const visibleHospitals = useMemo(
    () =>
      filteredHospitals.slice(
        (Math.min(page, totalPages) - 1) * PAGE_SIZE,
        Math.min(page, totalPages) * PAGE_SIZE,
      ),
    [filteredHospitals, page, totalPages],
  );

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, filters.city]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormErrors({});
    setLogoFile(null);
    setLogoPreview("");
    setCoverFile(null);
    setCoverPreview("");
    if (logoInputRef.current) logoInputRef.current.value = "";
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const startEdit = (hospital) => {
    setEditing(hospital);
    setForm({
      name: hospital.name || "",
      address: hospital.location?.address || "",
      city: hospital.location?.city || "",
      state: hospital.location?.state || "",
      pincode: hospital.location?.pincode || "",
      mapsUrl: hospital.location?.mapsUrl || "",
      phone: hospital.contact?.phone || hospital.contact?.reception || "",
      email: hospital.contact?.email || "",
      website: hospital.contact?.website || "",
      logo: hospital.logo || "",
      coverImage: hospital.coverImage || "",
      departments: (hospital.departments || []).join(", "),
      services: (hospital.services || []).join(", "),
      adminName: "",
      adminEmail: "",
      adminPassword: "",
    });
    setLogoPreview(hospital.logo || "");
    setCoverPreview(hospital.coverImage || "");
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be less than 8 MB");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setLogoPreview(event.target.result);
    reader.readAsDataURL(file);
  };

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be less than 8 MB");
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (event) => setCoverPreview(event.target.result);
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const errors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.name.trim()) errors.name = "Hospital name is required";
    if (!form.address.trim()) errors.address = "Address is required";
    if (!form.city.trim()) errors.city = "City is required";
    if (!form.state.trim()) errors.state = "State is required";
    if (!form.pincode.trim()) errors.pincode = "Pincode is required";
    if (!form.phone.trim()) errors.phone = "Phone is required";
    if (!form.email.trim()) {
      errors.email = "Email is required";
    } else if (!emailPattern.test(form.email.trim())) {
      errors.email = "Please enter a valid email address";
    }
    if (form.mapsUrl && !/^https?:\/\//i.test(form.mapsUrl.trim())) {
      errors.mapsUrl = "Maps URL must start with http:// or https://";
    }
    if (form.website && !/^https?:\/\//i.test(form.website.trim())) {
      errors.website = "Website must start with http:// or https://";
    }
    if (!editing) {
      if (!form.adminName.trim()) errors.adminName = "Admin name is required";
      if (!form.adminEmail.trim()) {
        errors.adminEmail = "Admin email is required";
      } else if (!emailPattern.test(form.adminEmail.trim())) {
        errors.adminEmail = "Please enter a valid admin email";
      }
      if (!form.adminPassword.trim()) {
        errors.adminPassword = "Admin password is required";
      } else if (form.adminPassword.trim().length < 6) {
        errors.adminPassword = "Password must be at least 6 characters";
      }
    }
    return errors;
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      toast.error("Please fix the highlighted fields below");
      return;
    }
    setFormErrors({});
    setBusy(true);
    try {
      const payload = {
        ...form,
        departments: form.departments
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        services: form.services
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      if (logoFile) payload.logo = logoPreview;
      if (coverFile) payload.coverImage = coverPreview;

      if (editing) {
        await API.patch(`/hospital/${editing._id}`, payload);
        toast.success("Hospital updated successfully");
      } else {
        await API.post("/hospital/create-with-admin", payload);
        toast.success("Hospital and first admin created successfully");
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save hospital");
    } finally {
      setBusy(false);
    }
  };

  const toggleHospital = async (hospital) => {
    try {
      await API.patch(`/hospital/${hospital._id}/status`, {
        isActive: !hospital.isActive,
      });
      toast.success(
        `Hospital ${hospital.isActive ? "suspended" : "activated"}`,
      );
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update hospital status",
      );
    }
  };

  const requestDelete = (hospital) => setConfirmDelete(hospital);

  const confirmDeleteHospital = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await API.delete(`/hospital/${confirmDelete._id}`);
      toast.success("Hospital deleted");
      setConfirmDelete(null);
      await load();
    } catch (error) {
      setConfirmDelete(null);
      toast.error(
        error.response?.data?.message || "Hospital could not be deleted",
      );
    } finally {
      setDeleting(false);
    }
  };

  const setField = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Layout>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Platform ownership</span>
          <h2>Hospitals</h2>
          <p>
            Manage hospital lifecycle and basic platform summaries. Patient and
            appointment records stay private.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={resetForm}>
          <FaPlus /> New Hospital
        </button>
      </section>

      <section className="admin-grid-two">
        <form className="panel-card" onSubmit={submit}>
          <h3>
            <FaHospital /> {editing ? "Edit Hospital" : "Create Hospital"}
          </h3>

          <h4>Branding</h4>
          <label className="form-label">
            Hospital Name
            <input
              required
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
            />
            {formErrors.name && (
              <span className="admin-field-error">{formErrors.name}</span>
            )}
          </label>

          <div className="admin-account-grid compact">
            <div className="form-label">
              <span>Hospital Logo</span>
              <div className="hospital-logo-upload">
                {logoPreview ? (
                  <div className="hospital-logo-preview">
                    <img src={logoPreview} alt="Hospital logo preview" />
                    <button
                      type="button"
                      className="hospital-logo-remove"
                      onClick={() => {
                        setLogoFile(null);
                        setLogoPreview("");
                        if (logoInputRef.current)
                          logoInputRef.current.value = "";
                      }}
                      title="Remove logo"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    className="hospital-logo-placeholder"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <FaImage /> <span>Upload Logo</span>
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  style={{ display: "none" }}
                />
                {!logoPreview && (
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <FaUpload /> Upload Logo
                  </button>
                )}
              </div>
            </div>
            <div className="form-label">
              <span>Hospital Cover Image</span>
              <div className="hospital-logo-upload">
                {coverPreview ? (
                  <div className="hospital-logo-preview cover">
                    <img src={coverPreview} alt="Hospital cover preview" />
                    <button
                      type="button"
                      className="hospital-logo-remove"
                      onClick={() => {
                        setCoverFile(null);
                        setCoverPreview("");
                        if (coverInputRef.current)
                          coverInputRef.current.value = "";
                      }}
                      title="Remove cover"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    className="hospital-logo-placeholder"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    <FaImage /> <span>Upload Cover</span>
                  </div>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  style={{ display: "none" }}
                />
                {!coverPreview && (
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => coverInputRef.current?.click()}
                  >
                    <FaUpload /> Upload Cover
                  </button>
                )}
              </div>
            </div>
          </div>

          <h4>Location</h4>
          <label className="form-label">
            Address
            <input
              required
              value={form.address}
              onChange={(event) => setField("address", event.target.value)}
            />
            {formErrors.address && (
              <span className="admin-field-error">{formErrors.address}</span>
            )}
          </label>
          <div className="admin-account-grid compact">
            <label className="form-label">
              City
              <input
                required
                value={form.city}
                onChange={(event) => setField("city", event.target.value)}
              />
              {formErrors.city && (
                <span className="admin-field-error">{formErrors.city}</span>
              )}
            </label>
            <label className="form-label">
              State
              <input
                required
                value={form.state}
                onChange={(event) => setField("state", event.target.value)}
              />
              {formErrors.state && (
                <span className="admin-field-error">{formErrors.state}</span>
              )}
            </label>
            <label className="form-label">
              Pincode
              <input
                required
                value={form.pincode}
                onChange={(event) => setField("pincode", event.target.value)}
              />
              {formErrors.pincode && (
                <span className="admin-field-error">{formErrors.pincode}</span>
              )}
            </label>
          </div>
          <label className="form-label">
            Google Maps URL <small>(optional)</small>
            <input
              type="url"
              value={form.mapsUrl}
              onChange={(event) => setField("mapsUrl", event.target.value)}
              placeholder="https://maps.google.com/..."
            />
            {formErrors.mapsUrl && (
              <span className="admin-field-error">{formErrors.mapsUrl}</span>
            )}
          </label>

          <h4>Contact</h4>
          <div className="admin-account-grid compact">
            <label className="form-label">
              Phone
              <input
                required
                value={form.phone}
                onChange={(event) => setField("phone", event.target.value)}
              />
              {formErrors.phone && (
                <span className="admin-field-error">{formErrors.phone}</span>
              )}
            </label>
            <label className="form-label">
              Email
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
              />
              {formErrors.email && (
                <span className="admin-field-error">{formErrors.email}</span>
              )}
            </label>
            <label className="form-label">
              Website <small>(optional)</small>
              <input
                type="url"
                value={form.website}
                onChange={(event) => setField("website", event.target.value)}
                placeholder="https://hospital.com"
              />
              {formErrors.website && (
                <span className="admin-field-error">{formErrors.website}</span>
              )}
            </label>
          </div>

          <h4>Departments & Services</h4>
          <label className="form-label">
            Departments <small>(comma-separated)</small>
            <input
              value={form.departments}
              onChange={(event) => setField("departments", event.target.value)}
              placeholder="Cardiology, Neurology, Orthopedics"
            />
          </label>
          <label className="form-label">
            Services <small>(comma-separated)</small>
            <input
              value={form.services}
              onChange={(event) => setField("services", event.target.value)}
              placeholder="24x7 Emergency, ICU, Ambulance"
            />
          </label>

          {!editing && (
            <>
              <h4>First Hospital Admin</h4>
              <label className="form-label">
                Admin Name
                <input
                  required
                  value={form.adminName}
                  onChange={(event) =>
                    setField("adminName", event.target.value)
                  }
                />
                {formErrors.adminName && (
                  <span className="admin-field-error">
                    {formErrors.adminName}
                  </span>
                )}
              </label>
              <label className="form-label">
                Admin Email
                <input
                  required
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) =>
                    setField("adminEmail", event.target.value)
                  }
                />
                {formErrors.adminEmail && (
                  <span className="admin-field-error">
                    {formErrors.adminEmail}
                  </span>
                )}
              </label>
              <label className="form-label">
                Admin Password
                <input
                  required
                  type="password"
                  value={form.adminPassword}
                  onChange={(event) =>
                    setField("adminPassword", event.target.value)
                  }
                />
                {formErrors.adminPassword && (
                  <span className="admin-field-error">
                    {formErrors.adminPassword}
                  </span>
                )}
              </label>
            </>
          )}
          <div className="button-row">
            <button className="btn btn-primary" disabled={busy}>
              {busy
                ? "Saving..."
                : editing
                  ? "Save Hospital"
                  : "Create Hospital"}
            </button>
            {editing && (
              <button
                type="button"
                className="btn btn-light"
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="panel-card">
          <h3>Search and Filter</h3>
          <label className="form-label">
            Search Hospital
            <input
              placeholder="Name, ID, city or state"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
            />
          </label>
          <label className="form-label">
            Status
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters({ ...filters, status: event.target.value })
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <label className="form-label">
            City
            <select
              value={filters.city}
              onChange={(event) =>
                setFilters({ ...filters, city: event.target.value })
              }
            >
              <option value="all">All cities</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <p className="admin-help-text">
            Showing {visibleHospitals.length} of {filteredHospitals.length}{" "}
            hospitals (page {Math.min(page, totalPages)} of {totalPages}).
          </p>
        </section>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <h3>Hospital Directory</h3>
          <button type="button" className="btn btn-light" onClick={load}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="admin-help-text">
            <span className="spinner-border spinner-border-sm me-2" /> Loading
            hospitals…
          </p>
        ) : loadError ? (
          <div className="admin-error-box">
            <p>{loadError}</p>
            <button type="button" className="btn btn-light" onClick={load}>
              <FaSyncAlt /> Retry
            </button>
          </div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hospital</th>
                    <th>Hospital ID</th>
                    <th>Location</th>
                    <th>Contact</th>
                    <th>Doctors</th>
                    <th>Patients</th>
                    <th>Appointments</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHospitals.map((hospital) => (
                    <tr key={hospital._id}>
                      <td>
                        <div className="hospital-cell">
                          {hospital.logo && (
                            <img
                              src={hospital.logo}
                              alt={`${hospital.name} logo`}
                              className="hospital-cell-logo"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          )}
                          <div>
                            <strong>{hospital.name}</strong>
                            <br />
                            <small>{hospital.slug}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <small>{hospital.hospitalId || hospital._id}</small>
                      </td>
                      <td>
                        {[
                          hospital.location?.address,
                          hospital.location?.city,
                          hospital.location?.state,
                          hospital.location?.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Not available"}
                      </td>
                      <td>
                        {hospital.contact?.phone || "—"}
                        <br />
                        <small>{hospital.contact?.email || "—"}</small>
                      </td>
                      <td>{hospital.doctorCount || 0}</td>
                      <td>{hospital.patientCount || 0}</td>
                      <td>{hospital.appointmentCount || 0}</td>
                      <td>{hospital.isActive ? "Active" : "Suspended"}</td>
                      <td>
                        <div className="button-row">
                          <button
                            type="button"
                            className="btn btn-light"
                            title="View details"
                            onClick={() => setViewing(hospital)}
                          >
                            <FaEye />
                          </button>
                          <button
                            type="button"
                            className="btn btn-light"
                            title="Edit"
                            onClick={() => startEdit(hospital)}
                          >
                            <FaEdit />
                          </button>
                          <button
                            type="button"
                            className="btn btn-light"
                            title={hospital.isActive ? "Suspend" : "Activate"}
                            onClick={() => toggleHospital(hospital)}
                          >
                            {hospital.isActive ? <FaPause /> : <FaPlay />}
                          </button>
                          <button
                            type="button"
                            className="btn btn-light"
                            title="Delete"
                            onClick={() => requestDelete(hospital)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visibleHospitals.length && (
              <div className="empty-state">
                No hospitals match the selected filters.
              </div>
            )}
            {filteredHospitals.length > PAGE_SIZE && (
              <div className="pagination-row">
                <button
                  type="button"
                  className="btn btn-light"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <FaChevronLeft /> Previous
                </button>
                <span>
                  Page {Math.min(page, totalPages)} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-light"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                >
                  Next <FaChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this hospital?"
        message={[
          "Are you sure you want to delete",
          confirmDelete?.name,
          "? This action cannot be undone.",
        ]
          .filter(Boolean)
          .join(" ")}
        details="Hospitals with linked doctors, patients, or appointments cannot be deleted and must be suspended instead."
        confirmLabel="Yes, Delete"
        onConfirm={confirmDeleteHospital}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      {viewing && (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setViewing(null)}
        >
          <div
            className="admin-confirm-modal hospital-view-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="hospital-view-head">
              <div>
                <h3>
                  {viewing.logo && (
                    <img
                      src={viewing.logo}
                      alt={`${viewing.name} logo`}
                      className="hospital-cell-logo"
                    />
                  )}
                  {viewing.name}
                </h3>
                <span>
                  {viewing.isActive ? "Active" : "Suspended"} · {viewing.slug}
                </span>
              </div>
              <button
                type="button"
                className="app-confirm-close"
                aria-label="Close details"
                onClick={() => setViewing(null)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="hospital-view-grid">
              <div>
                <strong>Location</strong>
                <p>
                  <FaMapMarkerAlt />{" "}
                  {[
                    viewing.location?.address,
                    viewing.location?.city,
                    viewing.location?.state,
                    viewing.location?.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Not available"}
                </p>
                {viewing.location?.mapsUrl && (
                  <a
                    href={viewing.location.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FaGlobe /> Open in Maps
                  </a>
                )}
              </div>
              <div>
                <strong>Contact</strong>
                <p>
                  <FaPhoneAlt /> {viewing.contact?.phone || "Not available"}
                </p>
                {viewing.contact?.emergency && (
                  <p style={{ color: "#DC2626", fontWeight: "600" }}>
                    <FaPhoneAlt /> Emergency: {viewing.contact.emergency}
                  </p>
                )}
                <p>
                  <FaEnvelope /> {viewing.contact?.email || "Not available"}
                </p>
                {viewing.contact?.website && (
                  <a
                    href={viewing.contact.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FaGlobe /> {viewing.contact.website}
                  </a>
                )}
              </div>
            </div>
            <div className="hospital-view-stats">
              <span>
                <FaBuilding /> {viewing.doctorCount || 0} Doctors
              </span>
              <span>
                <FaStethoscope /> {viewing.patientCount || 0} Patients
              </span>
              <span>
                <FaCalendarCheck /> {viewing.appointmentCount || 0} Appointments
              </span>
            </div>
            <div className="hospital-view-section">
              <strong>Departments</strong>
              <p>
                {(viewing.departments || []).length
                  ? (viewing.departments || []).join(", ")
                  : "Not available"}
              </p>
            </div>
            <div className="hospital-view-section">
              <strong>Services</strong>
              <p>
                {(viewing.services || []).length
                  ? (viewing.services || []).join(", ")
                  : "Not available"}
              </p>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default HospitalManagement;
