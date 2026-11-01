import React, { useEffect, useMemo, useState } from "react";
import "./PremiumWorkspace.css";
import { Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import {
  FaBell,
  FaCalendarAlt,
  FaChartLine,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaClipboardList,
  FaCoins,
  FaCreditCard,
  FaEye,
  FaHospital,
  FaImages,
  FaLock,
  FaSearch,
  FaSignOutAlt,
  FaStethoscope,
  FaTimes,
  FaUserInjured,
  FaUserMd,
  FaPrint,
  FaFilePdf,
  FaHistory,
  FaBars,
  FaClinicMedical,
  FaStar,
  FaVideo,
  FaClock,
  FaMapMarkerAlt,
  FaArrowRight,
  FaCheckCircle,
  FaSyncAlt,
  FaPhoneAlt,
  FaRupeeSign,
  FaLayerGroup,
  FaUserCheck,
  FaMoneyBillWave,
  FaShieldAlt,
  FaKey,
  FaQuestionCircle,
  FaHeadset,
  FaChartBar,
  FaDownload,
  FaChevronDown,
  FaChevronUp,
  FaPaperPlane,
  FaSave,
  FaExclamationCircle,
  FaExternalLinkAlt,
  FaCheckDouble,
  FaQrcode,
  FaTrash,
  FaAmbulance,
} from "react-icons/fa";
import api from "./services/api";
import { jsPDF } from "jspdf";
import HospitalLogin from "./pages/HospitalLogin";
import Doctors from "./pages/Doctors";
import OnlineConsultationsView from "./OnlineConsultationsView";
import HospitalProfile from "./pages/HospitalProfile";
import Departments from "./pages/Departments";
import Appointments from "./pages/Appointments";
import DoctorScheduling from "./pages/DoctorScheduling";
import CheckInScannerView from "./pages/CheckInScannerView";
import ComplianceGovernanceCenter from "./pages/ComplianceGovernanceCenter";
import { HospitalEmergencyManager } from "./components/HospitalEmergencyManager";
import { formatDoctorName } from "./services/doctorFormat";
import {
  initHospitalSocket,
  disconnectHospitalSocket,
  subscribeHospitalSync,
} from "./services/socket";

const session = () =>
  JSON.parse(localStorage.getItem("hospitalAdminApp") || "null");
const pageSize = 8;
const menuGroups = [
  {
    label: "Overview",
    items: [
      ["dashboard", "Dashboard", FaChartLine],
      ["reports", "Reports & Analytics", FaChartBar],
      ["profile", "Hospital Profile", FaHospital],
    ],
  },
  {
    label: "Governance",
    items: [["compliance", "Compliance & Governance", FaShieldAlt]],
  },
  {
    label: "People",
    items: [
      ["doctors", "Doctors", FaUserMd],
      ["verification", "Doctor Verification", FaStethoscope],
      ["patients", "Patients", FaUserInjured],
    ],
  },
  {
    label: "Operations",
    items: [
      ["emergency", "Emergency SOS Queue", FaAmbulance],
      ["check-in", "Check-In & Queue", FaQrcode],
      ["appointments", "Appointments", FaClipboardList],
      ["online-consultations", "Online Consultations", FaVideo],
      ["availability", "Doctor Scheduling", FaCalendarAlt],
      ["departments", "Departments & Services", FaClinicMedical],
    ],
  },
  {
    label: "Communication",
    items: [
      ["notifications", "Notifications", FaBell],
      ["reviews", "Reviews", FaStar],
    ],
  },
  {
    label: "Hospital Content",
    items: [["gallery", "Hospital Gallery", FaImages]],
  },
  {
    label: "Finance",
    items: [
      ["earnings", "Earnings", FaCoins],
      ["subscription", "Subscription & Billing", FaCreditCard],
    ],
  },
  {
    label: "System",
    items: [["settings", "Settings & Security", FaLock]],
  },
];

const dateValue = (value) => {
  const parts = String(value || "").match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  return parts
    ? new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]))
    : null;
};
const inRange = (value, range) => {
  if (range === "all") return true;
  const date = dateValue(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  if (range === "today") return date.getTime() === today.getTime();
  if (range === "tomorrow") {
    end.setDate(end.getDate() + 1);
    return date.getTime() === end.getTime();
  }
  end.setDate(end.getDate() + (range === "week" ? 7 : 30));
  return date >= today && date <= end;
};
const formatMoney = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;
const statusLabel = (value) => String(value || "pending").replace("_", " ");
const statusClass = (value) =>
  `status-badge ${String(value || "pending").toLowerCase()}`;
const toInputDate = (value) => {
  const date = dateValue(value);
  return date ? date.toISOString().slice(0, 10) : "";
};
const toSlotDate = (value) => {
  const [year, month, day] = String(value || "").split("-");
  return year ? `${day}-${month}-${year}` : "";
};

/* ---------- Shared Print / PDF report helpers (no new files) ---------- */
const writePdfLines = (doc, lines) => {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(50);
  let y = 52;
  const pageHeight = 285;
  lines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, 182);
    wrapped.forEach((piece) => {
      if (y > pageHeight) {
        doc.addPage();
        y = 20;
      }
      doc.text(piece, 14, y);
      y += 5;
    });
  });
};

const buildPdf = (title, lines, filename) => {
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(13, 148, 136);
  doc.text("HealPoint", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Healing made human · Healthcare report", 14, 24);
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(title, 14, 33);
  doc.setTextColor(110);
  doc.setFontSize(9);
  doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, 14, 39);
  writePdfLines(doc, lines);
  doc.save(filename);
};

const openPrintWindow = (title, lines) => {
  const printWindow = window.open("", "_blank", "width=820,height=620");
  if (!printWindow) return;
  printWindow.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:28px;}
      .hp-brand{color:#0d9488;font-size:22px;font-weight:800;}
      .hp-sub{color:#64748b;font-size:12px;margin-top:2px;}
      h1{font-size:17px;margin:22px 0 4px;}
      .hp-meta{color:#64748b;font-size:11px;margin-bottom:14px;}
      pre{font-family:inherit;font-size:12px;line-height:1.7;white-space:pre-wrap;}
      @media print{body{padding:10px;}}
    </style></head><body>
    <div class="hp-brand">HealPoint</div>
    <div class="hp-sub">Healing made human · Healthcare report</div>
    <h1>${title}</h1>
    <div class="hp-meta">Generated on ${new Date().toLocaleString("en-IN")}</div>
    <pre>${lines.join("\n")}</pre>
    </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};

const appointmentReportLines = (list) => {
  const lines = [`Total appointments: ${(list || []).length}`];
  (list || []).forEach((item, index) => {
    lines.push(
      `\n#${index + 1}`,
      `Patient: ${item.userId?.name || "Patient"} | ${item.userId?.phone || ""}`,
      `Doctor: ${formatDoctorName(item.doctorId?.name, "Doctor")} | ${item.doctorId?.speciality || ""}`,
      `Date/Time: ${item.slotDate || "—"} at ${item.slotTime || "—"} | Type: ${item.consultationType || "clinic"}`,
      `Status: ${statusLabel(item.status)} | Payment: ${item.paymentStatus || "pending"} | ${formatMoney(item.amount)}`,
      "------------------------------------------------",
    );
  });
  return lines;
};

const patientReportLines = (list) => {
  const lines = [`Total patients: ${(list || []).length}`];
  (list || []).forEach((patient, index) => {
    lines.push(
      `\n#${index + 1}`,
      `Name: ${patient.name || "Patient"} | ${patient.email || ""}`,
      `Phone: ${patient.phone || "—"} | Gender: ${patient.gender || "—"}`,
      `Registered: ${
        patient.createdAt
          ? new Date(patient.createdAt).toLocaleDateString("en-IN")
          : "—"
      }`,
      "------------------------------------------------",
    );
  });
  return lines;
};

const doctorReportLines = (list) => {
  const lines = [`Total doctors: ${(list || []).length}`];
  (list || []).forEach((doctor, index) => {
    lines.push(
      `\n#${index + 1}`,
      `Name: ${doctor.name} | ${doctor.email}`,
      `Phone: ${doctor.phone || "—"} | Speciality: ${doctor.speciality || doctor.department || "General care"}`,
      `Availability: ${doctor.available ? "Available" : "Unavailable"} | Verification: ${doctor.verificationStatus || "Pending"}`,
      "------------------------------------------------",
    );
  });
  return lines;
};

function Protected({ children }) {
  return session()?.token ? children : <Navigate to="/login" replace />;
}

function Pagination({ page, count, onChange }) {
  if (count <= 1) return null;
  return (
    <div className="pagination">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <FaChevronLeft /> Previous
      </button>
      <span>
        Page {page} of {count}
      </span>
      <button
        type="button"
        disabled={page >= count}
        onClick={() => onChange(page + 1)}
      >
        Next <FaChevronRight />
      </button>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  empty = "No records available for this hospital.",
}) {
  return rows.length ? (
    <div className="data-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  ) : (
    <div className="empty-state">
      <FaClipboardList />
      <strong>{empty}</strong>
      <span>Data remains securely limited to your assigned hospital.</span>
    </div>
  );
}

function Portal() {
  const navigate = useNavigate();
  const location = useLocation();
  const app = session();

  const getPathView = (pathname) => {
    const raw = String(pathname || "").replace(/^\/+/, "").split("/")[0]?.trim();
    return raw || "dashboard";
  };

  const [view, setViewState] = useState(() => getPathView(location.pathname));

  useEffect(() => {
    const current = getPathView(location.pathname);
    setViewState(current);
  }, [location.pathname]);

  const setView = (nextView) => {
    setViewState(nextView);
    const targetPath = nextView === "dashboard" ? "/" : `/${nextView}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState(null);
  const [range, setRange] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appointmentsTab, setAppointmentsTab] = useState("list");

  const confirmLogout = () => {
    disconnectHospitalSocket();
    localStorage.removeItem("hospitalAdminApp");
    sessionStorage.removeItem("hospitalAdminApp");
    setLogoutOpen(false);
    navigate("/login", { replace: true });
  };

  const load = async () => {
    setLoading(true);
    setWorkspaceError(null);
    try {
      const response = await api.get("/api/v1/hospital-admin/dashboard");
      setData(response.data);
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        "Unable to load your hospital workspace";
      setWorkspaceError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();

    const s = session();
    if (s?.token) {
      initHospitalSocket(s.token);
    }

    let debounceTimer = null;
    const triggerDebouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        load();
      }, 400);
    };

    const unsubscribe = subscribeHospitalSync({
      onAppointmentSync: () => triggerDebouncedRefresh(),
      onQueueSync: () => triggerDebouncedRefresh(),
      onConsultationSync: () => triggerDebouncedRefresh(),
      onReviewSync: () => triggerDebouncedRefresh(),
      onNotification: (notif) => {
        triggerDebouncedRefresh();
        if (notif?.title) toast.info(notif.title);
      },
      onAuditSync: () => triggerDebouncedRefresh(),
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    setPage(1);
  }, [view, range, search]);

  const appointments = useMemo(
    () =>
      (data?.appointments || []).filter((item) => {
        const text =
          `${item.userId?.name || ""} ${item.doctorId?.name || ""} ${item.slotDate || ""} ${item.status || ""}`.toLowerCase();
        return (
          inRange(item.slotDate, range) && text.includes(search.toLowerCase())
        );
      }),
    [data, range, search],
  );
  const visibleAppointments = useMemo(
    () => appointments.slice((page - 1) * pageSize, page * pageSize),
    [appointments, page],
  );

  const changeAppointment = async (appointment, status) => {
    setBusyId(appointment._id);
    try {
      await api.patch(`/api/v1/appointment/update-status/${appointment._id}`, {
        appoinmtentStatus: status,
        reason: `Updated by ${app?.admin?.name || "Hospital Admin"}`,
      });
      toast.success(`Appointment ${statusLabel(status)}`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Appointment update failed");
    } finally {
      setBusyId("");
    }
  };
  const submitReschedule = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId(reschedule._id);
    try {
      await api.patch(`/api/v1/appointment/reschedule/${reschedule._id}`, {
        slotDate: toSlotDate(form.get("date")),
        slotTime: form.get("time"),
        reason: form.get("reason") || "Rescheduled by Hospital Admin",
      });
      toast.success("Appointment rescheduled");
      setReschedule(null);
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to reschedule appointment",
      );
    } finally {
      setBusyId("");
    }
  };
  const updateDoctor = async (doctor, payload, message) => {
    setBusyId(doctor._id);
    try {
      await api.patch(
        `/api/v1/doctor/${payload.status ? "update-verification-status" : "update-status"}/${doctor._id}`,
        payload,
      );
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Doctor update failed");
    } finally {
      setBusyId("");
    }
  };

  const toggleAvailability = async (doctor, available) => {
    setBusyId(doctor._id);
    try {
      await api.patch(`/api/v1/doctor/update-status/${doctor._id}`, {
        availableStatus: available,
      });
      toast.success(
        available
          ? `${doctor.name} is now available for appointments`
          : `${doctor.name} is now unavailable for appointments`,
      );
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Doctor availability update failed",
      );
    } finally {
      setBusyId("");
    }
  };

  if (loading && !data) return <DashboardSkeleton />;
  if (workspaceError && !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", padding: "20px" }}>
        <div style={{ maxWidth: "480px", background: "#fff", borderRadius: "12px", padding: "32px", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", border: "1px solid #fee2e2" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "20px" }}>
            ⚠
          </div>
          <h2 style={{ fontSize: "1.25rem", color: "#0f172a", marginBottom: "8px" }}>Hospital Workspace Unavailable</h2>
          <p style={{ color: "#64748b", fontSize: "0.925rem", marginBottom: "20px" }}>{workspaceError}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button type="button" className="action-btn primary" onClick={load}>Retry Loading</button>
            <button type="button" className="action-btn secondary" onClick={confirmLogout}>Log Out</button>
          </div>
        </div>
      </div>
    );
  }
  const hospital = data?.hospital || app?.hospital || {};
  const pageTitle =
    menuGroups
      .flatMap((group) => group.items)
      .find(([key]) => key === view)?.[1] || "Dashboard";
  return (
    <div className={`hospital-shell${mobileOpen ? " menu-open" : ""}`}>
      <aside className="hospital-sidebar">
        <div className="hospital-brand">
          {hospital.logo ? (
            <img
              src={hospital.logo}
              alt={`${hospital.name} logo`}
              className="hospital-brand-logo"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          ) : (
            <img
              src="/logo.png"
              alt="HealPoint"
              width={38}
              height={38}
              style={{ borderRadius: 10, flexShrink: 0 }}
            />
          )}
          <div>
            <strong>{hospital.name || "HealPoint"}</strong>
            <small>Hospital Admin</small>
          </div>
        </div>
        <nav aria-label="Hospital admin navigation">
          {menuGroups.map((group) => (
            <div className="hp-nav-group" key={group.label}>
              <span className="hp-nav-group-label">{group.label}</span>
              {group.items.map(([key, label, Icon]) => (
                <button
                  type="button"
                  className={view === key ? "active" : ""}
                  onClick={() => {
                    setView(key);
                    setMobileOpen(false);
                  }}
                  key={key}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button
          type="button"
          className="logout"
          onClick={() => setLogoutOpen(true)}
        >
          <FaSignOutAlt />
          <span>Logout</span>
        </button>
      </aside>
      {mobileOpen && (
        <button
          type="button"
          className="hospital-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <main className="hospital-main">
        {![
          "appointments",
          "departments",
          "settings",
          "security",
          "support",
          "reports",
          "analytics",
          "notifications",
          "reviews",
          "patients",
          "earnings",
          "verification",
          "check-in",
        ].includes(view) ? (
          <header className="hospital-header">
            <div>
              <span
                className={
                  hospital.isActive
                    ? "hospital-state active"
                    : "hospital-state suspended"
                }
              >
                {hospital.isActive ? "Active hospital" : "Suspended hospital"}
              </span>
              <h1>{pageTitle}</h1>
              <p>
                {hospital.name} · Welcome,{" "}
                {app?.admin?.name || "Hospital Admin"}
              </p>
            </div>
            <div className="hospital-header-actions">
              <button
                type="button"
                className="menu-toggle"
                aria-label="Toggle navigation"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((value) => !value)}
              >
                {mobileOpen ? <FaTimes /> : <FaBars />}
              </button>
              <button className="refresh-button" type="button" onClick={load}>
                Refresh data
              </button>
            </div>
          </header>
        ) : (
          <div className="mobile-only-header">
            <button
              type="button"
              className="menu-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <FaTimes /> : <FaBars />}
            </button>
          </div>
        )}
        {view === "dashboard" && (
          <Dashboard data={data} setView={setView} setSelected={setSelected} />
        )}
        {(view === "reports" || view === "analytics") && (
          <ReportsView
            data={data}
            appointments={data?.appointments || []}
            setView={setView}
            reload={load}
          />
        )}
        {view === "compliance" && (
          <ComplianceGovernanceCenter hospital={hospital} />
        )}
        {view === "emergency" && <HospitalEmergencyManager hospital={hospital} />}
        {view === "online-consultations" && <OnlineConsultationsView />}
        {view === "appointments" && <Appointments hospital={hospital} />}
        {view === "doctors" && <Doctors />}
        {view === "patients" && (
          <PatientsView patients={data?.patients || []} />
        )}
        {view === "verification" && (
          <VerificationView
            doctors={(data?.doctors || []).filter(
              (doctor) => doctor.verificationStatus !== "Verified",
            )}
            onUpdate={updateDoctor}
            busyId={busyId}
          />
        )}
        {(view === "availability" ||
          view === "scheduling" ||
          view === "schedules") && <DoctorScheduling />}
        {view === "departments" && (
          <Departments hospital={hospital} reloadHospital={load} />
        )}
        {view === "reviews" && <ReviewsView reviews={data?.reviews || []} />}
        {view === "gallery" && (
          <GalleryView hospital={hospital} reload={load} />
        )}
        {view === "notifications" && (
          <NotificationsView notifications={data?.notifications || []} reload={load} />
        )}
        {view === "earnings" && <EarningsView data={data} />}
        {view === "subscription" && <SubscriptionView />}
        {view === "profile" && (
          <HospitalProfile hospital={hospital} reload={load} />
        )}
        {view === "settings" && (
          <SettingsView
            admin={app?.admin}
            hospital={hospital}
            setView={setView}
            initialTab="facility"
          />
        )}
        {view === "security" && (
          <SettingsView
            admin={app?.admin}
            hospital={hospital}
            setView={setView}
            initialTab="security"
          />
        )}
        {view === "support" && (
          <SettingsView
            admin={app?.admin}
            hospital={hospital}
            setView={setView}
            initialTab="support"
          />
        )}
        {view === "check-in" && <CheckInScannerView session={session()} />}
        {![
          "dashboard",
          "reports",
          "analytics",
          "compliance",
          "online-consultations",
          "appointments",
          "doctors",
          "patients",
          "verification",
          "availability",
          "scheduling",
          "schedules",
          "departments",
          "reviews",
          "gallery",
          "notifications",
          "earnings",
          "subscription",
          "profile",
          "settings",
          "security",
          "support",
          "check-in",
        ].includes(view) && (
          <div
            className="hp-not-found-card"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "#ffffff",
              borderRadius: "16px",
              margin: "24px 0",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            }}
          >
            <FaExclamationCircle
              style={{ fontSize: 48, color: "#f59e0b", marginBottom: 16 }}
            />
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: 8,
              }}
            >
              Page Not Found
            </h2>
            <p
              style={{
                color: "#64748b",
                marginBottom: 24,
                fontSize: 15,
                maxWidth: 480,
                margin: "0 auto 24px auto",
              }}
            >
              The section "<strong>{view}</strong>" does not exist in the
              Hospital Admin Portal.
            </p>
            <button
              type="button"
              className="primary-btn"
              onClick={() => setView("dashboard")}
              style={{
                background: "#0d9488",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "12px 28px",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </main>
      {selected && (
        <AppointmentModal
          appointment={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {reschedule && (
        <RescheduleModal
          appointment={reschedule}
          onClose={() => setReschedule(null)}
          onSubmit={submitReschedule}
          busy={busyId === reschedule._id}
        />
      )}
      {logoutOpen && (
        <div
          className="portal-logout-backdrop"
          role="presentation"
          onMouseDown={() => setLogoutOpen(false)}
        >
          <div
            className="portal-logout-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hospital-logout-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="portal-logout-icon">
              <FaSignOutAlt />
            </div>
            <h3 id="hospital-logout-title">Are you sure you want to logout?</h3>
            <p>Your Hospital Admin session will be closed securely.</p>
            <div className="portal-logout-actions">
              <button type="button" onClick={() => setLogoutOpen(false)}>
                Cancel
              </button>
              <button type="button" className="confirm" onClick={confirmLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="hp-dash-skeleton-wrap">
      <div className="hp-skeleton-hero shimmer" />
      <div className="hp-skeleton-stat-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="hp-skeleton-card shimmer" />
        ))}
      </div>
      <div className="hp-skeleton-chart shimmer" />
      <div className="hp-skeleton-grid">
        <div className="hp-skeleton-box shimmer" />
        <div className="hp-skeleton-box shimmer" />
      </div>
    </div>
  );
}

function Dashboard({ data, setView, setSelected }) {
  const totals = data?.dashboard?.totals || {};
  const hospital = data?.hospital || {};
  const doctors = data?.doctors || [];
  const patients = data?.patients || [];
  const appointments = data?.appointments || [];
  const reviews = data?.reviews || [];
  const departments = data?.departments || [];
  const subscription = data?.subscription || {};
  const notifications = data?.notifications || [];

  // 1. Time & Greeting
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const formattedDate = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // 2. Quick Actions
  const quickActions = [
    { label: "Add Doctor", target: "doctors", icon: FaUserMd },
    {
      label: "Verify Doctors",
      target: "verification",
      icon: FaStethoscope,
      badge: totals.pendingVerification > 0 ? totals.pendingVerification : null,
    },
    { label: "Schedule", target: "appointments", icon: FaClipboardList },
    { label: "Departments", target: "departments", icon: FaClinicMedical },
    { label: "Profile", target: "profile", icon: FaHospital },
    { label: "Plan & Billing", target: "subscription", icon: FaCreditCard },
  ];

  // 3. 8 Real KPI Cards
  const kpiCards = [
    {
      id: "doctors",
      title: "Total Doctors",
      value: totals.doctors ?? doctors.length,
      sub: `${totals.availableDoctors ?? doctors.filter((d) => d.available).length} on duty now`,
      target: "doctors",
      icon: FaUserMd,
      tone: "blue",
    },
    {
      id: "patients",
      title: "Hospital Patients",
      value: totals.patients ?? patients.length,
      sub: "Active patient registry",
      target: "patients",
      icon: FaUserInjured,
      tone: "cyan",
    },
    {
      id: "today",
      title: "Today's Schedule",
      value: totals.today ?? 0,
      sub: "Scheduled for today",
      target: "appointments",
      icon: FaCalendarAlt,
      tone: "amber",
    },
    {
      id: "upcoming",
      title: "Upcoming Visits",
      value: totals.upcoming ?? 0,
      sub: "Future bookings",
      target: "appointments",
      icon: FaClipboardList,
      tone: "purple",
    },
    {
      id: "completed",
      title: "Completed",
      value: totals.completed ?? 0,
      sub: "Consultations done",
      target: "appointments",
      icon: FaCheckCircle,
      tone: "emerald",
    },
    {
      id: "pending",
      title: "Pending Action",
      value: totals.pending ?? 0,
      sub: "Awaiting confirmation",
      target: "appointments",
      icon: FaClock,
      tone: "orange",
    },
    {
      id: "departments",
      title: "Departments",
      value: totals.departments ?? departments.length,
      sub: "Specialty clinical wings",
      target: "departments",
      icon: FaClinicMedical,
      tone: "indigo",
    },
    {
      id: "revenue",
      title: "Hospital Revenue",
      value: formatMoney(totals.revenue ?? 0),
      sub: totals.pendingRevenue
        ? `₹${Number(totals.pendingRevenue).toLocaleString("en-IN")} pending`
        : "Settled collections",
      target: "earnings",
      icon: FaCoins,
      tone: "teal",
    },
  ];

  // 4. Analytics Trend State
  const [trendPeriod, setTrendPeriod] = useState("daily");
  const [trendMetric, setTrendMetric] = useState("count");

  const trendData = useMemo(() => {
    const trends = data?.dashboard?.trends || {};
    if (trendPeriod === "weekly") return trends.weekly || [];
    if (trendPeriod === "monthly") return trends.monthly || [];
    return trends.daily || [];
  }, [data, trendPeriod]);

  const maxTrendVal = useMemo(() => {
    return Math.max(
      ...trendData.map((d) =>
        trendMetric === "revenue"
          ? Number(d.revenue || 0)
          : Number(d.count || 0),
      ),
      1,
    );
  }, [trendData, trendMetric]);

  const totalTrendVal = useMemo(() => {
    return trendData.reduce(
      (sum, d) =>
        sum +
        (trendMetric === "revenue"
          ? Number(d.revenue || 0)
          : Number(d.count || 0)),
      0,
    );
  }, [trendData, trendMetric]);

  // 5. Appointments Categorization & Filters
  const [apptFilter, setApptFilter] = useState("today");
  const [apptSearch, setApptSearch] = useState("");

  const todayKey = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;

  const categorizedAppointments = useMemo(() => {
    const today = appointments.filter((a) => {
      if (a.slotDate === todayKey) return true;
      const d = dateValue(a.slotDate);
      if (!d) return false;
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });
    const upcoming = appointments.filter((a) => {
      if (a.status !== "pending" && a.status !== "confirmed") return false;
      const d = dateValue(a.slotDate);
      if (!d) return false;
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return d > endOfToday;
    });
    const pending = appointments.filter((a) => a.status === "pending");
    const confirmed = appointments.filter((a) => a.status === "confirmed");
    const completed = appointments.filter((a) => a.status === "completed");
    const cancelled = appointments.filter(
      (a) => a.status === "cancel" || a.status === "cancelled",
    );
    return {
      today,
      upcoming,
      pending,
      confirmed,
      completed,
      cancelled,
      all: appointments,
    };
  }, [appointments, todayKey, now]);

  const activeApptList = useMemo(() => {
    const base = categorizedAppointments[apptFilter] || appointments;
    if (!apptSearch.trim()) return base;
    const q = apptSearch.toLowerCase();
    return base.filter((a) => {
      const pat = a.userId?.name || "";
      const phone = a.userId?.phone || "";
      const doc = a.doctorId?.name || "";
      const dept = a.doctorId?.department || a.doctorId?.speciality || "";
      const date = a.slotDate || "";
      return (
        pat.toLowerCase().includes(q) ||
        phone.toLowerCase().includes(q) ||
        doc.toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q) ||
        date.includes(q)
      );
    });
  }, [categorizedAppointments, apptFilter, apptSearch, appointments]);

  const locationStr =
    [hospital.location?.city, hospital.location?.state]
      .filter(Boolean)
      .join(", ") ||
    hospital.location?.address ||
    "Gujarat, India";

  return (
    <div className="hp-dash-container">
      {/* 1. Facility Command Bar / Hero */}
      <section className="hp-dash-hero">
        <div className="hp-dash-hero-info">
          <div className="hp-dash-hero-badges">
            <span
              className={
                hospital.isActive
                  ? "hp-dash-hero-chip active"
                  : "hp-dash-hero-chip suspended"
              }
            >
              <span className="hp-pulse-dot" />
              {hospital.isActive
                ? "Operational • Active Facility"
                : "Facility Suspended"}
            </span>
            <span className="hp-dash-hero-chip outline">
              <FaMapMarkerAlt /> {locationStr}
            </span>
            <span className="hp-dash-hero-chip outline">
              <FaClock /> OPD: {hospital.opdTimings || "09:00 AM - 08:00 PM"}
            </span>
          </div>
          <h2>
            {greeting}, {hospital.name || "HealPoint Hospital"}
          </h2>
          <p className="hp-dash-hero-sub">
            {formattedDate} · Hospital Operations & Clinical Command Center
          </p>
        </div>
        <div className="hp-dash-hero-actions">
          {quickActions.map(({ label, target, icon: Icon, badge }) => (
            <button
              type="button"
              key={label}
              className="hp-quick-action"
              onClick={() => setView(target)}
            >
              <Icon />
              <span>{label}</span>
              {badge ? <span className="hp-qa-badge">{badge}</span> : null}
            </button>
          ))}
        </div>
      </section>

      {/* 2. 8 Real KPI Cards */}
      <section className="stat-grid-8">
        {kpiCards.map(({ id, title, value, sub, target, icon: Icon, tone }) => (
          <button
            type="button"
            key={id}
            className={`hp-stat-card tone-${tone}`}
            onClick={() => setView(target)}
          >
            <div className="hp-stat-card-top">
              <span className="stat-ico">
                <Icon />
              </span>
              <span className="hp-stat-label">{title}</span>
            </div>
            <strong className="hp-stat-val">{value}</strong>
            <div className="hp-stat-sub">
              <span>{sub}</span>
              <FaArrowRight className="hp-stat-arrow" />
            </div>
          </button>
        ))}
      </section>

      {/* 3. Multi-Period Interactive Analytics Trend */}
      <section className="hp-panel hp-analytics-card">
        <div className="hp-analytics-header">
          <div>
            <h3>Hospital Activity & Performance Analytics</h3>
            <p>
              {trendPeriod === "daily"
                ? "Last 7 Days Trend"
                : trendPeriod === "weekly"
                  ? "Last 4 Weeks Breakdown"
                  : "Last 6 Months Trajectory"}
              {" · "}
              <strong>
                Total:{" "}
                {trendMetric === "revenue"
                  ? formatMoney(totalTrendVal)
                  : `${totalTrendVal} appointments`}
              </strong>
            </p>
          </div>
          <div className="hp-analytics-controls">
            <div className="hp-toggle-group">
              <button
                type="button"
                className={trendMetric === "count" ? "active" : ""}
                onClick={() => setTrendMetric("count")}
              >
                Volume
              </button>
              <button
                type="button"
                className={trendMetric === "revenue" ? "active" : ""}
                onClick={() => setTrendMetric("revenue")}
              >
                Revenue (₹)
              </button>
            </div>
            <div className="hp-toggle-group">
              <button
                type="button"
                className={trendPeriod === "daily" ? "active" : ""}
                onClick={() => setTrendPeriod("daily")}
              >
                7 Days
              </button>
              <button
                type="button"
                className={trendPeriod === "weekly" ? "active" : ""}
                onClick={() => setTrendPeriod("weekly")}
              >
                4 Weeks
              </button>
              <button
                type="button"
                className={trendPeriod === "monthly" ? "active" : ""}
                onClick={() => setTrendPeriod("monthly")}
              >
                6 Months
              </button>
            </div>
          </div>
        </div>

        <div className="hp-analytics-chart-bar-area">
          {trendData.map((item, idx) => {
            const val =
              trendMetric === "revenue"
                ? Number(item.revenue || 0)
                : Number(item.count || 0);
            const heightPct = Math.max(8, (val / maxTrendVal) * 100);
            const displayVal =
              trendMetric === "revenue" ? formatMoney(val) : val;
            return (
              <div key={item.label || idx} className="hp-chart-col">
                <span className="hp-chart-val">{displayVal}</span>
                <div className="hp-chart-track">
                  <div
                    className="hp-chart-fill"
                    style={{ height: `${heightPct}%` }}
                    title={`${item.label}: ${displayVal}`}
                  />
                </div>
                <small className="hp-chart-label">{item.label}</small>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Interactive Appointments Operations Table */}
      <section className="hp-panel hp-appointments-center">
        <div className="hp-panel-head">
          <div>
            <h3>Appointment Operations Center</h3>
            <p>
              Live clinical queue, patient arrivals, and consultation tracking
            </p>
          </div>
          <button
            type="button"
            className="hp-view-all-btn"
            onClick={() => setView("appointments")}
          >
            Full Appointment Manager <FaArrowRight />
          </button>
        </div>

        <div className="hp-appointments-filter-bar">
          <div className="hp-filter-tabs">
            {[
              ["today", "Today", categorizedAppointments.today.length],
              ["upcoming", "Upcoming", categorizedAppointments.upcoming.length],
              ["pending", "Pending", categorizedAppointments.pending.length],
              [
                "confirmed",
                "Confirmed",
                categorizedAppointments.confirmed.length,
              ],
              [
                "completed",
                "Completed",
                categorizedAppointments.completed.length,
              ],
              [
                "cancelled",
                "Cancelled",
                categorizedAppointments.cancelled.length,
              ],
              ["all", "All Records", categorizedAppointments.all.length],
            ].map(([key, label, count]) => (
              <button
                type="button"
                key={key}
                className={apptFilter === key ? "active" : ""}
                onClick={() => setApptFilter(key)}
              >
                {label} <span className="hp-tab-badge">{count}</span>
              </button>
            ))}
          </div>
          <label className="hp-table-search">
            <FaSearch />
            <input
              value={apptSearch}
              onChange={(e) => setApptSearch(e.target.value)}
              placeholder="Search patient, doctor, specialty..."
            />
          </label>
        </div>

        <div className="hp-table-wrap">
          {activeApptList.length ? (
            <table className="hp-dash-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor & Specialty</th>
                  <th>Schedule</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeApptList.slice(0, 7).map((item) => (
                  <tr key={item._id}>
                    <td>
                      <div className="hp-cell-patient">
                        <span className="hp-patient-avatar">
                          {(item.userId?.name || "P").charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {item.userId?.name || "Registered Patient"}
                          </strong>
                          <small>{item.userId?.phone || "No phone"}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>
                          {formatDoctorName(
                            item.doctorId?.name,
                            "Assigned Doctor",
                          )}
                        </strong>
                        <small className="hp-text-muted">
                          {item.doctorId?.department ||
                            item.doctorId?.speciality ||
                            "General Medicine"}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{item.slotDate}</strong>
                        <small>{item.slotTime}</small>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`hp-mode-badge ${item.consultationType === "video" ? "video" : "in-clinic"}`}
                      >
                        {item.consultationType === "video" ? (
                          <>
                            <FaVideo /> Video
                          </>
                        ) : (
                          <>
                            <FaClinicMedical /> In-Clinic
                          </>
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`hp-pay-badge ${item.paymentStatus === "paid" ? "paid" : "pending"}`}
                      >
                        {item.paymentStatus === "paid"
                          ? `Paid · ₹${item.amount || 0}`
                          : item.paymentMethod === "cash"
                            ? `Cash · ₹${item.amount || 0}`
                            : `Pending · ₹${item.amount || 0}`}
                      </span>
                    </td>
                    <td>
                      <span className={statusClass(item.status)}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="hp-table-action-btn"
                        onClick={() =>
                          setSelected
                            ? setSelected(item)
                            : setView("appointments")
                        }
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="hp-empty-table">
              <FaClipboardList />
              <h4>No appointments found</h4>
              <p>
                {apptSearch
                  ? "No records match your search filter."
                  : `There are currently no ${apptFilter} appointments for this hospital.`}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 5. Operational Modules Grid */}
      <section className="content-grid hp-dash-modules-grid">
        {/* Doctor Duty & Availability Panel */}
        <Panel
          title="Doctor Duty & Availability"
          action={
            <button
              type="button"
              className="panel-link"
              onClick={() => setView("doctors")}
            >
              Manage Doctors →
            </button>
          }
        >
          <div className="hp-doctor-roster-list">
            {doctors.slice(0, 5).map((doc) => (
              <div key={doc._id} className="hp-doctor-roster-row">
                <div className="hp-doc-info">
                  <div className="hp-doc-avatar">
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
                  <div>
                    <strong>{formatDoctorName(doc.name)}</strong>
                    <small>
                      {doc.speciality || doc.department || "Specialist"} · ₹
                      {doc.fees || 500}
                    </small>
                  </div>
                </div>
                <div className="hp-doc-status-cell">
                  <span
                    className={
                      doc.available
                        ? "status-badge confirmed"
                        : "status-badge cancel"
                    }
                  >
                    {doc.available ? "Available" : "Off Duty"}
                  </span>
                </div>
              </div>
            ))}
            {doctors.length === 0 && (
              <div className="empty-state small">
                <FaUserMd />
                <strong>No doctors assigned yet</strong>
              </div>
            )}
          </div>
        </Panel>

        {/* Clinical Departments Breakdown */}
        <Panel
          title="Departments & Clinical Wings"
          action={
            <button
              type="button"
              className="panel-link"
              onClick={() => setView("departments")}
            >
              All Departments →
            </button>
          }
        >
          <div className="hp-dept-breakdown-list">
            {departments.slice(0, 5).map((dept) => (
              <div key={dept.name} className="hp-dept-row">
                <div>
                  <strong>{dept.name}</strong>
                  <small>
                    {dept.doctorCount} Doctors · {dept.availableDoctors} Active
                  </small>
                </div>
                <div className="hp-dept-stats">
                  <span className="hp-dept-count-pill">
                    {dept.appointmentCount} Visits
                  </span>
                </div>
              </div>
            ))}
            {departments.length === 0 && (
              <div className="empty-state small">
                <FaClinicMedical />
                <strong>No active departments configured</strong>
              </div>
            )}
          </div>
        </Panel>

        {/* Active Subscription & Tier Card */}
        <Panel
          title="Subscription & Service Tier"
          action={
            <button
              type="button"
              className="panel-link"
              onClick={() => setView("subscription")}
            >
              Billing Details →
            </button>
          }
        >
          <div className="hp-subscription-banner">
            <div className="hp-sub-tier-badge">
              <FaCreditCard />
              <div>
                <strong>
                  {subscription.planName ||
                    hospital.subscriptionPlan ||
                    "Hospital Enterprise Tier"}
                </strong>
                <span className="hp-sub-status-pill">
                  {subscription.status || "Active Plan"}
                </span>
              </div>
            </div>
            <div className="hp-sub-details-grid">
              <div>
                <span className="hp-sub-detail-label">Billing Cycle</span>
                <strong className="hp-sub-detail-val">
                  {subscription.billingCycle
                    ? subscription.billingCycle.toUpperCase()
                    : "MONTHLY"}
                </strong>
              </div>
              <div>
                <span className="hp-sub-detail-label">Plan Fee</span>
                <strong className="hp-sub-detail-val">
                  {formatMoney(subscription.amount || 0)}
                </strong>
              </div>
              <div>
                <span className="hp-sub-detail-label">Valid Through</span>
                <strong className="hp-sub-detail-val">
                  {subscription.expiryDate
                    ? new Date(subscription.expiryDate).toLocaleDateString(
                        "en-IN",
                      )
                    : "Facility Active"}
                </strong>
              </div>
            </div>
          </div>
        </Panel>

        {/* Patient Satisfaction & Reviews */}
        <Panel
          title="Patient Feedback & Ratings"
          action={
            <button
              type="button"
              className="panel-link"
              onClick={() => setView("reviews")}
            >
              View All ({reviews.length}) →
            </button>
          }
        >
          <div className="hp-reviews-summary-bar">
            <div className="hp-rating-big">
              <strong>{totals.avgRating || 4.8}</strong>
              <small>out of 5.0</small>
            </div>
            <div className="hp-rating-stars-wrap">
              <div className="hp-stars">★★★★★</div>
              <small>Based on verified patient appointments</small>
            </div>
          </div>
          <div className="hp-compact-reviews-list">
            {reviews.slice(0, 3).map((r) => (
              <div key={r._id} className="hp-review-item">
                <div className="hp-review-item-head">
                  <strong>{r.patientId?.name || "Patient"}</strong>
                  <span className="hp-review-rating">★ {r.rating || 5}</span>
                </div>
                <small className="hp-text-muted">
                  Consulted {formatDoctorName(r.doctorId?.name, "Doctor")}
                </small>
                {r.comment && <p className="hp-review-comment">{r.comment}</p>}
              </div>
            ))}
            {reviews.length === 0 && (
              <div className="empty-state small">
                <FaStar />
                <strong>No reviews received yet</strong>
              </div>
            )}
          </div>
        </Panel>

        {/* Hospital Notifications */}
        <Panel
          title="Operational Alerts"
          action={
            <button
              type="button"
              className="panel-link"
              onClick={() => setView("notifications")}
            >
              All Alerts →
            </button>
          }
        >
          <NotificationsView
            notifications={(notifications || []).slice(0, 5)}
            compact
          />
        </Panel>
      </section>
    </div>
  );
}

function CompactReviews({ reviews }) {
  return reviews.length ? (
    <div className="compact-list">
      {reviews.map((review) => (
        <div key={review._id}>
          <span>
            <strong>{review.patientId?.name || "Patient"}</strong>
            <small>
              {formatDoctorName(review.doctorId?.name, "Doctor")} ·{" "}
              <b>{"★".repeat(Math.min(5, review.rating || 0))}</b>
            </small>
          </span>
          <em>{review.rating || 0}/5</em>
        </div>
      ))}
    </div>
  ) : (
    <div className="empty-state small">
      <FaStar />
      <strong>No patient reviews yet</strong>
    </div>
  );
}

function CompactAvailability({ doctors }) {
  return doctors.length ? (
    <div className="compact-list">
      {doctors.map((doctor) => (
        <div key={doctor._id}>
          <span>
            <strong>{doctor.name}</strong>
            <small>
              {doctor.speciality || doctor.department || "Specialist"}
            </small>
          </span>
          <em
            className={
              doctor.available
                ? "status-badge confirmed"
                : "status-badge cancel"
            }
          >
            {doctor.available ? "Available" : "Unavailable"}
          </em>
        </div>
      ))}
    </div>
  ) : (
    <div className="empty-state small">
      <FaCalendarAlt />
      <strong>No doctors assigned yet</strong>
    </div>
  );
}

const Panel = ({ title, children, action }) => (
  <section className="panel">
    <div className="panel-heading">
      <h2>{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

function BarChart({ data, money }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="bar-chart">
      {data.map((item) => (
        <div key={item.label}>
          <span
            style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }}
          />
          <strong>{money ? formatMoney(item.value) : item.value}</strong>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}

function CompactAppointments({ appointments }) {
  return appointments.length ? (
    <div className="compact-list">
      {appointments.map((item) => (
        <div key={item._id}>
          <span>
            <strong>{item.userId?.name || "Patient"}</strong>
            <small>
              {formatDoctorName(item.doctorId?.name, "Doctor")} ·{" "}
              {item.slotDate} {item.slotTime}
            </small>
          </span>
          <em className={statusClass(item.status)}>
            {statusLabel(item.status)}
          </em>
        </div>
      ))}
    </div>
  ) : (
    <div className="empty-state small">
      <strong>No recent appointments</strong>
    </div>
  );
}

function AppointmentFilters({ range, setRange, search, setSearch }) {
  return (
    <div className="table-toolbar">
      <div className="range-tabs">
        {[
          ["all", "All"],
          ["today", "Today"],
          ["tomorrow", "Tomorrow"],
          ["week", "This week"],
          ["month", "This month"],
        ].map(([value, label]) => (
          <button
            type="button"
            className={range === value ? "selected" : ""}
            onClick={() => setRange(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="search-field">
        <FaSearch />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search patient, doctor, date…"
        />
      </label>
    </div>
  );
}
function AppointmentsView({
  appointments,
  total,
  range,
  setRange,
  search,
  setSearch,
  page,
  setPage,
  selected,
  reschedule,
  changeStatus,
  busyId,
  reportData,
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const reportList = reportData || appointments;
  const reportTitle = "Appointments — HealPoint";
  return (
    <Panel
      title="Appointment management"
      action={<span className="record-count">{total} records</span>}
    >
      <div className="report-toolbar">
        <button
          type="button"
          className="report-btn"
          onClick={() =>
            openPrintWindow(reportTitle, appointmentReportLines(reportList))
          }
        >
          <FaPrint /> Print
        </button>
        <button
          type="button"
          className="report-btn"
          onClick={() =>
            buildPdf(
              reportTitle,
              appointmentReportLines(reportList),
              `appointments-${Date.now()}.pdf`,
            )
          }
        >
          <FaFilePdf /> Download PDF
        </button>
      </div>
      <AppointmentFilters {...{ range, setRange, search, setSearch }} />
      <DataTable
        columns={[
          "Patient",
          "Doctor",
          "Date & time",
          "Status",
          "Amount",
          "Actions",
        ]}
        rows={appointments.map((item) => (
          <tr key={item._id}>
            <td>
              <strong>{item.userId?.name || "Patient"}</strong>
              <small>{item.userId?.phone || item.userId?.email || ""}</small>
            </td>
            <td>
              {formatDoctorName(item.doctorId?.name, "Doctor")}
              <small>{item.doctorId?.speciality || ""}</small>
            </td>
            <td>
              {item.slotDate}
              <small>{item.slotTime}</small>
            </td>
            <td>
              <span className={statusClass(item.status)}>
                {statusLabel(item.status)}
              </span>
            </td>
            <td>{formatMoney(item.amount)}</td>
            <td>
              <div className="row-actions">
                <button
                  type="button"
                  onClick={() => selected(item)}
                  aria-label="View appointment"
                >
                  <FaEye />
                </button>
                {["pending", "rescheduled"].includes(item.status) && (
                  <button
                    type="button"
                    disabled={busyId === item._id}
                    className="accept"
                    onClick={() => changeStatus(item, "confirmed")}
                    title="Confirm"
                  >
                    <FaCheck />
                  </button>
                )}
                {!["completed", "cancel", "missed"].includes(item.status) && (
                  <button
                    type="button"
                    disabled={busyId === item._id}
                    onClick={() => reschedule(item)}
                    title="Reschedule"
                  >
                    <FaCalendarAlt />
                  </button>
                )}
                {!["completed", "cancel", "missed"].includes(item.status) && (
                  <button
                    type="button"
                    disabled={busyId === item._id}
                    className="reject"
                    onClick={() => changeStatus(item, "cancel")}
                    title="Cancel"
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      />{" "}
      <Pagination page={page} count={pageCount} onChange={setPage} />
    </Panel>
  );
}
function DoctorsView({ doctors, onUpdate, busyId }) {
  return (
    <Panel title="Doctors">
      <div className="report-toolbar">
        <button
          type="button"
          className="report-btn"
          onClick={() =>
            openPrintWindow("Doctors — HealPoint", doctorReportLines(doctors))
          }
        >
          <FaPrint /> Print
        </button>
        <button
          type="button"
          className="report-btn"
          onClick={() =>
            buildPdf(
              "Doctors — HealPoint",
              doctorReportLines(doctors),
              `doctors-${Date.now()}.pdf`,
            )
          }
        >
          <FaFilePdf /> Download PDF
        </button>
      </div>
      <DataTable
        columns={[
          "Doctor",
          "Speciality",
          "Contact",
          "Availability",
          "Verification",
          "Actions",
        ]}
        rows={doctors.map((doctor) => (
          <tr key={doctor._id}>
            <td>
              <strong>{doctor.name}</strong>
            </td>
            <td>{doctor.speciality || doctor.department || "General care"}</td>
            <td>
              <small>
                {doctor.email}
                <br />
                {doctor.phone || "—"}
              </small>
            </td>
            <td>
              <span
                className={
                  doctor.available
                    ? "status-badge confirmed"
                    : "status-badge cancel"
                }
              >
                {doctor.available ? "Available" : "Unavailable"}
              </span>
            </td>
            <td>
              <span className={statusClass(doctor.verificationStatus)}>
                {doctor.verificationStatus || "Pending"}
              </span>
            </td>
            <td>
              <div className="row-actions">
                <button
                  type="button"
                  disabled={busyId === doctor._id}
                  onClick={() =>
                    onUpdate(
                      doctor,
                      { available: !doctor.available },
                      `Doctor marked ${doctor.available ? "unavailable" : "available"}`,
                    )
                  }
                >
                  {doctor.available ? "Pause" : "Enable"}
                </button>
              </div>
            </td>
          </tr>
        ))}
      />
    </Panel>
  );
}
function PatientsView({ patients }) {
  const [search, setSearch] = useState("");
  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (p.name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.phone || "").toLowerCase().includes(q)
    );
  });

  const maleCount = patients.filter(
    (p) => (p.gender || "").toLowerCase() === "male",
  ).length;
  const femaleCount = patients.filter(
    (p) => (p.gender || "").toLowerCase() === "female",
  ).length;

  return (
    <div className="premier-page-container">
      <div className="premier-page-header">
        <div className="header-left">
          <div className="breadcrumb-line">
            <span>Hospital Portal</span>
            <span className="separator">/</span>
            <span className="current">Patients</span>
          </div>
          <h1>Patient Registry</h1>
          <p>
            All registered patients who have booked appointments at this
            facility
          </p>
        </div>
        <div className="header-right">
          <button
            type="button"
            className="action-btn secondary"
            onClick={() =>
              openPrintWindow(
                "Patients — HealPoint",
                patientReportLines(patients),
              )
            }
          >
            <FaPrint /> <span>Print</span>
          </button>
          <button
            type="button"
            className="action-btn secondary"
            onClick={() =>
              buildPdf(
                "Patients — HealPoint",
                patientReportLines(patients),
                `patients-${Date.now()}.pdf`,
              )
            }
          >
            <FaFilePdf /> <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        {[
          { label: "Total Patients", val: patients.length, color: "#0d9488" },
          { label: "Male", val: maleCount, color: "#3b82f6" },
          { label: "Female", val: femaleCount, color: "#ec4899" },
          {
            label: "Recent (30d)",
            val: patients.filter(
              (p) =>
                p.createdAt &&
                new Date(p.createdAt) >
                  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            ).length,
            color: "#f59e0b",
          },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "16px 24px",
              minWidth: "140px",
              flex: "1",
            }}
          >
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color }}>
              {val}
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#64748b",
                marginTop: "4px",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "10px",
          padding: "10px 16px",
          marginBottom: "16px",
        }}
      >
        <FaSearch style={{ color: "#94a3b8" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or phone..."
          style={{
            border: "none",
            outline: "none",
            width: "100%",
            fontSize: "0.9rem",
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
            }}
          >
            <FaTimes />
          </button>
        )}
      </label>

      <section className="panel">
        <div className="panel-heading">
          <h2>Patient Records</h2>
          <span className="record-count">
            {filtered.length} of {patients.length} patients
          </span>
        </div>
        <DataTable
          columns={["Patient", "Contact", "Gender", "Joined"]}
          rows={filtered.map((patient) => (
            <tr key={patient._id}>
              <td>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "#e0f2fe",
                      color: "#0369a1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "0.9rem",
                      flexShrink: 0,
                    }}
                  >
                    {(patient.name || "P").charAt(0).toUpperCase()}
                  </span>
                  <strong>{patient.name}</strong>
                </div>
              </td>
              <td>
                <small>
                  {patient.email}
                  <br />
                  {patient.phone || "—"}
                </small>
              </td>
              <td>{patient.gender || "—"}</td>
              <td>
                {patient.createdAt
                  ? new Date(patient.createdAt).toLocaleDateString("en-IN")
                  : "—"}
              </td>
            </tr>
          ))}
          empty="No patients registered for this hospital yet."
        />
      </section>
    </div>
  );
}
function VerificationView({ doctors, onUpdate, busyId }) {
  const pendingCount = doctors.filter(
    (d) => d.verificationStatus === "Pending" || !d.verificationStatus,
  ).length;
  const rejectedCount = doctors.filter(
    (d) => d.verificationStatus === "Rejected",
  ).length;

  return (
    <div className="premier-page-container">
      <div className="premier-page-header">
        <div className="header-left">
          <div className="breadcrumb-line">
            <span>Hospital Portal</span>
            <span className="separator">/</span>
            <span className="current">Doctor Verification</span>
          </div>
          <h1>Doctor Verification Queue</h1>
          <p>
            Review and approve doctor credentials for your hospital's clinical
            panel
          </p>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        {[
          { label: "Awaiting Review", val: doctors.length, color: "#0d9488" },
          { label: "Pending Status", val: pendingCount, color: "#f59e0b" },
          { label: "Rejected", val: rejectedCount, color: "#ef4444" },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "16px 24px",
              minWidth: "140px",
              flex: "1",
            }}
          >
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color }}>
              {val}
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#64748b",
                marginTop: "4px",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      <Panel title="Doctor Verification">
        <DataTable
          columns={["Doctor", "Speciality", "Current status", "Review action"]}
          rows={doctors.map((doctor) => (
            <tr key={doctor._id}>
              <td>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  {doctor.image ? (
                    <img
                      src={doctor.image}
                      alt={doctor.name}
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: "#e0f2fe",
                        color: "#0369a1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        flexShrink: 0,
                      }}
                    >
                      {(doctor.name || "D").charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <strong>{doctor.name}</strong>
                    <br />
                    <small style={{ color: "#64748b" }}>{doctor.email}</small>
                  </div>
                </div>
              </td>
              <td>{doctor.speciality || doctor.department || "—"}</td>
              <td>
                <span className={statusClass(doctor.verificationStatus)}>
                  {doctor.verificationStatus || "Pending"}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <button
                    type="button"
                    className="accept"
                    disabled={busyId === doctor._id}
                    onClick={() =>
                      onUpdate(
                        doctor,
                        {
                          status: "Verified",
                          note: "Verified by assigned Hospital Admin",
                        },
                        "Doctor verified",
                      )
                    }
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="reject"
                    disabled={busyId === doctor._id}
                    onClick={() =>
                      onUpdate(
                        doctor,
                        {
                          status: "Rejected",
                          note: "Rejected by assigned Hospital Admin",
                        },
                        "Doctor rejected",
                      )
                    }
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
          empty="No doctors are awaiting verification."
        />
      </Panel>
    </div>
  );
}
function AvailabilityView({ doctors, onToggle, busyId }) {
  const scheduleSummary = (doctor) => {
    if (Array.isArray(doctor.weeklySchedule) && doctor.weeklySchedule.length) {
      return doctor.weeklySchedule
        .filter((day) => day?.enabled)
        .map((day) => `${day.day} ${day.startTime}–${day.endTime}`)
        .join(" · ");
    }
    if (Array.isArray(doctor.timeSlots) && doctor.timeSlots.length) {
      return doctor.timeSlots
        .map(
          (slot) =>
            `${slot.day || slot.date} ${slot.startTime || slot.time || ""}–${slot.endTime || ""}`,
        )
        .join(" · ");
    }
    return doctor.availabilitySchedule || "Weekly schedule not configured";
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Doctor availability</h2>
        <span className="record-count">
          {doctors.filter((d) => d.available).length} available ·{" "}
          {doctors.length} doctors
        </span>
      </div>
      {doctors.length ? (
        <div className="availability-grid">
          {doctors.map((doctor) => (
            <article className="availability-card" key={doctor._id}>
              <div className="availability-card-head">
                {doctor.image ? (
                  <img
                    src={doctor.image}
                    alt={doctor.name}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <span>
                    <FaUserMd />
                  </span>
                )}
                <div>
                  <strong>{doctor.name}</strong>
                  <small>
                    {doctor.speciality || doctor.department || "Specialist"}
                  </small>
                </div>
                <em
                  className={
                    doctor.available
                      ? "status-badge confirmed"
                      : "status-badge cancel"
                  }
                >
                  {doctor.available ? "Available" : "Unavailable"}
                </em>
              </div>
              <div className="availability-schedule">
                <FaCalendarAlt />
                <span>{scheduleSummary(doctor)}</span>
              </div>
              <button
                type="button"
                className={doctor.available ? "toggle off" : "toggle on"}
                disabled={busyId === doctor._id}
                onClick={() => onToggle(doctor, !doctor.available)}
              >
                {busyId === doctor._id
                  ? "Updating…"
                  : doctor.available
                    ? "Mark unavailable"
                    : "Mark available"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FaCalendarAlt />
          <strong>No doctors have been assigned yet</strong>
          <span>
            Availability is managed per doctor once they join your hospital.
          </span>
        </div>
      )}
    </section>
  );
}
function DepartmentsView({ hospital, reload }) {
  const [departments, setDepartments] = useState(
    (hospital.departments || []).map((item) => String(item)),
  );
  const [services, setServices] = useState(
    (hospital.services || []).map((item) => String(item)),
  );
  const [departmentInput, setDepartmentInput] = useState("");
  const [serviceInput, setServiceInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addItem = (list, setter, value, setInput) => {
    const clean = value.trim();
    if (!clean || list.includes(clean)) return;
    setter([...list, clean]);
    setInput("");
  };
  const removeItem = (list, setter, item) =>
    setter(list.filter((value) => value !== item));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch("/api/v1/hospital-admin/profile", {
        departments,
        services,
      });
      toast.success("Departments & services updated");
      reload();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Unable to update departments & services",
      );
    } finally {
      setSaving(false);
    }
  };

  const TagEditor = ({
    title,
    items,
    onAdd,
    onRemove,
    input,
    setInput,
    placeholder,
    Icon,
  }) => (
    <div className="ds-editor">
      <div className="ds-editor-head">
        <span className="stat-ico">
          <Icon />
        </span>
        <h3>{title}</h3>
        <span className="record-count">{items.length}</span>
      </div>
      <div className="ds-tags">
        {items.length ? (
          items.map((item) => (
            <span className="ds-tag" key={item}>
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={() => onRemove(item)}
              >
                <FaTimes />
              </button>
            </span>
          ))
        ) : (
          <span className="ds-empty">None configured yet</span>
        )}
      </div>
      <div className="ds-add">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onAdd(input);
            }
          }}
        />
        <button type="button" onClick={() => onAdd(input)}>
          Add
        </button>
      </div>
    </div>
  );

  return (
    <form className="ds-form" onSubmit={save}>
      <div className="ds-grid">
        <TagEditor
          title="Departments"
          items={departments}
          onAdd={(value) =>
            addItem(departments, setDepartments, value, setDepartmentInput)
          }
          onRemove={(item) => removeItem(departments, setDepartments, item)}
          input={departmentInput}
          setInput={setDepartmentInput}
          placeholder="e.g. Cardiology"
          Icon={FaClinicMedical}
        />
        <TagEditor
          title="Services"
          items={services}
          onAdd={(value) =>
            addItem(services, setServices, value, setServiceInput)
          }
          onRemove={(item) => removeItem(services, setServices, item)}
          input={serviceInput}
          setInput={setServiceInput}
          placeholder="e.g. Emergency 24x7"
          Icon={FaClipboardList}
        />
      </div>
      <button type="submit" className="ds-save" disabled={saving}>
        {saving ? "Saving…" : "Save departments & services"}
      </button>
    </form>
  );
}
function ReviewsView({ reviews }) {
  const avgRating = reviews.length
    ? (
        reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
      ).toFixed(1)
    : "—";
  const fiveStarCount = reviews.filter((r) => r.rating === 5).length;

  return (
    <div className="premier-page-container">
      <div className="premier-page-header">
        <div className="header-left">
          <div className="breadcrumb-line">
            <span>Hospital Portal</span>
            <span className="separator">/</span>
            <span className="current">Reviews</span>
          </div>
          <h1>Patient Reviews & Feedback</h1>
          <p>Verified patient satisfaction scores and consultation feedback</p>
        </div>
        <div className="header-right">
          <button
            type="button"
            className="action-btn secondary"
            onClick={() =>
              openPrintWindow(
                "Reviews — HealPoint",
                reviews.map(
                  (r, i) =>
                    `#${i + 1} | ${r.patientId?.name || "Patient"} → ${formatDoctorName(r.doctorId?.name, "Doctor")} | ★${r.rating}/5 | ${r.comment || "No comment"}`,
                ),
              )
            }
          >
            <FaPrint /> <span>Print</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        {[
          { label: "Total Reviews", val: reviews.length, color: "#0d9488" },
          { label: "Average Rating", val: `★ ${avgRating}`, color: "#f59e0b" },
          { label: "5-Star Reviews", val: fiveStarCount, color: "#10b981" },
          { label: "Pending Response", val: 0, color: "#64748b" },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "16px 24px",
              minWidth: "140px",
              flex: "1",
            }}
          >
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color }}>
              {val}
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#64748b",
                marginTop: "4px",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      <Panel title="Hospital Reviews">
        <DataTable
          columns={["Patient", "Doctor", "Rating", "Comment", "Date"]}
          rows={reviews.map((review) => (
            <tr key={review._id}>
              <td>
                <strong>
                  {review.patientId?.name || review.name || "Patient"}
                </strong>
              </td>
              <td>{formatDoctorName(review.doctorId?.name, "Doctor")}</td>
              <td>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#fef9c3",
                    color: "#ca8a04",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    borderRadius: "8px",
                    padding: "3px 10px",
                  }}
                >
                  {"★".repeat(Math.min(5, review.rating || 0))}{" "}
                  {review.rating || 0}/5
                </span>
              </td>
              <td style={{ maxWidth: "300px" }}>
                {review.comment || review.review || "—"}
              </td>
              <td>
                <small style={{ color: "#64748b" }}>
                  {review.createdAt
                    ? new Date(review.createdAt).toLocaleDateString("en-IN")
                    : "—"}
                </small>
              </td>
            </tr>
          ))}
          empty="No reviews for this hospital yet."
        />
      </Panel>
    </div>
  );
}
function ReportsView({ data, appointments = [], setView, reload }) {
  const [period, setPeriod] = useState("all"); // "7days" | "4weeks" | "all"
  const [subTab, setSubTab] = useState("analytics"); // "analytics" | "medical-docs"

  const hospital = data?.hospital || {};
  const list = appointments || [];

  // Filter list by selected period
  const filteredList = useMemo(() => {
    if (period === "all") return list;
    const now = new Date();
    const cutoff = new Date();
    if (period === "7days") cutoff.setDate(now.getDate() - 7);
    if (period === "4weeks") cutoff.setDate(now.getDate() - 28);

    return list.filter((item) => {
      if (!item.slotDate) return true;
      const d = dateValue(item.slotDate);
      return d ? d >= cutoff : true;
    });
  }, [list, period]);

  // Aggregate metrics
  const total = filteredList.length;
  const completed = filteredList.filter((a) => a.status === "completed").length;
  const pending = filteredList.filter(
    (a) => a.status === "pending" || a.status === "confirmed",
  ).length;
  const cancelled = filteredList.filter(
    (a) => a.status === "cancelled" || a.status === "cancel",
  ).length;
  const totalRevenue = filteredList
    .filter((a) => a.paymentStatus === "completed" || a.isPaid)
    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Department distribution
  const deptDist = useMemo(() => {
    const counts = {};
    filteredList.forEach((a) => {
      const d = a.department || a.doctorId?.speciality || "General Medicine";
      counts[d] = (counts[d] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [filteredList]);

  // Medical reports extracted
  const attachedDocs = useMemo(() => {
    return list.flatMap((app) =>
      (app.medicalReports || []).map((rep) => ({
        ...rep,
        patientName: app.userId?.name || "Patient",
        doctorName: formatDoctorName(app.doctorId?.name, "Doctor"),
        date: app.slotDate,
        appointmentId: app._id,
      })),
    );
  }, [list]);

  const handleExportCsv = () => {
    if (!filteredList.length) return;
    const headers = [
      "Appointment ID",
      "Patient",
      "Doctor",
      "Department",
      "Date",
      "Time",
      "Status",
      "Payment",
      "Amount",
    ];
    const rows = filteredList.map((a) => [
      `"${a._id}"`,
      `"${a.userId?.name || "Patient"}"`,
      `"${a.doctorId?.name || "Doctor"}"`,
      `"${a.department || a.doctorId?.speciality || "General"}"`,
      `"${a.slotDate || ""}"`,
      `"${a.slotTime || ""}"`,
      `"${a.status || ""}"`,
      `"${a.paymentStatus || ""}"`,
      `"${a.amount || 0}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `hospital-analytics-${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    buildPdf(
      `${hospital.name || "Hospital"} — Operational Analytics Report`,
      [
        `Period Filter: ${period === "all" ? "All Time" : period === "7days" ? "Past 7 Days" : "Past 4 Weeks"}`,
        `Total Appointments: ${total}`,
        `Completed Consultations: ${completed} (${completionRate}%)`,
        `Pending & Confirmed: ${pending}`,
        `Cancelled Bookings: ${cancelled}`,
        `Realized Revenue Collections: ₹${totalRevenue.toLocaleString("en-IN")}`,
        "------------------------------------------------",
        `Specialty Distribution:`,
        ...deptDist.map(([d, count]) => `• ${d}: ${count} patient visits`),
      ],
      `analytics-report-${period}.pdf`,
    );
  };

  return (
    <div className="premier-page-container">
      {/* Premier Header */}
      <div className="premier-page-header">
        <div className="header-left">
          <div className="breadcrumb-line">
            <span>Hospital Portal</span>
            <span className="separator">/</span>
            <span className="current">Reports & Analytics</span>
          </div>
          <h1>Operational Reports & Analytics</h1>
          <p>
            {hospital?.name
              ? `${hospital.name} · Real-time Clinical Volume, Financial Realizations & Reports`
              : "Real-time Clinical Volume, Financial Realizations & Reports"}
          </p>
        </div>
        <div className="header-right">
          <button
            type="button"
            className="action-btn secondary"
            onClick={handleExportCsv}
            disabled={total === 0}
            title="Download CSV report"
          >
            <FaDownload />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            className="action-btn secondary"
            onClick={handleExportPdf}
            disabled={total === 0}
            title="Download PDF report"
          >
            <FaFilePdf />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            className="action-btn secondary"
            onClick={() => window.print()}
            title="Print report"
          >
            <FaPrint />
            <span>Print</span>
          </button>
          {reload && (
            <button
              type="button"
              className="action-btn primary"
              onClick={reload}
              title="Refresh data"
            >
              <FaSyncAlt />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs & Period bar */}
      <div
        className="hp-sub-tabs-bar"
        style={{ justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            className={subTab === "analytics" ? "selected" : ""}
            onClick={() => setSubTab("analytics")}
          >
            <FaChartBar /> Performance Analytics
          </button>
          <button
            type="button"
            className={subTab === "medical-docs" ? "selected" : ""}
            onClick={() => setSubTab("medical-docs")}
          >
            <FaFilePdf /> Medical Attachments ({attachedDocs.length})
          </button>
        </div>

        {subTab === "analytics" && (
          <div className="filter-pill-group" style={{ margin: 0 }}>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#64748b",
                alignSelf: "center",
                marginRight: "4px",
              }}
            >
              TIMEFRAME:
            </span>
            <button
              type="button"
              className={`filter-pill ${period === "all" ? "active" : ""}`}
              onClick={() => setPeriod("all")}
            >
              All Time ({list.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${period === "4weeks" ? "active" : ""}`}
              onClick={() => setPeriod("4weeks")}
            >
              Past 4 Weeks
            </button>
            <button
              type="button"
              className={`filter-pill ${period === "7days" ? "active" : ""}`}
              onClick={() => setPeriod("7days")}
            >
              Past 7 Days
            </button>
          </div>
        )}
      </div>

      {subTab === "analytics" ? (
        <>
          {/* KPI Summary Cards */}
          <div className="premier-stats-grid">
            <div className="stat-card">
              <div className="stat-icon-box blue">
                <FaCalendarAlt />
              </div>
              <div className="stat-content">
                <span className="stat-label">Total Appointments</span>
                <h3 className="stat-number">{total}</h3>
                <span className="stat-hint">In selected timeframe</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-box green">
                <FaCheckCircle />
              </div>
              <div className="stat-content">
                <span className="stat-label">Completed Consults</span>
                <h3 className="stat-number">{completed}</h3>
                <span className="stat-hint text-success">
                  {completionRate}% fulfillment
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-box indigo">
                <FaClock />
              </div>
              <div className="stat-content">
                <span className="stat-label">Pending / Confirmed</span>
                <h3 className="stat-number">{pending}</h3>
                <span className="stat-hint">Active pipeline</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-box purple">
                <FaTimes />
              </div>
              <div className="stat-content">
                <span className="stat-label">Cancelled / No-shows</span>
                <h3 className="stat-number">{cancelled}</h3>
                <span className="stat-hint text-muted">
                  {total > 0 ? Math.round((cancelled / total) * 100) : 0}%
                  revocation rate
                </span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon-box amber">
                <FaRupeeSign />
              </div>
              <div className="stat-content">
                <span className="stat-label">Realized Collections</span>
                <h3 className="stat-number">
                  ₹{totalRevenue.toLocaleString("en-IN")}
                </h3>
                <span className="stat-hint text-success">
                  Direct patient settlements
                </span>
              </div>
            </div>
          </div>

          {total === 0 ? (
            <div className="empty-data-alert">
              <FaExclamationCircle
                style={{ fontSize: "2rem", color: "#94a3b8" }}
              />
              <strong style={{ fontSize: "1rem", color: "#334155" }}>
                No appointment records found for this timeframe
              </strong>
              <span>
                Switch to "All Time" to view full historical metrics and trends.
              </span>
            </div>
          ) : (
            <div className="analytics-chart-card">
              <div className="analytics-chart-header">
                <div>
                  <h3>Specialty & Department Utilization</h3>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "0.84rem",
                      color: "#64748b",
                    }}
                  >
                    Breakdown of patient volume by clinical wing
                  </p>
                </div>
              </div>

              <div className="dept-breakdown-list">
                {deptDist.map(([dept, count]) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={dept} className="dept-breakdown-item">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <FaClinicMedical style={{ color: "#2563eb" }} />
                        <span>{dept}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                        }}
                      >
                        <div
                          style={{
                            width: "120px",
                            height: "8px",
                            background: "#e2e8f0",
                            borderRadius: "999px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background:
                                "linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)",
                              borderRadius: "999px",
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "0.82rem",
                            color: "#64748b",
                            minWidth: "40px",
                          }}
                        >
                          {pct}%
                        </span>
                        <strong>{count} visits</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Medical Attachments Roster */
        <div className="settings-content-card">
          <div className="settings-card-header">
            <h2>Patient Diagnostic Attachments & Reports</h2>
            <p>
              Uploaded clinical documentation, lab findings, and imaging reports
              across appointments.
            </p>
          </div>
          {attachedDocs.length === 0 ? (
            <div className="empty-data-alert">
              <FaFilePdf style={{ fontSize: "2rem", color: "#94a3b8" }} />
              <strong style={{ fontSize: "1rem", color: "#334155" }}>
                No clinical documents uploaded yet
              </strong>
              <span>
                Medical records uploaded by patients during booking will appear
                here.
              </span>
            </div>
          ) : (
            <DataTable
              columns={["Patient", "Doctor", "Date", "Document", "Action"]}
              rows={attachedDocs.map((doc, idx) => (
                <tr key={doc._id || idx}>
                  <td>
                    <strong>{doc.patientName}</strong>
                  </td>
                  <td>{doc.doctorName}</td>
                  <td>{doc.date || "—"}</td>
                  <td>{doc.name || doc.title || "Diagnostic Report"}</td>
                  <td>
                    {doc.url ? (
                      <a
                        className="action-btn secondary"
                        style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FaExternalLinkAlt /> Open File
                      </a>
                    ) : (
                      <span className="text-muted">Not attached</span>
                    )}
                  </td>
                </tr>
              ))}
            />
          )}
        </div>
      )}
    </div>
  );
}
function NotificationsView({ notifications: initialNotifications, compact, reload }) {
  const [items, setItems] = useState(initialNotifications || []);
  const [filter, setFilter] = useState("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    setItems(initialNotifications || []);
  }, [initialNotifications]);

  const markAsRead = async (id) => {
    try {
      setBusyId(id);
      await api.patch(`/api/v1/notification/read/${id}`, { isRead: true });
      setItems((prev) =>
        prev.map((item) => (item._id === id ? { ...item, isRead: true, read: true } : item))
      );
      toast.success("Notification marked as read");
      if (typeof reload === "function") reload();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update notification");
    } finally {
      setBusyId(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await api.patch("/api/v1/notification/mark-all", { isRead: true });
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true, read: true })));
      toast.success("All hospital notifications marked as read");
      if (typeof reload === "function") reload();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteItem = async (id) => {
    try {
      setBusyId(id);
      await api.delete(`/api/v1/notification/delete/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      toast.success("Notification deleted");
      if (typeof reload === "function") reload();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete notification");
    } finally {
      setBusyId(null);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((n) => {
      if (filter === "unread") return !n.isRead;
      if (filter === "high") return n.priority === "high" || n.priority === "urgent";
      if (filter === "bookings") {
        const t = (n.type || "").toLowerCase();
        return t.includes("appointment") || t.includes("booking") || t.includes("cancel");
      }
      return true;
    });
  }, [items, filter]);

  const unread = items.filter((n) => !n.isRead).length;

  const content = filteredItems.length ? (
    <div className="notification-list">
      {filteredItems.map((item) => (
        <article
          key={item._id}
          className={!item.isRead ? "unread-notif" : ""}
          style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px", borderBottom: "1px solid #f1f5f9" }}
        >
          <span className={`priority ${item.priority || "normal"}`} style={{ marginTop: "4px" }}>
            <FaBell />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
              <strong style={{ fontSize: "0.95rem", color: item.isRead ? "#475569" : "#0f172a" }}>{item.title}</strong>
              <small style={{ color: "#94a3b8", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                {item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "Just now"}
              </small>
            </div>
            <p style={{ margin: "4px 0 8px 0", color: "#64748b", fontSize: "0.85rem" }}>{item.message}</p>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {!item.isRead && (
                <button
                  type="button"
                  style={{
                    padding: "3px 8px",
                    fontSize: "0.75rem",
                    background: "#f0fdf4",
                    color: "#16a34a",
                    border: "1px solid #bbf7d0",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onClick={() => markAsRead(item._id)}
                  disabled={busyId === item._id}
                >
                  <FaCheck size={10} /> Mark Read
                </button>
              )}
              <button
                type="button"
                style={{
                  padding: "3px 8px",
                  fontSize: "0.75rem",
                  background: "#fef2f2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onClick={() => deleteItem(item._id)}
                disabled={busyId === item._id}
                title="Delete alert"
              >
                <FaTrash size={10} /> Delete
              </button>
            </div>
          </div>
          {!item.isRead && (
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "#0d9488",
                flexShrink: 0,
                marginTop: "6px",
              }}
            />
          )}
        </article>
      ))}
    </div>
  ) : (
    <div className="empty-state small" style={{ padding: "36px", textAlign: "center" }}>
      <FaBell size={28} style={{ color: "#94a3b8", marginBottom: "8px" }} />
      <p style={{ margin: 0, color: "#64748b", fontWeight: 600 }}>No hospital notifications matching this filter.</p>
    </div>
  );

  if (compact) return content;

  return (
    <div className="premier-page-container">
      <div className="premier-page-header">
        <div className="header-left">
          <div className="breadcrumb-line">
            <span>Hospital Portal</span>
            <span className="separator">/</span>
            <span className="current">Notifications</span>
          </div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            Operational Alerts
            {unread > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  borderRadius: "999px",
                  padding: "2px 9px",
                }}
              >
                {unread} NEW
              </span>
            )}
          </h1>
          <p>
            Live system events, booking updates and clinical alerts · {unread} unread of {items.length} total
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {typeof reload === "function" && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={reload}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <FaSyncAlt /> Refresh
            </button>
          )}
          {unread > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={markAllAsRead}
              disabled={markingAll}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <FaCheckDouble /> {markingAll ? "Marking..." : "Mark All as Read"}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        {[
          {
            label: "Total Alerts",
            val: items.length,
            color: "#0d9488",
          },
          {
            label: "Unread",
            val: unread,
            color: unread > 0 ? "#ef4444" : "#10b981",
          },
          {
            label: "Read",
            val: items.length - unread,
            color: "#64748b",
          },
          {
            label: "High Priority",
            val: items.filter((n) => n.priority === "high" || n.priority === "urgent").length,
            color: "#f59e0b",
          },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "16px 24px",
              minWidth: "140px",
              flex: "1",
            }}
          >
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color }}>
              {val}
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "#64748b",
                marginTop: "4px",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {[
              { id: "all", label: `All (${items.length})` },
              { id: "unread", label: `Unread (${unread})` },
              { id: "high", label: "High Priority" },
              { id: "bookings", label: "Bookings" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                style={{
                  padding: "6px 12px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: filter === tab.id ? "1px solid #0d9488" : "1px solid #e2e8f0",
                  background: filter === tab.id ? "#f0fdfa" : "#fff",
                  color: filter === tab.id ? "#0d9488" : "#64748b",
                  cursor: "pointer",
                }}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <span className="record-count">{filteredItems.length} alerts visible</span>
        </div>
        {content}
      </section>
    </div>
  );
}
function EarningsView({ data }) {
  const totals = data?.dashboard?.totals || {};
  const monthly = data?.dashboard?.monthly || [];
  const appointments = data?.appointments || [];

  const paidCount = appointments.filter(
    (a) => a.paymentStatus === "paid" || a.isPaid,
  ).length;
  const pendingCount = appointments.filter(
    (a) => a.paymentStatus !== "paid" && !a.isPaid,
  ).length;
  const cashCount = appointments.filter(
    (a) => a.paymentMethod === "cash",
  ).length;
  const totalRevenue = totals.revenue || 0;
  const pendingRevenue = totals.pendingRevenue || 0;

  const kpis = [
    {
      label: "Total Realized Revenue",
      val: formatMoney(totalRevenue),
      color: "#0d9488",
      icon: FaRupeeSign,
    },
    {
      label: "Pending Collections",
      val: formatMoney(pendingRevenue),
      color: "#f59e0b",
      icon: FaClock,
    },
    {
      label: "Paid Appointments",
      val: paidCount,
      color: "#10b981",
      icon: FaCheckCircle,
    },
    {
      label: "Cash Transactions",
      val: cashCount,
      color: "#6366f1",
      icon: FaMoneyBillWave,
    },
  ];

  return (
    <div className="premier-page-container">
      <div className="premier-page-header">
        <div className="header-left">
          <div className="breadcrumb-line">
            <span>Hospital Portal</span>
            <span className="separator">/</span>
            <span className="current">Earnings</span>
          </div>
          <h1>Earnings & Revenue</h1>
          <p>
            Revenue from paid and completed hospital appointments · Calculated
            strictly from this hospital's authorized records
          </p>
        </div>
        <div className="header-right">
          <button
            type="button"
            className="action-btn secondary"
            onClick={() =>
              buildPdf(
                "Earnings Report",
                [
                  `Total Revenue: ${formatMoney(totalRevenue)}`,
                  `Pending Revenue: ${formatMoney(pendingRevenue)}`,
                  `Paid Appointments: ${paidCount}`,
                  `Cash Transactions: ${cashCount}`,
                  "---",
                  "Monthly Breakdown:",
                  ...monthly.map((m) => `${m.label}: ${formatMoney(m.value)}`),
                ],
                `earnings-report-${Date.now()}.pdf`,
              )
            }
          >
            <FaFilePdf /> <span>Download PDF</span>
          </button>
          <button
            type="button"
            className="action-btn secondary"
            onClick={() =>
              openPrintWindow("Earnings — HealPoint", [
                `Total Revenue: ${formatMoney(totalRevenue)}`,
                `Pending Revenue: ${formatMoney(pendingRevenue)}`,
              ])
            }
          >
            <FaPrint /> <span>Print</span>
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="premier-stats-grid" style={{ marginBottom: "24px" }}>
        {kpis.map(({ label, val, color, icon: Icon }) => (
          <div key={label} className="stat-card">
            <div
              className="stat-icon-box"
              style={{ background: color + "22", color }}
            >
              <Icon />
            </div>
            <div className="stat-content">
              <span className="stat-label">{label}</span>
              <h3 className="stat-number" style={{ color, fontSize: "1.4rem" }}>
                {val}
              </h3>
            </div>
          </div>
        ))}
      </div>

      <Panel title="Monthly Revenue Breakdown">
        {monthly.length ? (
          <BarChart data={monthly} money />
        ) : (
          <div className="empty-state small">
            <FaCoins />
            <strong>No monthly revenue data available yet.</strong>
          </div>
        )}
      </Panel>
    </div>
  );
}
function ProfileView({ hospital, reload }) {
  const [form, setForm] = useState(() => ({
    name: hospital.name || "",
    about: hospital.about || "",
    opdTimings: hospital.opdTimings || "",
    logo: hospital.logo || "",
    departments: (hospital.departments || []).join(", "),
    services: (hospital.services || []).join(", "),
    address: hospital.location?.address || "",
    city: hospital.location?.city || "",
    state: hospital.location?.state || "",
    pincode: hospital.location?.pincode || "",
    mapsUrl: hospital.location?.mapsUrl || "",
    email: hospital.contact?.email || "",
    reception: hospital.contact?.reception || "",
    emergency: hospital.contact?.emergency || "",
    website: hospital.contact?.website || "",
  }));
  const set = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const save = async (event) => {
    event.preventDefault();
    try {
      await api.patch("/api/v1/hospital-admin/profile", {
        name: form.name,
        about: form.about,
        opdTimings: form.opdTimings,
        logo: form.logo,
        departments: form.departments
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        services: form.services
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        location: {
          ...hospital.location,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          mapsUrl: form.mapsUrl,
        },
        contact: {
          ...hospital.contact,
          email: form.email,
          reception: form.reception,
          emergency: form.emergency,
          website: form.website,
        },
      });
      toast.success("Hospital profile updated");
      reload();
    } catch (error) {
      toast.error(error.response?.data?.message || "Profile update failed");
    }
  };
  const Field = ({ label, name, type = "text", placeholder, full = false }) => (
    <label className={`hp-profile-field${full ? " full" : ""}`}>
      <span>{label}</span>
      <input
        type={type}
        value={form[name]}
        onChange={set(name)}
        placeholder={placeholder}
      />
    </label>
  );
  return (
    <div className="hp-profile">
      <section className="hp-profile-hero">
        <div className="hp-profile-logo">
          {hospital.logo ? (
            <img src={hospital.logo} alt={`${hospital.name} logo`} />
          ) : (
            <FaHospital />
          )}
        </div>
        <div className="hp-profile-hero-info">
          <span
            className={
              hospital.isActive
                ? "status-badge confirmed"
                : "status-badge cancel"
            }
          >
            {hospital.isActive ? "Active hospital" : "Suspended hospital"}
          </span>
          <h2>{hospital.name || "Hospital"}</h2>
          <p>
            {hospital.about ||
              "This hospital is part of the HealPoint care network."}
          </p>
          {hospital.location?.city && (
            <small>
              {hospital.location.address
                ? `${hospital.location.address}, `
                : ""}
              {hospital.location.city}
              {hospital.location.state ? `, ${hospital.location.state}` : ""}
            </small>
          )}
        </div>
        <div className="hp-profile-hero-meta">
          <div>
            <span>Operating hours</span>
            <strong>{hospital.opdTimings || "Not configured"}</strong>
          </div>
          <div>
            <span>Departments</span>
            <strong>{(hospital.departments || []).length}</strong>
          </div>
          <div>
            <span>Services</span>
            <strong>{(hospital.services || []).length}</strong>
          </div>
        </div>
      </section>

      <form className="hp-profile-form" onSubmit={save}>
        <Panel title="Basic Information">
          <div className="hp-profile-grid">
            <Field label="Hospital name" name="name" />
            <Field label="OPD operating hours" name="opdTimings" />
            <Field label="Logo URL" name="logo" placeholder="https://…" full />
            <label className="hp-profile-field full">
              <span>About / description</span>
              <textarea
                value={form.about}
                onChange={set("about")}
                placeholder="Describe your hospital, specialities and patient promise…"
              />
            </label>
          </div>
        </Panel>

        <Panel title="Contact Information">
          <div className="hp-profile-grid">
            <Field label="Email" name="email" type="email" />
            <Field label="Reception phone" name="reception" />
            <Field label="Emergency line" name="emergency" />
            <Field label="Website" name="website" />
          </div>
        </Panel>

        <Panel title="Location">
          <div className="hp-profile-grid">
            <Field label="Street address" name="address" full />
            <Field label="City" name="city" />
            <Field label="State" name="state" />
            <Field label="Pincode" name="pincode" />
            <Field
              label="Google Maps URL"
              name="mapsUrl"
              placeholder="https://maps.google.com/…"
              full
            />
          </div>
        </Panel>

        <Panel title="Departments & Services">
          <div className="hp-profile-grid">
            <Field label="Departments (comma separated)" name="departments" />
            <Field label="Services (comma separated)" name="services" />
          </div>
        </Panel>

        <button type="submit" className="ds-save">
          Save hospital profile
        </button>
      </form>
    </div>
  );
}
function GalleryView({ hospital, reload }) {
  const [url, setUrl] = useState("");
  const images = hospital.gallery || hospital.hospitalImages || [];
  const save = async (next) => {
    try {
      await api.patch("/api/v1/hospital-admin/profile", {
        gallery: next,
        hospitalImages: next,
      });
      toast.success("Hospital gallery updated");
      reload();
    } catch (error) {
      toast.error(error.response?.data?.message || "Gallery update failed");
    }
  };
  return (
    <Panel title="Hospital gallery">
      <form
        className="gallery-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!url.trim()) return;
          save([...images, url.trim()]);
          setUrl("");
        }}
      >
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a secure image URL"
        />
        <button type="submit">Add image</button>
      </form>
      {images.length ? (
        <div className="gallery-grid">
          {images.map((image, index) => (
            <figure key={`${image}-${index}`}>
              <img src={image} alt={`Hospital gallery ${index + 1}`} />
              <button
                type="button"
                onClick={() =>
                  save(images.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                Remove
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FaImages />
          <strong>No gallery images yet</strong>
          <span>
            Add an approved hospital image URL to display it in this hospital
            workspace.
          </span>
        </div>
      )}
    </Panel>
  );
}
function SettingsView({ admin, hospital, setView, initialTab = "facility" }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Password & Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ text: "", type: "" });

  // Notifications State
  const [notifPrefs, setNotifPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem("hospitalAdminNotifPrefs");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      newBookings: true,
      cancellations: true,
      emergencyAlerts: true,
      dailyDigest: true,
      securityAudit: true,
    };
  });
  const [notifSuccessToast, setNotifSuccessToast] = useState(false);

  // Support / Help Desk State
  const [openFaq, setOpenFaq] = useState(null);
  const [supportForm, setSupportForm] = useState({
    subject: "",
    category: "Clinical Operations",
    message: "",
  });
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportMsg, setSupportMsg] = useState({ text: "", type: "" });

  const faqs = [
    {
      q: "How are doctor profiles and clinical verification handled?",
      a: "Hospital Admins can register new doctors under the 'Doctors' module. Newly registered doctors remain in pending verification until their medical council registration and identity credentials are electronically verified under 'Doctor Verification'.",
    },
    {
      q: "How do OPD hours and slot schedules coordinate with patient bookings?",
      a: "Under 'Doctor Scheduling', administrators configure recurring shift intervals, slot durations (e.g. 15, 30 mins), and maximum patient capacities. Once published, real-time availability syncs immediately to the patient app.",
    },
    {
      q: "How does the hospital receive consultation fee settlements?",
      a: "Online patient bookings and consultation payments are secured via Razorpay and credited directly to the hospital's verified merchant bank account on standard T+2 rolling settlement schedules.",
    },
    {
      q: "Is patient clinical documentation and records isolated strictly to our hospital?",
      a: "Yes. HealPoint enforces strict tenant-level isolation. Patient clinical records, medical attachments, and consultation notes are encrypted and accessible only by authorized practitioners and administration staff within your facility.",
    },
  ];

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg({ text: "", type: "" });

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({
        text: "Please enter current, new, and confirm passwords.",
        type: "error",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        text: "New password and confirmation do not match.",
        type: "error",
      });
      return;
    }
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPasswordRegex.test(newPassword)) {
      setPasswordMsg({
        text: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
        type: "error",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const sess = session();
      const userId =
        admin?._id || admin?.id || sess?.admin?._id || sess?.admin?.id;
      if (!userId) {
        throw new Error("Admin user identifier missing from session.");
      }
      const res = await fetch(
        `http://localhost:8080/api/v1/user/update-password/${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sess?.token}`,
          },
          body: JSON.stringify({ oldPassword: currentPassword, newPassword }),
        },
      );
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to update password.");
      }
      setPasswordMsg({
        text: "Security password updated successfully! Please keep your credentials confidential.",
        type: "success",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMsg({
        text:
          err.message ||
          "Unable to update password. Please check your current password.",
        type: "error",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const toggleNotif = (key) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    localStorage.setItem("hospitalAdminNotifPrefs", JSON.stringify(updated));
    setNotifSuccessToast(true);
    setTimeout(() => setNotifSuccessToast(false), 2200);
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    setSupportMsg({ text: "", type: "" });

    if (!supportForm.subject.trim() || !supportForm.message.trim()) {
      setSupportMsg({
        text: "Please enter both subject and message details.",
        type: "error",
      });
      return;
    }

    setSupportLoading(true);
    try {
      const sess = session();
      const res = await fetch(
        "http://localhost:8080/api/v1/webmessage/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: sess?.token ? `Bearer ${sess.token}` : undefined,
          },
          body: JSON.stringify({
            name: admin?.name || "Hospital Admin",
            email: admin?.email || "admin@hospital.com",
            subject: `[${supportForm.category}] ${supportForm.subject}`,
            message: supportForm.message,
          }),
        },
      );
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.message || "Failed to submit ticket.");
      }
      setSupportMsg({
        text: "Support ticket dispatched successfully! Reference logged. HealPoint engineering will respond shortly.",
        type: "success",
      });
      setSupportForm({
        subject: "",
        category: "Clinical Operations",
        message: "",
      });
    } catch (err) {
      setSupportMsg({
        text: err.message || "Failed to dispatch message.",
        type: "error",
      });
    } finally {
      setSupportLoading(false);
    }
  };

  return (
    <div className="premier-page-container">
      {/* Premier Header */}
      <div className="premier-page-header">
        <div className="header-left">
          <div className="breadcrumb-line">
            <span>Hospital Portal</span>
            <span className="separator">/</span>
            <span className="current">Settings & Security</span>
          </div>
          <h1>Workspace & Security Settings</h1>
          <p>
            {hospital?.name
              ? `${hospital.name} · Facility Profile, Authentication Credentials, Notifications & Help Desk`
              : "Facility Profile, Authentication Credentials, Notifications & Help Desk"}
          </p>
        </div>
        <div className="header-right">
          <span className="badge-pill">Role: Hospital Admin</span>
          <span className="badge-live-pulse">
            <span className="pulse-dot" /> Tenant Scoped
          </span>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="hp-sub-tabs-bar">
        <button
          type="button"
          className={activeTab === "facility" ? "selected" : ""}
          onClick={() => setActiveTab("facility")}
        >
          <FaHospital /> Facility & Workspace
        </button>
        <button
          type="button"
          className={activeTab === "security" ? "selected" : ""}
          onClick={() => setActiveTab("security")}
        >
          <FaLock /> Security & Password
        </button>
        <button
          type="button"
          className={activeTab === "notifications" ? "selected" : ""}
          onClick={() => setActiveTab("notifications")}
        >
          <FaBell /> Notifications
        </button>
        <button
          type="button"
          className={activeTab === "support" ? "selected" : ""}
          onClick={() => setActiveTab("support")}
        >
          <FaHeadset /> Help Desk & FAQs
        </button>
      </div>

      {/* TAB 1: Facility & Workspace */}
      {activeTab === "facility" && (
        <div className="settings-content-card">
          <div className="settings-card-header">
            <h2>Facility Credentials & System Isolation</h2>
            <p>
              Operational metadata and privacy isolation for this healthcare
              institution.
            </p>
          </div>

          <div className="settings-info-grid">
            <div className="settings-info-card">
              <span className="info-label">Assigned Facility</span>
              <span className="info-value">
                {hospital?.name || "Anand Hospital"}
              </span>
              <span className="info-sub">
                {hospital?.address?.city || "City"},{" "}
                {hospital?.address?.state || "State"}
              </span>
            </div>

            <div className="settings-info-card">
              <span className="info-label">Administrator Account</span>
              <span className="info-value">
                {admin?.name || "Hospital Admin"}
              </span>
              <span className="info-sub">
                {admin?.email || "admin@hospital.com"}
              </span>
            </div>

            <div className="settings-info-card">
              <span className="info-label">Operational Status</span>
              <span
                className="info-value"
                style={{ color: hospital?.isActive ? "#059669" : "#dc2626" }}
              >
                {hospital?.isActive ? "Active & Operational" : "Suspended"}
              </span>
              <span className="info-sub">
                {hospital?.isActive
                  ? "Public catalog visible and accepting bookings"
                  : "Bookings temporarily paused"}
              </span>
            </div>

            <div className="settings-info-card">
              <span className="info-label">Tenant Isolation Policy</span>
              <span className="info-value">Hospital Scoped</span>
              <span className="info-sub">
                Patient records, bookings, and diagnostic reports are strictly
                isolated to this hospital.
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "10px" }}>
            {setView && (
              <button
                type="button"
                className="action-btn primary"
                onClick={() => setView("profile")}
              >
                <FaHospital />
                <span>Manage Full Hospital Profile</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Security & Password */}
      {activeTab === "security" && (
        <div className="settings-content-card">
          <div className="settings-card-header">
            <h2>Security & Password Authentication</h2>
            <p>
              Update administrator login credentials. Enforces strong complexity
              standards.
            </p>
          </div>

          {passwordMsg.text && (
            <div
              className={
                passwordMsg.type === "success"
                  ? "alert-banner-success"
                  : "alert-banner-error"
              }
            >
              {passwordMsg.type === "success" ? (
                <FaCheckCircle />
              ) : (
                <FaExclamationCircle />
              )}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="settings-form">
            <div className="form-group-field">
              <label>Current Password</label>
              <div className="input-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter existing password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-pwd-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <FaEye />
                </button>
              </div>
            </div>

            <div className="form-group-field">
              <label>New Password</label>
              <div className="input-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 8 characters with letters, numbers, symbols"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <small style={{ color: "#64748b", fontSize: "0.78rem" }}>
                Must contain at least 8 characters, 1 uppercase, 1 lowercase, 1
                digit, and 1 special symbol.
              </small>
            </div>

            <div className="form-group-field">
              <label>Confirm New Password</label>
              <div className="input-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="action-btn primary"
              style={{ alignSelf: "flex-start", marginTop: "8px" }}
              disabled={passwordLoading}
            >
              <FaKey />
              <span>
                {passwordLoading ? "Updating Credentials…" : "Update Password"}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Notifications */}
      {activeTab === "notifications" && (
        <div className="settings-content-card">
          <div className="settings-card-header">
            <h2>Operational Alert & Notification Preferences</h2>
            <p>Customize real-time dispatch alerts and summary digests.</p>
          </div>

          {notifSuccessToast && (
            <div className="alert-banner-success">
              <FaCheckCircle />
              <span>Notification preferences saved to your device.</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              maxWidth: "640px",
            }}
          >
            <div className="settings-toggle-row">
              <div className="toggle-info">
                <strong>Patient Booking Alerts</strong>
                <span>
                  Receive instant notification when a patient schedules a new
                  appointment
                </span>
              </div>
              <button
                type="button"
                className={`toggle-switch-btn ${notifPrefs.newBookings ? "active" : ""}`}
                onClick={() => toggleNotif("newBookings")}
                aria-label="Toggle patient booking alerts"
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="settings-toggle-row">
              <div className="toggle-info">
                <strong>Cancellations & Reschedules</strong>
                <span>
                  Instant dispatch when appointments are adjusted or revoked
                </span>
              </div>
              <button
                type="button"
                className={`toggle-switch-btn ${notifPrefs.cancellations ? "active" : ""}`}
                onClick={() => toggleNotif("cancellations")}
                aria-label="Toggle cancellations alert"
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="settings-toggle-row">
              <div className="toggle-info">
                <strong>Emergency & Critical OPD Priority</strong>
                <span>
                  High-priority audio-visual indicator for emergency queue
                  entries
                </span>
              </div>
              <button
                type="button"
                className={`toggle-switch-btn ${notifPrefs.emergencyAlerts ? "active" : ""}`}
                onClick={() => toggleNotif("emergencyAlerts")}
                aria-label="Toggle emergency alerts"
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="settings-toggle-row">
              <div className="toggle-info">
                <strong>Daily Operational Digest</strong>
                <span>
                  End-of-day summary of consultations fulfilled and realized
                  revenue
                </span>
              </div>
              <button
                type="button"
                className={`toggle-switch-btn ${notifPrefs.dailyDigest ? "active" : ""}`}
                onClick={() => toggleNotif("dailyDigest")}
                aria-label="Toggle daily digest"
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            <div className="settings-toggle-row">
              <div className="toggle-info">
                <strong>Security & System Audit Log</strong>
                <span>
                  Alerts when administrative password or hospital settings are
                  changed
                </span>
              </div>
              <button
                type="button"
                className={`toggle-switch-btn ${notifPrefs.securityAudit ? "active" : ""}`}
                onClick={() => toggleNotif("securityAudit")}
                aria-label="Toggle security audit alerts"
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Help Desk & Support */}
      {activeTab === "support" && (
        <div className="settings-content-card">
          <div className="settings-card-header">
            <h2>Hospital Admin Support & Knowledge Base</h2>
            <p>
              Frequently asked questions and direct engineering help desk
              ticketing.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {/* FAQ Accordion */}
            <div>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  marginBottom: "14px",
                  color: "#0f172a",
                }}
              >
                Frequently Asked Questions
              </h3>
              <div className="faq-accordion">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div key={idx} className="faq-item">
                      <button
                        type="button"
                        className="faq-question"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                      >
                        <span>{faq.q}</span>
                        {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                      {isOpen && <div className="faq-answer">{faq.a}</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Support Message Ticket Form */}
            <div>
              <h3
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  marginBottom: "14px",
                  color: "#0f172a",
                }}
              >
                Submit Support Ticket
              </h3>

              {supportMsg.text && (
                <div
                  className={
                    supportMsg.type === "success"
                      ? "alert-banner-success"
                      : "alert-banner-error"
                  }
                  style={{ marginBottom: "12px" }}
                >
                  {supportMsg.type === "success" ? (
                    <FaCheckCircle />
                  ) : (
                    <FaExclamationCircle />
                  )}
                  <span>{supportMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSupportSubmit} className="settings-form">
                <div className="form-group-field">
                  <label>Category</label>
                  <select
                    value={supportForm.category}
                    onChange={(e) =>
                      setSupportForm({
                        ...supportForm,
                        category: e.target.value,
                      })
                    }
                    className="filter-select"
                  >
                    <option value="Clinical Operations">
                      Clinical Operations
                    </option>
                    <option value="Doctor Scheduling">Doctor Scheduling</option>
                    <option value="Billing & Razorpay">
                      Billing & Razorpay
                    </option>
                    <option value="Technical Issue">Technical Issue</option>
                    <option value="General Inquiry">General Inquiry</option>
                  </select>
                </div>

                <div className="form-group-field">
                  <label>Subject</label>
                  <input
                    type="text"
                    placeholder="Brief summary of request or issue"
                    value={supportForm.subject}
                    onChange={(e) =>
                      setSupportForm({
                        ...supportForm,
                        subject: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-group-field">
                  <label>Details & Description</label>
                  <textarea
                    rows={4}
                    placeholder="Describe the issue or assistance required in detail"
                    value={supportForm.message}
                    onChange={(e) =>
                      setSupportForm({
                        ...supportForm,
                        message: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontFamily: "inherit",
                      fontSize: "0.88rem",
                    }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="action-btn primary"
                  style={{ alignSelf: "flex-start" }}
                  disabled={supportLoading}
                >
                  <FaPaperPlane />
                  <span>
                    {supportLoading ? "Dispatching Ticket…" : "Submit Ticket"}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function AppointmentModal({ appointment, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="detail-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          <FaTimes />
        </button>
        <div className="report-toolbar">
          <button
            type="button"
            className="report-btn"
            onClick={() =>
              openPrintWindow(
                `Appointment — ${appointment.userId?.name || "Patient"}`,
                appointmentReportLines([appointment]),
              )
            }
          >
            <FaPrint /> Print
          </button>
          <button
            type="button"
            className="report-btn"
            onClick={() =>
              buildPdf(
                `Appointment — ${appointment.userId?.name || "Patient"}`,
                appointmentReportLines([appointment]),
                `appointment-${appointment._id}.pdf`,
              )
            }
          >
            <FaFilePdf /> Download PDF
          </button>
        </div>
        <span className={statusClass(appointment.status)}>
          {statusLabel(appointment.status)}
        </span>
        <h2>Appointment details</h2>
        <div className="detail-grid">
          <div>
            <small>Patient</small>
            <strong>{appointment.userId?.name || "Patient"}</strong>
            <span>
              {appointment.userId?.email || ""}
              <br />
              {appointment.userId?.phone || ""}
            </span>
          </div>
          <div>
            <small>Doctor</small>
            <strong>
              {formatDoctorName(appointment.doctorId?.name, "Doctor")}
            </strong>
            <span>{appointment.doctorId?.speciality || ""}</span>
          </div>
          <div>
            <small>Schedule</small>
            <strong>
              {appointment.slotDate} · {appointment.slotTime}
            </strong>
            <span>{appointment.appointmentType || "Clinic appointment"}</span>
          </div>
          <div>
            <small>Payment</small>
            <strong>{formatMoney(appointment.amount)}</strong>
            <span>{appointment.paymentStatus || "Pending"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
function SubscriptionView() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/v1/subscription/my");
      setSubscription(data.subscription);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load your hospital subscription",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const fmtDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  if (loading) {
    return (
      <Panel title="Subscription & Billing">
        <div className="empty-state">
          <FaCreditCard />
          <strong>Loading your subscription…</strong>
        </div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Subscription & Billing">
        <div className="empty-state">
          <FaCreditCard />
          <strong>Unable to load subscription</strong>
          <span>{error}</span>
          <button type="button" className="refresh-button" onClick={load}>
            Try again
          </button>
        </div>
      </Panel>
    );
  }

  const plan = subscription?.planDetails || {};
  const benefits = plan.features?.length
    ? plan.features
    : subscription?.planName
      ? [`Current plan: ${subscription.planName}`]
      : [];
  const paymentStatusLabel = (value) =>
    ({
      paid: "Paid",
      pending: "Pending",
      failed: "Failed",
      refunded: "Refunded",
      "n/a": "N/A",
    })[value] ||
    value ||
    "—";

  return (
    <>
      <section className="panel subscription-panel">
        <div className="panel-heading">
          <h2>Current plan</h2>
          <span className={statusClass(subscription?.status)}>
            {statusLabel(subscription?.status)}
          </span>
        </div>
        <div className="subscription-plan-hero">
          <div>
            <span>
              <FaCreditCard />
            </span>
            <div>
              <strong>
                {subscription?.planName ||
                  subscription?.planKey ||
                  "Free / Trial"}
              </strong>
              <small>
                {subscription?.billingCycle === "yearly"
                  ? "Yearly billing"
                  : "Monthly billing"}
                {subscription?.autoRenew ? " · Auto-renew on" : ""}
              </small>
            </div>
            <div className="subscription-amount">
              {subscription?.amount
                ? formatMoney(subscription.amount)
                : "Free trial"}
            </div>
          </div>
        </div>
        <div className="detail-grid subscription-meta-grid">
          <div>
            <small>Payment status</small>
            <strong>{paymentStatusLabel(subscription?.paymentStatus)}</strong>
            <span>
              {subscription?.paymentStatus === "paid"
                ? "Received"
                : "Outstanding / not applicable"}
            </span>
          </div>
          <div>
            <small>Start date</small>
            <strong>{fmtDate(subscription?.startDate)}</strong>
            <span>When this plan began</span>
          </div>
          <div>
            <small>Renewal / expiry</small>
            <strong>{fmtDate(subscription?.expiryDate)}</strong>
            <span>Next billing after this date</span>
          </div>
          <div>
            <small>Billing cycle</small>
            <strong>{subscription?.billingCycle || "—"}</strong>
            <span>Amount: {formatMoney(subscription?.amount)}</span>
          </div>
        </div>
      </section>

      {benefits.length > 0 && (
        <Panel title="Plan benefits">
          <ul className="subscription-benefits">
            {benefits.map((benefit) => (
              <li key={benefit}>
                <FaCheck /> {benefit}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {(subscription?.history || []).length > 0 && (
        <Panel title="Subscription history">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Status change</th>
                  <th>Note</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {subscription.history.map((entry, index) => (
                  <tr key={index}>
                    <td>
                      <FaHistory /> {entry.action || "—"}
                    </td>
                    <td>
                      {entry.fromStatus || "—"} → {entry.toStatus || "—"}
                    </td>
                    <td>{entry.note || "—"}</td>
                    <td>{fmtDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {(subscription?.payments || []).length > 0 && (
        <Panel title="Payment history">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Cycle</th>
                  <th>Status</th>
                  <th>Paid at</th>
                </tr>
              </thead>
              <tbody>
                {subscription.payments.map((payment, index) => (
                  <tr key={index}>
                    <td>{formatMoney(payment.amount)}</td>
                    <td>{payment.billingCycle}</td>
                    <td>
                      <span className={statusClass(payment.paymentStatus)}>
                        {statusLabel(payment.paymentStatus)}
                      </span>
                    </td>
                    <td>{fmtDate(payment.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

function RescheduleModal({ appointment, onClose, onSubmit, busy }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="detail-modal reschedule-form"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="modal-close" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>Reschedule appointment</h2>
        <p>
          {appointment.userId?.name || "Patient"} with Dr.{" "}
          {appointment.doctorId?.name || "Doctor"}
        </p>
        <label>
          New date
          <input
            required
            type="date"
            name="date"
            defaultValue={toInputDate(appointment.slotDate)}
          />
        </label>
        <label>
          New time
          <input required type="time" name="time" />
        </label>
        <label>
          Reason
          <input name="reason" placeholder="Optional reason for the patient" />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Confirm reschedule"}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ToastContainer position="top-right" />
      <Routes>
        <Route path="/login" element={<HospitalLogin />} />
        <Route
          path="/*"
          element={
            <Protected>
              <Portal />
            </Protected>
          }
        />
      </Routes>
    </>
  );
}
