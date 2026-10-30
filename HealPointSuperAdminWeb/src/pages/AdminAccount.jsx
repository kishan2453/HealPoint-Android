import React, { useEffect, useMemo, useState } from "react";
import { toast } from "../utils/notify";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaBell,
  FaCog,
  FaEye,
  FaEyeSlash,
  FaHistory,
  FaLaptopMedical,
  FaLock,
  FaPalette,
  FaSave,
  FaShieldAlt,
  FaSignInAlt,
  FaSignOutAlt,
  FaTrash,
  FaUserCircle,
  FaUserMd,
  FaUserPlus,
  FaUsersCog,
  FaCalendarAlt,
  FaCreditCard,
  FaServer,
  FaHospital,
  FaInfoCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaUndo,
  FaVideo,
  FaCheck,
  FaTimes,
  FaUserShield,
  FaKey,
} from "react-icons/fa";
import API from "../Api/API";
import Layout from "../components/Layout/Layout";
import { setUser } from "../redux/slice/authSlice";
import {
  MODULE_PERMISSIONS,
  ALL_PERMISSION_IDS,
  DEFAULT_HOSPITAL_ADMIN_PERMISSIONS,
} from "../utils/permissions";

const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const passwordHelp =
  "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";

const emptySettings = {
  general: {
    hospitalName: "Anand Hospital",
    timezone: "Asia/Kolkata",
    language: "English",
  },
  notifications: {
    emailAlerts: true,
    appointmentAlerts: true,
    securityAlerts: true,
  },
  appearance: { theme: "light", density: "comfortable" },
};

const defaultPlatformSettings = {
  general: {
    appName: "HealPoint Healthcare - Appointment & Patient Service",
    tagline: "Advanced Multi-Hospital Healthcare & Doctor Appointment Platform",
    supportEmail: "support@healpoint.com",
    supportPhone: "+91 98765 43210",
    emergencyHelpline: "108",
    hospitalName: "Anand Hospital",
    timezone: "Asia/Kolkata",
    language: "English",
  },
  appointments: {
    defaultSlotDurationMinutes: 30,
    maxAdvanceBookingDays: 30,
    allowCancellation: true,
    cancellationCutoffHours: 2,
    allowRescheduling: true,
    autoConfirmBooking: true,
  },
  notifications: {
    emailAlerts: true,
    smsAlerts: true,
    appointmentAlerts: true,
    paymentAlerts: true,
    securityAlerts: true,
  },
  subscriptions: {
    trialPeriodDays: 30,
    gracePeriodDays: 7,
    enforceDoctorLimit: true,
  },
  security: {
    sessionTimeoutHours: 24,
    requirePasswordChangeEveryDays: 90,
    rateLimitingEnabled: true,
  },
  guideVideoUrl: "",
};

const getImageSrc = (image) => {
  if (!image) return "";
  if (
    image.startsWith("data:") ||
    image.startsWith("http") ||
    image.startsWith("blob:")
  )
    return image;
  return `data:image/jpeg;base64,${image}`;
};

const formatDateTime = (value) => {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const PasswordField = ({ label, value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <label className="admin-account-field">
      <span>{label}</span>
      <div className="password-field">
        <FaLock />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button type="button" onClick={() => setVisible((item) => !item)}>
          {visible ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
    </label>
  );
};

const AdminAccount = ({ defaultTab = "profile" }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [settingsSubTab, setSettingsSubTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [doctorHistorySummary, setDoctorHistorySummary] = useState([]);
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Administrator",
    image: "",
    imageFile: null,
  });
  const [settings, setSettings] = useState(emptySettings);
  const [platformConfig, setPlatformConfig] = useState(defaultPlatformSettings);
  const [originalPlatformConfig, setOriginalPlatformConfig] = useState(
    defaultPlatformSettings,
  );
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);

  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Administrator",
    currentPassword: "",
  });
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [searchParams] = useSearchParams();
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const tabs = [
    { id: "profile", label: "Admin Profile", icon: <FaUserCircle /> },
    { id: "settings", label: "Settings & System", icon: <FaCog /> },
    { id: "roles", label: "Roles & Permissions", icon: <FaShieldAlt /> },
    { id: "security", label: "Account Security", icon: <FaLock /> },
    { id: "admins", label: "Hospital Admins", icon: <FaUsersCog /> },
    { id: "history", label: "Login & Audit", icon: <FaHistory /> },
  ];

  const [rolesData, setRolesData] = useState({
    modules: MODULE_PERMISSIONS,
    roles: [],
    admins: [],
    defaultHospitalAdminPermissions: DEFAULT_HOSPITAL_ADMIN_PERMISSIONS,
  });
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [selectedAdminPermissions, setSelectedAdminPermissions] = useState([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionCategoryFilter, setPermissionCategoryFilter] =
    useState("all");
  const [permissionSearchTerm, setPermissionSearchTerm] = useState("");

  const settingsCategories = [
    { id: "general", label: "General", icon: <FaHospital /> },
    { id: "appointments", label: "Appointments", icon: <FaCalendarAlt /> },
    { id: "notifications", label: "Notifications", icon: <FaBell /> },
    { id: "subscriptions", label: "Subscriptions", icon: <FaCreditCard /> },
    { id: "payments", label: "Payment Gateway", icon: <FaCreditCard /> },
    { id: "security", label: "System Security", icon: <FaLock /> },
    { id: "status", label: "System Status", icon: <FaServer /> },
  ];

  const hasUnsavedSettings = useMemo(() => {
    return (
      JSON.stringify(platformConfig) !== JSON.stringify(originalPlatformConfig)
    );
  }, [platformConfig, originalPlatformConfig]);

  const loginHistory = useMemo(() => user?.loginHistory || [], [user]);
  const securityActivity = useMemo(() => user?.securityActivity || [], [user]);
  const successfulLogins = loginHistory.filter(
    (item) => item.status === "success",
  );
  const failedLogins = loginHistory.filter((item) => item.status === "failed");
  const activeSessions = loginHistory.filter((item) => item.active);
  const lastLogin = successfulLogins[0];

  const hydrateUser = (nextUser) => {
    dispatch(setUser(nextUser));
    setProfile({
      name: nextUser?.name || "",
      email: nextUser?.email || "",
      phone: nextUser?.phone || "",
      role: nextUser?.role || "Administrator",
      image: nextUser?.image || "",
      imageFile: null,
    });
    setSettings({
      general: {
        ...emptySettings.general,
        ...(nextUser?.adminSettings?.general || {}),
      },
      notifications: {
        ...emptySettings.notifications,
        ...(nextUser?.adminSettings?.notifications || {}),
      },
      appearance: {
        ...emptySettings.appearance,
        ...(nextUser?.adminSettings?.appearance || {}),
      },
    });
  };

  const fetchProfile = async () => {
    try {
      const { data } = await API.get("/user/admin/profile");
      hydrateUser(data.user);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to load admin profile",
      );
    }
  };

  const fetchPlatformSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data } = await API.get("/settings");
      if (data?.settings) {
        const merged = {
          general: {
            ...defaultPlatformSettings.general,
            ...(data.settings.general || {}),
          },
          appointments: {
            ...defaultPlatformSettings.appointments,
            ...(data.settings.appointments || {}),
          },
          notifications: {
            ...defaultPlatformSettings.notifications,
            ...(data.settings.notifications || {}),
          },
          subscriptions: {
            ...defaultPlatformSettings.subscriptions,
            ...(data.settings.subscriptions || {}),
          },
          security: {
            ...defaultPlatformSettings.security,
            ...(data.settings.security || {}),
          },
          guideVideoUrl: data.settings.guideVideoUrl || "",
        };
        setPlatformConfig(merged);
        setOriginalPlatformConfig(merged);
      }
      if (data?.paymentConfig) setPaymentConfig(data.paymentConfig);
      if (data?.systemStatus) setSystemStatus(data.systemStatus);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Unable to load platform configuration",
      );
    } finally {
      setSettingsLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data } = await API.get("/user/admin/admins");
      setAdmins(data.admins || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load admins");
    }
  };

  const fetchDoctorHistory = async () => {
    try {
      const { data } = await API.get("/doctor/admin/history");
      setDoctorHistorySummary(data.verificationCounts || []);
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to load doctor history",
      );
    }
  };

  const fetchRolesData = async () => {
    try {
      const { data } = await API.get("/user/admin/permissions");
      if (data?.success) {
        setRolesData({
          modules: data.modules || MODULE_PERMISSIONS,
          roles: data.roles || [],
          admins: data.admins || [],
          defaultHospitalAdminPermissions:
            data.defaultHospitalAdminPermissions ||
            DEFAULT_HOSPITAL_ADMIN_PERMISSIONS,
        });
        if (data.admins?.length > 0) {
          setSelectedAdminId((prev) => {
            const exists = data.admins.some((a) => a._id === prev);
            const targetId = exists ? prev : data.admins[0]._id;
            const target = data.admins.find((a) => a._id === targetId);
            setSelectedAdminPermissions(
              target?.permissions || DEFAULT_HOSPITAL_ADMIN_PERMISSIONS,
            );
            return targetId;
          });
        }
      }
    } catch (error) {
      console.error("[permissions] fetchRolesData error:", error);
    }
  };

  const passwordStrength = useMemo(() => {
    const pwd = passwordForm.newPassword || "";
    if (!pwd) {
      return {
        score: 0,
        label: "None",
        color: "#94a3b8",
        checks: {
          length: false,
          upper: false,
          lower: false,
          number: false,
          special: false,
        },
      };
    }
    const checks = {
      length: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[^A-Za-z0-9]/.test(pwd),
    };
    const count = Object.values(checks).filter(Boolean).length;
    let score = count * 20;
    let label = "Very Weak";
    let color = "#ef4444";
    if (score >= 100) {
      label = "Very Strong";
      color = "#10b981";
    } else if (score >= 80) {
      label = "Strong";
      color = "#22c55e";
    } else if (score >= 60) {
      label = "Medium";
      color = "#f59e0b";
    } else if (score >= 40) {
      label = "Weak";
      color = "#f97316";
    }
    return { score, label, color, checks };
  }, [passwordForm.newPassword]);

  const handleSelectAdminForPermissions = (adminId) => {
    setSelectedAdminId(adminId);
    const target = rolesData.admins.find((a) => a._id === adminId);
    if (target) {
      setSelectedAdminPermissions(
        target.permissions && target.permissions.length > 0
          ? target.permissions
          : DEFAULT_HOSPITAL_ADMIN_PERMISSIONS,
      );
    }
  };

  const handleTogglePermission = (permissionId) => {
    setSelectedAdminPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  };

  const handleSelectAllPermissions = () => {
    setSelectedAdminPermissions(ALL_PERMISSION_IDS);
  };

  const handleResetDefaultPermissions = () => {
    setSelectedAdminPermissions(DEFAULT_HOSPITAL_ADMIN_PERMISSIONS);
  };

  const handleClearAllPermissions = () => {
    setSelectedAdminPermissions([]);
  };

  const handleSaveAdminPermissions = async () => {
    if (!selectedAdminId) {
      return toast.error("Please select a hospital administrator first");
    }
    setSavingPermissions(true);
    try {
      const { data } = await API.patch(
        `/user/admin/admins/${selectedAdminId}/permissions`,
        {
          permissions: selectedAdminPermissions,
        },
      );
      toast.success(data.message || "Permissions updated successfully");
      await fetchRolesData();
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to update permissions",
      );
    } finally {
      setSavingPermissions(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPlatformSettings();
    fetchAdmins();
    fetchDoctorHistory();
    fetchRolesData();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      [
        "profile",
        "settings",
        "roles",
        "security",
        "admins",
        "history",
      ].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    } else if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, searchParams]);

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile.name || !profile.email || !profile.phone || !profile.role) {
      return toast.error("Please fill all profile fields");
    }
    const formData = new FormData();
    formData.append("name", profile.name);
    formData.append("email", profile.email);
    formData.append("phone", profile.phone);
    formData.append("role", profile.role);
    if (profile.imageFile) formData.append("image", profile.imageFile);
    setLoading(true);
    try {
      const { data } = await API.patch("/user/admin/profile", formData);
      hydrateUser(data.user);
      toast.success(data.message || "Profile saved successfully");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Profile update failed");
    } finally {
      setLoading(false);
    }
  };

  const savePlatformSettings = async (event) => {
    if (event) event.preventDefault();
    setLoading(true);
    try {
      const { data } = await API.patch("/settings", platformConfig);
      if (data?.settings) {
        const merged = {
          general: {
            ...defaultPlatformSettings.general,
            ...(data.settings.general || {}),
          },
          appointments: {
            ...defaultPlatformSettings.appointments,
            ...(data.settings.appointments || {}),
          },
          notifications: {
            ...defaultPlatformSettings.notifications,
            ...(data.settings.notifications || {}),
          },
          subscriptions: {
            ...defaultPlatformSettings.subscriptions,
            ...(data.settings.subscriptions || {}),
          },
          security: {
            ...defaultPlatformSettings.security,
            ...(data.settings.security || {}),
          },
          guideVideoUrl: data.settings.guideVideoUrl || "",
        };
        setPlatformConfig(merged);
        setOriginalPlatformConfig(merged);
      }
      toast.success(data?.message || "System configuration saved successfully");
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Failed to update configuration",
      );
    } finally {
      setLoading(false);
    }
  };

  const resetPlatformSettings = () => {
    setPlatformConfig(originalPlatformConfig);
    toast.info("Unsaved configuration changes reverted");
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (
      !passwordForm.currentPassword ||
      !passwordForm.newPassword ||
      !passwordForm.confirmPassword
    ) {
      return toast.error("Please fill all password fields");
    }
    if (!strongPasswordRegex.test(passwordForm.newPassword))
      return toast.error(passwordHelp);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error("Confirm password does not match");
    }
    setLoading(true);
    try {
      const { data } = await API.patch("/user/admin/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success(data.message || "Password changed successfully");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Password change failed");
    } finally {
      setLoading(false);
    }
  };

  const saveAdmin = async (event) => {
    event.preventDefault();
    const payload = editingAdmin
      ? {
          name: editingAdmin.name,
          email: editingAdmin.email,
          phone: editingAdmin.phone || "",
          role: editingAdmin.role,
          currentPassword: editingAdmin.currentPassword,
        }
      : adminForm;
    if (
      !payload.name ||
      !payload.email ||
      !payload.role ||
      !payload.currentPassword
    ) {
      return toast.error("Please fill admin details and current password");
    }
    if (!editingAdmin && !strongPasswordRegex.test(payload.password || "")) {
      return toast.error(passwordHelp);
    }
    setLoading(true);
    try {
      if (editingAdmin) {
        await API.patch(`/user/admin/admins/${editingAdmin._id}`, payload);
        setEditingAdmin(null);
      } else {
        await API.post("/user/admin/admins", payload);
        setAdminForm({
          name: "",
          email: "",
          password: "",
          role: "Administrator",
          currentPassword: "",
        });
      }
      await fetchAdmins();
      toast.success(editingAdmin ? "Admin updated" : "Admin created");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Admin action failed");
    } finally {
      setLoading(false);
    }
  };

  const removeAdmin = async () => {
    if (!deletePassword) return toast.error("Current password is required");
    setLoading(true);
    try {
      await API.delete(`/user/admin/admins/${deleteTarget._id}`, {
        data: { currentPassword: deletePassword },
      });
      setDeleteTarget(null);
      setDeletePassword("");
      await fetchAdmins();
      toast.success("Admin removed");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to remove admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="page-intro admin-account-hero">
        <div>
          <span className="eyebrow">Admin control</span>
          <h2>Account Workspace</h2>
          <p>Manage profile, settings, security, admins and login activity.</p>
        </div>
        <button
          type="button"
          className="btn btn-light"
          onClick={() => navigate("/home")}
        >
          Dashboard
        </button>
      </section>

      <section className="admin-account-shell">
        <aside className="admin-account-tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="admin-account-panel">
          {activeTab === "profile" && (
            <form onSubmit={saveProfile} className="admin-account-grid">
              <div className="admin-profile-photo">
                {getImageSrc(profile.image) ? (
                  <img
                    src={getImageSrc(profile.image)}
                    alt="Admin"
                    width={180}
                    height={180}
                    loading="eager"
                    decoding="async"
                    className="hd-profile-image"
                  />
                ) : (
                  <FaUserCircle />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setProfile((item) => ({
                      ...item,
                      imageFile: file || null,
                      image: file ? URL.createObjectURL(file) : item.image,
                    }));
                  }}
                />
                <span>Upload profile photo</span>
              </div>
              <label className="admin-account-field">
                <span>Name</span>
                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile({ ...profile, name: event.target.value })
                  }
                />
              </label>
              <label className="admin-account-field">
                <span>Email</span>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(event) =>
                    setProfile({ ...profile, email: event.target.value })
                  }
                />
              </label>
              <label className="admin-account-field">
                <span>Mobile Number</span>
                <input
                  value={profile.phone}
                  onChange={(event) =>
                    setProfile({ ...profile, phone: event.target.value })
                  }
                />
              </label>
              <label className="admin-account-field">
                <span>Role</span>
                <input
                  value={profile.role}
                  onChange={(event) =>
                    setProfile({ ...profile, role: event.target.value })
                  }
                />
              </label>
              <button
                type="submit"
                className="btn btn-primary admin-account-submit"
                disabled={loading}
              >
                <FaSave /> {loading ? "Saving..." : "Save Profile"}
              </button>
            </form>
          )}

          {activeTab === "settings" && (
            <div className="sa-settings-container">
              {settingsLoading ? (
                <div className="empty-state" style={{ padding: "40px" }}>
                  <FaServer
                    style={{
                      fontSize: "2rem",
                      marginBottom: "12px",
                      color: "var(--sa-primary)",
                    }}
                  />
                  <h4>Loading System Configuration...</h4>
                  <p>
                    Fetching platform settings and provider operational status.
                  </p>
                </div>
              ) : (
                <div className="sa-settings-layout">
                  <aside className="sa-settings-nav">
                    {settingsCategories.map((cat) => (
                      <button
                        type="button"
                        key={cat.id}
                        className={`sa-settings-nav-btn ${settingsSubTab === cat.id ? "active" : ""}`}
                        onClick={() => setSettingsSubTab(cat.id)}
                      >
                        {cat.icon}
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </aside>

                  <div className="sa-settings-content">
                    {/* 1. General Settings */}
                    {settingsSubTab === "general" && (
                      <form
                        onSubmit={savePlatformSettings}
                        className="sa-settings-card"
                      >
                        <div className="sa-settings-card-header">
                          <h3>
                            <FaHospital /> General Platform Configuration
                          </h3>
                          <p>
                            Manage application branding, global support
                            contacts, and default institutional identity.
                          </p>
                        </div>

                        <div className="sa-info-banner">
                          <FaInfoCircle />
                          <span>
                            Platform identity applies across the unified
                            HealPoint healthcare ecosystem (Patient Portal,
                            Doctor Panel, and Hospital Admin Workspaces).
                          </span>
                        </div>

                        <div className="sa-form-grid">
                          <div className="sa-form-group full-width">
                            <label>Application Name</label>
                            <input
                              type="text"
                              value={platformConfig.general.appName}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  general: {
                                    ...platformConfig.general,
                                    appName: e.target.value,
                                  },
                                })
                              }
                              required
                            />
                            <small>
                              Canonical platform title: HealPoint Healthcare -
                              Appointment & Patient Service
                            </small>
                          </div>

                          <div className="sa-form-group full-width">
                            <label>Platform Tagline / Description</label>
                            <input
                              type="text"
                              value={platformConfig.general.tagline}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  general: {
                                    ...platformConfig.general,
                                    tagline: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>

                          <div className="sa-form-group">
                            <label>Central Support Email</label>
                            <input
                              type="email"
                              value={platformConfig.general.supportEmail}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  general: {
                                    ...platformConfig.general,
                                    supportEmail: e.target.value,
                                  },
                                })
                              }
                              required
                            />
                          </div>

                          <div className="sa-form-group">
                            <label>Support Phone Number</label>
                            <input
                              type="text"
                              value={platformConfig.general.supportPhone}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  general: {
                                    ...platformConfig.general,
                                    supportPhone: e.target.value,
                                  },
                                })
                              }
                              required
                            />
                          </div>

                          <div className="sa-form-group">
                            <label>Emergency Medical Helpline</label>
                            <input
                              type="text"
                              value={platformConfig.general.emergencyHelpline}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  general: {
                                    ...platformConfig.general,
                                    emergencyHelpline: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>

                          <div className="sa-form-group">
                            <label>Default Hospital Identity</label>
                            <input
                              type="text"
                              value={platformConfig.general.hospitalName}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  general: {
                                    ...platformConfig.general,
                                    hospitalName: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>

                          <div className="sa-form-group">
                            <label>System Timezone</label>
                            <select
                              value={platformConfig.general.timezone}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  general: {
                                    ...platformConfig.general,
                                    timezone: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="Asia/Kolkata">
                                Asia/Kolkata (IST +5:30)
                              </option>
                              <option value="UTC">UTC</option>
                              <option value="America/New_York">
                                America/New_York (EST)
                              </option>
                              <option value="Europe/London">
                                Europe/London (GMT)
                              </option>
                            </select>
                          </div>

                          <div className="sa-form-group">
                            <label>System Language</label>
                            <select
                              value={platformConfig.general.language}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  general: {
                                    ...platformConfig.general,
                                    language: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="English">English</option>
                              <option value="Hindi">Hindi</option>
                            </select>
                          </div>
                        </div>

                        <div className="sa-settings-actions">
                          <button
                            type="button"
                            className="btn btn-light"
                            onClick={resetPlatformSettings}
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaUndo /> Reset
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaSave />{" "}
                            {loading ? "Saving..." : "Save General Settings"}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* 2. Appointment Settings */}
                    {settingsSubTab === "appointments" && (
                      <form
                        onSubmit={savePlatformSettings}
                        className="sa-settings-card"
                      >
                        <div className="sa-settings-card-header">
                          <h3>
                            <FaCalendarAlt /> Appointment & Booking Rules
                          </h3>
                          <p>
                            Configures scheduling constraints, cancellation
                            cutoffs, and default doctor slot generation.
                          </p>
                        </div>

                        <div className="sa-form-grid">
                          <div className="sa-form-group">
                            <label>Default Slot Duration (Minutes)</label>
                            <select
                              value={
                                platformConfig.appointments
                                  .defaultSlotDurationMinutes
                              }
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  appointments: {
                                    ...platformConfig.appointments,
                                    defaultSlotDurationMinutes: Number(
                                      e.target.value,
                                    ),
                                  },
                                })
                              }
                            >
                              <option value={15}>
                                15 Minutes (Express Consult)
                              </option>
                              <option value={30}>
                                30 Minutes (Standard Consult)
                              </option>
                              <option value={45}>
                                45 Minutes (Extended Review)
                              </option>
                              <option value={60}>
                                60 Minutes (Comprehensive Evaluation)
                              </option>
                            </select>
                            <small>
                              Serves as the baseline slot interval when
                              doctor-specific override is unset.
                            </small>
                          </div>

                          <div className="sa-form-group">
                            <label>Advance Booking Horizon (Days)</label>
                            <input
                              type="number"
                              min={1}
                              max={90}
                              value={
                                platformConfig.appointments
                                  .maxAdvanceBookingDays
                              }
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  appointments: {
                                    ...platformConfig.appointments,
                                    maxAdvanceBookingDays: Number(
                                      e.target.value,
                                    ),
                                  },
                                })
                              }
                            />
                            <small>
                              Maximum forward days a patient can book doctor
                              appointments.
                            </small>
                          </div>
                        </div>

                        <div
                          className="sa-toggle-list"
                          style={{ marginTop: "20px" }}
                        >
                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>Patient Appointment Cancellation</strong>
                              <span>
                                Permit patients to cancel booked appointments
                                online prior to consultation.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.appointments.allowCancellation
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    appointments: {
                                      ...platformConfig.appointments,
                                      allowCancellation: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>

                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>Patient Appointment Rescheduling</strong>
                              <span>
                                Permit patients to select alternative date/time
                                slots before consultation cutoff.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.appointments.allowRescheduling
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    appointments: {
                                      ...platformConfig.appointments,
                                      allowRescheduling: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>

                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>Auto-Confirm Bookings</strong>
                              <span>
                                Directly accept valid paid/confirmed slots into
                                doctor schedule without manual triage.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.appointments.autoConfirmBooking
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    appointments: {
                                      ...platformConfig.appointments,
                                      autoConfirmBooking: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>
                        </div>

                        <div className="sa-settings-actions">
                          <button
                            type="button"
                            className="btn btn-light"
                            onClick={resetPlatformSettings}
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaUndo /> Reset
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaSave />{" "}
                            {loading ? "Saving..." : "Save Appointment Rules"}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* 3. Notification Settings */}
                    {settingsSubTab === "notifications" && (
                      <form
                        onSubmit={savePlatformSettings}
                        className="sa-settings-card"
                      >
                        <div className="sa-settings-card-header">
                          <h3>
                            <FaBell /> System Notification Preferences
                          </h3>
                          <p>
                            Configure automated dispatch channels and alert
                            triggers for appointments, payments, and system
                            events.
                          </p>
                        </div>

                        <div className="sa-toggle-list">
                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>SMTP Email Delivery</strong>
                              <span>
                                Dispatch transaction confirmations, consultation
                                links, and password resets via email.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.notifications.emailAlerts
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    notifications: {
                                      ...platformConfig.notifications,
                                      emailAlerts: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>

                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>SMS Notifications (Fast2SMS)</strong>
                              <span>
                                Send appointment confirmation SMS alerts to
                                patients on booking and completion.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={platformConfig.notifications.smsAlerts}
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    notifications: {
                                      ...platformConfig.notifications,
                                      smsAlerts: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>

                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>Appointment Lifecycle Alerts</strong>
                              <span>
                                Trigger in-app notifications for bookings,
                                status changes, cancellations, and doctor notes.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.notifications.appointmentAlerts
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    notifications: {
                                      ...platformConfig.notifications,
                                      appointmentAlerts: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>

                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>Payment & Financial Alerts</strong>
                              <span>
                                Notify administrators and patients regarding
                                verified receipts, refunds, and subscription
                                billing.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.notifications.paymentAlerts
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    notifications: {
                                      ...platformConfig.notifications,
                                      paymentAlerts: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>

                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>Security & Audit Alerts</strong>
                              <span>
                                Log and notify on administrative credential
                                updates, status overrides, and unusual login
                                activities.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.notifications.securityAlerts
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    notifications: {
                                      ...platformConfig.notifications,
                                      securityAlerts: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>
                        </div>

                        <div className="sa-settings-actions">
                          <button
                            type="button"
                            className="btn btn-light"
                            onClick={resetPlatformSettings}
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaUndo /> Reset
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaSave />{" "}
                            {loading
                              ? "Saving..."
                              : "Save Notification Preferences"}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* 4. Subscription Settings */}
                    {settingsSubTab === "subscriptions" && (
                      <form
                        onSubmit={savePlatformSettings}
                        className="sa-settings-card"
                      >
                        <div className="sa-settings-card-header">
                          <h3>
                            <FaCreditCard /> Hospital Subscription Policies
                          </h3>
                          <p>
                            Configure institutional trial windows, grace
                            durations, and enforcement policies across tenant
                            hospitals.
                          </p>
                        </div>

                        <div className="sa-info-banner">
                          <FaInfoCircle />
                          <span>
                            To manage individual pricing plans, features, and
                            plan tiers, visit the dedicated{" "}
                            <strong
                              style={{
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                              onClick={() => navigate("/subscription-plans")}
                            >
                              Subscription Plans
                            </strong>{" "}
                            management portal.
                          </span>
                        </div>

                        <div className="sa-form-grid">
                          <div className="sa-form-group">
                            <label>Default Hospital Trial Period (Days)</label>
                            <input
                              type="number"
                              min={0}
                              max={90}
                              value={
                                platformConfig.subscriptions.trialPeriodDays
                              }
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  subscriptions: {
                                    ...platformConfig.subscriptions,
                                    trialPeriodDays: Number(e.target.value),
                                  },
                                })
                              }
                            />
                            <small>
                              Trial duration granted to newly onboarded
                              healthcare facilities.
                            </small>
                          </div>

                          <div className="sa-form-group">
                            <label>Billing Grace Period (Days)</label>
                            <input
                              type="number"
                              min={0}
                              max={30}
                              value={
                                platformConfig.subscriptions.gracePeriodDays
                              }
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  subscriptions: {
                                    ...platformConfig.subscriptions,
                                    gracePeriodDays: Number(e.target.value),
                                  },
                                })
                              }
                            />
                            <small>
                              Days before hospital service restriction following
                              an unpaid renewal.
                            </small>
                          </div>
                        </div>

                        <div
                          className="sa-toggle-list"
                          style={{ marginTop: "20px" }}
                        >
                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>Enforce Plan Doctor Capacities</strong>
                              <span>
                                Restrict adding physicians beyond the hospital's
                                active tier allocation (e.g. 10 for Free, 25 for
                                Basic).
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.subscriptions
                                    .enforceDoctorLimit
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    subscriptions: {
                                      ...platformConfig.subscriptions,
                                      enforceDoctorLimit: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>
                        </div>

                        <div className="sa-settings-actions">
                          <button
                            type="button"
                            className="btn btn-light"
                            onClick={resetPlatformSettings}
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaUndo /> Reset
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaSave />{" "}
                            {loading
                              ? "Saving..."
                              : "Save Subscription Policies"}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* 5. Payment Gateway Configuration */}
                    {settingsSubTab === "payments" && (
                      <div className="sa-settings-card">
                        <div className="sa-settings-card-header">
                          <h3>
                            <FaCreditCard /> Payment Gateway Status (Razorpay)
                          </h3>
                          <p>
                            Secure overview of the transaction processing
                            backend and merchant configuration.
                          </p>
                        </div>

                        <div className="sa-info-banner">
                          <FaShieldAlt />
                          <span>
                            Security Principle: Production merchant secrets
                            (Razorpay Key Secret, Webhook Secrets) are strictly
                            isolated in server environment variables and never
                            exposed to the frontend browser interface.
                          </span>
                        </div>

                        <div
                          className="sa-status-pills"
                          style={{ marginBottom: "24px" }}
                        >
                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>Gateway Status</span>
                              <span
                                className={`sa-badge ${paymentConfig?.isConfigured ? "success" : "warning"}`}
                              >
                                {paymentConfig?.isConfigured ? (
                                  <FaCheckCircle />
                                ) : (
                                  <FaExclamationTriangle />
                                )}
                                {paymentConfig?.isConfigured
                                  ? "Operational"
                                  : "Pending Setup"}
                              </span>
                            </div>
                            <strong>
                              {paymentConfig?.provider || "Razorpay"}
                            </strong>
                            <small>
                              {paymentConfig?.isConfigured
                                ? "API authentication validated on server"
                                : "Missing credentials in server .env"}
                            </small>
                          </div>

                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>Environment Mode</span>
                              <span className="sa-badge success">
                                {paymentConfig?.mode || "Test"}
                              </span>
                            </div>
                            <strong>INR (₹)</strong>
                            <small>
                              Indian Rupee multi-bank checkout enabled
                            </small>
                          </div>

                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>Key ID Identifier</span>
                            </div>
                            <strong>
                              {paymentConfig?.keyIdPreview || "Not Available"}
                            </strong>
                            <small>Verified public merchant identifier</small>
                          </div>
                        </div>

                        <div className="sa-form-grid">
                          <div className="sa-form-group">
                            <label>Default Payment Currency</label>
                            <input
                              type="text"
                              value="INR (₹) - Indian Rupee"
                              disabled
                            />
                          </div>
                          <div className="sa-form-group">
                            <label>Supported Payment Instruments</label>
                            <input
                              type="text"
                              value="UPI, Credit/Debit Cards, NetBanking, Razorpay Wallet"
                              disabled
                            />
                          </div>
                          <div className="sa-form-group full-width">
                            <label>
                              Patient Guide Video URL (Booking Instructions)
                            </label>
                            <input
                              type="url"
                              placeholder="https://example.com/guide-video.mp4"
                              value={platformConfig.guideVideoUrl}
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  guideVideoUrl: e.target.value,
                                })
                              }
                            />
                            <small>
                              Public instructional video displayed to patients
                              explaining slot booking and payment procedures.
                            </small>
                          </div>
                        </div>

                        <div className="sa-settings-actions">
                          <button
                            type="button"
                            className="btn btn-light"
                            onClick={resetPlatformSettings}
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaUndo /> Reset
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => savePlatformSettings()}
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaSave />{" "}
                            {loading
                              ? "Saving..."
                              : "Save Payment Guide Config"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 6. System Security */}
                    {settingsSubTab === "security" && (
                      <form
                        onSubmit={savePlatformSettings}
                        className="sa-settings-card"
                      >
                        <div className="sa-settings-card-header">
                          <h3>
                            <FaShieldAlt /> System Security & Session Policies
                          </h3>
                          <p>
                            Configure session longevity, brute-force
                            rate-limiting, and password rotation requirements.
                          </p>
                        </div>

                        <div className="sa-form-grid">
                          <div className="sa-form-group">
                            <label>Session Expiration Timeout (Hours)</label>
                            <input
                              type="number"
                              min={1}
                              max={168}
                              value={
                                platformConfig.security.sessionTimeoutHours
                              }
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  security: {
                                    ...platformConfig.security,
                                    sessionTimeoutHours: Number(e.target.value),
                                  },
                                })
                              }
                            />
                            <small>
                              Duration before an inactive administrator session
                              expires automatically.
                            </small>
                          </div>

                          <div className="sa-form-group">
                            <label>Password Renewal Frequency (Days)</label>
                            <input
                              type="number"
                              min={0}
                              max={365}
                              value={
                                platformConfig.security
                                  .requirePasswordChangeEveryDays
                              }
                              onChange={(e) =>
                                setPlatformConfig({
                                  ...platformConfig,
                                  security: {
                                    ...platformConfig.security,
                                    requirePasswordChangeEveryDays: Number(
                                      e.target.value,
                                    ),
                                  },
                                })
                              }
                            />
                            <small>
                              Recommended interval for administrative credential
                              rotation (0 to disable).
                            </small>
                          </div>
                        </div>

                        <div
                          className="sa-toggle-list"
                          style={{ marginTop: "20px" }}
                        >
                          <div className="sa-toggle-row">
                            <div className="sa-toggle-info">
                              <strong>API Rate Limiting Protection</strong>
                              <span>
                                Throttles excessive authentication and payment
                                queries against automated brute-force attacks.
                              </span>
                            </div>
                            <label className="sa-switch">
                              <input
                                type="checkbox"
                                checked={
                                  platformConfig.security.rateLimitingEnabled
                                }
                                onChange={(e) =>
                                  setPlatformConfig({
                                    ...platformConfig,
                                    security: {
                                      ...platformConfig.security,
                                      rateLimitingEnabled: e.target.checked,
                                    },
                                  })
                                }
                              />
                              <span className="sa-slider"></span>
                            </label>
                          </div>
                        </div>

                        <div className="sa-settings-actions">
                          <button
                            type="button"
                            className="btn btn-light"
                            onClick={resetPlatformSettings}
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaUndo /> Reset
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={!hasUnsavedSettings || loading}
                          >
                            <FaSave />{" "}
                            {loading ? "Saving..." : "Save Security Policies"}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* 7. System Status */}
                    {settingsSubTab === "status" && (
                      <div className="sa-settings-card">
                        <div className="sa-settings-card-header">
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <h3>
                                <FaServer /> Health & Diagnostic Status
                              </h3>
                              <p>
                                Live operational status verified directly by the
                                HealPoint healthcare backend runtime.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-light"
                              onClick={fetchPlatformSettings}
                            >
                              Refresh Diagnostics
                            </button>
                          </div>
                        </div>

                        <div className="sa-status-pills">
                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>API Runtime</span>
                              <span className="sa-badge success">
                                <FaCheckCircle /> Online
                              </span>
                            </div>
                            <strong>
                              Node.js {systemStatus?.nodeVersion || "v20.x"}
                            </strong>
                            <small>
                              Environment:{" "}
                              {systemStatus?.environment || "production"}
                            </small>
                          </div>

                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>Process Memory</span>
                              <span className="sa-badge success">Optimal</span>
                            </div>
                            <strong>
                              {systemStatus?.memoryUsageMB || 0} MB RSS
                            </strong>
                            <small>Process memory utilization</small>
                          </div>

                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>Uptime</span>
                            </div>
                            <strong>
                              {Math.floor(
                                (systemStatus?.serverUptimeSeconds || 0) / 3600,
                              )}
                              h{" "}
                              {Math.floor(
                                ((systemStatus?.serverUptimeSeconds || 0) %
                                  3600) /
                                  60,
                              )}
                              m
                            </strong>
                            <small>Continuous application runtime</small>
                          </div>

                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>Email Engine (SMTP)</span>
                              <span
                                className={`sa-badge ${systemStatus?.emailServiceConfigured ? "success" : "warning"}`}
                              >
                                {systemStatus?.emailServiceConfigured
                                  ? "Configured"
                                  : "Unset"}
                              </span>
                            </div>
                            <strong>
                              {systemStatus?.emailServiceConfigured
                                ? "Connected"
                                : "Disabled"}
                            </strong>
                            <small>Transactional alerts dispatching</small>
                          </div>

                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>SMS Gateway</span>
                              <span
                                className={`sa-badge ${systemStatus?.smsServiceConfigured ? "success" : "warning"}`}
                              >
                                {systemStatus?.smsServiceConfigured
                                  ? "Active"
                                  : "Unset"}
                              </span>
                            </div>
                            <strong>
                              {systemStatus?.smsServiceConfigured
                                ? "Fast2SMS"
                                : "Disabled"}
                            </strong>
                            <small>Patient mobile SMS dispatch</small>
                          </div>

                          <div className="sa-status-pill">
                            <div className="sa-status-pill-head">
                              <span>Database State</span>
                              <span className="sa-badge success">
                                <FaCheckCircle /> Connected
                              </span>
                            </div>
                            <strong>MongoDB Atlas</strong>
                            <small>Multi-tenant health records store</small>
                          </div>
                        </div>

                        <div
                          className="admin-settings-card doctor-history-settings"
                          style={{ marginTop: "24px" }}
                        >
                          <div className="doctor-history-head">
                            <h3>
                              <FaUserMd /> Platform Doctor Verification Overview
                            </h3>
                            <button
                              type="button"
                              className="btn btn-light"
                              onClick={fetchDoctorHistory}
                            >
                              Refresh
                            </button>
                          </div>
                          <div
                            className="notification-stats"
                            style={{
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(140px, 1fr))",
                              gap: "12px",
                              marginTop: "12px",
                            }}
                          >
                            {doctorHistorySummary.length ? (
                              doctorHistorySummary.map((item) => (
                                <article
                                  className="metric-card"
                                  key={item._id || item.status}
                                  style={{ padding: "14px" }}
                                >
                                  <div>
                                    <p
                                      style={{
                                        margin: "0 0 4px",
                                        fontSize: "0.75rem",
                                        color: "var(--sa-muted)",
                                      }}
                                    >
                                      {item._id || "Unknown"}
                                    </p>
                                    <strong style={{ fontSize: "1.3rem" }}>
                                      {item.count || 0}
                                    </strong>
                                  </div>
                                </article>
                              ))
                            ) : (
                              <p>
                                Doctor status distribution is currently being
                                computed.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "roles" && (
            <div className="admin-settings-stack roles-permissions-workspace">
              {/* Header card */}
              <div className="admin-settings-card roles-hero-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#ede9fe",
                        color: "#6d28d9",
                        marginBottom: "0.5rem",
                      }}
                    >
                      Access Control Architecture
                    </span>
                    <h3 style={{ margin: "0.25rem 0" }}>
                      <FaShieldAlt /> System Roles & Permissions
                    </h3>
                    <p
                      style={{
                        color: "#64748b",
                        margin: "0.25rem 0 0 0",
                        maxWidth: "700px",
                      }}
                    >
                      Centralized role-based access control (RBAC) across all 16
                      platform modules. Super Admin holds root authority, while
                      Hospital Administrators are provisioned with tailored
                      module sets.
                    </p>
                  </div>
                  <div
                    style={{
                      background: "#f1f5f9",
                      padding: "0.75rem 1.25rem",
                      borderRadius: "12px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "#6366f1",
                        display: "block",
                      }}
                    >
                      {rolesData.modules?.length || 16}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Active Modules
                    </span>
                  </div>
                </div>

                {/* Current Super Admin status */}
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(14,165,233,0.06))",
                    border: "1px solid rgba(99,102,241,0.2)",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    marginTop: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "10px",
                        background: "#6366f1",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.25rem",
                      }}
                    >
                      <FaUserShield />
                    </div>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        <strong style={{ fontSize: "1.05rem" }}>
                          Logged In As: {user?.name || "Super Admin"}
                        </strong>
                        <span
                          style={{
                            background: "#6366f1",
                            color: "#fff",
                            padding: "2px 8px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                          }}
                        >
                          Super Admin
                        </span>
                      </div>
                      <small style={{ color: "#64748b" }}>
                        Email: {user?.email} • Platform Authority: Root (16/16
                        Modules Unlocked)
                      </small>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={fetchRolesData}
                    >
                      <FaUndo /> Refresh Matrix
                    </button>
                  </div>
                </div>
              </div>

              {/* Roles Directory */}
              <div className="admin-settings-card">
                <h3>
                  <FaUsersCog /> Platform Roles Directory
                </h3>
                <p style={{ color: "#64748b" }}>
                  HealPoint features 4 verified role classifications.
                  Unauthorized or mock roles are strictly rejected by the
                  backend security layer.
                </p>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  {(rolesData.roles || []).map((role) => (
                    <div
                      key={role.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "1.25rem",
                        background: "#fff",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <h4
                            style={{
                              margin: 0,
                              fontSize: "1.05rem",
                              color: "#1e293b",
                            }}
                          >
                            {role.name}
                          </h4>
                          <span
                            style={{
                              fontSize: "0.7rem",
                              fontWeight: "600",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              background: role.color
                                ? `${role.color}15`
                                : "#e2e8f0",
                              color: role.color || "#475569",
                            }}
                          >
                            {role.badge}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: "0.85rem",
                            color: "#64748b",
                            lineHeight: "1.4",
                            margin: "0.5rem 0",
                          }}
                        >
                          {role.description}
                        </p>
                      </div>
                      <div
                        style={{
                          marginTop: "1rem",
                          paddingTop: "0.75rem",
                          borderTop: "1px solid #f1f5f9",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.8rem",
                          color: "#64748b",
                        }}
                      >
                        <span>
                          Scope: <strong>{role.level}</strong>
                        </span>
                        <span>
                          {role.moduleCount > 0
                            ? `${role.moduleCount} Modules`
                            : role.portal
                              ? "Portal Access"
                              : "Standard"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hospital Administrator Permission Configurator */}
              <div className="admin-settings-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <h3>
                      <FaUserShield /> Hospital Admin Module Assignment
                    </h3>
                    <p style={{ color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      Grant or revoke granular module access for facility
                      administrators. Changes are enforced on their next request
                      and logged to the security audit trail.
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={handleSelectAllPermissions}
                    >
                      Select All (16)
                    </button>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={handleResetDefaultPermissions}
                    >
                      Reset Default (8)
                    </button>
                    <button
                      type="button"
                      className="btn btn-light btn-sm"
                      onClick={handleClearAllPermissions}
                    >
                      Clear All
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={savingPermissions || !selectedAdminId}
                      onClick={handleSaveAdminPermissions}
                    >
                      <FaSave />{" "}
                      {savingPermissions ? "Saving..." : "Save Permissions"}
                    </button>
                  </div>
                </div>

                {/* Admin selector */}
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: "10px",
                    padding: "1rem",
                    margin: "1.25rem 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: "260px" }}>
                    <label
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#475569",
                        display: "block",
                        marginBottom: "0.25rem",
                      }}
                    >
                      Target Hospital Administrator:
                    </label>
                    <select
                      className="form-control"
                      value={selectedAdminId}
                      onChange={(e) =>
                        handleSelectAdminForPermissions(e.target.value)
                      }
                      style={{ background: "#fff", borderColor: "#cbd5e1" }}
                    >
                      {rolesData.admins.map((adm) => (
                        <option key={adm._id} value={adm._id}>
                          {adm.name} ({adm.email}) —{" "}
                          {adm.hospital?.name || "Unassigned"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedAdminId &&
                    (() => {
                      const current = rolesData.admins.find(
                        (a) => a._id === selectedAdminId,
                      );
                      return (
                        <div
                          style={{
                            display: "flex",
                            gap: "1.25rem",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <small
                              style={{ color: "#64748b", display: "block" }}
                            >
                              Assigned Hospital
                            </small>
                            <strong>
                              {current?.hospital?.name || "Unassigned"}
                            </strong>
                          </div>
                          <div>
                            <small
                              style={{ color: "#64748b", display: "block" }}
                            >
                              Account Status
                            </small>
                            <span
                              style={{
                                color: current?.isActive
                                  ? "#16a34a"
                                  : "#dc2626",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                              }}
                            >
                              {current?.isActive ? "Active" : "Suspended"}
                            </span>
                          </div>
                          <div>
                            <small
                              style={{ color: "#64748b", display: "block" }}
                            >
                              Modules Granted
                            </small>
                            <span
                              style={{
                                background: "#e0e7ff",
                                color: "#4338ca",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                fontWeight: 600,
                                fontSize: "0.85rem",
                              }}
                            >
                              {selectedAdminPermissions.length} /{" "}
                              {rolesData.modules.length}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                </div>

                {/* Checkbox Matrix */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "0.75rem",
                    marginTop: "1rem",
                  }}
                >
                  {rolesData.modules.map((module) => {
                    const isChecked = selectedAdminPermissions.includes(
                      module.id,
                    );
                    return (
                      <div
                        key={module.id}
                        onClick={() => handleTogglePermission(module.id)}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                          padding: "0.85rem 1rem",
                          borderRadius: "10px",
                          border: isChecked
                            ? "1px solid #6366f1"
                            : "1px solid #e2e8f0",
                          background: isChecked
                            ? "rgba(99, 102, 241, 0.04)"
                            : "#fff",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{
                            marginTop: "3px",
                            cursor: "pointer",
                            accentColor: "#6366f1",
                          }}
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
                                fontSize: "0.9rem",
                                color: isChecked ? "#4338ca" : "#1e293b",
                              }}
                            >
                              {module.name}
                            </strong>
                            <span
                              style={{
                                fontSize: "0.65rem",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                background: "#f1f5f9",
                                color: "#64748b",
                              }}
                            >
                              {module.category}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: "0.75rem",
                              color: "#64748b",
                              margin: "0.25rem 0 0 0",
                              lineHeight: "1.3",
                            }}
                          >
                            {module.description}
                          </p>
                          <small
                            style={{
                              fontSize: "0.7rem",
                              color: "#94a3b8",
                              display: "inline-block",
                              marginTop: "4px",
                            }}
                          >
                            Route: {module.route}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 16-Module Platform Capability Matrix */}
              <div className="admin-settings-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <h3>
                      <FaShieldAlt /> 16-Module Capabilities & Access Matrix
                    </h3>
                    <p style={{ color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      Reference directory of all official HealPoint modules,
                      identifiers, and role access privileges.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <select
                      className="form-control"
                      value={permissionCategoryFilter}
                      onChange={(e) =>
                        setPermissionCategoryFilter(e.target.value)
                      }
                      style={{ fontSize: "0.85rem", width: "auto" }}
                    >
                      <option value="all">All Categories</option>
                      <option value="Overview">Overview</option>
                      <option value="Clinical">Clinical</option>
                      <option value="Management">Management</option>
                      <option value="Finance">Finance</option>
                      <option value="Content">Content</option>
                      <option value="System">System</option>
                    </select>
                  </div>
                </div>

                <div className="admin-table-scroll">
                  <table className="table" style={{ fontSize: "0.85rem" }}>
                    <thead>
                      <tr>
                        <th>Module Name</th>
                        <th>Identifier</th>
                        <th>Category</th>
                        <th>Primary Route</th>
                        <th>Super Admin</th>
                        <th>Hospital Admin</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rolesData.modules
                        .filter(
                          (m) =>
                            permissionCategoryFilter === "all" ||
                            m.category === permissionCategoryFilter,
                        )
                        .map((mod) => (
                          <tr key={mod.id}>
                            <td>
                              <strong>{mod.name}</strong>
                            </td>
                            <td>
                              <code>{mod.id}</code>
                            </td>
                            <td>
                              <span
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: "4px",
                                  background: "#f1f5f9",
                                  fontSize: "0.75rem",
                                }}
                              >
                                {mod.category}
                              </span>
                            </td>
                            <td>
                              <small>{mod.route}</small>
                            </td>
                            <td>
                              <span
                                style={{ color: "#16a34a", fontWeight: 600 }}
                              >
                                <FaCheckCircle /> Full
                              </span>
                            </td>
                            <td>
                              {rolesData.defaultHospitalAdminPermissions.includes(
                                mod.id,
                              ) ? (
                                <span
                                  style={{
                                    color: "#0284c7",
                                    fontWeight: 600,
                                  }}
                                >
                                  <FaCheckCircle /> Default
                                </span>
                              ) : (
                                <span style={{ color: "#64748b" }}>
                                  Optional
                                </span>
                              )}
                            </td>
                            <td style={{ maxWidth: "260px", color: "#64748b" }}>
                              {mod.description}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="admin-settings-stack">
              <form className="admin-settings-card" onSubmit={changePassword}>
                <h3>
                  <FaShieldAlt /> Change Password
                </h3>
                <PasswordField
                  label="Current Admin Password"
                  value={passwordForm.currentPassword}
                  onChange={(value) =>
                    setPasswordForm({ ...passwordForm, currentPassword: value })
                  }
                  placeholder="Verify current password"
                />
                <PasswordField
                  label="New Password"
                  value={passwordForm.newPassword}
                  onChange={(value) =>
                    setPasswordForm({ ...passwordForm, newPassword: value })
                  }
                  placeholder="Create new password"
                />

                {/* Real-time Password Strength Meter */}
                {passwordForm.newPassword && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "0.75rem 1rem",
                      margin: "0.75rem 0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "0.35rem",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#475569",
                        }}
                      >
                        Password Strength:
                      </span>
                      <strong
                        style={{
                          fontSize: "0.8rem",
                          color: passwordStrength.color,
                        }}
                      >
                        {passwordStrength.label} ({passwordStrength.score}%)
                      </strong>
                    </div>
                    {/* Visual Strength Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "6px",
                        background: "#e2e8f0",
                        borderRadius: "3px",
                        overflow: "hidden",
                        marginBottom: "0.6rem",
                      }}
                    >
                      <div
                        style={{
                          width: `${passwordStrength.score}%`,
                          height: "100%",
                          background: passwordStrength.color,
                          transition: "width 0.3s ease, background 0.3s ease",
                        }}
                      />
                    </div>
                    {/* Checklist */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.35rem",
                        fontSize: "0.75rem",
                      }}
                    >
                      <span
                        style={{
                          color: passwordStrength.checks.length
                            ? "#16a34a"
                            : "#94a3b8",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        {passwordStrength.checks.length ? (
                          <FaCheck />
                        ) : (
                          <FaTimes />
                        )}{" "}
                        At least 8 characters
                      </span>
                      <span
                        style={{
                          color: passwordStrength.checks.upper
                            ? "#16a34a"
                            : "#94a3b8",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        {passwordStrength.checks.upper ? (
                          <FaCheck />
                        ) : (
                          <FaTimes />
                        )}{" "}
                        Uppercase letter (A-Z)
                      </span>
                      <span
                        style={{
                          color: passwordStrength.checks.lower
                            ? "#16a34a"
                            : "#94a3b8",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        {passwordStrength.checks.lower ? (
                          <FaCheck />
                        ) : (
                          <FaTimes />
                        )}{" "}
                        Lowercase letter (a-z)
                      </span>
                      <span
                        style={{
                          color: passwordStrength.checks.number
                            ? "#16a34a"
                            : "#94a3b8",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        {passwordStrength.checks.number ? (
                          <FaCheck />
                        ) : (
                          <FaTimes />
                        )}{" "}
                        Numeric digit (0-9)
                      </span>
                      <span
                        style={{
                          color: passwordStrength.checks.special
                            ? "#16a34a"
                            : "#94a3b8",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          gridColumn: "span 2",
                        }}
                      >
                        {passwordStrength.checks.special ? (
                          <FaCheck />
                        ) : (
                          <FaTimes />
                        )}{" "}
                        Special character (!@#$%^&*)
                      </span>
                    </div>
                  </div>
                )}

                <PasswordField
                  label="Confirm Password"
                  value={passwordForm.confirmPassword}
                  onChange={(value) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: value,
                    })
                  }
                  placeholder="Repeat new password"
                />
                <small className="admin-help-text">{passwordHelp}</small>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  Change Password
                </button>
              </form>

              {/* Active Device Sessions */}
              <div className="admin-settings-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <h3>
                      <FaHistory /> Active Device Sessions
                    </h3>
                    <p style={{ color: "#64748b", margin: "0.25rem 0 0 0" }}>
                      Recent device logins for your administrator account.
                      Changing your password automatically revokes sessions
                      across other devices.
                    </p>
                  </div>
                  <span className="badge badge-primary">
                    {activeSessions.length} Active Session
                    {activeSessions.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "0.75rem",
                    marginTop: "1rem",
                  }}
                >
                  {loginHistory.slice(0, 5).map((session, idx) => (
                    <div
                      key={session.sessionId || idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.85rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: session.active
                          ? "rgba(16,185,129,0.04)"
                          : "#fff",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <strong>{session.device || "Desktop Browser"}</strong>
                          {session.active ? (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "#16a34a",
                                background: "#dcfce7",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                fontWeight: 600,
                              }}
                            >
                              Current / Active
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                color: "#64748b",
                                background: "#f1f5f9",
                                padding: "1px 6px",
                                borderRadius: "4px",
                              }}
                            >
                              Terminated
                            </span>
                          )}
                        </div>
                        <small style={{ color: "#64748b" }}>
                          Browser: {session.browser || "Browser"} • IP:{" "}
                          {session.ip || "127.0.0.1"} •{" "}
                          {new Date(session.loggedInAt).toLocaleString("en-IN")}
                        </small>
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                        {session.status === "success"
                          ? "Authenticated"
                          : "Failed attempt"}
                      </span>
                    </div>
                  ))}
                  {loginHistory.length === 0 && (
                    <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                      No session history recorded yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="admin-settings-card">
                <h3>
                  <FaLock /> Account Security Controls
                </h3>
                <p>
                  Sensitive administrative actions require your current admin
                  password before changes are saved to ensure security.
                </p>
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() =>
                    setPasswordForm({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    })
                  }
                >
                  Reset Password Form
                </button>
              </div>
            </div>
          )}

          {activeTab === "admins" && (
            <div className="admin-settings-stack">
              <form className="admin-settings-card" onSubmit={saveAdmin}>
                <h3>
                  <FaUserPlus />{" "}
                  {editingAdmin ? "Edit Admin" : "Add Another Admin"}
                </h3>
                <div className="admin-account-grid compact">
                  <label className="admin-account-field">
                    <span>Name</span>
                    <input
                      value={(editingAdmin || adminForm).name}
                      onChange={(event) =>
                        editingAdmin
                          ? setEditingAdmin({
                              ...editingAdmin,
                              name: event.target.value,
                            })
                          : setAdminForm({
                              ...adminForm,
                              name: event.target.value,
                            })
                      }
                    />
                  </label>
                  <label className="admin-account-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={(editingAdmin || adminForm).email}
                      onChange={(event) =>
                        editingAdmin
                          ? setEditingAdmin({
                              ...editingAdmin,
                              email: event.target.value,
                            })
                          : setAdminForm({
                              ...adminForm,
                              email: event.target.value,
                            })
                      }
                    />
                  </label>
                  {!editingAdmin && (
                    <PasswordField
                      label="New Admin Password"
                      value={adminForm.password}
                      onChange={(value) =>
                        setAdminForm({ ...adminForm, password: value })
                      }
                      placeholder="Set login password"
                    />
                  )}
                  <label className="admin-account-field">
                    <span>Role</span>
                    <input
                      value={(editingAdmin || adminForm).role}
                      onChange={(event) =>
                        editingAdmin
                          ? setEditingAdmin({
                              ...editingAdmin,
                              role: event.target.value,
                            })
                          : setAdminForm({
                              ...adminForm,
                              role: event.target.value,
                            })
                      }
                    />
                  </label>
                  <PasswordField
                    label="Current Admin Password"
                    value={(editingAdmin || adminForm).currentPassword || ""}
                    onChange={(value) =>
                      editingAdmin
                        ? setEditingAdmin({
                            ...editingAdmin,
                            currentPassword: value,
                          })
                        : setAdminForm({ ...adminForm, currentPassword: value })
                    }
                    placeholder="Required to confirm"
                  />
                </div>
                <div className="admin-inline-actions">
                  {editingAdmin && (
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setEditingAdmin(null)}
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {editingAdmin ? "Update Admin" : "Create Admin"}
                  </button>
                </div>
              </form>

              <div className="admin-settings-card">
                <h3>
                  <FaUsersCog /> Admin List
                </h3>
                <div className="admin-table-scroll">
                  <table className="table admin-account-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((admin) => (
                        <tr key={admin._id}>
                          <td>{admin.name}</td>
                          <td>{admin.email}</td>
                          <td>{admin.role || "Administrator"}</td>
                          <td>
                            {admin.lastActivityAt
                              ? new Date(admin.lastActivityAt).toLocaleString()
                              : "Never"}
                          </td>
                          <td>
                            <div className="admin-inline-actions">
                              <button
                                type="button"
                                className="btn btn-light"
                                onClick={() =>
                                  setEditingAdmin({
                                    ...admin,
                                    currentPassword: "",
                                  })
                                }
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger"
                                disabled={admin._id === user?._id}
                                onClick={() => setDeleteTarget(admin)}
                              >
                                <FaTrash /> Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="admin-history-dashboard">
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  padding: "14px 18px",
                  background:
                    "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
                  border: "1px solid #bfdbfe",
                  borderRadius: "12px",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <strong
                    style={{
                      color: "#1e3a8a",
                      fontSize: "0.92rem",
                      display: "block",
                    }}
                  >
                    Platform-Wide Audit & Activity Logs
                  </strong>
                  <span style={{ color: "#3b82f6", fontSize: "0.82rem" }}>
                    View complete administrative history, doctor verification
                    events, hospital updates, and security logs.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate("/audit-logs")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.82rem",
                    padding: "8px 16px",
                  }}
                >
                  <FaHistory /> View Audit Logs Dashboard
                </button>
              </div>

              <div className="admin-history-card last-login-card">
                <div>
                  <span>Last Login</span>
                  <h3>
                    {lastLogin
                      ? formatDateTime(lastLogin.loggedInAt)
                      : "No successful login yet"}
                  </h3>
                  <p>
                    {lastLogin?.browser || "Unknown browser"} ·{" "}
                    {lastLogin?.device || "Unknown device"}
                  </p>
                </div>
                <FaSignInAlt />
              </div>

              <div className="admin-history-stats">
                <article>
                  <span>Success Login</span>
                  <strong>{successfulLogins.length}</strong>
                </article>
                <article>
                  <span>Failed Login</span>
                  <strong>{failedLogins.length}</strong>
                </article>
                <article>
                  <span>Active Sessions</span>
                  <strong>{activeSessions.length}</strong>
                </article>
              </div>

              <div className="admin-history-grid">
                <section className="admin-history-card">
                  <h3>
                    <FaLaptopMedical /> Active Sessions
                  </h3>
                  <div className="admin-session-list">
                    {(activeSessions.length
                      ? activeSessions
                      : successfulLogins.slice(0, 3)
                    ).map((item, index) => (
                      <article
                        key={`${item.sessionId || item.loggedInAt}-${index}`}
                      >
                        <div>
                          <strong>{item.browser || "Unknown browser"}</strong>
                          <span>
                            {item.device || "Unknown device"} ·{" "}
                            {item.ip || "Unknown IP"}
                          </span>
                        </div>
                        <em className={item.active ? "active" : ""}>
                          {item.active ? "Active" : "Closed"}
                        </em>
                      </article>
                    ))}
                    {!loginHistory.length && (
                      <p>No active sessions recorded yet.</p>
                    )}
                  </div>
                </section>

                <section className="admin-history-card">
                  <h3>
                    <FaHistory /> Security Activity Timeline
                  </h3>
                  <div className="admin-security-timeline">
                    {(securityActivity.length ? securityActivity : []).map(
                      (item, index) => (
                        <article
                          key={`${item.createdAt}-${index}`}
                          className={item.type}
                        >
                          <span>
                            {item.type === "logout" ? (
                              <FaSignOutAlt />
                            ) : (
                              <FaShieldAlt />
                            )}
                          </span>
                          <div>
                            <strong>
                              {item.title || item.type?.replaceAll("_", " ")}
                            </strong>
                            <p>
                              {item.message || "Security activity recorded."}
                            </p>
                            <small>
                              {formatDateTime(item.createdAt)} ·{" "}
                              {item.browser || "Unknown browser"} ·{" "}
                              {item.device || "Unknown device"}
                            </small>
                          </div>
                        </article>
                      ),
                    )}
                    {!securityActivity.length && (
                      <p>No security timeline activity recorded yet.</p>
                    )}
                  </div>
                </section>
              </div>

              <div className="admin-history-card">
                <h3>
                  <FaHistory /> Login History
                </h3>
                <div className="admin-table-scroll">
                  <table className="table admin-account-table">
                    <thead>
                      <tr>
                        <th>Login Date & Time</th>
                        <th>Logout Date & Time</th>
                        <th>Browser Information</th>
                        <th>Device Information</th>
                        <th>Status</th>
                        <th>Session</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.map((item, index) => (
                        <tr key={`${item.loggedInAt}-${index}`}>
                          <td>{formatDateTime(item.loggedInAt)}</td>
                          <td>{formatDateTime(item.loggedOutAt)}</td>
                          <td>
                            {item.browser ||
                              item.userAgent ||
                              "Unknown browser"}
                          </td>
                          <td>{item.device || "Unknown device"}</td>
                          <td>
                            <span
                              className={`admin-history-status ${item.status || "success"}`}
                            >
                              {item.status === "failed"
                                ? "Failed Login"
                                : "Success Login"}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`admin-history-session ${item.active ? "active" : "closed"}`}
                            >
                              {item.active ? "Active Session" : "Closed"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!loginHistory.length && (
                    <p>No login activity recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {deleteTarget && (
        <div className="admin-modal-backdrop" role="dialog" aria-modal="true">
          <div className="admin-confirm-modal">
            <h3>Remove admin?</h3>
            <p>
              Enter your current admin password to remove {deleteTarget.email}.
            </p>
            <PasswordField
              label="Current Admin Password"
              value={deletePassword}
              onChange={setDeletePassword}
              placeholder="Required"
            />
            <div className="admin-inline-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={removeAdmin}
                disabled={loading}
              >
                Remove Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default AdminAccount;
