import { useEffect, useMemo, useState } from "react";
import {
  FaEdit,
  FaKey,
  FaPause,
  FaPlay,
  FaPlus,
  FaTrash,
  FaUserCog,
  FaShieldAlt,
  FaCheck,
  FaExclamationTriangle,
  FaSave,
} from "react-icons/fa";
import Layout from "../components/Layout/Layout";
import API from "../Api/API";
import toast from "../utils/notify";
import {
  MODULE_PERMISSIONS,
  ALL_PERMISSION_IDS,
  DEFAULT_HOSPITAL_ADMIN_PERMISSIONS,
} from "../utils/permissions";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  currentPassword: "",
  hospitalId: "",
};
const hospitalIdOf = (value) => value?._id || value || "";

const HospitalAdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    hospitalId: "",
    status: "all",
  });
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [permissionsTarget, setPermissionsTarget] = useState(null);
  const [permissionsSelection, setPermissionsSelection] = useState([]);
  const [permissionsBusy, setPermissionsBusy] = useState(false);
  const [statusConfirmTarget, setStatusConfirmTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [adminResponse, hospitalResponse] = await Promise.all([
        API.get("/user/admin/admins"),
        API.get("/hospital/get-all"),
      ]);
      setAdmins(adminResponse.data.admins || []);
      setHospitals(hospitalResponse.data.hospitals || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to load Hospital Admins",
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleAdmins = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return admins.filter((admin) => {
      const hospitalId = hospitalIdOf(admin.hospitalId);
      const matchesSearch =
        !search ||
        [
          admin.name,
          admin.email,
          admin.hospitalId?.name,
          admin.hospitalId?.slug,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      const matchesHospital =
        !filters.hospitalId || hospitalId === filters.hospitalId;
      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active"
          ? admin.isActive !== false
          : admin.isActive === false);
      return matchesSearch && matchesHospital && matchesStatus;
    });
  }, [admins, filters]);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const startEdit = (admin) => {
    setEditing(admin);
    setForm({
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      currentPassword: "",
      hospitalId: hospitalIdOf(admin.hospitalId),
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name || !form.email || !form.hospitalId || !form.currentPassword)
      return toast.error(
        "Name, email, hospital and current password are required",
      );
    if (!editing && !form.password)
      return toast.error("A password is required for a new Hospital Admin");
    setBusy(true);
    try {
      const payload = { ...form };
      if (editing) delete payload.password;
      const response = editing
        ? await API.patch(`/user/admin/admins/${editing._id}`, payload)
        : await API.post("/user/admin/admins", payload);
      toast.success(
        response.data.message ||
          (editing ? "Hospital Admin updated" : "Hospital Admin created"),
      );
      startCreate();
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Hospital Admin action failed",
      );
    } finally {
      setBusy(false);
    }
  };

  const openPermissionsModal = (admin) => {
    setPermissionsTarget(admin);
    setPermissionsSelection(
      admin.permissions && admin.permissions.length > 0
        ? admin.permissions
        : DEFAULT_HOSPITAL_ADMIN_PERMISSIONS,
    );
  };

  const togglePermissionSelection = (id) => {
    setPermissionsSelection((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const selectAllPermissions = () => {
    setPermissionsSelection(ALL_PERMISSION_IDS);
  };

  const resetDefaultPermissions = () => {
    setPermissionsSelection(DEFAULT_HOSPITAL_ADMIN_PERMISSIONS);
  };

  const clearAllPermissions = () => {
    setPermissionsSelection([]);
  };

  const saveAdminPermissions = async () => {
    if (!permissionsTarget) return;
    setPermissionsBusy(true);
    try {
      const response = await API.patch(
        `/user/admin/admins/${permissionsTarget._id}/permissions`,
        { permissions: permissionsSelection },
      );
      toast.success(
        response.data.message || "Permissions updated successfully",
      );
      setPermissionsTarget(null);
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to update permissions",
      );
    } finally {
      setPermissionsBusy(false);
    }
  };

  const requestToggleStatus = (admin) => {
    setStatusConfirmTarget(admin);
  };

  const confirmToggleStatus = async () => {
    if (!statusConfirmTarget) return;
    const target = statusConfirmTarget;
    setStatusConfirmTarget(null);
    try {
      await API.patch(`/user/admin/admins/${target._id}/status`, {
        isActive: target.isActive === false,
      });
      toast.success(
        `Hospital Admin ${target.isActive === false ? "activated" : "suspended"}`,
      );
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to update admin status",
      );
    }
  };

  const resetAdminPassword = async (event) => {
    event.preventDefault();
    if (!resetPassword) return toast.error("Enter a new password");
    try {
      await API.patch(`/user/admin/admins/${resetTarget._id}/reset-password`, {
        password: resetPassword,
      });
      toast.success("Hospital Admin password reset");
      setResetTarget(null);
      setResetPassword("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to reset password");
    }
  };

  const deleteAdmin = async (admin) => {
    setDeleteTarget(admin);
    setDeletePassword("");
  };

  const confirmDeleteAdmin = async (event) => {
    event.preventDefault();
    if (!deleteTarget) return;
    if (!deletePassword)
      return toast.error(
        "Enter your current Super Admin password to remove this Hospital Admin",
      );
    setBusy(true);
    try {
      await API.delete(`/user/admin/admins/${deleteTarget._id}`, {
        data: { currentPassword: deletePassword },
      });
      toast.success("Hospital Admin removed");
      setDeleteTarget(null);
      setDeletePassword("");
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to remove Hospital Admin",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
      <section className="page-intro">
        <div>
          <span className="eyebrow">Platform access control</span>
          <h2>Hospital Admins</h2>
          <p>
            Each Hospital Admin is permanently assigned to one hospital. A
            hospital can have up to 3 admins.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={startCreate}>
          <FaPlus /> New Hospital Admin
        </button>
      </section>

      <section className="admin-grid-two">
        <form className="panel-card" onSubmit={submit}>
          <h3>
            <FaUserCog />{" "}
            {editing ? "Edit Hospital Admin" : "Create Hospital Admin"}
          </h3>
          <label className="form-label">
            Admin Name
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label className="form-label">
            Admin Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          {!editing && (
            <label className="form-label">
              Initial Password
              <input
                required
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
              />
            </label>
          )}
          <label className="form-label">
            Assign to Hospital
            <select
              required
              value={form.hospitalId}
              onChange={(event) =>
                setForm({ ...form, hospitalId: event.target.value })
              }
            >
              <option value="">Select an existing hospital</option>
              {hospitals.map((hospital) => {
                const count = admins.filter(
                  (admin) => hospitalIdOf(admin.hospitalId) === hospital._id,
                ).length;
                return (
                  <option
                    value={hospital._id}
                    key={hospital._id}
                    disabled={!editing && count >= 3}
                  >
                    {hospital.name} ({count}/3 admins)
                  </option>
                );
              })}
            </select>
          </label>
          <label className="form-label">
            Current Super Admin Password
            <input
              required
              type="password"
              value={form.currentPassword}
              onChange={(event) =>
                setForm({ ...form, currentPassword: event.target.value })
              }
            />
          </label>
          <div className="button-row">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Saving..." : editing ? "Save Admin" : "Create Admin"}
            </button>
            {editing && (
              <button
                type="button"
                className="btn btn-light"
                onClick={startCreate}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="panel-card">
          <h3>Search and Filter</h3>
          <label className="form-label">
            Search
            <input
              placeholder="Name, email or hospital"
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
            />
          </label>
          <label className="form-label">
            Hospital
            <select
              value={filters.hospitalId}
              onChange={(event) =>
                setFilters({ ...filters, hospitalId: event.target.value })
              }
            >
              <option value="">All hospitals</option>
              {hospitals.map((hospital) => (
                <option key={hospital._id} value={hospital._id}>
                  {hospital.name}
                </option>
              ))}
            </select>
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
          <p className="admin-help-text">
            Showing {visibleAdmins.length} of {admins.length} Hospital Admins.
          </p>
        </section>
      </section>

      <section className="panel-card">
        <div className="section-heading">
          <h3>Hospital Admin Directory</h3>
          <button type="button" className="btn btn-light" onClick={load}>
            Refresh
          </button>
        </div>
        <div className="admin-table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Hospital</th>
                <th>Hospital ID</th>
                <th>Permissions</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleAdmins.map((admin) => (
                <tr key={admin._id}>
                  <td>
                    <strong>{admin.name}</strong>
                    <br />
                    <small>{admin.email}</small>
                  </td>
                  <td>{admin.hospitalId?.name || "Unassigned"}</td>
                  <td>
                    <small>{hospitalIdOf(admin.hospitalId) || "—"}</small>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="badge"
                      style={{
                        background: "#e0e7ff",
                        color: "#4338ca",
                        border: "1px solid #c7d2fe",
                        cursor: "pointer",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                        fontSize: "0.75rem",
                      }}
                      onClick={() => openPermissionsModal(admin)}
                      title="Click to configure module permissions"
                    >
                      <FaShieldAlt /> {admin.permissions?.length || 8}/16
                      Modules
                    </button>
                  </td>
                  <td>
                    <span
                      style={{
                        color: admin.isActive === false ? "#dc2626" : "#16a34a",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      {admin.isActive === false ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td>
                    {admin.createdAt
                      ? new Date(admin.createdAt).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td>
                    {admin.loginHistory?.[0]?.loggedInAt
                      ? new Date(
                          admin.loginHistory[0].loggedInAt,
                        ).toLocaleString("en-IN")
                      : "Not available"}
                  </td>
                  <td>
                    <div className="button-row">
                      <button
                        type="button"
                        className="btn btn-light"
                        title="Manage Permissions"
                        onClick={() => openPermissionsModal(admin)}
                      >
                        <FaShieldAlt />
                      </button>
                      <button
                        type="button"
                        className="btn btn-light"
                        title="Edit"
                        onClick={() => startEdit(admin)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        type="button"
                        className="btn btn-light"
                        title="Reset password"
                        onClick={() => setResetTarget(admin)}
                      >
                        <FaKey />
                      </button>
                      <button
                        type="button"
                        className="btn btn-light"
                        title={
                          admin.isActive === false ? "Activate" : "Suspend"
                        }
                        onClick={() => requestToggleStatus(admin)}
                      >
                        {admin.isActive === false ? <FaPlay /> : <FaPause />}
                      </button>
                      <button
                        type="button"
                        className="btn btn-light"
                        title="Remove"
                        onClick={() => deleteAdmin(admin)}
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
        {!visibleAdmins.length && (
          <div className="empty-state">
            No Hospital Admins match the selected filters.
          </div>
        )}
      </section>

      {/* Permissions Management Modal */}
      {permissionsTarget && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            style={{
              maxWidth: "720px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: "0.75rem",
                marginBottom: "1rem",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <FaShieldAlt style={{ color: "#6366f1" }} /> Permissions:{" "}
                  {permissionsTarget.name}
                </h3>
                <small style={{ color: "#64748b" }}>
                  {permissionsTarget.email} •{" "}
                  {permissionsTarget.hospitalId?.name || "Unassigned Hospital"}
                </small>
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={selectAllPermissions}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={resetDefaultPermissions}
                >
                  Default (8)
                </button>
                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={clearAllPermissions}
                >
                  Clear
                </button>
              </div>
            </div>

            <div
              style={{
                overflowY: "auto",
                flex: 1,
                paddingRight: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "0.65rem",
                }}
              >
                {MODULE_PERMISSIONS.map((mod) => {
                  const isChecked = permissionsSelection.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      onClick={() => togglePermissionSelection(mod.id)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.65rem",
                        padding: "0.75rem",
                        borderRadius: "8px",
                        border: isChecked
                          ? "1px solid #6366f1"
                          : "1px solid #e2e8f0",
                        background: isChecked
                          ? "rgba(99, 102, 241, 0.04)"
                          : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ marginTop: "2px", accentColor: "#6366f1" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <strong
                            style={{
                              fontSize: "0.85rem",
                              color: isChecked ? "#4338ca" : "#1e293b",
                            }}
                          >
                            {mod.name}
                          </strong>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: "#64748b",
                              background: "#f1f5f9",
                              padding: "1px 5px",
                              borderRadius: "3px",
                            }}
                          >
                            {mod.category}
                          </span>
                        </div>
                        <small
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            display: "block",
                            marginTop: "2px",
                            lineHeight: "1.3",
                          }}
                        >
                          {mod.description}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="button-row"
              style={{
                borderTop: "1px solid #e2e8f0",
                paddingTop: "0.75rem",
              }}
            >
              <button
                className="btn btn-primary"
                disabled={permissionsBusy}
                onClick={saveAdminPermissions}
              >
                <FaSave />{" "}
                {permissionsBusy
                  ? "Saving..."
                  : `Save Permissions (${permissionsSelection.length}/16)`}
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setPermissionsTarget(null)}
                disabled={permissionsBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Confirmation Modal */}
      {statusConfirmTarget && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <FaExclamationTriangle
                style={{
                  color:
                    statusConfirmTarget.isActive === false
                      ? "#16a34a"
                      : "#f59e0b",
                }}
              />
              {statusConfirmTarget.isActive === false ? "Activate" : "Suspend"}{" "}
              {statusConfirmTarget.name}?
            </h3>
            <p className="admin-help-text">
              {statusConfirmTarget.isActive === false
                ? "This will restore administrative access for this Hospital Admin to their assigned facility."
                : "Suspended Hospital Admins are immediately blocked from logging in and all active sessions are revoked."}
            </p>
            <div className="button-row">
              <button
                className={`btn ${statusConfirmTarget.isActive === false ? "btn-primary" : "btn-danger"}`}
                onClick={confirmToggleStatus}
              >
                {statusConfirmTarget.isActive === false
                  ? "Activate Admin"
                  : "Suspend Admin"}
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setStatusConfirmTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={resetAdminPassword}>
            <h3>Reset {resetTarget.name}'s password</h3>
            <label className="form-label">
              New Password
              <input
                autoFocus
                required
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button className="btn btn-primary">Reset Password</button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => {
                  setResetTarget(null);
                  setResetPassword("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={confirmDeleteAdmin}>
            <h3>Remove {deleteTarget.name}?</h3>
            <p className="admin-help-text">
              This permanently removes the Hospital Admin. Confirm with your
              current Super Admin password.
            </p>
            <label className="form-label">
              Current Super Admin Password
              <input
                autoFocus
                required
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button className="btn btn-primary" disabled={busy}>
                {busy ? "Removing..." : "Remove Admin"}
              </button>
              <button
                type="button"
                className="btn btn-light"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeletePassword("");
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
};

export default HospitalAdminManagement;
