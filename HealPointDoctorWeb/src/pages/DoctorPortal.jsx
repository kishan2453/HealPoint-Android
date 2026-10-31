import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaBell,
  FaBars,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaCog,
  FaFileMedical,
  FaHistory,
  FaLock,
  FaMoneyBillWave,
  FaNotesMedical,
  FaSignOutAlt,
  FaSearch,
  FaStar,
  FaStethoscope,
  FaUpload,
  FaUserInjured,
  FaUserMd,
  FaTimes,
  FaPrint,
  FaFilePdf,
  FaVideo,
  FaHospital,
  FaUserCheck,
  FaFilter,
  FaArrowRight,
  FaCalendarDay,
  FaTimesCircle,
  FaCheck,
  FaExchangeAlt,
  FaSyncAlt,
  FaEye,
  FaPhoneAlt,
  FaEnvelope,
  FaExclamationTriangle,
  FaInfoCircle,
  FaChevronLeft,
  FaChevronRight,
  FaChevronDown,
  FaCheckDouble,
  FaPlay,
  FaPhoneVolume,
  FaUserClock,
  FaFolderOpen,
  FaFileAlt,
  FaUserSlash,
  FaCalendarCheck,
  FaHeartbeat,
  FaWeight,
  FaThermometerHalf,
  FaLungs,
  FaEdit,
  FaPlus,
  FaSave,
  FaTrash,
  FaDownload,
  FaArrowUp,
  FaArrowDown,
  FaPills,
  FaClinicMedical,
  FaFileInvoice,
  FaReceipt,
  FaShieldAlt,
  FaKey,
  FaGlobe,
  FaCertificate,
  FaIdCard,
  FaBuilding,
  FaInbox,
  FaEyeSlash,
  FaExternalLinkAlt,
  FaStarHalfAlt,
} from "react-icons/fa";
import api from "../services/api";
import {
  initDoctorSocket,
  disconnectDoctorSocket,
  subscribeDoctorSync,
} from "../services/socket";
import { jsPDF } from "jspdf";
import OnlineConsultations from "../components/OnlineConsultations";

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

const openPrintWindow = (title, lines, meta = "") => {
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
      ${meta}
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

const printPrescriptionSlip = (rx) => {
  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (!printWindow) return;
  const doc = rx.doctor || {};
  const pat = rx.patient || rx.userId || {};
  const apt = rx.appointment || rx;
  const meds =
    Array.isArray(rx.medicines) && rx.medicines.length
      ? rx.medicines
      : apt.medicines || [];
  const inst =
    rx.prescriptionInstructions || apt.prescriptionInstructions || {};

  const medRows = meds
    .map(
      (m, idx) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${idx + 1}. ${m.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${m.dosage || "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">
        <span style="background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:4px;font-weight:600;font-size:12px;">${m.frequency || "1-0-1"}</span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">${m.duration || "—"}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;">${[m.route, m.timing, m.instructions].filter(Boolean).join(" · ") || "—"}</td>
    </tr>
  `,
    )
    .join("");

  printWindow.document
    .write(`<!doctype html><html><head><title>Prescription — ${pat.name || "Patient"}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 32px; margin: 0; line-height: 1.5; }
      .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 20px; }
      .brand { font-size: 24px; font-weight: 800; color: #0d9488; }
      .brand-sub { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
      .doc-info { text-align: right; }
      .doc-name { font-size: 18px; font-weight: 700; color: #0f172a; }
      .doc-sub { font-size: 13px; color: #475569; }
      .patient-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; font-size: 13px; margin-bottom: 24px; }
      .patient-box div strong { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; }
      .rx-symbol { font-size: 28px; font-weight: 800; color: #0d9488; margin-bottom: 10px; }
      .diagnosis-box { margin-bottom: 20px; padding: 10px 14px; background: #f0fdfa; border-left: 4px solid #0d9488; border-radius: 4px; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
      th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #cbd5e1; }
      .instructions-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; font-size: 13px; margin-bottom: 30px; }
      .instructions-box h4 { margin: 0 0 8px; font-size: 13px; color: #1e293b; text-transform: uppercase; }
      .footer-sign { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
      .sign-line { text-align: right; }
      .sign-line .line { width: 200px; border-bottom: 1px solid #0f172a; margin-bottom: 6px; }
      @media print { body { padding: 16px; } }
    </style></head><body>
      <div class="header">
        <div>
          <div class="brand">HealPoint</div>
          <div class="brand-sub">Healthcare & Clinical Services</div>
          <div style="font-size:12px;color:#475569;margin-top:6px;">${doc.hospitalName || "HealPoint Partner Hospital"}</div>
          <div style="font-size:11px;color:#64748b;">${doc.hospitalAddress || doc.hospitalCity || ""}</div>
        </div>
        <div class="doc-info">
          <div class="doc-name">${doc.name || "Doctor"}</div>
          <div class="doc-sub">${doc.qualification || "Consultant Physician"} — ${doc.specialization || "General Medicine"}</div>
          <div style="font-size:12px;color:#64748b;">Reg. No: ${doc.registrationNumber || "MCI-HP-REG"}</div>
          ${doc.phone ? `<div style="font-size:12px;color:#64748b;">Tel: ${doc.phone}</div>` : ""}
        </div>
      </div>

      <div class="patient-box">
        <div><strong>Patient Name</strong> ${pat.name || "Patient"}</div>
        <div><strong>Age / Gender</strong> ${pat.dob ? new Date().getFullYear() - new Date(pat.dob).getFullYear() + " Yrs" : pat.age || "—"} / ${pat.gender || "—"}</div>
        <div><strong>Patient ID</strong> ${pat.displayId || (pat._id ? String(pat._id).slice(-8).toUpperCase() : "—")}</div>
        <div><strong>Date & Time</strong> ${apt.slotDate || new Date().toISOString().split("T")[0]} (${apt.slotTime || "—"})</div>
      </div>

      ${
        rx.diagnosis || apt.diagnosis
          ? `
        <div class="diagnosis-box">
          <strong>Diagnosis / Clinical Impression:</strong> ${rx.diagnosis || apt.diagnosis}
        </div>
      `
          : ""
      }

      <div class="rx-symbol">℞</div>

      ${
        meds.length > 0
          ? `
        <table>
          <thead>
            <tr>
              <th style="width:35%;">Medicine & Formulation</th>
              <th style="width:15%;">Dosage</th>
              <th style="width:15%;">Frequency</th>
              <th style="width:15%;">Duration</th>
              <th style="width:20%;">Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${medRows}
          </tbody>
        </table>
      `
          : `
        <div style="padding:16px;background:#f8fafc;border-radius:6px;font-size:14px;white-space:pre-wrap;margin-bottom:24px;">
          ${rx.prescription || apt.prescription || "No medications specified."}
        </div>
      `
      }

      ${
        inst.dietInstructions ||
        inst.generalInstructions ||
        inst.followUpInstructions ||
        rx.followUpAdvice ||
        apt.followUpAdvice
          ? `
        <div class="instructions-box">
          <h4>Clinical Instructions & Advice</h4>
          ${inst.dietInstructions ? `<p style="margin:4px 0;"><strong>Dietary Advice:</strong> ${inst.dietInstructions}</p>` : ""}
          ${inst.generalInstructions ? `<p style="margin:4px 0;"><strong>General Instructions:</strong> ${inst.generalInstructions}</p>` : ""}
          ${inst.followUpInstructions || rx.followUpAdvice || apt.followUpAdvice ? `<p style="margin:4px 0;"><strong>Follow-up Advice:</strong> ${inst.followUpInstructions || rx.followUpAdvice || apt.followUpAdvice}</p>` : ""}
          ${inst.additionalNotes ? `<p style="margin:4px 0;"><strong>Additional Notes:</strong> ${inst.additionalNotes}</p>` : ""}
        </div>
      `
          : ""
      }

      <div class="footer-sign">
        <div style="font-size:11px;color:#94a3b8;">
          Prescription generated digitally via HealPoint Doctor Command Center.<br/>
          Valid across all licensed pharmacies in India.
        </div>
        <div class="sign-line">
          <div class="line"></div>
          <strong>${doc.name || "Doctor"}</strong>
          <div style="font-size:11px;color:#64748b;">Authorized Signatory</div>
        </div>
      </div>
    </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 300);
};

const appointmentToReportLine = (item) => {
  const patient = item.patient || item.userId || {};
  const phoneEmail = [patient.phone, patient.email].filter(Boolean).join(" · ");
  return [
    `Patient: ${patient.name || "Patient"}`,
    `Contact: ${phoneEmail || "Not available"}`,
    `Date/Time: ${item.slotDate || "—"} at ${item.slotTime || "—"} | Type: ${item.consultationType || "clinic"}`,
    `Status: ${statusLabel[item.status] || item.status} | Payment: ${item.paymentStatus || "cash_pending"} | Rs ${item.amount || 0}`,
    `Diagnosis: ${item.diagnosis || "Not recorded"} | Notes: ${item.medicalNotes || "—"}`,
    "------------------------------------------------",
  ];
};

const appointmentReportTitle = (viewTitle) =>
  viewTitle ? `${viewTitle} — HealPoint` : "Appointments — HealPoint";

const appointmentLines = (appointments) => {
  const lines = [`Total appointments: ${(appointments || []).length}`];
  (appointments || []).forEach((item, index) => {
    lines.push(`\n#${index + 1}`, ...appointmentToReportLine(item));
  });
  return lines;
};

const patientReportLines = (patient) => {
  const appointments = patient?.appointments || [];
  const totalSpent = appointments.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const lines = [
    `Patient: ${patient.name || "Patient"}`,
    `Email: ${patient.email || "Not available"} | Phone: ${patient.phone || "Not available"}`,
    `Age / Gender: ${
      patient.dob
        ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
        : "Not available"
    } / ${patient.gender || "Not available"}`,
    `Total appointments: ${appointments.length} | Lifetime spend: Rs ${totalSpent || 0}`,
    "",
  ];
  appointments.forEach((item, index) => {
    lines.push(
      `#${index + 1} ${item.slotDate || "—"} at ${item.slotTime || "—"}`,
      `Status: ${statusLabel[item.status] || item.status} | Doctor: ${item.doctorId?.name || "Self"}`,
      `Diagnosis: ${item.diagnosis || "Not recorded"} | Prescription: ${item.prescription || "—"}`,
      "------------------------------------------------",
    );
  });
  if (!appointments.length) lines.push("No appointment history yet.");
  return lines;
};

const menuItems = [
  ["dashboard", "Dashboard", <FaStethoscope />],
  ["today", "Today's Appointments", <FaCalendarAlt />],
  ["upcoming", "Upcoming Appointments", <FaClock />],
  ["appointments", "All Appointments", <FaCalendarDay />],
  ["queue", "Patient Queue (OPD)", <FaUserCheck />],
  ["patients", "Patients Directory", <FaUserInjured />],
  ["medical-history", "Patient History / EMR", <FaHistory />],
  ["online-consultations", "Online Consultations", <FaVideo />],
  ["prescriptions", "Prescriptions", <FaNotesMedical />],
  ["upload-reports", "Medical Reports", <FaUpload />],
  ["availability", "Availability & Schedule", <FaCalendarAlt />],
  ["earnings", "Earnings & Billing", <FaMoneyBillWave />],
  ["reviews", "Patient Reviews", <FaStar />],
  ["notifications", "Notifications", <FaBell />],
  ["profile", "Profile", <FaUserMd />],
  ["settings", "Settings", <FaCog />],
  ["security", "Security", <FaLock />],
];

const emptyPanel = { dashboard: {}, doctor: {} };

const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const imageSource = (value) => {
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const text = String(value).trim();
  const mime = text.startsWith("iVBOR")
    ? "image/png"
    : text.startsWith("R0lG")
      ? "image/gif"
      : "image/jpeg";
  return `data:${mime};base64,${text}`;
};

const statusLabel = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancel: "Cancelled",
  rescheduled: "Rescheduled",
  missed: "Missed",
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

/** Normalize doctor name to always have a clean "Dr. <Name>" without duplicate prefixes */
const formatDoctorTitle = (name) => {
  if (!name) return "Dr. Doctor";
  const clean = String(name)
    .replace(/^(?:(?:dr\.?|doctor)\s+)+/gi, "")
    .trim();
  return `Dr. ${clean || "Doctor"}`;
};

/** Strip leading "Dr." / "Doctor" prefix when raw name is needed */
const stripDrPrefix = (name) => {
  if (!name) return "Doctor";
  return (
    String(name)
      .replace(/^(?:(?:dr\.?|doctor)\s+)+/gi, "")
      .trim() || "Doctor"
  );
};

const parseTime = (value) => {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
};

const formatTime = (minutes) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const dateToWeekday = (slotDate) => {
  const [day, month, year] = String(slotDate || "")
    .split("-")
    .map(Number);
  if (!day || !month || !year) return "";
  return WEEKDAYS[new Date(year, month - 1, day).getDay()];
};

const buildAvailableSlots = ({
  doctor,
  slotDate,
  slotDuration = 30,
  booked = [],
}) => {
  if (!doctor || !slotDate) return [];
  const weekday = dateToWeekday(slotDate);
  const daySchedule = (doctor.weeklySchedule || []).find(
    (item) => String(item.day).toLowerCase() === weekday.toLowerCase(),
  );
  if (daySchedule && daySchedule.enabled === false) return [];

  let startTime = "09:00 AM";
  let endTime = "05:00 PM";
  if (daySchedule) {
    startTime = daySchedule.startTime || startTime;
    endTime = daySchedule.endTime || endTime;
  } else if (doctor.availabilitySchedule) {
    const match = String(doctor.availabilitySchedule).match(
      /(\d{1,2}:\d{2}\s?[AP]M)\s*-\s*(\d{1,2}:\d{2}\s?[AP]M)/i,
    );
    if (match) {
      startTime = match[1];
      endTime = match[2];
    }
  }

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (start == null || end == null || end <= start) return [];

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}-${String(today.getMonth() + 1).padStart(2, "0")}-${today.getFullYear()}`;
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const isToday = slotDate === todayStr;

  const slots = [];
  let cursor = start;
  while (cursor < end) {
    if (!isToday || cursor > nowMinutes) {
      const time = formatTime(cursor);
      if (!booked.includes(time)) slots.push(time);
    }
    cursor += Number(slotDuration) || 30;
  }
  return slots;
};

const EmptyState = ({
  title = "No data found",
  text = "When data is available, it will appear here.",
}) => (
  <div className="dp-empty">
    <FaFileMedical />
    <strong>{title}</strong>
    <p>{text}</p>
  </div>
);

const Loading = () => (
  <div className="dp-loading">Loading doctor portal...</div>
);

export default function DoctorPortal() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const stored = JSON.parse(localStorage.getItem("doctorApp") || "null");
  const doctorId = stored?.doctor?._id;
  const [panel, setPanel] = useState(emptyPanel);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleOutside = () => setProfileMenuOpen(false);
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, [profileMenuOpen]);

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    const q = encodeURIComponent(globalSearch.trim());
    if (activeView === "patients") {
      navigate(`/patients?search=${q}`);
    } else {
      navigate(`/appointments?search=${q}`);
    }
  };

  const pathSegments = useMemo(
    () => location.pathname.split("/").filter(Boolean),
    [location.pathname],
  );
  const activeView = pathSegments[0] || "dashboard";
  const subRouteId = pathSegments[1] || "";
  const selectedPatientId = activeView === "patients" ? subRouteId : null;
  const selectedAppointmentId =
    params.id || (activeView === "appointments" ? subRouteId : null);

  const loadPanel = async () => {
    if (!doctorId) {
      navigate("/login", { replace: true });
      return;
    }
    setError("");
    try {
      const res = await api.get(`/api/v1/doctor/panel/${doctorId}`);
      setPanel(res.data || emptyPanel);
      const current = JSON.parse(localStorage.getItem("doctorApp") || "null");
      localStorage.setItem(
        "doctorApp",
        JSON.stringify({ ...current, doctor: res.data.doctor }),
      );
    } catch (err) {
      const message =
        err.response?.data?.message || "Unable to load doctor portal";
      setError(message);
      toast.error(message);
      if (err.response?.status === 401) navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchUnreadCount = async () => {
    if (!doctorId) return;
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/notifications?limit=1`,
      );
      if (typeof res.data?.unreadCount === "number") {
        setUnreadNotificationsCount(res.data.unreadCount);
      }
    } catch {
      // background fetch handled gracefully
    }
  };

  useEffect(() => {
    loadPanel();
    fetchUnreadCount();

    const token = stored?.token || localStorage.getItem("doctorToken");
    if (token) {
      initDoctorSocket(token);
    }

    let debounceTimer = null;
    const triggerDebouncedRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadPanel();
        fetchUnreadCount();
      }, 400);
    };

    const unsubscribe = subscribeDoctorSync({
      onAppointmentSync: () => triggerDebouncedRefresh(),
      onQueueSync: () => triggerDebouncedRefresh(),
      onConsultationSync: () => triggerDebouncedRefresh(),
      onNotification: (notif) => {
        fetchUnreadCount();
        if (notif?.title) toast.info(notif.title);
      },
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [doctorId]);

  const doctor = panel.doctor || stored?.doctor || {};
  const dashboard = panel.dashboard || {};
  const allAppointments = dashboard.allAppointments || [];
  const appointmentById = selectedAppointmentId
    ? allAppointments.find((item) => item._id === selectedAppointmentId)
    : null;

  const patients = useMemo(() => {
    const map = new Map();
    allAppointments.forEach((appointment) => {
      const patient = appointment.patient || appointment.userId;
      if (!patient?._id) return;
      const current = map.get(patient._id) || { ...patient, appointments: [] };
      current.appointments.push(appointment);
      map.set(patient._id, current);
    });
    return [...map.values()];
  }, [allAppointments]);

  const selectedPatient = selectedPatientId
    ? patients.find((item) => item._id === selectedPatientId)
    : null;

  const logout = () => {
    try {
      disconnectDoctorSocket();
      sessionStorage.clear();
      localStorage.removeItem("doctorApp");
      localStorage.removeItem("doctorToken");
      localStorage.removeItem("selectedHospital");
    } catch {
      // ignore
    }
    navigate("/login", { replace: true });
  };

  const [rescheduleModal, setRescheduleModal] = useState({
    isOpen: false,
    appointment: null,
    slotDate: "",
    slotTime: "",
    reason: "",
    slots: [],
  });

  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    appointmentId: null,
    status: "",
    label: "",
    requiresReason: false,
    reason: "",
  });

  const toggleOnlineStatus = async () => {
    const current = doctor.onlineStatus || "offline";
    const nextStatus = current === "online" ? "offline" : "online";
    try {
      await api.patch(`/api/v1/doctor/panel/${doctorId}/profile`, {
        onlineStatus: nextStatus,
      });
      setPanel((prev) => ({
        ...prev,
        doctor: { ...prev.doctor, onlineStatus: nextStatus },
      }));
      toast.success(`Online status updated to ${nextStatus}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to update status");
    }
  };

  const openStatusModal = (appointmentId, status, label) => {
    const isRejection = ["cancel", "rejected"].includes(status);
    setStatusModal({
      isOpen: true,
      appointmentId,
      status,
      label:
        label ||
        (status === "confirmed"
          ? "Confirm Appointment"
          : status === "completed"
            ? "Complete Appointment"
            : "Cancel / Reject Appointment"),
      requiresReason: isRejection,
      reason: "",
    });
  };

  const handleConfirmStatus = async () => {
    if (!statusModal.appointmentId) return;
    if (statusModal.requiresReason && !statusModal.reason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }
    setSaving(true);
    try {
      await api.patch(
        `/api/v1/doctor/panel/${doctorId}/appointment/${statusModal.appointmentId}/status`,
        { status: statusModal.status, reason: statusModal.reason.trim() },
      );
      toast.success("Appointment status updated");
      setStatusModal({
        isOpen: false,
        appointmentId: null,
        status: "",
        label: "",
        requiresReason: false,
        reason: "",
      });
      await loadPanel();
    } catch (err) {
      toast.error(err.response?.data?.message || "Appointment update failed");
    } finally {
      setSaving(false);
    }
  };

  const openRescheduleModal = (appointment) => {
    setRescheduleModal({
      isOpen: true,
      appointment,
      slotDate: "",
      slotTime: "",
      reason: "",
      slots: [],
    });
  };

  const handleDateChangeForReschedule = (rawDate) => {
    if (!rawDate) {
      setRescheduleModal((prev) => ({
        ...prev,
        slotDate: "",
        slotTime: "",
        slots: [],
      }));
      return;
    }
    const [year, month, day] = rawDate.split("-");
    const formattedDate = `${day}-${month}-${year}`;

    const booked = allAppointments
      .filter(
        (item) =>
          item.slotDate === formattedDate &&
          ["pending", "confirmed", "rescheduled"].includes(item.status),
      )
      .map((item) => item.slotTime);

    const available = buildAvailableSlots({
      doctor,
      slotDate: formattedDate,
      slotDuration: doctor.slotDurationMinutes || 30,
      booked,
    });

    setRescheduleModal((prev) => ({
      ...prev,
      slotDate: formattedDate,
      slotTime: "",
      slots: available,
    }));
  };

  const handleConfirmReschedule = async () => {
    if (
      !rescheduleModal.appointment ||
      !rescheduleModal.slotDate ||
      !rescheduleModal.slotTime
    ) {
      toast.error("Please select both a date and an available time slot");
      return;
    }
    setSaving(true);
    try {
      await api.patch(
        `/api/v1/doctor/panel/${doctorId}/appointment/${rescheduleModal.appointment._id}/reschedule`,
        {
          slotDate: rescheduleModal.slotDate,
          slotTime: rescheduleModal.slotTime,
          reason: rescheduleModal.reason || "",
        },
      );
      toast.success("Appointment rescheduled successfully");
      setRescheduleModal({
        isOpen: false,
        appointment: null,
        slotDate: "",
        slotTime: "",
        reason: "",
        slots: [],
      });
      await loadPanel();
    } catch (err) {
      toast.error(err.response?.data?.message || "Reschedule failed");
    } finally {
      setSaving(false);
    }
  };

  const savePrescription = async (appointmentId, payload) => {
    setSaving(true);
    try {
      await api.post(
        `/api/v1/doctor/panel/${doctorId}/appointment/${appointmentId}/prescription`,
        payload,
      );
      toast.success("Medical record saved");
      await loadPanel();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Unable to save medical record",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteReport = async (appointmentId, reportId) => {
    if (!window.confirm("Delete this medical report?")) return;
    setSaving(true);
    try {
      await api.delete(
        `/api/v1/doctor/panel/${doctorId}/appointment/${appointmentId}/report/${reportId}`,
      );
      toast.success("Report deleted");
      await loadPanel();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to delete report");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  const doctorAvatar = imageSource(doctor.hdProfilePicture || doctor.image);
  const doctorInitials = (doctor.name || "Doctor")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={`dp-shell${sidebarOpen ? " menu-open" : ""}`}>
      <aside className="dp-sidebar">
        <div className="dp-brand">
          <img
            src="/healpoint-favicon.svg"
            alt="HealPoint"
            width={38}
            height={38}
            style={{ borderRadius: 10, flexShrink: 0 }}
          />
          <div>
            <strong>HealPoint</strong>
            <small>Doctor Portal</small>
          </div>
        </div>
        <div className="dp-doctor-identity">
          {doctorAvatar ? (
            <img src={doctorAvatar} alt={formatDoctorTitle(doctor.name)} />
          ) : (
            <span>{doctorInitials}</span>
          )}
          <div>
            <strong>{formatDoctorTitle(doctor.name)}</strong>
            <small>
              {doctor.speciality || doctor.department || "Specialist"}
            </small>
            <em>
              <i /> Online
            </em>
          </div>
        </div>
        <nav>
          {menuItems.map(([key, label, icon]) => (
            <Link
              key={key}
              className={activeView === key ? "active" : ""}
              to={`/${key}`}
              onClick={() => setSidebarOpen(false)}
            >
              {icon}
              <span>{label}</span>
              {key === "notifications" && unreadNotificationsCount > 0 && (
                <span className="dp-sidebar-badge-count">
                  {unreadNotificationsCount > 99
                    ? "99+"
                    : unreadNotificationsCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <button type="button" className="dp-logout" onClick={logout}>
          <FaSignOutAlt /> Logout
        </button>
      </aside>
      {sidebarOpen && (
        <button
          type="button"
          className="dp-sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="dp-main">
        <div className="dp-topbar">
          <button
            type="button"
            className="dp-menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((value) => !value)}
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
          <form className="dp-global-search" onSubmit={handleGlobalSearch}>
            <FaSearch />
            <input
              placeholder="Search patients, appointments..."
              aria-label="Search portal"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </form>
          <div className="dp-topbar-actions">
            <button
              type="button"
              aria-label="Notifications"
              className="dp-topbar-bell-btn"
              title="Notifications"
              onClick={() => navigate("/notifications")}
            >
              <FaBell />
              {unreadNotificationsCount > 0 ? (
                <span className="dp-topbar-badge">
                  {unreadNotificationsCount > 99
                    ? "99+"
                    : unreadNotificationsCount}
                </span>
              ) : (
                <i />
              )}
            </button>
            <div
              className={`dp-topbar-profile ${profileMenuOpen ? "is-open" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setProfileMenuOpen((prev) => !prev);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  setProfileMenuOpen((prev) => !prev);
                }
              }}
              title="Account profile & settings"
            >
              {doctorAvatar ? (
                <img src={doctorAvatar} alt={formatDoctorTitle(doctor.name)} />
              ) : (
                <span>{doctorInitials}</span>
              )}
              <div className="dp-topbar-profile-info">
                <div className="dp-topbar-name-row">
                  <strong>{formatDoctorTitle(doctor.name)}</strong>
                  <FaChevronDown className="dp-topbar-chevron" />
                </div>
                <small>
                  {doctor.speciality || doctor.department || "Specialist"}
                </small>
              </div>

              {profileMenuOpen && (
                <div
                  className="dp-topbar-profile-dropdown"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="dp-topbar-profile-dropdown-head">
                    <strong>{formatDoctorTitle(doctor.name)}</strong>
                    <small>
                      {doctor.speciality || doctor.department || "Specialist"}
                    </small>
                    {doctor.email ? (
                      <span className="dp-dropdown-email">{doctor.email}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="dp-dropdown-item"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate("/profile");
                    }}
                  >
                    <FaUserMd /> View Profile
                  </button>
                  <button
                    type="button"
                    className="dp-dropdown-item"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate("/settings");
                    }}
                  >
                    <FaCog /> Settings & Password
                  </button>
                  <div className="dp-dropdown-divider" />
                  <button
                    type="button"
                    className="dp-dropdown-item dp-dropdown-logout"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                  >
                    <FaSignOutAlt /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <header className="dp-header">
          <div className="dp-header-content">
            <div>
              <div className="dp-header-badges">
                <small className="dp-date-chip">
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </small>
                <span
                  className={`dp-badge-chip ${doctor.verificationStatus === "Verified" ? "dp-badge-verified" : "dp-badge-pending-v"}`}
                >
                  <FaCheckCircle /> {doctor.verificationStatus || "Pending"}{" "}
                  Verification
                </span>
                <span className="dp-badge-chip dp-badge-speciality">
                  {doctor.speciality || doctor.department || "Specialist"}
                </span>
                <span className="dp-badge-chip dp-badge-hospital">
                  <FaHospital />{" "}
                  {doctor.hospitalId?.name || doctor.hospitalName || "Hospital"}
                </span>
              </div>
              <h1>
                {getGreeting()}, {formatDoctorTitle(doctor.name)}
              </h1>
              <p>
                Leading clinical care at{" "}
                {doctor.hospitalId?.name ||
                  doctor.hospitalName ||
                  "HealPoint Hospital"}{" "}
                · {doctor.degree || "MBBS"} ({doctor.experience || 5}+ yrs exp)
              </p>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className={`dp-status-pill-toggle ${doctor.onlineStatus === "online" ? "is-online" : "is-offline"}`}
                onClick={toggleOnlineStatus}
                title="Toggle online consultation availability"
              >
                <span className="dp-status-dot" />
                <span>
                  {doctor.onlineStatus === "online"
                    ? "Online for Consults"
                    : "Offline"}
                </span>
              </button>
              <button
                type="button"
                onClick={loadPanel}
                className="dp-light-btn"
              >
                <FaSyncAlt /> Refresh
              </button>
            </div>
          </div>
        </header>

        {error && <div className="dp-alert">{error}</div>}

        {activeView === "dashboard" && (
          <DashboardView
            dashboard={dashboard}
            appointments={allAppointments}
            patientCount={patients.length}
            doctor={doctor}
            onStatus={openStatusModal}
            onReschedule={openRescheduleModal}
            saving={saving}
            navigate={navigate}
          />
        )}
        {["today", "upcoming", "pending", "completed", "appointments"].includes(
          activeView,
        ) &&
          !params.id && (
            <AppointmentsView
              key={activeView}
              view={activeView === "appointments" ? "all" : activeView}
              title={
                activeView === "appointments"
                  ? "Appointments Command Center"
                  : menuItems.find(([key]) => key === activeView)?.[1] ||
                    "Appointments"
              }
              doctorId={doctorId}
              doctor={doctor}
              fallbackAppointments={getAppointmentsForView(
                activeView,
                dashboard,
              )}
              saving={saving}
              onStatus={openStatusModal}
              onReschedule={openRescheduleModal}
              onRefresh={loadPanel}
              initialSearch={
                new URLSearchParams(location.search).get("search") || ""
              }
            />
          )}
        {activeView === "queue" && (
          <PatientQueueView
            doctorId={doctorId}
            doctor={doctor}
            onRefresh={loadPanel}
          />
        )}
        {activeView === "appointments" &&
          selectedAppointmentId &&
          appointmentById && (
            <AppointmentDetailsView
              appointment={appointmentById}
              doctor={doctor}
              onSave={savePrescription}
              onDeleteReport={deleteReport}
              saving={saving}
              onStatus={openStatusModal}
              onReschedule={openRescheduleModal}
            />
          )}
        {activeView === "patients" && !selectedPatientId && (
          <PatientsManagementView
            doctorId={doctorId}
            initialSearch={
              new URLSearchParams(location.search).get("search") || ""
            }
          />
        )}
        {activeView === "patients" && selectedPatientId && (
          <PatientProfileView
            doctorId={doctorId}
            patientId={selectedPatientId}
            doctor={doctor}
            onRefresh={loadPanel}
          />
        )}
        {(activeView === "online-consultations" ||
          activeView === "consultations" ||
          (activeView === "consultation" && !subRouteId)) && (
          <OnlineConsultations doctorId={doctorId} />
        )}
        {activeView === "consultation" && subRouteId && (
          <ConsultationWorkspaceView
            doctorId={doctorId}
            appointmentId={subRouteId}
            doctor={doctor}
            onComplete={() => {
              loadPanel();
              navigate("/queue");
            }}
          />
        )}
        {activeView === "medical-history" && (
          <MedicalHistoryEMRView
            doctorId={doctorId}
            initialPatientId={subRouteId || null}
            doctor={doctor}
          />
        )}
        {activeView === "prescriptions" && (
          <PrescriptionsView
            doctorId={doctorId}
            doctor={doctor}
            appointments={allAppointments}
            initialAppointmentId={
              subRouteId ||
              new URLSearchParams(location.search).get("appointmentId") ||
              null
            }
            initialPatientId={
              new URLSearchParams(location.search).get("patientId") || null
            }
            onSave={savePrescription}
            saving={saving}
          />
        )}
        {activeView === "upload-reports" && (
          <UploadReportsView
            doctorId={doctorId}
            doctor={doctor}
            appointments={allAppointments}
            initialAppointmentId={
              subRouteId ||
              new URLSearchParams(location.search).get("appointmentId") ||
              null
            }
            initialPatientId={
              new URLSearchParams(location.search).get("patientId") || null
            }
            onSave={savePrescription}
            saving={saving}
          />
        )}
        {(activeView === "availability" || activeView === "calendar") && (
          <AvailabilityView
            doctor={doctor}
            doctorId={doctorId}
            onSaved={loadPanel}
          />
        )}
        {activeView === "earnings" && (
          <EarningsView
            dashboard={dashboard}
            doctorId={doctorId}
            doctor={doctor}
            initialTab="earnings"
          />
        )}
        {activeView === "analytics" && (
          <EarningsView
            dashboard={dashboard}
            doctorId={doctorId}
            doctor={doctor}
            initialTab="analytics"
          />
        )}
        {activeView === "notifications" && (
          <NotificationsView
            doctorId={doctorId}
            doctor={doctor}
            onCountChange={setUnreadNotificationsCount}
            navigate={navigate}
          />
        )}
        {activeView === "reviews" && (
          <ReviewsView doctorId={doctorId} doctor={doctor} />
        )}
        {activeView === "verification" && (
          <VerificationView
            doctor={doctor}
            doctorId={doctorId}
            onSaved={loadPanel}
          />
        )}
        {activeView === "profile" && (
          <ProfileView
            doctor={doctor}
            doctorId={doctorId}
            onSaved={loadPanel}
          />
        )}
        {(activeView === "settings" || activeView === "security") && (
          <SettingsView
            doctor={doctor}
            doctorId={doctorId}
            onSaved={loadPanel}
            logout={logout}
          />
        )}
        {![
          "dashboard",
          "today",
          "upcoming",
          "completed",
          "cancelled",
          "appointments",
          "queue",
          "patients",
          "online-consultations",
          "consultations",
          "consultation",
          "medical-history",
          "prescriptions",
          "upload-reports",
          "availability",
          "calendar",
          "earnings",
          "analytics",
          "notifications",
          "reviews",
          "verification",
          "profile",
          "settings",
          "security",
        ].includes(activeView) && (
          <div
            className="dp-card"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              margin: "32px auto",
              maxWidth: 560,
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 44, color: "#f59e0b", marginBottom: 16 }}>
              ⚠️
            </div>
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
                lineHeight: 1.5,
              }}
            >
              The section "<strong>{activeView}</strong>" was not found in the
              Doctor Portal.
            </p>
            <button
              type="button"
              className="dp-primary-btn"
              onClick={() => navigate("/dashboard")}
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

        {/* Interactive Reschedule Modal */}
        {rescheduleModal.isOpen && (
          <div
            className="dp-modal-backdrop"
            onClick={() =>
              setRescheduleModal((prev) => ({ ...prev, isOpen: false }))
            }
          >
            <div className="dp-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="dp-modal-header">
                <h3>Reschedule Appointment</h3>
                <button
                  type="button"
                  className="dp-modal-close-btn"
                  onClick={() =>
                    setRescheduleModal((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  <FaTimes />
                </button>
              </div>
              <div className="dp-modal-body">
                <div>
                  <strong>Patient: </strong>
                  <span>
                    {rescheduleModal.appointment?.patient?.name ||
                      rescheduleModal.appointment?.userId?.name ||
                      "Patient"}
                  </span>
                </div>
                <div>
                  <strong>Current Time: </strong>
                  <span>
                    {rescheduleModal.appointment?.slotDate} at{" "}
                    {rescheduleModal.appointment?.slotTime}
                  </span>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 700,
                      fontSize: "0.82rem",
                    }}
                  >
                    Select New Date
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    className="dp-filter-date-input"
                    style={{ width: "100%" }}
                    onChange={(e) =>
                      handleDateChangeForReschedule(e.target.value)
                    }
                  />
                </div>
                {rescheduleModal.slotDate && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 700,
                        fontSize: "0.82rem",
                      }}
                    >
                      Available Slots for {rescheduleModal.slotDate} (
                      {rescheduleModal.slots.length} available)
                    </label>
                    {rescheduleModal.slots.length > 0 ? (
                      <div className="dp-slots-grid">
                        {rescheduleModal.slots.map((time) => (
                          <button
                            type="button"
                            key={time}
                            className={`dp-slot-btn ${
                              rescheduleModal.slotTime === time
                                ? "selected"
                                : ""
                            }`}
                            onClick={() =>
                              setRescheduleModal((prev) => ({
                                ...prev,
                                slotTime: time,
                              }))
                            }
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p
                        style={{
                          color: "#ef4444",
                          fontSize: "0.8rem",
                          margin: 0,
                        }}
                      >
                        No available slots on this date according to your
                        working schedule. Please pick another date.
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 700,
                      fontSize: "0.82rem",
                    }}
                  >
                    Reason for Rescheduling
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Schedule adjustment, patient requested change..."
                    value={rescheduleModal.reason}
                    onChange={(e) =>
                      setRescheduleModal((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                    }}
                  />
                </div>
              </div>
              <div className="dp-modal-footer">
                <button
                  type="button"
                  className="dp-page-btn"
                  onClick={() =>
                    setRescheduleModal((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="dp-btn-complete"
                  disabled={
                    saving ||
                    !rescheduleModal.slotDate ||
                    !rescheduleModal.slotTime
                  }
                  onClick={handleConfirmReschedule}
                >
                  {saving ? "Rescheduling..." : "Confirm Reschedule"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Status Confirmation Modal */}
        {statusModal.isOpen && (
          <div
            className="dp-modal-backdrop"
            onClick={() =>
              setStatusModal((prev) => ({ ...prev, isOpen: false }))
            }
          >
            <div className="dp-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="dp-modal-header">
                <h3>{statusModal.label}</h3>
                <button
                  type="button"
                  className="dp-modal-close-btn"
                  onClick={() =>
                    setStatusModal((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  <FaTimes />
                </button>
              </div>
              <div className="dp-modal-body">
                <p style={{ margin: 0, color: "#475569", fontSize: "0.88rem" }}>
                  {statusModal.status === "cancel"
                    ? "Are you sure you want to cancel or reject this appointment? Please state the reason below:"
                    : statusModal.status === "confirmed"
                      ? "Are you sure you want to accept and confirm this appointment?"
                      : "Are you sure you want to mark this appointment as completed? If cash payment was chosen, it will be marked as paid."}
                </p>
                {statusModal.requiresReason && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 700,
                        fontSize: "0.82rem",
                      }}
                    >
                      Reason for Cancellation{" "}
                      <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Doctor emergency surgery, slot conflict..."
                      value={statusModal.reason}
                      onChange={(e) =>
                        setStatusModal((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        resize: "vertical",
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="dp-modal-footer">
                <button
                  type="button"
                  className="dp-page-btn"
                  onClick={() =>
                    setStatusModal((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={
                    statusModal.status === "cancel"
                      ? "dp-filter-clear-all"
                      : statusModal.status === "confirmed"
                        ? "dp-btn-accept"
                        : "dp-btn-complete"
                  }
                  disabled={
                    saving ||
                    (statusModal.requiresReason && !statusModal.reason.trim())
                  }
                  onClick={handleConfirmStatus}
                >
                  {saving
                    ? "Processing..."
                    : `Confirm ${
                        statusModal.status === "cancel"
                          ? "Cancellation"
                          : statusModal.status === "confirmed"
                            ? "Acceptance"
                            : "Completion"
                      }`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function getAppointmentsForView(view, dashboard) {
  if (view === "today") return dashboard.todayAppointments || [];
  if (view === "upcoming") return dashboard.upcomingAppointments || [];
  if (view === "pending") return dashboard.pendingAppointments || [];
  if (view === "completed") return dashboard.completedAppointments || [];
  return dashboard.allAppointments || [];
}

function DashboardView({
  dashboard,
  appointments = [],
  patientCount = 0,
  doctor = {},
  onStatus,
  onReschedule,
  saving,
  navigate,
}) {
  const totals = dashboard.totals || {};
  const todayAppts = dashboard.todayAppointments || [];
  const upcomingAppts = dashboard.upcomingAppointments || [];
  const notifications = (dashboard.notifications || []).slice(0, 5);

  const todayDate = new Date();
  const weekday = dateToWeekday(
    `${String(todayDate.getDate()).padStart(2, "0")}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${todayDate.getFullYear()}`,
  );
  const daySchedule = (doctor.weeklySchedule || []).find(
    (item) => String(item.day).toLowerCase() === weekday.toLowerCase(),
  );
  const workingHours = daySchedule
    ? `${daySchedule.startTime || "09:00 AM"} - ${daySchedule.endTime || "05:00 PM"}`
    : doctor.availabilitySchedule || "09:00 AM - 05:00 PM";

  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const key = `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
    return {
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      value: appointments.filter((item) => item.slotDate === key).length,
    };
  });

  const monthly = (dashboard.earnings?.monthly || [])
    .slice(-6)
    .map((item) => ({ label: item.month.split(" ")[0], value: item.amount }));

  const recentPatients = useMemo(() => {
    const map = new Map();
    appointments.forEach((item) => {
      const p = item.patient || item.userId;
      if (p?._id && !map.has(p._id)) {
        map.set(p._id, { ...p, lastAppointment: item });
      }
    });
    return [...map.values()].slice(0, 4);
  }, [appointments]);

  return (
    <>
      {/* Responsive 5-KPI Section */}
      <section className="dp-kpi-grid">
        <article
          className="dp-kpi-card dp-kpi-today"
          onClick={() => navigate("/today")}
          title="View today's appointments"
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaCalendarAlt />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">{totals.today || 0}</div>
            <div className="dp-kpi-label">Today's Appointments</div>
            <div className="dp-kpi-sub">Visits scheduled for today</div>
          </div>
        </article>

        <article
          className="dp-kpi-card dp-kpi-pending"
          onClick={() => navigate("/pending")}
          title="View pending appointments"
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaClock />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">{totals.pending || 0}</div>
            <div className="dp-kpi-label">Pending Requests</div>
            <div className="dp-kpi-sub">Awaiting confirmation</div>
          </div>
        </article>

        <article
          className="dp-kpi-card dp-kpi-completed"
          onClick={() => navigate("/completed")}
          title="View completed appointments"
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaCheckCircle />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">{totals.completed || 0}</div>
            <div className="dp-kpi-label">Completed Consults</div>
            <div className="dp-kpi-sub">Successfully concluded</div>
          </div>
        </article>

        <article
          className="dp-kpi-card dp-kpi-patients"
          onClick={() => navigate("/patients")}
          title="View all patient records"
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaUserInjured />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">
              {totals.totalPatients || patientCount || 0}
            </div>
            <div className="dp-kpi-label">Total Patients</div>
            <div className="dp-kpi-sub">Assigned to your care</div>
          </div>
        </article>

        <article
          className="dp-kpi-card dp-kpi-earnings"
          onClick={() => navigate("/earnings")}
          title="View revenue analytics"
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaMoneyBillWave />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">₹{totals.todayEarnings || 0}</div>
            <div className="dp-kpi-label">Today's Earnings</div>
            <div className="dp-kpi-sub">
              Total Revenue: ₹{totals.earnings || 0}
            </div>
          </div>
        </article>
      </section>

      {/* Quick Actions Strip */}
      <div className="dp-quick-actions-strip">
        <Link
          to="/queue"
          className="dp-quick-action-btn dp-quick-action-highlight"
        >
          <FaUserCheck /> OPD Patient Queue
        </Link>
        <Link to="/today" className="dp-quick-action-btn">
          <FaCalendarAlt /> View Today's Appointments
        </Link>
        <Link to="/appointments" className="dp-quick-action-btn">
          <FaCalendarDay /> All Appointments
        </Link>
        <Link to="/patients" className="dp-quick-action-btn">
          <FaUserInjured /> Patient Directory
        </Link>
        <Link to="/availability" className="dp-quick-action-btn">
          <FaClock /> Manage Availability
        </Link>
        <Link to="/prescriptions" className="dp-quick-action-btn">
          <FaNotesMedical /> Medical Prescriptions
        </Link>
        <Link to="/upload-reports" className="dp-quick-action-btn">
          <FaUpload /> Upload Patient Reports
        </Link>
      </div>

      {/* Today's Appointments Command Center */}
      <Panel
        title={`Today's Appointment Command Center (${todayAppts.length})`}
        action={
          <Link
            to="/today"
            className="dp-btn-view"
            style={{ textDecoration: "none" }}
          >
            View Full List
          </Link>
        }
      >
        {todayAppts.length === 0 ? (
          <EmptyState
            title="No appointments scheduled for today."
            text="You are all caught up. Any new patient bookings or walk-ins for today will show up here immediately."
          />
        ) : (
          <div className="dp-today-list">
            {todayAppts.map((item, idx) => {
              const patient = item.patient || item.userId || {};
              const patientAvatar = imageSource(patient.image);
              const isVideo = item.consultationType === "video";
              const isPaid = item.paymentStatus === "paid" || item.payment;
              return (
                <article className="dp-today-card" key={item._id}>
                  <div className="dp-today-time-badge">
                    <span>{item.slotTime}</span>
                    <small>Slot #{idx + 1}</small>
                  </div>

                  {patientAvatar ? (
                    <img
                      src={patientAvatar}
                      alt=""
                      className="dp-patient-avatar-sm"
                    />
                  ) : (
                    <div className="dp-patient-avatar-sm">
                      {(patient.name || "P").slice(0, 1).toUpperCase()}
                    </div>
                  )}

                  <div className="dp-today-card-info">
                    <strong>{patient.name || "Patient"}</strong>
                    <div className="dp-today-card-meta">
                      <span>{patient.phone || "No phone"}</span>
                      {patient.gender && <span>• {patient.gender}</span>}
                      <span>
                        • Appt ID: {item.appointmentId || item._id.slice(-6)}
                      </span>
                    </div>
                    <div className="dp-today-badges" style={{ marginTop: 6 }}>
                      <span
                        className={`dp-pill ${
                          isVideo ? "dp-pill-video" : "dp-pill-clinic"
                        }`}
                      >
                        {isVideo ? <FaVideo /> : <FaHospital />}
                        {isVideo ? "Video Consult" : "Clinic Visit"}
                      </span>
                      <span
                        className={`dp-pill ${
                          isPaid ? "dp-pill-paid" : "dp-pill-cash-pending"
                        }`}
                      >
                        {isPaid ? "Paid" : "Payment Pending"} · ₹
                        {item.amount || 0}
                      </span>
                      <span className={`dp-pill dp-pill-${item.status}`}>
                        {statusLabel[item.status] || item.status}
                      </span>
                    </div>
                  </div>

                  <div className="dp-today-actions">
                    {isVideo &&
                      item.meetingUrl &&
                      item.status !== "completed" &&
                      item.status !== "cancel" && (
                        <a
                          href={item.meetingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="dp-btn-video-join"
                        >
                          <FaVideo /> Join Video
                        </a>
                      )}
                    {item.status === "pending" && (
                      <>
                        <button
                          type="button"
                          className="dp-btn-accept"
                          disabled={saving}
                          onClick={() =>
                            onStatus(
                              item._id,
                              "confirmed",
                              "Confirm Appointment",
                            )
                          }
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="dp-filter-clear-all"
                          disabled={saving}
                          onClick={() =>
                            onStatus(item._id, "cancel", "Reject Appointment")
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {item.status === "confirmed" && (
                      <>
                        <button
                          type="button"
                          className="dp-btn-complete"
                          disabled={saving}
                          onClick={() =>
                            onStatus(
                              item._id,
                              "completed",
                              "Complete Appointment",
                            )
                          }
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className="dp-btn-reschedule"
                          disabled={saving}
                          onClick={() => onReschedule(item)}
                        >
                          Reschedule
                        </button>
                      </>
                    )}
                    <Link
                      to={`/appointments/${item._id}`}
                      className="dp-btn-view"
                    >
                      Details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      {/* Main Grid: Upcoming, Schedule Snapshot, Patients, Notifications, Charts */}
      <section className="dp-grid two">
        {/* Upcoming Appointments Snapshot */}
        <Panel
          title="Upcoming Appointments"
          action={
            <Link
              to="/upcoming"
              className="dp-btn-view"
              style={{ textDecoration: "none" }}
            >
              View All ({upcomingAppts.length})
            </Link>
          }
        >
          {upcomingAppts.length === 0 ? (
            <EmptyState
              title="No upcoming appointments"
              text="You do not have any pending or confirmed bookings for future dates."
            />
          ) : (
            <div className="dp-list">
              {upcomingAppts.slice(0, 5).map((item) => {
                const p = item.patient || item.userId || {};
                return (
                  <article className="dp-appointment-row" key={item._id}>
                    <div className="dp-patient-avatar-sm">
                      {(p.name || "P").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <strong>{p.name || "Patient"}</strong>
                      <span>
                        {item.slotDate} at {item.slotTime} ·{" "}
                        {item.consultationType === "video" ? "Video" : "Clinic"}
                      </span>
                      <small>
                        Payment: {item.paymentStatus || "cash_pending"} · ₹
                        {item.amount || 0}
                      </small>
                    </div>
                    <span className={`dp-pill dp-pill-${item.status}`}>
                      {statusLabel[item.status] || item.status}
                    </span>
                    <div className="dp-actions">
                      <Link to={`/appointments/${item._id}`}>Details</Link>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onReschedule(item)}
                      >
                        Reschedule
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Schedule Snapshot */}
        <Panel
          title="Today's Schedule & Availability"
          action={
            <Link
              to="/availability"
              className="dp-btn-view"
              style={{ textDecoration: "none" }}
            >
              Manage Schedule
            </Link>
          }
        >
          <div className="dp-schedule-snapshot">
            <div className="dp-schedule-row">
              <span>Today's Day & Date</span>
              <strong>
                {weekday}, {todayDate.toLocaleDateString("en-IN")}
              </strong>
            </div>
            <div className="dp-schedule-row">
              <span>Operating Hours</span>
              <strong>{workingHours}</strong>
            </div>
            <div className="dp-schedule-row">
              <span>Consultation Mode</span>
              <strong>Clinic & Online Video</strong>
            </div>
            <div className="dp-schedule-row">
              <span>Booked Visits Today</span>
              <strong style={{ color: "#2563eb" }}>
                {todayAppts.length} appointments
              </strong>
            </div>
            <div className="dp-schedule-row">
              <span>Online Consultation Status</span>
              <strong
                style={{
                  color:
                    doctor.onlineStatus === "online" ? "#16a34a" : "#64748b",
                }}
              >
                {doctor.onlineStatus === "online"
                  ? "Active (Accepting calls)"
                  : "Offline"}
              </strong>
            </div>
          </div>
        </Panel>

        {/* Recent Patients Preview */}
        <Panel
          title="Recent Patients"
          action={
            <Link
              to="/patients"
              className="dp-btn-view"
              style={{ textDecoration: "none" }}
            >
              View Patients ({patientCount})
            </Link>
          }
        >
          {recentPatients.length === 0 ? (
            <EmptyState
              title="No patient records yet"
              text="Patient visits will be cataloged here automatically."
            />
          ) : (
            <div className="dp-list">
              {recentPatients.map((patient) => (
                <article className="dp-simple-row" key={patient._id}>
                  <div className="dp-patient-avatar-sm">
                    {(patient.name || "P").slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", color: "#0f172a" }}>
                      {patient.name}
                    </strong>
                    <small style={{ color: "#64748b" }}>
                      {patient.phone || patient.email || "Contact unavailable"}{" "}
                      · Last visit:{" "}
                      {patient.lastAppointment?.slotDate || "Recent"}
                    </small>
                  </div>
                  <Link
                    to={`/patients/${patient._id}`}
                    className="dp-btn-view"
                    style={{ textDecoration: "none" }}
                  >
                    View History
                  </Link>
                </article>
              ))}
            </div>
          )}
        </Panel>

        {/* Notifications Preview */}
        <Panel
          title="Notifications Preview"
          action={
            <Link
              to="/notifications"
              className="dp-btn-view"
              style={{ textDecoration: "none" }}
            >
              View All
            </Link>
          }
        >
          {notifications.length === 0 ? (
            <EmptyState
              title="No new notifications"
              text="Appointment and patient notifications will appear here."
            />
          ) : (
            <NotificationList notifications={notifications} />
          )}
        </Panel>

        {/* Weekly Appointment Activity Chart */}
        <Panel title="Weekly Appointment Activity">
          <MiniChart data={weekly} />
        </Panel>

        {/* Monthly Revenue Chart */}
        <Panel title="Monthly Revenue Analytics">
          <MiniChart data={monthly} money />
        </Panel>
      </section>
    </>
  );
}

function MiniChart({ data, money = false }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  if (!data.length)
    return (
      <EmptyState
        title="No chart data yet"
        text="Completed appointments will appear here."
      />
    );
  return (
    <div className="dp-chart">
      {data.map((item) => (
        <div className="dp-chart-item" key={item.label}>
          <span
            style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }}
            title={`${money ? "Rs " : ""}${item.value}`}
          />
          <small>{item.label}</small>
          <b>{money ? `₹${item.value}` : item.value}</b>
        </div>
      ))}
    </div>
  );
}

function AppointmentsView({
  view = "all",
  title = "Appointments Command Center",
  doctorId,
  doctor = {},
  fallbackAppointments = [],
  saving,
  onStatus,
  onReschedule,
  onRefresh,
  initialSearch = "",
}) {
  const [activeTab, setActiveTab] = useState(view);
  const [search, setSearch] = useState(initialSearch);
  const [consultationType, setConsultationType] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loadingList, setLoadingList] = useState(false);
  const [appointmentsList, setAppointmentsList] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [tabCounts, setTabCounts] = useState({
    all: 0,
    today: 0,
    upcoming: 0,
    pending: 0,
    completed: 0,
    cancelled: 0,
  });

  const fetchAppointments = async () => {
    if (!doctorId) return;
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page);
      params.set("limit", pageSize);
      if (activeTab !== "all") params.set("view", activeTab);
      if (search.trim()) params.set("search", search.trim());
      if (consultationType !== "all")
        params.set("consultationType", consultationType);
      if (paymentStatus !== "all") params.set("paymentStatus", paymentStatus);
      if (selectedDate) {
        const [y, m, d] = selectedDate.split("-");
        params.set("date", `${d}-${m}-${y}`);
      }

      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/appointments?${params.toString()}`,
      );
      setAppointmentsList(res.data.appointments || []);
      setPagination(
        res.data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 },
      );
      if (res.data.counts) setTabCounts(res.data.counts);
    } catch (err) {
      console.warn("Appointments list API error, using fallback dataset", err);
      let filtered = [...fallbackAppointments];
      if (activeTab === "pending")
        filtered = filtered.filter((a) => a.status === "pending");
      if (activeTab === "completed")
        filtered = filtered.filter((a) => a.status === "completed");
      if (activeTab === "cancelled")
        filtered = filtered.filter((a) => a.status === "cancel");
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(
          (a) =>
            (a.patient?.name || a.userId?.name || "")
              .toLowerCase()
              .includes(q) ||
            (a.patientPhone || "").includes(q) ||
            (a.appointmentId || "").toLowerCase().includes(q),
        );
      }
      setAppointmentsList(
        filtered.slice((page - 1) * pageSize, page * pageSize),
      );
      setPagination({
        total: filtered.length,
        page,
        limit: pageSize,
        totalPages: Math.ceil(filtered.length / pageSize) || 1,
      });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [
    doctorId,
    activeTab,
    search,
    consultationType,
    paymentStatus,
    selectedDate,
    page,
  ]);

  const handleClearFilters = () => {
    setSearch("");
    setConsultationType("all");
    setPaymentStatus("all");
    setSelectedDate("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
    consultationType !== "all" ||
    paymentStatus !== "all" ||
    selectedDate,
  );

  const reportTitle = appointmentReportTitle(title);

  return (
    <Panel
      title={title}
      action={
        <div className="dp-report-toolbar" style={{ margin: 0 }}>
          <button
            type="button"
            className="dp-report-btn"
            onClick={() => {
              fetchAppointments();
              if (onRefresh) onRefresh();
            }}
            disabled={loadingList}
            title="Refresh appointments"
          >
            <FaSyncAlt className={loadingList ? "dp-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            className="dp-report-btn"
            onClick={() =>
              openPrintWindow(reportTitle, appointmentLines(appointmentsList))
            }
          >
            <FaPrint /> Print
          </button>
          <button
            type="button"
            className="dp-report-btn"
            onClick={() =>
              buildPdf(
                reportTitle,
                appointmentLines(appointmentsList),
                `${
                  String(title || "appointments")
                    .toLowerCase()
                    .replace(/\W+/g, "-") || "appointments"
                }-${Date.now()}.pdf`,
              )
            }
          >
            <FaFilePdf /> Download PDF
          </button>
        </div>
      }
    >
      {/* Command Center Toolbar: Tabs, Search & Filters */}
      <div className="dp-command-toolbar">
        {/* Quick Filter Tabs */}
        <div className="dp-filter-tabs">
          {[
            { id: "all", label: "All Appointments", count: tabCounts.all },
            { id: "today", label: "Today", count: tabCounts.today },
            { id: "upcoming", label: "Upcoming", count: tabCounts.upcoming },
            { id: "pending", label: "Pending", count: tabCounts.pending },
            { id: "completed", label: "Completed", count: tabCounts.completed },
            { id: "cancelled", label: "Cancelled", count: tabCounts.cancelled },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`dp-filter-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
            >
              <span>{tab.label}</span>
              <span className="dp-tab-count">{tab.count || 0}</span>
            </button>
          ))}
        </div>

        {/* Filter Controls Row */}
        <div className="dp-filter-controls">
          <div className="dp-search-input-wrap">
            <FaSearch />
            <input
              type="text"
              placeholder="Search by patient name, phone, or appointment ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button
                type="button"
                className="dp-search-clear-btn"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
              >
                <FaTimes />
              </button>
            )}
          </div>

          <select
            className="dp-filter-select"
            value={consultationType}
            onChange={(e) => {
              setConsultationType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Modes</option>
            <option value="clinic">Clinic Visit</option>
            <option value="video">Video Consultation</option>
          </select>

          <select
            className="dp-filter-select"
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="cash_pending">Cash Pending</option>
            <option value="online_pending">Online Pending</option>
            <option value="refunded">Refunded</option>
          </select>

          <input
            type="date"
            className="dp-filter-date-input"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setPage(1);
            }}
            title="Filter by appointment date"
          />

          {hasActiveFilters && (
            <button
              type="button"
              className="dp-filter-clear-all"
              onClick={handleClearFilters}
            >
              <FaTimesCircle style={{ marginRight: 4 }} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Appointments List / Table Container */}
      <div className="dp-table-wrapper">
        {loadingList ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <FaSyncAlt style={{ fontSize: "1.5rem", marginBottom: 8 }} />
            <p style={{ margin: 0, fontWeight: 700 }}>
              Loading appointments...
            </p>
          </div>
        ) : appointmentsList.length === 0 ? (
          <EmptyState
            title={
              hasActiveFilters
                ? "No matching appointments"
                : "No appointments found"
            }
            text={
              hasActiveFilters
                ? "No appointments match your active search or filters. Try adjusting your filters or search terms."
                : "There are no appointments in this category."
            }
          />
        ) : (
          <>
            {/* Desktop Table */}
            <table className="dp-data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Schedule</th>
                  <th>Type</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointmentsList.map((item) => {
                  const patient = item.patient || item.userId || {};
                  const patientAvatar = imageSource(patient.image);
                  const isVideo = item.consultationType === "video";
                  const isPaid = item.paymentStatus === "paid" || item.payment;
                  return (
                    <tr key={item._id}>
                      <td>
                        <div className="dp-table-patient">
                          {patientAvatar ? (
                            <img
                              src={patientAvatar}
                              alt=""
                              className="dp-patient-avatar-sm"
                            />
                          ) : (
                            <div className="dp-patient-avatar-sm">
                              {(patient.name || "P").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="dp-table-patient-details">
                            <strong>{patient.name || "Patient"}</strong>
                            <span>{patient.phone || "No phone"}</span>
                            {patient.gender && <span>{patient.gender}</span>}
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong style={{ color: "#0f172a", display: "block" }}>
                          {item.slotDate}
                        </strong>
                        <span style={{ color: "#2563eb", fontWeight: 750 }}>
                          {item.slotTime}
                        </span>
                        <span
                          style={{
                            display: "block",
                            color: "#94a3b8",
                            fontSize: "0.7rem",
                          }}
                        >
                          ID: {item.appointmentId || item._id.slice(-6)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`dp-pill ${
                            isVideo ? "dp-pill-video" : "dp-pill-clinic"
                          }`}
                        >
                          {isVideo ? <FaVideo /> : <FaHospital />}
                          {isVideo ? "Video Consult" : "Clinic Visit"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`dp-pill ${
                            isPaid ? "dp-pill-paid" : "dp-pill-cash-pending"
                          }`}
                        >
                          {isPaid ? "Paid" : "Pending"}
                        </span>
                        <strong
                          style={{
                            display: "block",
                            marginTop: 3,
                            color: "#0f172a",
                          }}
                        >
                          ₹{item.amount || 0}
                        </strong>
                      </td>

                      <td>
                        <span className={`dp-pill dp-pill-${item.status}`}>
                          {statusLabel[item.status] || item.status}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div
                          className="dp-table-actions"
                          style={{ justifyContent: "flex-end" }}
                        >
                          <Link
                            to={`/appointments/${item._id}`}
                            className="dp-btn-view"
                          >
                            <FaEye /> View
                          </Link>

                          {isVideo &&
                            item.meetingUrl &&
                            item.status !== "completed" &&
                            item.status !== "cancel" && (
                              <a
                                href={item.meetingUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="dp-btn-video-join"
                              >
                                <FaVideo /> Join
                              </a>
                            )}

                          {item.status === "pending" && (
                            <>
                              <button
                                type="button"
                                className="dp-btn-accept"
                                disabled={saving}
                                onClick={() =>
                                  onStatus(
                                    item._id,
                                    "confirmed",
                                    "Confirm Appointment",
                                  )
                                }
                              >
                                <FaCheck /> Accept
                              </button>
                              <button
                                type="button"
                                className="dp-filter-clear-all"
                                disabled={saving}
                                onClick={() =>
                                  onStatus(
                                    item._id,
                                    "cancel",
                                    "Reject Appointment",
                                  )
                                }
                              >
                                <FaTimes /> Reject
                              </button>
                            </>
                          )}

                          {item.status === "confirmed" && (
                            <>
                              <button
                                type="button"
                                className="dp-btn-complete"
                                disabled={saving}
                                onClick={() =>
                                  onStatus(
                                    item._id,
                                    "completed",
                                    "Complete Appointment",
                                  )
                                }
                              >
                                <FaCheckDouble /> Complete
                              </button>
                              <button
                                type="button"
                                className="dp-btn-reschedule"
                                disabled={saving}
                                onClick={() => onReschedule(item)}
                              >
                                <FaExchangeAlt /> Reschedule
                              </button>
                              <button
                                type="button"
                                className="dp-filter-clear-all"
                                disabled={saving}
                                onClick={() =>
                                  onStatus(
                                    item._id,
                                    "cancel",
                                    "Cancel Appointment",
                                  )
                                }
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {item.status === "rescheduled" && (
                            <>
                              <button
                                type="button"
                                className="dp-btn-accept"
                                disabled={saving}
                                onClick={() =>
                                  onStatus(
                                    item._id,
                                    "confirmed",
                                    "Confirm Appointment",
                                  )
                                }
                              >
                                <FaCheck /> Accept
                              </button>
                              <button
                                type="button"
                                className="dp-btn-reschedule"
                                disabled={saving}
                                onClick={() => onReschedule(item)}
                              >
                                Reschedule
                              </button>
                            </>
                          )}

                          {item.status === "completed" && (
                            <Link
                              to={`/appointments/${item._id}`}
                              className="dp-btn-complete"
                              style={{ textDecoration: "none" }}
                            >
                              Prescription
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Responsive Cards (visible <= 820px) */}
            <div className="dp-mobile-appointment-cards">
              {appointmentsList.map((item) => {
                const patient = item.patient || item.userId || {};
                const patientAvatar = imageSource(patient.image);
                const isVideo = item.consultationType === "video";
                const isPaid = item.paymentStatus === "paid" || item.payment;
                return (
                  <article className="dp-mobile-card" key={item._id}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      {patientAvatar ? (
                        <img
                          src={patientAvatar}
                          alt=""
                          className="dp-patient-avatar-sm"
                        />
                      ) : (
                        <div className="dp-patient-avatar-sm">
                          {(patient.name || "P").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: "#0f172a", display: "block" }}>
                          {patient.name || "Patient"}
                        </strong>
                        <small style={{ color: "#64748b" }}>
                          {patient.phone || "No phone"}
                        </small>
                      </div>
                      <span className={`dp-pill dp-pill-${item.status}`}>
                        {statusLabel[item.status] || item.status}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.8rem",
                        color: "#475569",
                      }}
                    >
                      <div>
                        <strong>Date: </strong>
                        {item.slotDate} at {item.slotTime}
                      </div>
                      <div>
                        <strong>Fee: </strong>₹{item.amount || 0} (
                        {isPaid ? "Paid" : "Pending"})
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        paddingTop: 8,
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      <Link
                        to={`/appointments/${item._id}`}
                        className="dp-btn-view"
                      >
                        Details
                      </Link>
                      {item.status === "pending" && (
                        <>
                          <button
                            type="button"
                            className="dp-btn-accept"
                            disabled={saving}
                            onClick={() =>
                              onStatus(
                                item._id,
                                "confirmed",
                                "Confirm Appointment",
                              )
                            }
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="dp-filter-clear-all"
                            disabled={saving}
                            onClick={() =>
                              onStatus(item._id, "cancel", "Reject Appointment")
                            }
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {item.status === "confirmed" && (
                        <>
                          <button
                            type="button"
                            className="dp-btn-complete"
                            disabled={saving}
                            onClick={() =>
                              onStatus(
                                item._id,
                                "completed",
                                "Complete Appointment",
                              )
                            }
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            className="dp-btn-reschedule"
                            disabled={saving}
                            onClick={() => onReschedule(item)}
                          >
                            Reschedule
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="dp-pagination">
              <div>
                Showing {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} appointments
              </div>
              <div className="dp-pagination-buttons">
                <button
                  type="button"
                  className="dp-page-btn"
                  disabled={pagination.page <= 1 || loadingList}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <FaChevronLeft /> Previous
                </button>
                <span style={{ fontWeight: 750, color: "#0f172a" }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  className="dp-page-btn"
                  disabled={
                    pagination.page >= pagination.totalPages || loadingList
                  }
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <FaChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

function AppointmentList({
  appointments,
  compact = false,
  onStatus,
  onReschedule,
  saving,
}) {
  if (!appointments?.length)
    return (
      <EmptyState
        title="No appointments"
        text="There are no appointments in this section."
      />
    );
  return (
    <div className="dp-list">
      {appointments.map((item) => (
        <article className="dp-appointment-row" key={item._id}>
          {item.patient?.image || item.userId?.image ? (
            <img
              className="dp-avatar"
              src={imageSource(item.patient?.image || item.userId?.image)}
              alt="Patient"
            />
          ) : (
            <div className="dp-avatar dp-avatar-fallback">
              {(item.patient?.name || item.userId?.name || "P").slice(0, 1)}
            </div>
          )}
          <div>
            <strong>
              {item.patient?.name || item.userId?.name || "Patient"}
            </strong>
            <span>
              {item.slotDate} at {item.slotTime} |{" "}
              {item.consultationType || "clinic"} |{" "}
              {item.patient?.gender ||
                item.userId?.gender ||
                "Gender unavailable"}
            </span>
            <small>
              Payment: {item.paymentStatus || "cash_pending"} | Rs{" "}
              {item.amount || 0}
            </small>
          </div>
          <em className={`dp-status ${item.status}`}>
            {statusLabel[item.status] || item.status}
          </em>
          {!compact && (
            <div className="dp-actions">
              <Link to={`/appointments/${item._id}`}>Details</Link>
              {item.status !== "confirmed" && (
                <button
                  disabled={saving}
                  onClick={() => onStatus(item._id, "confirmed")}
                >
                  Accept
                </button>
              )}
              {item.status !== "cancel" && (
                <button
                  disabled={saving}
                  onClick={() => onStatus(item._id, "cancel")}
                >
                  Reject
                </button>
              )}
              {item.status !== "completed" && (
                <button
                  disabled={saving}
                  onClick={() => onStatus(item._id, "completed")}
                >
                  Complete
                </button>
              )}
              <button disabled={saving} onClick={() => onReschedule(item)}>
                Reschedule
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function AppointmentDetailsView({
  appointment,
  doctor,
  onSave,
  onDeleteReport,
  saving,
}) {
  const [form, setForm] = useState({
    diagnosis: appointment.diagnosis || "",
    prescription: appointment.prescription || "",
    medicalNotes: appointment.medicalNotes || "",
    followUpAdvice: appointment.followUpAdvice || "",
  });

  const patient = appointment.patient || appointment.userId || {};
  const patientName =
    appointment.patientName ||
    patient.name ||
    appointment.userId?.name ||
    "Patient";
  const patientEmail = patient.email || appointment.userId?.email || "";
  const patientPhone =
    patient.phone ||
    appointment.userId?.phone ||
    patient.contact ||
    appointment.userId?.contact ||
    "";
  const patientAge = patient.dob
    ? `${Math.max(0, new Date().getFullYear() - new Date(patient.dob).getFullYear())} yrs`
    : "—";
  const patientGender = patient.gender || "Not specified";
  const doctorName = formatDoctorTitle(doctor.name);
  const doctorSpeciality =
    doctor.speciality ||
    doctor.specialization ||
    doctor.department ||
    "Specialist";
  const hospitalName =
    doctor.hospitalId?.name ||
    doctor.hospitalName ||
    appointment.hospital?.name ||
    appointment.hospitalName ||
    "HealPoint Hospital";
  const reportEntries = appointment.medicalReports || [];

  const downloadText = () => {
    const lines = [
      "==============================================",
      "        HEALPOINT MEDICAL PRESCRIPTION",
      "==============================================",
      `Doctor        : ${doctorName} (${doctorSpeciality})`,
      `Hospital      : ${hospitalName}`,
      "",
      "----------------------------------------------",
      "PATIENT DETAILS",
      "----------------------------------------------",
      `Patient       : ${patientName}`,
      `${patientEmail ? `Email         : ${patientEmail}` : ""}`,
      `${patientPhone ? `Phone         : ${patientPhone}` : ""}`,
      `Age / Gender  : ${patientAge} / ${patientGender}`,
      "",
      "----------------------------------------------",
      "APPOINTMENT",
      "----------------------------------------------",
      `Date          : ${appointment.slotDate || "—"}`,
      `Time          : ${appointment.slotTime || "—"}`,
      `Status        : ${statusLabel[appointment.status] || appointment.status || "—"}`,
      `Payment       : ${appointment.paymentStatus || "cash_pending"} | Rs ${appointment.amount || 0}`,
      "",
      "----------------------------------------------",
      "DIAGNOSIS",
      "----------------------------------------------",
      appointment.diagnosis || "Not recorded",
      "",
      "----------------------------------------------",
      "PRESCRIPTION",
      "----------------------------------------------",
      appointment.prescription || "Not recorded",
      "",
      "----------------------------------------------",
      "MEDICAL NOTES",
      "----------------------------------------------",
      appointment.medicalNotes || "Not recorded",
      "",
      "----------------------------------------------",
      "FOLLOW-UP ADVICE",
      "----------------------------------------------",
      appointment.followUpAdvice || "Not recorded",
    ].filter(Boolean);

    if (reportEntries.length) {
      lines.push(
        "",
        "----------------------------------------------",
        "ATTACHED REPORTS",
        "----------------------------------------------",
        ...reportEntries.map(
          (report) =>
            `- ${report.name} (${(report.type || "report").replace(/_/g, " ")})`,
        ),
      );
    }

    lines.push(
      "",
      "----------------------------------------------",
      `Generated electronically by HealPoint on ${new Date().toLocaleString("en-IN")}`,
      `Doctor signature: ${doctorName}`,
      "==============================================",
    );

    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `prescription-${appointment._id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPrescriptionPdf = () => {
    const pdfLines = [
      `Doctor        : ${doctorName} (${doctorSpeciality})`,
      `Hospital      : ${hospitalName}`,
      "",
      "PATIENT DETAILS",
      `Patient       : ${patientName}`,
      `Email         : ${patientEmail || "—"}`,
      `Phone         : ${patientPhone || "—"}`,
      `Age / Gender  : ${patientAge} / ${patientGender}`,
      "",
      "APPOINTMENT",
      `Date / Time   : ${appointment.slotDate || "—"} at ${appointment.slotTime || "—"}`,
      `Status        : ${statusLabel[appointment.status] || appointment.status || "—"}`,
      `Payment       : ${appointment.paymentStatus || "cash_pending"} | Rs ${appointment.amount || 0}`,
      "",
      "DIAGNOSIS",
      appointment.diagnosis || "Not recorded",
      "",
      "PRESCRIPTION",
      appointment.prescription || "Not recorded",
      "",
      "MEDICAL NOTES",
      appointment.medicalNotes || "Not recorded",
      "",
      "FOLLOW-UP ADVICE",
      appointment.followUpAdvice || "Not recorded",
    ];

    if (reportEntries.length) {
      pdfLines.push("", "ATTACHED REPORTS");
      reportEntries.forEach((report) =>
        pdfLines.push(
          `- ${report.name} (${(report.type || "report").replace(/_/g, " ")})`,
        ),
      );
    }

    pdfLines.push(
      "",
      "----------------------------------------------",
      `Generated electronically by HealPoint on ${new Date().toLocaleString("en-IN")}`,
      `Doctor signature: ${doctorName}`,
    );

    buildPdf(
      `Medical Prescription — ${patientName}`,
      pdfLines,
      `prescription-${appointment._id}.pdf`,
    );
  };

  return (
    <Panel title="Appointment Details">
      <div className="dp-actions">
        <button type="button" onClick={() => window.print()}>
          Print Prescription
        </button>
        <button type="button" onClick={downloadPrescriptionPdf}>
          Download PDF
        </button>
        <button type="button" onClick={downloadText}>
          Download Prescription
        </button>
      </div>
      <p className="dp-hint">
        Print or save as PDF from the browser print dialog — only the
        prescription sheet is printed.
      </p>

      {/* Screen-only workspace (hidden when printing) */}
      <div className="dp-screen-only">
        <div className="dp-detail-grid">
          <Info label="Patient" value={patientName} />
          <Info label="Email" value={patientEmail || "Not available"} />
          <Info
            label="Age / Gender"
            value={`${patientAge} / ${patientGender}`}
          />
          <Info label="Hospital" value={hospitalName} />
          <Info
            label="Disease / Concern"
            value={
              appointment.diagnosis ||
              appointment.medicalNotes ||
              "Not recorded"
            }
          />
          <Info
            label="Date & Time"
            value={`${appointment.slotDate} ${appointment.slotTime}`}
          />
          <Info
            label="Status"
            value={statusLabel[appointment.status] || appointment.status}
          />
          <Info
            label="Payment"
            value={`${appointment.paymentStatus || "cash_pending"} | Rs ${appointment.amount || 0}`}
          />
        </div>
        <MedicalForm
          form={form}
          setForm={setForm}
          onSubmit={() => onSave(appointment._id, form)}
          saving={saving}
        />
        <ReportsList
          reports={reportEntries}
          appointmentId={appointment._id}
          onDelete={onDeleteReport}
        />
      </div>

      {/* Print-only professional prescription sheet */}
      <div className="dp-print-sheet">
        <header className="dp-print-head">
          <div className="dp-print-brand">
            <FaStethoscope aria-hidden="true" />
            <div>
              <strong>HealPoint</strong>
              <small>Healing made human · Patient-centric care</small>
            </div>
          </div>
          <div className="dp-print-clinic">
            <strong>{doctorName}</strong>
            <span>{doctorSpeciality}</span>
            <small>{hospitalName}</small>
          </div>
        </header>

        <div className="dp-print-title">
          <h3>Medical Prescription</h3>
          <span>Appointment ID: {appointment._id}</span>
        </div>

        <div className="dp-print-patient">
          <div>
            <span>Patient</span>
            <strong>{patientName}</strong>
          </div>
          <div>
            <span>Age / Gender</span>
            <strong>
              {patientAge} / {patientGender}
            </strong>
          </div>
          <div>
            <span>Appointment Date</span>
            <strong>{appointment.slotDate || "—"}</strong>
          </div>
          <div>
            <span>Appointment Time</span>
            <strong>{appointment.slotTime || "—"}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>
              {statusLabel[appointment.status] || appointment.status}
            </strong>
          </div>
          <div>
            <span>Payment</span>
            <strong>
              {appointment.paymentStatus || "cash_pending"} · Rs{" "}
              {appointment.amount || 0}
            </strong>
          </div>
        </div>

        <div className="dp-print-body">
          <section>
            <h4>Diagnosis</h4>
            <p>{appointment.diagnosis || "Not recorded"}</p>
          </section>
          <section>
            <h4>Prescription</h4>
            <p className="dp-rx-lines">
              {appointment.prescription || "Not recorded"}
            </p>
          </section>
          <section>
            <h4>Medical Notes</h4>
            <p>{appointment.medicalNotes || "Not recorded"}</p>
          </section>
          <section>
            <h4>Follow-up Advice</h4>
            <p>{appointment.followUpAdvice || "Not recorded"}</p>
          </section>
          {reportEntries.length > 0 && (
            <section>
              <h4>Attached Reports</h4>
              <ul>
                {reportEntries.map((report) => (
                  <li key={report._id || report.url}>
                    {report.name} ({report.type || "report"})
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="dp-print-foot">
          <div className="dp-print-sign">
            <span>Authorized Doctor Signature</span>
            <strong>{doctorName}</strong>
            <em>{doctorSpeciality}</em>
          </div>
          <div className="dp-print-stamp">
            <strong>HealPoint</strong>
            <span>Official Prescription</span>
            <small>Verified Medical Document</small>
          </div>
          <small className="dp-print-generated">
            Generated electronically by HealPoint on{" "}
            {new Date().toLocaleString("en-IN")}
          </small>
        </footer>
      </div>
    </Panel>
  );
}

function PatientQueueView({ doctorId, doctor, onRefresh }) {
  const navigate = useNavigate();
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    appointmentId: null,
    patientName: "",
    action: "",
    title: "",
    promptText: "",
    reasonRequired: false,
    reason: "",
    notes: "",
  });

  const handleStartConsultation = async (appointmentId) => {
    setActionLoading(true);
    try {
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/consultation/${appointmentId}/start`,
      );
      if (res.data?.success) {
        toast.success("Consultation started");
        navigate(`/consultation/${appointmentId}`);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to start consultation",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const fetchQueue = async () => {
    if (!doctorId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/v1/doctor/panel/${doctorId}/queue`);
      if (res.data?.success) {
        setQueueData(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load patient queue";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [doctorId]);

  const handleQueueAction = async (
    appointmentId,
    action,
    reason = "",
    notes = "",
  ) => {
    setActionLoading(true);
    try {
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/queue/${appointmentId}/action`,
        { action, reason, notes },
      );
      if (res.data?.success) {
        toast.success(res.data.message || "Action updated successfully");
        await fetchQueue();
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Error performing queue action",
      );
    } finally {
      setActionLoading(false);
      setActionModal({
        isOpen: false,
        appointmentId: null,
        patientName: "",
        action: "",
        title: "",
        promptText: "",
        reasonRequired: false,
        reason: "",
        notes: "",
      });
    }
  };

  const handleCallNext = () => {
    const nextPatient =
      queueData?.sections?.waiting?.[0] || queueData?.sections?.checkedIn?.[0];
    if (!nextPatient) {
      toast.info("No waiting or checked-in patients in today's queue.");
      return;
    }
    handleQueueAction(nextPatient._id, "call_patient");
  };

  const summary = queueData?.summary || {
    todayDate: new Date().toLocaleDateString("en-IN"),
    doctorName: formatDoctorTitle(doctor?.name),
    hospitalName: doctor?.hospitalId?.name || "Hospital",
    department: doctor?.department || doctor?.speciality || "OPD",
    totalToday: 0,
    waitingCount: 0,
    checkedInCount: 0,
    inConsultationCount: 0,
    completedCount: 0,
    cancelledCount: 0,
  };

  const currentList = useMemo(() => {
    if (!queueData) return [];
    if (activeTab === "all") return queueData.queue || [];
    if (activeTab === "waiting") return queueData.sections?.waiting || [];
    if (activeTab === "checked_in") return queueData.sections?.checkedIn || [];
    if (activeTab === "in_consultation")
      return queueData.sections?.inConsultation || [];
    if (activeTab === "completed") return queueData.sections?.completed || [];
    if (activeTab === "cancelled") return queueData.sections?.cancelled || [];
    return queueData.queue || [];
  }, [queueData, activeTab]);

  return (
    <div className="dp-queue-container">
      {/* OPD Queue Header Banner */}
      <div className="dp-queue-header-card">
        <div className="dp-queue-header-top">
          <div className="dp-queue-header-left">
            <span className="dp-queue-date-tag">
              <FaCalendarDay /> {summary.todayDate}
            </span>
            <h2>OPD Patient Queue</h2>
            <p>
              {summary.doctorName} · {summary.hospitalName} ·{" "}
              <strong>{summary.department}</strong>
            </p>
          </div>
          <div className="dp-queue-header-actions">
            <button
              type="button"
              className="dp-queue-call-next-btn"
              onClick={handleCallNext}
              disabled={
                actionLoading ||
                (!queueData?.sections?.waiting?.length &&
                  !queueData?.sections?.checkedIn?.length)
              }
            >
              <FaPhoneVolume /> Call Next Patient
            </button>
            <button
              type="button"
              className="dp-queue-refresh-btn"
              onClick={fetchQueue}
              title="Refresh queue"
              disabled={loading}
            >
              <FaSyncAlt className={loading ? "dp-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Live Status Metric Chips */}
        <div className="dp-queue-kpi-strip">
          <div
            className={`dp-queue-kpi-chip ${
              activeTab === "all" ? "active" : ""
            }`}
            onClick={() => setActiveTab("all")}
          >
            <span>Total OPD</span>
            <strong>{summary.totalToday}</strong>
          </div>
          <div
            className={`dp-queue-kpi-chip amber ${
              activeTab === "waiting" ? "active" : ""
            }`}
            onClick={() => setActiveTab("waiting")}
          >
            <span>Waiting</span>
            <strong>{summary.waitingCount}</strong>
          </div>
          <div
            className={`dp-queue-kpi-chip cyan ${
              activeTab === "checked_in" ? "active" : ""
            }`}
            onClick={() => setActiveTab("checked_in")}
          >
            <span>Checked In</span>
            <strong>{summary.checkedInCount}</strong>
          </div>
          <div
            className={`dp-queue-kpi-chip emerald ${
              activeTab === "in_consultation" ? "active" : ""
            }`}
            onClick={() => setActiveTab("in_consultation")}
          >
            <span className="dp-live-indicator">
              <i className="dp-pulse-dot" /> In Consultation
            </span>
            <strong>{summary.inConsultationCount}</strong>
          </div>
          <div
            className={`dp-queue-kpi-chip blue ${
              activeTab === "completed" ? "active" : ""
            }`}
            onClick={() => setActiveTab("completed")}
          >
            <span>Completed</span>
            <strong>{summary.completedCount}</strong>
          </div>
          <div
            className={`dp-queue-kpi-chip rose ${
              activeTab === "cancelled" ? "active" : ""
            }`}
            onClick={() => setActiveTab("cancelled")}
          >
            <span>Cancelled / No-Show</span>
            <strong>{summary.cancelledCount}</strong>
          </div>
        </div>
      </div>

      {/* Queue Filter Tabs Bar */}
      <div className="dp-queue-tabs-bar">
        <button
          type="button"
          className={`dp-queue-tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Flow <span className="dp-tab-count">{summary.totalToday}</span>
        </button>
        <button
          type="button"
          className={`dp-queue-tab ${activeTab === "waiting" ? "active" : ""}`}
          onClick={() => setActiveTab("waiting")}
        >
          Waiting{" "}
          <span className="dp-tab-count amber">{summary.waitingCount}</span>
        </button>
        <button
          type="button"
          className={`dp-queue-tab ${
            activeTab === "checked_in" ? "active" : ""
          }`}
          onClick={() => setActiveTab("checked_in")}
        >
          Checked In{" "}
          <span className="dp-tab-count cyan">{summary.checkedInCount}</span>
        </button>
        <button
          type="button"
          className={`dp-queue-tab ${
            activeTab === "in_consultation" ? "active" : ""
          }`}
          onClick={() => setActiveTab("in_consultation")}
        >
          In Consultation{" "}
          <span className="dp-tab-count emerald">
            {summary.inConsultationCount}
          </span>
        </button>
        <button
          type="button"
          className={`dp-queue-tab ${
            activeTab === "completed" ? "active" : ""
          }`}
          onClick={() => setActiveTab("completed")}
        >
          Completed{" "}
          <span className="dp-tab-count blue">{summary.completedCount}</span>
        </button>
        <button
          type="button"
          className={`dp-queue-tab ${
            activeTab === "cancelled" ? "active" : ""
          }`}
          onClick={() => setActiveTab("cancelled")}
        >
          Cancelled / No-Show{" "}
          <span className="dp-tab-count rose">{summary.cancelledCount}</span>
        </button>
      </div>

      {/* Queue Patient Cards List */}
      {loading ? (
        <div className="dp-loading-container">
          <div className="dp-spinner" />
          <p>Loading live patient queue...</p>
        </div>
      ) : error ? (
        <div className="dp-error-container">
          <FaExclamationTriangle />
          <p>{error}</p>
          <button
            type="button"
            className="dp-btn dp-btn-secondary"
            onClick={fetchQueue}
          >
            Try Again
          </button>
        </div>
      ) : currentList.length === 0 ? (
        <div className="dp-empty-state-card">
          <div className="dp-empty-icon">
            <FaUserClock />
          </div>
          <h3>No patients in this queue stage</h3>
          <p>
            {activeTab === "all"
              ? "There are no appointments scheduled for today's OPD."
              : `There are currently no patients marked as '${activeTab.replace(
                  "_",
                  " ",
                )}'.`}
          </p>
          <button
            type="button"
            className="dp-btn dp-btn-outline"
            onClick={() => setActiveTab("all")}
          >
            View All Flow
          </button>
        </div>
      ) : (
        <div className="dp-queue-cards-grid">
          {currentList.map((item) => {
            const patient = item.patient || item.userId || {};
            const patientId = patient._id;
            const patientName = patient.name || "Patient";
            const patientImage = imageSource(
              patient.image || patient.hdProfilePicture || "",
            );
            const initials = patientName
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const age = patient.dob
              ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
              : null;
            const stage = item.queueStage || "waiting";

            return (
              <div
                key={item._id}
                className={`dp-queue-card dp-queue-stage-${stage}`}
              >
                <div className="dp-queue-card-top">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div className="dp-queue-pos-badge">
                      #{item.queuePosition || 1}
                    </div>
                    {item.queueToken && (
                      <span
                        className="dp-queue-token-badge"
                        style={{
                          background:
                            "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: "0.78rem",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          letterSpacing: "0.5px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        TOKEN {item.queueToken}
                      </span>
                    )}
                  </div>
                  <div className="dp-queue-badges-row">
                    {item.calledAt && (
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "#f59e0b",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <FaPhoneVolume /> Called{" "}
                        {new Date(item.calledAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    <span className={`dp-queue-status-tag ${stage}`}>
                      {stage === "in_consultation" ? (
                        <>
                          <i className="dp-pulse-dot" /> IN CONSULTATION
                        </>
                      ) : stage === "checked_in" ? (
                        "CHECKED IN"
                      ) : stage === "completed" ? (
                        "COMPLETED"
                      ) : stage === "cancelled" ? (
                        item.status === "missed" ? (
                          "NO-SHOW / MISSED"
                        ) : (
                          "CANCELLED"
                        )
                      ) : (
                        "WAITING"
                      )}
                    </span>
                    <span className="dp-queue-time-badge">
                      <FaClock /> {item.slotTime || "—"}
                    </span>
                  </div>
                </div>

                <div className="dp-queue-card-patient">
                  {patientImage ? (
                    <img
                      src={patientImage}
                      alt={patientName}
                      className="dp-queue-avatar"
                    />
                  ) : (
                    <div className="dp-queue-avatar dp-avatar-fallback">
                      {initials}
                    </div>
                  )}
                  <div className="dp-queue-patient-info">
                    <h4>
                      {patientId ? (
                        <Link
                          to={`/patients/${patientId}`}
                          title="View Patient Profile"
                        >
                          {patientName}
                        </Link>
                      ) : (
                        patientName
                      )}
                    </h4>
                    <p className="dp-queue-demographics">
                      {patient.gender || "Gender N/A"}
                      {age ? ` · ${age} yrs` : ""}
                      {patient.phone ? ` · ${patient.phone}` : ""}
                    </p>
                    <div className="dp-queue-meta-chips">
                      <span className="dp-meta-type-chip">
                        {item.consultationType === "video" ? (
                          <>
                            <FaVideo /> Video Consultation
                          </>
                        ) : (
                          <>
                            <FaHospital /> In-Clinic
                          </>
                        )}
                      </span>
                      <span
                        className={`dp-meta-payment-chip ${
                          item.paymentStatus === "paid" ? "paid" : "pending"
                        }`}
                      >
                        {item.paymentStatus === "paid"
                          ? `Paid ₹${item.amount || 0}`
                          : `Cash Pending ₹${item.amount || 0}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Primary & Secondary Actions */}
                <div className="dp-queue-card-actions">
                  {stage === "waiting" && (
                    <>
                      <button
                        type="button"
                        className="dp-btn dp-btn-amber dp-btn-flex"
                        disabled={actionLoading}
                        onClick={() =>
                          handleQueueAction(item._id, "call_patient")
                        }
                      >
                        <FaPhoneVolume /> Call / Check In
                      </button>
                      <button
                        type="button"
                        className="dp-btn dp-btn-emerald"
                        disabled={actionLoading}
                        onClick={() => handleStartConsultation(item._id)}
                      >
                        <FaPlay /> Start Consultation
                      </button>
                    </>
                  )}

                  {stage === "checked_in" && (
                    <>
                      <button
                        type="button"
                        className="dp-btn dp-btn-amber dp-btn-flex"
                        disabled={actionLoading}
                        onClick={() =>
                          handleQueueAction(item._id, "call_patient")
                        }
                      >
                        <FaPhoneVolume /> Call / Announce
                      </button>
                      <button
                        type="button"
                        className="dp-btn dp-btn-emerald dp-btn-flex"
                        disabled={actionLoading}
                        onClick={() => handleStartConsultation(item._id)}
                      >
                        <FaPlay /> Start Consultation
                      </button>
                    </>
                  )}

                  {stage === "in_consultation" && (
                    <>
                      <Link
                        to={`/consultation/${item._id}`}
                        className="dp-btn dp-btn-primary dp-btn-flex"
                        title="Enter Clinical Workspace"
                      >
                        <FaStethoscope /> Enter Consultation
                      </Link>
                      <button
                        type="button"
                        className="dp-btn dp-btn-indigo"
                        disabled={actionLoading}
                        onClick={() =>
                          setActionModal({
                            isOpen: true,
                            appointmentId: item._id,
                            patientName,
                            action: "complete_consultation",
                            title: `Complete Consultation — ${patientName}`,
                            promptText:
                              "You are about to mark this consultation as completed. You may enter clinical notes or follow-up summary below:",
                            reasonRequired: false,
                            reason: "",
                            notes: item.medicalNotes || "",
                          })
                        }
                      >
                        <FaCheck /> Complete
                      </button>
                    </>
                  )}

                  {stage === "completed" && (
                    <>
                      {patientId && (
                        <Link
                          to={`/medical-history/${patientId}`}
                          className="dp-btn dp-btn-secondary dp-btn-flex"
                          title="Open Comprehensive EMR"
                        >
                          <FaHistory /> Patient EMR
                        </Link>
                      )}
                      <Link
                        to="/prescriptions"
                        className="dp-btn dp-btn-outline"
                      >
                        <FaNotesMedical /> Prescription
                      </Link>
                    </>
                  )}

                  {stage !== "completed" && stage !== "cancelled" && (
                    <div className="dp-queue-secondary-actions">
                      <button
                        type="button"
                        className="dp-btn-text text-amber"
                        disabled={actionLoading}
                        onClick={() =>
                          setActionModal({
                            isOpen: true,
                            appointmentId: item._id,
                            patientName,
                            action: "mark_noshow",
                            title: `Mark No-Show / Missed — ${patientName}`,
                            promptText:
                              "Are you sure you want to mark this appointment as a missed appointment / no-show?",
                            reasonRequired: false,
                            reason:
                              "Patient did not show up for the appointment",
                            notes: "",
                          })
                        }
                      >
                        <FaUserSlash /> No-Show
                      </button>
                      <button
                        type="button"
                        className="dp-btn-text text-rose"
                        disabled={actionLoading}
                        onClick={() =>
                          setActionModal({
                            isOpen: true,
                            appointmentId: item._id,
                            patientName,
                            action: "cancel",
                            title: `Cancel Appointment — ${patientName}`,
                            promptText:
                              "Please provide a reason for cancelling this appointment:",
                            reasonRequired: true,
                            reason: "",
                            notes: "",
                          })
                        }
                      >
                        <FaTimes /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Action Dialog Modal */}
      {actionModal.isOpen && (
        <div className="dp-modal-backdrop">
          <div className="dp-modal-dialog">
            <div className="dp-modal-header">
              <h3>{actionModal.title}</h3>
              <button
                type="button"
                className="dp-modal-close"
                onClick={() =>
                  setActionModal((prev) => ({ ...prev, isOpen: false }))
                }
              >
                <FaTimes />
              </button>
            </div>
            <div className="dp-modal-body">
              <p>{actionModal.promptText}</p>
              {actionModal.action === "complete_consultation" && (
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 700,
                      fontSize: "0.82rem",
                    }}
                  >
                    Clinical Notes / Summary (Optional)
                  </label>
                  <textarea
                    rows={4}
                    className="dp-modal-textarea"
                    placeholder="Enter clinical observations, advice, or summary..."
                    value={actionModal.notes}
                    onChange={(e) =>
                      setActionModal((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
              {actionModal.reasonRequired && (
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 700,
                      fontSize: "0.82rem",
                    }}
                  >
                    Cancellation Reason{" "}
                    <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="dp-modal-input"
                    placeholder="Reason for cancellation..."
                    value={actionModal.reason}
                    onChange={(e) =>
                      setActionModal((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>
            <div className="dp-modal-footer">
              <button
                type="button"
                className="dp-btn dp-btn-secondary"
                onClick={() =>
                  setActionModal((prev) => ({ ...prev, isOpen: false }))
                }
              >
                Close
              </button>
              <button
                type="button"
                className={`dp-btn ${
                  actionModal.action === "cancel"
                    ? "dp-btn-rose"
                    : actionModal.action === "mark_noshow"
                      ? "dp-btn-amber"
                      : "dp-btn-emerald"
                }`}
                disabled={
                  actionLoading ||
                  (actionModal.reasonRequired && !actionModal.reason.trim())
                }
                onClick={() =>
                  handleQueueAction(
                    actionModal.appointmentId,
                    actionModal.action,
                    actionModal.reason,
                    actionModal.notes,
                  )
                }
              >
                {actionLoading ? "Processing..." : "Confirm Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientsManagementView({ doctorId, initialSearch = "" }) {
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [search, setSearch] = useState(initialSearch);
  const [sortBy, setSortBy] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchPatients = async (
    page = 1,
    searchQuery = search,
    sort = sortBy,
  ) => {
    if (!doctorId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(`/api/v1/doctor/panel/${doctorId}/patients`, {
        params: {
          page,
          limit: 10,
          search: searchQuery,
          sortBy: sort,
        },
      });
      if (res.data?.success) {
        setPatients(res.data.patients || []);
        setPagination(
          res.data.pagination || {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 1,
          },
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load patients";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(1, search, sortBy);
    }, 300);
    return () => clearTimeout(timer);
  }, [doctorId, search, sortBy]);

  return (
    <div className="dp-patients-container">
      {/* Header & Controls */}
      <div className="dp-patients-header-bar">
        <div>
          <h2>Patient Directory</h2>
          <p>
            Total active patients under your care:{" "}
            <strong>{pagination.total}</strong>
          </p>
        </div>

        <div className="dp-patients-controls">
          <div className="dp-search-box">
            <FaSearch className="dp-search-icon" />
            <input
              type="text"
              placeholder="Search by name, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="dp-search-clear"
                onClick={() => setSearch("")}
              >
                <FaTimes />
              </button>
            )}
          </div>

          <div className="dp-sort-box">
            <label>Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="dp-select"
            >
              <option value="recent">Recent Visit</option>
              <option value="appointments">Most Appointments</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="dp-loading-container">
          <div className="dp-spinner" />
          <p>Loading patient directory...</p>
        </div>
      ) : error ? (
        <div className="dp-error-container">
          <FaExclamationTriangle />
          <p>{error}</p>
          <button
            type="button"
            className="dp-btn dp-btn-secondary"
            onClick={() => fetchPatients(1)}
          >
            Try Again
          </button>
        </div>
      ) : patients.length === 0 ? (
        <div className="dp-empty-state-card">
          <div className="dp-empty-icon">
            <FaUserInjured />
          </div>
          <h3>
            {search
              ? "No patients match your search"
              : "No patient records yet"}
          </h3>
          <p>
            {search
              ? `No records found matching "${search}". Please check the spelling or clear search.`
              : "Patients will appear here automatically when appointments are scheduled."}
          </p>
          {search && (
            <button
              type="button"
              className="dp-btn dp-btn-outline"
              onClick={() => setSearch("")}
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="dp-table-wrapper dp-patients-table-desktop">
            <table className="dp-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Contact</th>
                  <th>Demographics</th>
                  <th>Appointments</th>
                  <th>Last Visit</th>
                  <th>Total Billed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => {
                  const avatar = imageSource(p.image || "");
                  const initials = (p.name || "Patient")
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const age = p.dob
                    ? new Date().getFullYear() - new Date(p.dob).getFullYear()
                    : null;

                  return (
                    <tr key={p._id}>
                      <td>
                        <div className="dp-table-patient-cell">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={p.name}
                              className="dp-patient-avatar-sm"
                            />
                          ) : (
                            <div className="dp-patient-avatar-sm dp-avatar-fallback">
                              {initials}
                            </div>
                          )}
                          <div>
                            <strong>
                              <Link to={`/patients/${p._id}`}>{p.name}</Link>
                            </strong>
                            <small className="dp-id-sub">
                              ID: {p._id.slice(-6).toUpperCase()}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="dp-contact-col">
                          <span>{p.phone || "—"}</span>
                          <small>{p.email || "—"}</small>
                        </div>
                      </td>
                      <td>
                        <span>
                          {p.gender || "—"}
                          {age ? ` · ${age} yrs` : ""}
                        </span>
                      </td>
                      <td>
                        <div className="dp-badge-stats">
                          <span className="dp-badge-pill">
                            {p.appointmentCount} total
                          </span>
                          {p.completedCount > 0 && (
                            <span className="dp-badge-pill green">
                              {p.completedCount} completed
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span>
                          {p.lastVisit
                            ? new Date(p.lastVisit).toLocaleDateString("en-IN")
                            : "—"}
                        </span>
                      </td>
                      <td>
                        <strong>₹{p.totalSpent || 0}</strong>
                      </td>
                      <td>
                        <div className="dp-table-actions">
                          <Link
                            to={`/patients/${p._id}`}
                            className="dp-action-link"
                            title="View Full Record"
                          >
                            <FaEye /> Profile
                          </Link>
                          <Link
                            to={`/medical-history/${p._id}`}
                            className="dp-action-link"
                            title="Complete EMR"
                          >
                            <FaFolderOpen /> EMR
                          </Link>
                          <Link
                            to={`/patients/${p._id}?tab=history`}
                            className="dp-action-link"
                            title="Medical History"
                          >
                            <FaHistory /> History
                          </Link>
                          <Link
                            to={`/patients/${p._id}?tab=prescriptions`}
                            className="dp-action-link"
                            title="Prescriptions"
                          >
                            <FaNotesMedical /> Rx
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="dp-patients-cards-mobile">
            {patients.map((p) => {
              const avatar = imageSource(p.image || "");
              const initials = (p.name || "Patient")
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const age = p.dob
                ? new Date().getFullYear() - new Date(p.dob).getFullYear()
                : null;

              return (
                <div key={p._id} className="dp-patient-card-mobile">
                  <div className="dp-pcm-top">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={p.name}
                        className="dp-pcm-avatar"
                      />
                    ) : (
                      <div className="dp-pcm-avatar dp-avatar-fallback">
                        {initials}
                      </div>
                    )}
                    <div>
                      <h4>
                        <Link to={`/patients/${p._id}`}>{p.name}</Link>
                      </h4>
                      <p>
                        {p.gender || "—"}
                        {age ? ` · ${age} yrs` : ""}
                        {p.phone ? ` · ${p.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="dp-pcm-stats">
                    <div>
                      <span>Appointments</span>
                      <strong>{p.appointmentCount}</strong>
                    </div>
                    <div>
                      <span>Completed</span>
                      <strong>{p.completedCount}</strong>
                    </div>
                    <div>
                      <span>Total Billed</span>
                      <strong>₹{p.totalSpent || 0}</strong>
                    </div>
                  </div>
                  <div className="dp-pcm-actions">
                    <Link
                      to={`/medical-history/${p._id}`}
                      className="dp-btn dp-btn-sm dp-btn-primary"
                    >
                      EMR
                    </Link>
                    <Link
                      to={`/patients/${p._id}`}
                      className="dp-btn dp-btn-sm dp-btn-secondary"
                    >
                      Profile
                    </Link>
                    <Link
                      to={`/patients/${p._id}?tab=history`}
                      className="dp-btn dp-btn-sm dp-btn-secondary"
                    >
                      History
                    </Link>
                    <Link
                      to={`/patients/${p._id}?tab=prescriptions`}
                      className="dp-btn dp-btn-sm dp-btn-secondary"
                    >
                      Prescriptions
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="dp-pagination-bar">
              <span className="dp-pagination-info">
                Showing {(pagination.page - 1) * pagination.limit + 1} -{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} patients
              </span>
              <div className="dp-pagination-btns">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchPatients(pagination.page - 1)}
                  className="dp-page-btn"
                >
                  <FaChevronLeft /> Previous
                </button>
                <span className="dp-page-indicator">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchPatients(pagination.page + 1)}
                  className="dp-page-btn"
                >
                  Next <FaChevronRight />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PatientProfileView({ doctorId, patientId, doctor, onRefresh }) {
  const location = useLocation();
  const queryTab =
    new URLSearchParams(location.search).get("tab") || "overview";
  const [activeTab, setActiveTab] = useState(queryTab);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDetails = async () => {
    if (!doctorId || !patientId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/patient/${patientId}/details`,
      );
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      const msg =
        err.response?.data?.message || "Failed to load patient record";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [doctorId, patientId]);

  useEffect(() => {
    if (queryTab) setActiveTab(queryTab);
  }, [queryTab]);

  if (loading) {
    return (
      <div className="dp-loading-container">
        <div className="dp-spinner" />
        <p>Loading patient health record...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dp-error-container">
        <FaExclamationTriangle />
        <p>{error || "Patient record could not be loaded."}</p>
        <Link to="/patients" className="dp-btn dp-btn-secondary">
          <FaChevronLeft /> Return to Patients
        </Link>
        <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
          <button
            type="button"
            className="dp-btn dp-btn-primary"
            onClick={fetchDetails}
          >
            <FaSyncAlt /> Retry
          </button>
          <Link to="/patients" className="dp-btn dp-btn-secondary">
            <FaChevronLeft /> Return to Patients
          </Link>
        </div>
      </div>
    );
  }

  const patient = data.patient || {};
  const overview = data.overview || {};
  const appointments = data.appointments || [];
  const prescriptions = data.prescriptions || [];
  const reports = data.reports || [];
  const timeline = data.timeline || [];

  const patientAvatar = imageSource(patient.image || "");
  const initials = (patient.name || "Patient")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const age = patient.dob
    ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
    : null;

  return (
    <div className="dp-patient-profile-wrapper">
      {/* Top Navigation / Breadcrumbs */}
      <div className="dp-profile-top-bar">
        <Link to="/patients" className="dp-back-link">
          <FaChevronLeft /> Back to Patients
        </Link>
        <div className="dp-profile-export-btns">
          <button
            type="button"
            className="dp-btn dp-btn-outline dp-btn-sm"
            onClick={() => {
              fetchDetails();
              if (onRefresh) onRefresh();
            }}
            disabled={loading}
            title="Refresh patient records"
          >
            <FaSyncAlt className={loading ? "dp-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            className="dp-btn dp-btn-outline dp-btn-sm"
            onClick={() =>
              openPrintWindow(
                `Patient Record: ${patient.name || "Patient"} — HealPoint`,
                patientReportLines({ ...patient, appointments }),
              )
            }
          >
            <FaPrint /> Print Summary
          </button>
          <button
            type="button"
            className="dp-btn dp-btn-outline dp-btn-sm"
            onClick={() =>
              buildPdf(
                `Patient Health Record — ${patient.name || "Patient"}`,
                patientReportLines({ ...patient, appointments }),
                `patient-${patient._id || Date.now()}.pdf`,
              )
            }
          >
            <FaFilePdf /> Download PDF
          </button>
        </div>
      </div>

      {/* Patient Hero Profile Card */}
      <div className="dp-profile-hero-card">
        <div className="dp-profile-hero-main">
          {patientAvatar ? (
            <img
              src={patientAvatar}
              alt={patient.name}
              className="dp-profile-hero-avatar"
            />
          ) : (
            <div className="dp-profile-hero-avatar dp-avatar-fallback">
              {initials}
            </div>
          )}
          <div className="dp-profile-hero-details">
            <div className="dp-profile-name-row">
              <h2>{patient.name || "Patient"}</h2>
              <span className="dp-patient-id-badge">ID: {patient._id}</span>
            </div>
            <p className="dp-profile-sub">
              <strong>{patient.gender || "Gender N/A"}</strong>
              {age ? ` · ${age} years (${patient.dob})` : ""}
              {patient.phone ? ` · 📞 ${patient.phone}` : ""}
              {patient.email ? ` · ✉️ ${patient.email}` : ""}
            </p>
            {patient.address && (
              <p className="dp-profile-address">📍 {patient.address}</p>
            )}
            <div className="dp-profile-care-tags">
              <span className="dp-care-tag">
                Primary Doctor: <strong>{doctor?.name || "Self"}</strong>
              </span>
              <span className="dp-care-tag">
                Hospital:{" "}
                <strong>
                  {doctor?.hospitalId?.name || "HealPoint Clinic"}
                </strong>
              </span>
            </div>
          </div>
        </div>

        <div className="dp-profile-hero-actions">
          <Link
            to={`/medical-history/${patientId}`}
            className="dp-btn dp-btn-emerald"
          >
            <FaHistory /> Complete EMR Hub
          </Link>
          <Link
            to={`/prescriptions?patientId=${patientId}`}
            className="dp-btn dp-btn-primary"
          >
            <FaNotesMedical /> Write Prescription
          </Link>
          <Link
            to={`/upload-reports?patientId=${patientId}`}
            className="dp-btn dp-btn-secondary"
          >
            <FaUpload /> Upload Report
          </Link>
        </div>
      </div>

      {/* Profile Section Tabs */}
      <div className="dp-profile-tabs-strip">
        <button
          type="button"
          className={`dp-profile-tab ${
            activeTab === "overview" ? "active" : ""
          }`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`dp-profile-tab ${
            activeTab === "appointments" ? "active" : ""
          }`}
          onClick={() => setActiveTab("appointments")}
        >
          Appointments{" "}
          <span className="dp-tab-count">{appointments.length}</span>
        </button>
        <button
          type="button"
          className={`dp-profile-tab ${
            activeTab === "history" ? "active" : ""
          }`}
          onClick={() => setActiveTab("history")}
        >
          Medical History
        </button>
        <button
          type="button"
          className={`dp-profile-tab ${
            activeTab === "prescriptions" ? "active" : ""
          }`}
          onClick={() => setActiveTab("prescriptions")}
        >
          Prescriptions{" "}
          <span className="dp-tab-count">{prescriptions.length}</span>
        </button>
        <button
          type="button"
          className={`dp-profile-tab ${
            activeTab === "reports" ? "active" : ""
          }`}
          onClick={() => setActiveTab("reports")}
        >
          Reports <span className="dp-tab-count">{reports.length}</span>
        </button>
        <button
          type="button"
          className={`dp-profile-tab ${
            activeTab === "timeline" ? "active" : ""
          }`}
          onClick={() => setActiveTab("timeline")}
        >
          Health Timeline{" "}
          <span className="dp-tab-count">{timeline.length}</span>
        </button>
      </div>

      {/* Tab Content Panes */}
      <div className="dp-profile-tab-content">
        {/* 1. Overview Tab */}
        {activeTab === "overview" && (
          <div className="dp-overview-pane">
            <div className="dp-overview-kpis-grid">
              <div className="dp-overview-kpi-card">
                <span>Total Appointments</span>
                <strong>{overview.totalAppointments}</strong>
                <small>With {doctor?.name || "Doctor"}</small>
              </div>
              <div className="dp-overview-kpi-card emerald">
                <span>Completed Visits</span>
                <strong>{overview.completedVisits}</strong>
                <small>Consultations conducted</small>
              </div>
              <div className="dp-overview-kpi-card cyan">
                <span>Total Billed</span>
                <strong>₹{overview.totalSpent || 0}</strong>
                <small>Consultation fees</small>
              </div>
              <div className="dp-overview-kpi-card amber">
                <span>Last Visit</span>
                <strong>{overview.lastVisit || "No prior visits"}</strong>
                <small>Most recent date</small>
              </div>
            </div>

            {overview.nextAppointment && (
              <div className="dp-upcoming-alert-box">
                <FaCalendarCheck />
                <div>
                  <h4>Upcoming Appointment Scheduled</h4>
                  <p>
                    Next scheduled consultation on:{" "}
                    <strong>{overview.nextAppointment}</strong>
                  </p>
                </div>
              </div>
            )}

            <div className="dp-overview-split">
              <div className="dp-overview-left">
                <Panel title="Recent Diagnoses & Prescriptions">
                  {prescriptions.length === 0 ? (
                    <p style={{ color: "#64748b", margin: 0, padding: 12 }}>
                      No prescriptions or diagnoses recorded yet for this
                      patient.
                    </p>
                  ) : (
                    <div className="dp-recent-prescriptions-list">
                      {prescriptions.slice(0, 3).map((p) => (
                        <div key={p._id} className="dp-recent-rx-item">
                          <div className="dp-rx-top">
                            <span className="dp-rx-date">{p.date}</span>
                            <span className="dp-rx-diag">
                              {p.diagnosis || "General Consultation"}
                            </span>
                          </div>
                          {p.prescription && (
                            <pre className="dp-rx-text">{p.prescription}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <div className="dp-overview-right">
                <Panel title="Uploaded Medical Reports">
                  {reports.length === 0 ? (
                    <p style={{ color: "#64748b", margin: 0, padding: 12 }}>
                      No diagnostic reports uploaded yet.
                    </p>
                  ) : (
                    <div className="dp-recent-reports-list">
                      {reports.slice(0, 4).map((r, i) => (
                        <div key={i} className="dp-report-item-row">
                          <FaFileMedical className="dp-rep-icon" />
                          <div className="dp-rep-meta">
                            <strong>{r.name || "Medical Report"}</strong>
                            <small>{r.slotDate || "Recent"}</small>
                          </div>
                          {r.url && (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="dp-btn-view"
                            >
                              Download
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          </div>
        )}

        {/* 2. Appointments Tab */}
        {activeTab === "appointments" && (
          <Panel title={`Appointment History (${appointments.length})`}>
            {appointments.length === 0 ? (
              <EmptyState
                title="No appointments"
                text="No appointments found for this patient."
              />
            ) : (
              <AppointmentList appointments={appointments} compact />
            )}
          </Panel>
        )}

        {/* 3. Medical History Tab */}
        {activeTab === "history" && (
          <Panel title="Clinical Medical History">
            {appointments.filter(
              (a) => a.diagnosis || a.medicalNotes || a.prescription,
            ).length === 0 ? (
              <EmptyState
                title="No clinical notes recorded"
                text="Medical history notes and diagnoses will appear here as consultations are conducted."
              />
            ) : (
              <div className="dp-medical-history-entries">
                {appointments
                  .filter(
                    (a) => a.diagnosis || a.medicalNotes || a.prescription,
                  )
                  .map((item) => (
                    <div key={item._id} className="dp-history-entry-card">
                      <div className="dp-he-header">
                        <div className="dp-he-date">
                          <FaCalendarAlt /> {item.slotDate} at {item.slotTime}
                        </div>
                        <span className={`dp-queue-status-tag ${item.status}`}>
                          {item.status?.toUpperCase()}
                        </span>
                      </div>
                      <div className="dp-he-body">
                        {item.diagnosis && (
                          <div className="dp-he-section">
                            <label>Primary Diagnosis:</label>
                            <p>{item.diagnosis}</p>
                          </div>
                        )}
                        {item.medicalNotes && (
                          <div className="dp-he-section">
                            <label>Clinical Notes & Observations:</label>
                            <p>{item.medicalNotes}</p>
                          </div>
                        )}
                        {item.prescription && (
                          <div className="dp-he-section">
                            <label>Prescribed Treatment:</label>
                            <pre>{item.prescription}</pre>
                          </div>
                        )}
                        {item.followUpAdvice && (
                          <div className="dp-he-section">
                            <label>Follow-up Advice:</label>
                            <p>{item.followUpAdvice}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Panel>
        )}

        {/* 4. Prescriptions Tab */}
        {activeTab === "prescriptions" && (
          <Panel title={`Prescriptions Issued (${prescriptions.length})`}>
            {prescriptions.length === 0 ? (
              <EmptyState
                title="No prescriptions on record"
                text="Create a prescription for this patient using the Write Prescription button."
              />
            ) : (
              <div className="dp-prescriptions-grid">
                {prescriptions.map((item) => (
                  <div key={item._id} className="dp-prescription-card">
                    <div className="dp-prescription-card-header">
                      <div>
                        <strong>Prescription #{item.appointmentId}</strong>
                        <small>
                          {item.date} · {item.time}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="dp-btn dp-btn-outline dp-btn-sm"
                        onClick={() =>
                          openPrintWindow(
                            `Prescription: ${patient.name} — ${item.date}`,
                            [
                              `Patient: ${patient.name}`,
                              `Doctor: ${
                                item.doctorName || doctor?.name || "Doctor"
                              }`,
                              `Date: ${item.date} at ${item.time}`,
                              `Diagnosis: ${item.diagnosis || "—"}`,
                              "",
                              "Prescribed Medication:",
                              item.prescription || "No prescription text",
                              "",
                              `Follow-up advice: ${item.followUpAdvice || "—"}`,
                            ],
                          )
                        }
                      >
                        <FaPrint /> Print
                      </button>
                    </div>
                    <div className="dp-prescription-card-body">
                      <div className="dp-p-block">
                        <span>Diagnosis:</span>
                        <strong>
                          {item.diagnosis || "General Examination"}
                        </strong>
                      </div>
                      <div className="dp-p-block">
                        <span>Medication / Instructions:</span>
                        <pre className="dp-rx-pre">
                          {item.prescription || "—"}
                        </pre>
                      </div>
                      {item.followUpAdvice && (
                        <div className="dp-p-block">
                          <span>Follow-up:</span>
                          <p>{item.followUpAdvice}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* 5. Reports Tab */}
        {activeTab === "reports" && (
          <Panel title={`Diagnostic & Medical Reports (${reports.length})`}>
            {reports.length === 0 ? (
              <EmptyState
                title="No diagnostic reports"
                text="Upload laboratory results, scans, and documents using Upload Reports."
              />
            ) : (
              <div className="dp-reports-grid">
                {reports.map((report, idx) => (
                  <div key={idx} className="dp-report-card">
                    <div className="dp-report-icon-box">
                      <FaFileMedical />
                    </div>
                    <div className="dp-report-details">
                      <h4>{report.name || "Medical Report"}</h4>
                      <p>
                        {report.slotDate
                          ? `Appointment on ${report.slotDate}`
                          : "Attached report"}
                      </p>
                    </div>
                    {report.url && (
                      <a
                        href={report.url}
                        target="_blank"
                        rel="noreferrer"
                        className="dp-btn dp-btn-outline dp-btn-sm"
                      >
                        Download / View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* 6. Timeline Tab */}
        {activeTab === "timeline" && (
          <Panel title="Patient Health History Timeline">
            {timeline.length === 0 ? (
              <EmptyState
                title="No events in timeline"
                text="Historical health events will appear here as appointments and records are added."
              />
            ) : (
              <div className="dp-timeline-container">
                {timeline.map((event, idx) => (
                  <div key={idx} className={`dp-timeline-item ${event.type}`}>
                    <div className="dp-timeline-marker" />
                    <div className="dp-timeline-content">
                      <span className="dp-timeline-time">
                        {new Date(event.date).toLocaleString("en-IN")}
                      </span>
                      <h4>{event.title}</h4>
                      <p>{event.description}</p>
                      {event.url && (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noreferrer"
                          className="dp-timeline-link"
                        >
                          View Attachment
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function PatientsView({ patients }) {
  if (!patients || !patients.length) {
    return (
      <Panel title="Patients">
        <EmptyState
          title="No patients yet"
          text="Patients appear after appointments are booked."
        />
      </Panel>
    );
  }
  return (
    <Panel title="Patients">
      <div className="dp-card-grid">
        {patients.map((patient) => (
          <Link
            className="dp-patient-card"
            to={`/patients/${patient._id}`}
            key={patient._id}
          >
            <strong>{patient.name || "Patient"}</strong>
            <span>
              {patient.email || patient.phone || "Contact unavailable"}
            </span>
            <small>{patient.appointments?.length || 0} appointments</small>
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function PatientDetailsView({ patient }) {
  const patientImage = imageSource(
    patient.image || patient.hdProfilePicture || "",
  );
  const patientInitials = (patient.name || "Patient")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const age = patient.dob
    ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
    : null;
  const totalSpent = (patient.appointments || []).reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const completedCount = (patient.appointments || []).filter(
    (item) => item.status === "completed",
  ).length;
  return (
    <Panel title="Patient Details">
      <div className="dp-report-toolbar">
        <button
          type="button"
          className="dp-report-btn"
          onClick={() =>
            openPrintWindow(
              `Patient: ${patient.name || "Patient"} — HealPoint`,
              patientReportLines(patient),
            )
          }
        >
          <FaPrint /> Print
        </button>
        <button
          type="button"
          className="dp-report-btn"
          onClick={() =>
            buildPdf(
              `Patient Report — ${patient.name || "Patient"}`,
              patientReportLines(patient),
              `patient-${patient._id || Date.now()}.pdf`,
            )
          }
        >
          <FaFilePdf /> Download PDF
        </button>
      </div>
      <div className="dp-patient-profile">
        {patientImage ? (
          <img
            className="dp-patient-avatar-lg"
            src={patientImage}
            alt={patient.name || "Patient"}
          />
        ) : (
          <div className="dp-patient-avatar-lg dp-patient-avatar-fallback">
            {patientInitials}
          </div>
        )}
        <div className="dp-patient-profile-info">
          <h3>{patient.name || "Patient"}</h3>
          <span>{patient.email || patient.phone || "Contact unavailable"}</span>
          <small>
            {patient.gender || "Gender unavailable"}
            {age ? ` · ${age} yrs` : ""}
          </small>
        </div>
      </div>
      <div className="dp-detail-grid">
        <Info label="Name" value={patient.name} />
        <Info label="Email" value={patient.email} />
        <Info label="Phone" value={patient.phone} />
        <Info label="Gender" value={patient.gender || "Not specified"} />
        {age ? <Info label="Age" value={`${age} yrs`} /> : null}
        <Info label="Appointments" value={patient.appointments?.length || 0} />
        <Info label="Completed" value={completedCount} />
        <Info label="Total spent" value={`₹${totalSpent}`} />
      </div>
      <h3>Appointment History</h3>
      <AppointmentList appointments={patient.appointments || []} compact />
      <ReportsList
        reports={(patient.appointments || []).flatMap(
          (item) => item.medicalReports || [],
        )}
      />
    </Panel>
  );
}

/* ==========================================================================
   PART 3: CONSULTATION WORKSPACE VIEW (PRODUCTION CLINICAL WORKSPACE)
   ========================================================================== */
function ConsultationWorkspaceView({
  doctorId,
  appointmentId,
  doctor,
  onComplete,
}) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [duration, setDuration] = useState(0);

  // Vitals State
  const [vitals, setVitals] = useState({
    bloodPressure: "",
    heartRate: "",
    temperature: "",
    respiratoryRate: "",
    spO2: "",
    weight: "",
    height: "",
    bmi: "",
  });

  // Clinical Notes State
  const [clinicalNotes, setClinicalNotes] = useState({
    chiefComplaint: "",
    symptoms: "",
    historyOfPresentIllness: "",
    examination: "",
    clinicalFindings: "",
    assessment: "",
    treatmentPlan: "",
    additionalNotes: "",
  });

  const [diagnosis, setDiagnosis] = useState("");
  const [followUpAdvice, setFollowUpAdvice] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [prescription, setPrescription] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");

  // Video Consultation (Google Meet) State & Handlers
  const [meetLinkInput, setMeetLinkInput] = useState("");
  const [meetLinkEditing, setMeetLinkEditing] = useState(false);
  const [meetActionLoading, setMeetActionLoading] = useState(false);

  const handleStartVideoConsultation = async () => {
    const meetingUrl = data?.appointment?.meetingUrl;
    if (!meetingUrl) {
      toast.error(
        "Please add a Google Meet link before starting video consultation",
      );
      return;
    }
    setMeetActionLoading(true);
    try {
      await api.patch(
        `/api/v1/consultation/doctor/${doctorId}/status/${appointmentId}`,
        { consultationStatus: "in_progress" },
      );
      setData((prev) => ({
        ...prev,
        appointment: {
          ...prev.appointment,
          consultationStatus: "in_progress",
          meetingStatus: "started",
          consultationStartedAt:
            prev.appointment?.consultationStartedAt || new Date(),
        },
      }));
      toast.success("Consultation started! Google Meet opened in a new tab.");
      window.open(meetingUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to start consultation",
      );
    } finally {
      setMeetActionLoading(false);
    }
  };

  const handleSaveMeetLink = async () => {
    const trimmed = meetLinkInput.trim();
    const GOOGLE_MEET_URL_REGEX =
      /^https:\/\/(meet\.)?google\.com\/[a-z0-9][a-z0-9-]{2,}(\?[a-zA-Z0-9=&_.-]*)?$/i;
    if (!GOOGLE_MEET_URL_REGEX.test(trimmed)) {
      toast.error(
        "Please enter a valid Google Meet URL (e.g. https://meet.google.com/abc-defg-hij)",
      );
      return;
    }
    setMeetActionLoading(true);
    try {
      const res = await api.post(
        `/api/v1/consultation/doctor/${doctorId}/meeting-link/${appointmentId}`,
        { meetingUrl: trimmed },
      );
      if (res.data?.success) {
        toast.success("Google Meet link saved successfully!");
        setData((prev) => ({
          ...prev,
          appointment: {
            ...prev.appointment,
            meetingUrl: trimmed,
            meetingStatus: "ready",
          },
        }));
        setMeetLinkEditing(false);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save Google Meet link",
      );
    } finally {
      setMeetActionLoading(false);
    }
  };

  const handleRemoveMeetLink = async () => {
    if (!window.confirm("Remove Google Meet link for this consultation?"))
      return;
    setMeetActionLoading(true);
    try {
      await api.delete(
        `/api/v1/consultation/doctor/${doctorId}/meeting-link/${appointmentId}`,
      );
      toast.success("Google Meet link removed");
      setData((prev) => ({
        ...prev,
        appointment: {
          ...prev.appointment,
          meetingUrl: "",
          meetingStatus: "not_created",
        },
      }));
      setMeetLinkInput("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove link");
    } finally {
      setMeetActionLoading(false);
    }
  };

  const fetchConsultation = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/consultation/${appointmentId}`,
      );
      if (res.data?.success) {
        setData(res.data);
        const apt = res.data.appointment || {};
        if (apt.vitals) {
          setVitals({
            bloodPressure: apt.vitals.bloodPressure || "",
            heartRate: apt.vitals.heartRate || "",
            temperature: apt.vitals.temperature || "",
            respiratoryRate: apt.vitals.respiratoryRate || "",
            spO2: apt.vitals.spO2 || "",
            weight: apt.vitals.weight || "",
            height: apt.vitals.height || "",
            bmi: apt.vitals.bmi || "",
          });
        }
        if (apt.clinicalNotes) {
          setClinicalNotes({
            chiefComplaint: apt.clinicalNotes.chiefComplaint || "",
            symptoms: apt.clinicalNotes.symptoms || "",
            historyOfPresentIllness:
              apt.clinicalNotes.historyOfPresentIllness || "",
            examination: apt.clinicalNotes.examination || "",
            clinicalFindings: apt.clinicalNotes.clinicalFindings || "",
            assessment: apt.clinicalNotes.assessment || "",
            treatmentPlan: apt.clinicalNotes.treatmentPlan || "",
            additionalNotes: apt.clinicalNotes.additionalNotes || "",
          });
        }
        setDiagnosis(apt.diagnosis || "");
        setFollowUpAdvice(apt.followUpAdvice || "");
        setPrescription(apt.prescription || "");
        setMedicalNotes(apt.medicalNotes || "");

        if (apt.consultationStartedAt) {
          const elapsed = Math.floor(
            (Date.now() - new Date(apt.consultationStartedAt).getTime()) / 1000,
          );
          setDuration(Math.max(0, elapsed));
        }
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load consultation context",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultation();
  }, [doctorId, appointmentId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVitalsChange = (field, value) => {
    const updated = { ...vitals, [field]: value };
    const w = Number(field === "weight" ? value : updated.weight);
    const h = Number(field === "height" ? value : updated.height);
    if (w > 0 && h > 0) {
      updated.bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
    } else {
      updated.bmi = "";
    }
    setVitals(updated);
  };

  const formatDuration = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")} min`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const combinedAdvice = [
        followUpAdvice,
        followUpDate ? `Follow-up on: ${followUpDate}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await api.put(
        `/api/v1/doctor/panel/${doctorId}/consultation/${appointmentId}/save`,
        {
          vitals,
          clinicalNotes,
          diagnosis,
          followUpAdvice: combinedAdvice,
          prescription,
          medicalNotes,
        },
      );
      if (res.data?.success) {
        toast.success("Consultation progress saved");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error saving consultation");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    const effectiveDiagnosis = diagnosis.trim();
    const effectiveAssessment = clinicalNotes.assessment.trim();
    const effectiveComplaint = clinicalNotes.chiefComplaint.trim();
    const effectiveNotes = medicalNotes.trim();

    if (
      !effectiveDiagnosis &&
      !effectiveAssessment &&
      !effectiveComplaint &&
      !effectiveNotes
    ) {
      return toast.error(
        "Please enter at least a Diagnosis or Clinical Assessment before completing consultation",
      );
    }

    setCompleting(true);
    try {
      const combinedAdvice = [
        followUpAdvice,
        followUpDate ? `Follow-up on: ${followUpDate}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await api.post(
        `/api/v1/doctor/panel/${doctorId}/consultation/${appointmentId}/complete`,
        {
          vitals,
          clinicalNotes,
          diagnosis: effectiveDiagnosis,
          followUpAdvice: combinedAdvice,
          prescription,
          medicalNotes,
        },
      );
      if (res.data?.success) {
        toast.success("Consultation completed successfully!");
        if (onComplete) onComplete();
        else navigate("/queue");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Error completing consultation",
      );
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return <div className="dp-loading">Loading consultation workspace...</div>;
  }

  if (!data?.appointment) {
    return (
      <div className="dp-empty">
        <FaExclamationTriangle size={36} color="#ef4444" />
        <strong>Consultation Record Not Found</strong>
        <p>
          The requested appointment record could not be found or is
          unauthorized.
        </p>
        <Link to="/queue" className="dp-btn dp-btn-primary">
          Return to Queue
        </Link>
      </div>
    );
  }

  const apt = data.appointment;
  const patient = data.patient || apt.userId || {};
  const patientAvatar = imageSource(patient.image || "");
  const patientInitials = (patient.name || "Patient")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const patientAge = patient.dob
    ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
    : null;

  return (
    <div className="dp-consultation-workspace">
      {/* Top Clinical Header Bar */}
      <div className="dp-consult-header-bar">
        <div className="dp-ch-left">
          <Link to="/queue" className="dp-btn-back" title="Back to OPD Queue">
            <FaChevronLeft /> Back to Queue
          </Link>
          <div className="dp-ch-patient-meta">
            <h2>{patient.name || "Patient"}</h2>
            <div className="dp-ch-tags">
              <span className="dp-id-badge">
                APT: {apt.displayAppointmentId || apt.appointmentId || apt._id}
              </span>
              {patientAge ? (
                <span className="dp-meta-chip">{patientAge} yrs</span>
              ) : null}
              {patient.gender ? (
                <span className="dp-meta-chip">{patient.gender}</span>
              ) : null}
              {patient.bloodGroup ? (
                <span className="dp-blood-chip">🩸 {patient.bloodGroup}</span>
              ) : null}
              <span className="dp-type-chip">
                {apt.consultationType === "video" ? (
                  <>
                    <FaVideo /> Video Consultation
                  </>
                ) : (
                  <>
                    <FaHospital /> In-Clinic
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="dp-ch-right">
          <div className="dp-ch-timer-badge">
            <span className="dp-pulse-dot green" />
            <span>Consultation Active:</span>
            <strong>{formatDuration(duration)}</strong>
          </div>
          <button
            type="button"
            className="dp-btn dp-btn-secondary"
            onClick={handleSave}
            disabled={saving || completing}
          >
            <FaSave /> {saving ? "Saving..." : "Save Progress"}
          </button>
          <button
            type="button"
            className="dp-btn dp-btn-emerald"
            onClick={handleComplete}
            disabled={saving || completing}
          >
            <FaCheckCircle />{" "}
            {completing ? "Completing..." : "Complete Consultation"}
          </button>
        </div>
      </div>

      {/* Two-Column Clinical Workspace Grid */}
      <div className="dp-consult-workspace-grid">
        {/* Main Left: Structured Clinical Notes & Forms */}
        <div className="dp-consult-main">
          {/* Video Consultation (Google Meet) Action Card */}
          {apt.consultationType === "video" && (
            <div
              className="dp-consult-card dp-meet-card"
              style={{
                border: "2px solid #0284c7",
                background: "linear-gradient(to right, #f0f9ff, #ffffff)",
              }}
            >
              <div
                className="dp-card-head"
                style={{
                  borderBottom: "1px solid #bae6fd",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <div
                    style={{
                      backgroundColor: "#0284c7",
                      color: "#fff",
                      padding: "10px",
                      borderRadius: "10px",
                      display: "flex",
                    }}
                  >
                    <FaVideo size={20} />
                  </div>
                  <div>
                    <h3
                      style={{
                        color: "#0369a1",
                        margin: 0,
                        fontSize: "1.15rem",
                        fontWeight: "700",
                      }}
                    >
                      Google Meet Online Consultation
                    </h3>
                    <span className="dp-card-hint" style={{ color: "#0284c7" }}>
                      Real-time video consultation with{" "}
                      {patient.name || "Patient"}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    className={`dp-meet-status-badge ${apt.meetingUrl ? (apt.consultationStatus === "in_progress" ? "in-progress" : "ready") : "pending"}`}
                  >
                    {apt.meetingStatus === "completed" ||
                    apt.consultationStatus === "completed"
                      ? "Completed"
                      : apt.consultationStatus === "in_progress"
                        ? "● In Progress"
                        : apt.meetingUrl
                          ? "Meeting Ready"
                          : "Link Required"}
                  </span>
                  {apt.meetingUrl && !meetLinkEditing && (
                    <button
                      type="button"
                      className="dp-btn-view"
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        setMeetLinkInput(apt.meetingUrl || "");
                        setMeetLinkEditing(true);
                      }}
                    >
                      <FaEdit /> Edit Link
                    </button>
                  )}
                </div>
              </div>

              <div style={{ padding: "20px" }}>
                {apt.meetingUrl && !meetLinkEditing ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "12px",
                        background: "#fff",
                        padding: "14px 18px",
                        borderRadius: "12px",
                        border: "1px solid #e0f2fe",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <small
                          style={{
                            display: "block",
                            color: "#64748b",
                            textTransform: "uppercase",
                            fontSize: "0.75rem",
                            fontWeight: "600",
                          }}
                        >
                          Active Google Meet URL
                        </small>
                        <a
                          href={apt.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "#0284c7",
                            fontWeight: "600",
                            fontSize: "0.95rem",
                            wordBreak: "break-all",
                            textDecoration: "none",
                          }}
                        >
                          {apt.meetingUrl}
                        </a>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="dp-btn dp-btn-secondary"
                          style={{ padding: "8px 14px", fontSize: "0.85rem" }}
                          onClick={() => {
                            navigator.clipboard.writeText(apt.meetingUrl);
                            toast.success("Meeting link copied to clipboard");
                          }}
                        >
                          Copy Link
                        </button>

                        <button
                          type="button"
                          className="dp-btn"
                          style={{
                            backgroundColor:
                              apt.consultationStatus === "completed"
                                ? "#64748b"
                                : "#0284c7",
                            color: "#fff",
                            padding: "10px 22px",
                            fontWeight: "700",
                            fontSize: "0.95rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                            cursor:
                              apt.consultationStatus === "completed"
                                ? "not-allowed"
                                : "pointer",
                          }}
                          disabled={
                            meetActionLoading ||
                            apt.consultationStatus === "completed"
                          }
                          onClick={handleStartVideoConsultation}
                        >
                          <FaVideo />
                          {apt.consultationStatus === "in_progress"
                            ? "Re-open Google Meet"
                            : apt.consultationStatus === "completed"
                              ? "Meeting Finished"
                              : "Start Consultation"}
                        </button>
                      </div>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        color: "#0369a1",
                      }}
                    >
                      💡 <strong>Clinical Guidance:</strong> Clicking{" "}
                      <em>Start Consultation</em> updates the consultation state
                      to <code>in_progress</code>, records start time, and opens
                      Google Meet in a new tab. When finished, return here to
                      complete clinical notes, vitals, and digital
                      prescriptions.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        background: "#fffbeb",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        fontSize: "0.9rem",
                      }}
                    >
                      <strong>
                        {apt.meetingUrl
                          ? "Update Google Meet Link"
                          : "Google Meet Link Required"}
                      </strong>
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "0.85rem",
                          color: "#b45309",
                        }}
                      >
                        Enter the real Google Meet room link for this patient
                        (e.g. <code>https://meet.google.com/abc-defg-hij</code>
                        ). Both you and the patient will join through this exact
                        URL.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="url"
                        placeholder="https://meet.google.com/xxx-yyyy-zzz"
                        value={meetLinkInput}
                        onChange={(e) => setMeetLinkInput(e.target.value)}
                        style={{
                          flex: 1,
                          minWidth: "260px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #94a3b8",
                          fontSize: "0.95rem",
                        }}
                      />
                      <button
                        type="button"
                        className="dp-btn dp-btn-primary"
                        style={{ padding: "10px 20px" }}
                        disabled={meetActionLoading}
                        onClick={handleSaveMeetLink}
                      >
                        <FaSave />{" "}
                        {meetActionLoading ? "Saving..." : "Save Meet Link"}
                      </button>
                      {meetLinkEditing && (
                        <button
                          type="button"
                          className="dp-btn dp-btn-secondary"
                          style={{ padding: "10px 16px" }}
                          onClick={() => setMeetLinkEditing(false)}
                        >
                          Cancel
                        </button>
                      )}
                      {apt.meetingUrl && (
                        <button
                          type="button"
                          className="dp-btn-danger"
                          style={{ padding: "10px 16px" }}
                          disabled={meetActionLoading}
                          onClick={handleRemoveMeetLink}
                        >
                          Remove Link
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 1. Patient Vitals Section */}
          <div className="dp-consult-card">
            <div className="dp-card-head">
              <h3>
                <FaHeartbeat color="#0d9488" /> Patient Vitals Entry
              </h3>
              <span className="dp-card-hint">
                Record vital measurements for this consultation
              </span>
            </div>
            <div className="dp-vitals-form-grid">
              <label>
                <span>Blood Pressure (mmHg)</span>
                <input
                  type="text"
                  placeholder="e.g. 120/80"
                  value={vitals.bloodPressure}
                  onChange={(e) =>
                    setVitals({ ...vitals, bloodPressure: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Heart Rate (bpm)</span>
                <input
                  type="number"
                  placeholder="60 - 100"
                  value={vitals.heartRate}
                  onChange={(e) =>
                    setVitals({ ...vitals, heartRate: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Temperature (°F)</span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="98.6"
                  value={vitals.temperature}
                  onChange={(e) =>
                    setVitals({ ...vitals, temperature: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Respiratory Rate (breaths/min)</span>
                <input
                  type="number"
                  placeholder="12 - 20"
                  value={vitals.respiratoryRate}
                  onChange={(e) =>
                    setVitals({ ...vitals, respiratoryRate: e.target.value })
                  }
                />
              </label>
              <label>
                <span>SpO2 Oxygen Saturation (%)</span>
                <input
                  type="number"
                  placeholder="95 - 100"
                  value={vitals.spO2}
                  onChange={(e) =>
                    setVitals({ ...vitals, spO2: e.target.value })
                  }
                />
              </label>
              <label>
                <span>Weight (kg)</span>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 70"
                  value={vitals.weight}
                  onChange={(e) => handleVitalsChange("weight", e.target.value)}
                />
              </label>
              <label>
                <span>Height (cm)</span>
                <input
                  type="number"
                  placeholder="e.g. 175"
                  value={vitals.height}
                  onChange={(e) => handleVitalsChange("height", e.target.value)}
                />
              </label>
              <div className="dp-bmi-box">
                <span>Calculated BMI</span>
                <div className="dp-bmi-display">
                  <strong>{vitals.bmi || "--"}</strong>
                  {vitals.bmi && (
                    <span
                      className={`dp-bmi-chip ${
                        Number(vitals.bmi) < 18.5
                          ? "underweight"
                          : Number(vitals.bmi) <= 24.9
                            ? "normal"
                            : Number(vitals.bmi) <= 29.9
                              ? "overweight"
                              : "obese"
                      }`}
                    >
                      {Number(vitals.bmi) < 18.5
                        ? "Underweight"
                        : Number(vitals.bmi) <= 24.9
                          ? "Normal"
                          : Number(vitals.bmi) <= 29.9
                            ? "Overweight"
                            : "Obese"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. Structured Clinical Notes Section */}
          <div className="dp-consult-card">
            <div className="dp-card-head">
              <h3>
                <FaNotesMedical color="#0284c7" /> Structured Clinical Notes
              </h3>
              <span className="dp-card-hint">
                Clinical examination, symptoms, and findings
              </span>
            </div>
            <div className="dp-clinical-fields-grid">
              <label className="dp-full-width">
                <span>Chief Complaint</span>
                <input
                  type="text"
                  placeholder="e.g. Throat irritation and mild fever for 2 days"
                  value={clinicalNotes.chiefComplaint}
                  onChange={(e) =>
                    setClinicalNotes({
                      ...clinicalNotes,
                      chiefComplaint: e.target.value,
                    })
                  }
                />
              </label>
              <label className="dp-full-width">
                <span>Symptoms & History of Present Illness (HPI)</span>
                <textarea
                  rows={3}
                  placeholder="Detailed symptoms, onset, duration, aggravating factors..."
                  value={clinicalNotes.symptoms}
                  onChange={(e) =>
                    setClinicalNotes({
                      ...clinicalNotes,
                      symptoms: e.target.value,
                    })
                  }
                />
              </label>
              <label className="dp-full-width">
                <span>Examination & Clinical Findings</span>
                <textarea
                  rows={3}
                  placeholder="Physical exam findings, throat examination, chest auscultation, lymph nodes..."
                  value={clinicalNotes.examination}
                  onChange={(e) =>
                    setClinicalNotes({
                      ...clinicalNotes,
                      examination: e.target.value,
                    })
                  }
                />
              </label>
              <label className="dp-full-width">
                <span>Clinical Assessment & Discussion</span>
                <textarea
                  rows={2}
                  placeholder="Doctor assessment, differential diagnosis, risk factors..."
                  value={clinicalNotes.assessment}
                  onChange={(e) =>
                    setClinicalNotes({
                      ...clinicalNotes,
                      assessment: e.target.value,
                    })
                  }
                />
              </label>
            </div>
          </div>

          {/* 3. Diagnosis & Treatment Plan */}
          <div className="dp-consult-card">
            <div className="dp-card-head">
              <h3>
                <FaStethoscope color="#7c3aed" /> Diagnosis & Treatment Plan
              </h3>
              <span className="dp-card-hint">
                Primary diagnosis and clinical treatment recommendations
              </span>
            </div>
            <div className="dp-clinical-fields-grid">
              <label className="dp-full-width">
                <span style={{ fontWeight: 700 }}>
                  Primary Diagnosis <span style={{ color: "#ef4444" }}>*</span>
                </span>
                <input
                  type="text"
                  className="dp-input-highlight"
                  placeholder="e.g. Acute Upper Respiratory Tract Infection (URTI) / Acute Pharyngitis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                />
              </label>
              <label className="dp-full-width">
                <span>Treatment Plan & Clinical Advice</span>
                <textarea
                  rows={3}
                  placeholder="Dietary recommendations, hydration, rest, lifestyle measures..."
                  value={clinicalNotes.treatmentPlan}
                  onChange={(e) =>
                    setClinicalNotes({
                      ...clinicalNotes,
                      treatmentPlan: e.target.value,
                    })
                  }
                />
              </label>
              <div className="dp-two-col">
                <label>
                  <span>Follow-Up Date</span>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                </label>
                <label>
                  <span>Follow-Up Advice / Instructions</span>
                  <input
                    type="text"
                    placeholder="e.g. Review if fever persists beyond 3 days"
                    value={followUpAdvice}
                    onChange={(e) => setFollowUpAdvice(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 4. Digital Prescription Integration */}
          <div className="dp-consult-card">
            <div className="dp-card-head">
              <div>
                <h3>
                  <FaFileMedical color="#2563eb" /> Prescription & Medications
                </h3>
                <span className="dp-card-hint">
                  Prescribe medications with dosage and instructions
                </span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                <Link
                  to={`/prescriptions?appointmentId=${appointmentId}`}
                  className="dp-btn dp-btn-secondary dp-btn-sm"
                  title="Open dedicated digital prescription editor"
                >
                  <FaNotesMedical /> Digital Rx Studio
                </Link>
                <Link
                  to={`/upload-reports?appointmentId=${appointmentId}`}
                  className="dp-btn dp-btn-outline dp-btn-sm"
                  title="Upload diagnostic report for this consultation"
                >
                  <FaUpload /> Upload Report
                </Link>
              </div>
            </div>
            <label className="dp-full-width">
              <span>Prescription Items & Instructions</span>
              <textarea
                rows={5}
                className="dp-prescription-textarea"
                placeholder="1. Tab. Paracetamol 650mg — 1 tablet thrice daily after meals for 3 days&#10;2. Tab. Cetirizine 10mg — 1 tablet at night for 5 days&#10;3. Saline nasal drops — 2 drops each nostril twice daily"
                value={prescription}
                onChange={(e) => setPrescription(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Right Sidebar: Sticky Patient Snapshot & Medical History Context */}
        <aside className="dp-consult-sidebar">
          {/* Patient Demographic Card */}
          <div className="dp-snapshot-card">
            <div className="dp-sc-top">
              {patientAvatar ? (
                <img
                  src={patientAvatar}
                  alt={patient.name}
                  className="dp-sc-avatar"
                />
              ) : (
                <div className="dp-sc-avatar dp-avatar-fallback">
                  {patientInitials}
                </div>
              )}
              <div>
                <h4>{patient.name}</h4>
                <p>{patient.phone || patient.email || "No contact info"}</p>
                <div className="dp-sc-badges">
                  {patient.bloodGroup ? (
                    <span className="dp-blood-badge">
                      🩸 {patient.bloodGroup}
                    </span>
                  ) : null}
                  <span className="dp-visit-badge">
                    {data.totalVisits} Total Visits
                  </span>
                </div>
              </div>
            </div>

            {/* Prominent Allergies Alert */}
            <div className="dp-sc-alert-section">
              <span className="dp-sc-section-title text-rose">
                <FaExclamationTriangle /> Allergies
              </span>
              {patient.allergies?.length ? (
                <div className="dp-tags-wrap">
                  {patient.allergies.map((allergy, i) => (
                    <span key={i} className="dp-allergy-tag">
                      {allergy}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="dp-sc-empty-text">
                  No drug/food allergies recorded
                </p>
              )}
            </div>

            {/* Chronic Conditions */}
            <div className="dp-sc-alert-section">
              <span className="dp-sc-section-title text-amber">
                <FaNotesMedical /> Chronic Conditions
              </span>
              {patient.chronicConditions?.length ? (
                <div className="dp-tags-wrap">
                  {patient.chronicConditions.map((cond, i) => (
                    <span key={i} className="dp-condition-tag">
                      {cond}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="dp-sc-empty-text">
                  No chronic conditions recorded
                </p>
              )}
            </div>

            {/* Previous Vitals Snapshot */}
            <div className="dp-sc-section">
              <span className="dp-sc-section-title">
                <FaHeartbeat /> Last Recorded Vitals
              </span>
              {data.previousVitals?.[0]?.vitals ? (
                <div className="dp-sc-vitals-box">
                  <div className="dp-sc-vital-item">
                    <span>BP:</span>
                    <strong>
                      {data.previousVitals[0].vitals.bloodPressure || "--"}
                    </strong>
                  </div>
                  <div className="dp-sc-vital-item">
                    <span>HR:</span>
                    <strong>
                      {data.previousVitals[0].vitals.heartRate
                        ? `${data.previousVitals[0].vitals.heartRate} bpm`
                        : "--"}
                    </strong>
                  </div>
                  <div className="dp-sc-vital-item">
                    <span>Temp:</span>
                    <strong>
                      {data.previousVitals[0].vitals.temperature
                        ? `${data.previousVitals[0].vitals.temperature}°F`
                        : "--"}
                    </strong>
                  </div>
                  <div className="dp-sc-vital-item">
                    <span>BMI:</span>
                    <strong>{data.previousVitals[0].vitals.bmi || "--"}</strong>
                  </div>
                  <small className="dp-sc-date">
                    Recorded: {data.previousVitals[0].date}
                  </small>
                </div>
              ) : (
                <p className="dp-sc-empty-text">No previous vitals on record</p>
              )}
            </div>

            {/* Previous Consultation Summary */}
            <div className="dp-sc-section">
              <span className="dp-sc-section-title">
                <FaHistory /> Last Consultation
              </span>
              {data.previousConsultationSummary ? (
                <div className="dp-sc-last-consult">
                  <strong>{data.previousConsultationSummary.diagnosis}</strong>
                  <p>
                    {data.previousConsultationSummary.notes ||
                      "Routine examination"}
                  </p>
                  <small>
                    Visit Date: {data.previousConsultationSummary.date}
                  </small>
                </div>
              ) : (
                <p className="dp-sc-empty-text">First visit with this doctor</p>
              )}
            </div>

            {/* Quick Links */}
            <div className="dp-sc-footer">
              <Link
                to={`/medical-history/${patient._id}`}
                target="_blank"
                className="dp-btn dp-btn-outline dp-btn-full"
              >
                <FaFolderOpen /> Open Complete EMR Record
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ==========================================================================
   PART 3: MEDICAL HISTORY / EMR HUB (ENTERPRISE PATIENT RECORD)
   ========================================================================== */
function MedicalHistoryEMRView({ doctorId, initialPatientId, doctor }) {
  const [selectedPatientId, setSelectedPatientId] = useState(
    initialPatientId || null,
  );
  const [patients, setPatients] = useState([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [emrData, setEmrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Edit Clinical Profile Modal state
  const [profileModal, setProfileModal] = useState({
    isOpen: false,
    bloodGroup: "",
    allergies: "",
    chronicConditions: "",
    saving: false,
  });

  // Fetch patient roster for selector
  useEffect(() => {
    const fetchPatientsList = async () => {
      try {
        const res = await api.get(`/api/v1/doctor/panel/${doctorId}/patients`, {
          params: { limit: 100 },
        });
        if (res.data?.success) {
          setPatients(res.data.patients || []);
        }
      } catch (err) {
        console.error("Failed to load patients for EMR", err);
      }
    };
    if (doctorId) fetchPatientsList();
  }, [doctorId]);

  // Load EMR for selected patient
  const fetchEMR = async (patientId) => {
    if (!patientId || !doctorId) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/emr/${patientId}`,
      );
      if (res.data?.success) {
        setEmrData(res.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load patient EMR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      fetchEMR(selectedPatientId);
    } else {
      setLoading(false);
    }
  }, [doctorId, selectedPatientId]);

  // Handle saving clinical profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileModal((prev) => ({ ...prev, saving: true }));
    try {
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/emr/${selectedPatientId}/clinical-profile`,
        {
          bloodGroup: profileModal.bloodGroup,
          allergies: profileModal.allergies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          chronicConditions: profileModal.chronicConditions
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        },
      );
      if (res.data?.success) {
        toast.success("Patient clinical profile updated");
        setProfileModal((prev) => ({ ...prev, isOpen: false, saving: false }));
        fetchEMR(selectedPatientId);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Error updating clinical profile",
      );
      setProfileModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const openProfileModal = () => {
    const patient = emrData?.patient || {};
    setProfileModal({
      isOpen: true,
      bloodGroup: patient.bloodGroup || "",
      allergies: (patient.allergies || []).join(", "),
      chronicConditions: (patient.chronicConditions || []).join(", "),
      saving: false,
    });
  };

  // Filtered patients for selector
  const filteredPatients = patients.filter((p) => {
    const query = patientSearch.toLowerCase();
    return (
      (p.name || "").toLowerCase().includes(query) ||
      (p.email || "").toLowerCase().includes(query) ||
      (p.phone || "").includes(query)
    );
  });

  // Print EMR Summary handler
  const handlePrintEMR = () => {
    window.print();
  };

  /* View 1: Patient Selector (when no patient selected) */
  if (!selectedPatientId) {
    return (
      <div className="dp-emr-hub-container">
        <div className="dp-emr-hub-header">
          <div>
            <h2>
              <FaHistory color="#0d9488" /> Electronic Medical Record (EMR) Hub
            </h2>
            <p>
              Select a patient from your clinical roster to access their
              comprehensive medical records
            </p>
          </div>
          <div className="dp-emr-search-box">
            <FaSearch />
            <input
              type="text"
              placeholder="Search patients by name, phone, or email..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div className="dp-empty">
            <FaUserInjured size={40} color="#94a3b8" />
            <strong>No Patients Found</strong>
            <p>No patients under your care matched your search query.</p>
          </div>
        ) : (
          <div className="dp-emr-patient-grid">
            {filteredPatients.map((p) => {
              const avatar = imageSource(p.image || "");
              const initials = (p.name || "Patient")
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const age = p.dob
                ? new Date().getFullYear() - new Date(p.dob).getFullYear()
                : null;

              return (
                <div key={p._id} className="dp-emr-patient-card">
                  <div className="dp-epc-top">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={p.name}
                        className="dp-epc-avatar"
                      />
                    ) : (
                      <div className="dp-epc-avatar dp-avatar-fallback">
                        {initials}
                      </div>
                    )}
                    <div>
                      <h4>{p.name}</h4>
                      <p>{p.phone || p.email || "No contact info"}</p>
                      <div className="dp-epc-tags">
                        {age ? (
                          <span className="dp-meta-chip">{age} yrs</span>
                        ) : null}
                        {p.gender ? (
                          <span className="dp-meta-chip">{p.gender}</span>
                        ) : null}
                        {p.bloodGroup ? (
                          <span className="dp-blood-chip">
                            🩸 {p.bloodGroup}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="dp-epc-stats">
                    <div className="dp-epc-stat">
                      <span>Total Visits</span>
                      <strong>{p.totalVisits || 0}</strong>
                    </div>
                    <div className="dp-epc-stat">
                      <span>Last Visit</span>
                      <strong>{p.lastVisitDate || "N/A"}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="dp-btn dp-btn-primary dp-btn-full"
                    onClick={() => setSelectedPatientId(p._id)}
                  >
                    <FaFolderOpen /> Open EMR Record
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  /* View 2: Full Patient EMR Record */
  if (loading) {
    return (
      <div className="dp-loading">Loading comprehensive patient EMR...</div>
    );
  }

  if (!emrData?.patient) {
    return (
      <div className="dp-empty">
        <FaExclamationTriangle size={36} color="#ef4444" />
        <strong>Patient EMR Not Found</strong>
        <p>Could not retrieve medical records for this patient.</p>
        <button
          type="button"
          className="dp-btn dp-btn-primary"
          onClick={() => setSelectedPatientId(null)}
        >
          Return to Patient Selector
        </button>
      </div>
    );
  }

  const {
    patient,
    overview,
    consultations,
    diagnoses,
    vitalsHistory,
    prescriptions,
    reports,
    timeline,
  } = emrData;
  const avatar = imageSource(patient.image || "");
  const initials = (patient.name || "Patient")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const age = patient.dob
    ? new Date().getFullYear() - new Date(patient.dob).getFullYear()
    : null;

  return (
    <div className="dp-emr-container">
      {/* Patient EMR Header */}
      <div className="dp-emr-header-card">
        <div className="dp-emr-header-top">
          <div className="dp-emr-patient-info">
            {avatar ? (
              <img src={avatar} alt={patient.name} className="dp-emr-avatar" />
            ) : (
              <div className="dp-emr-avatar dp-avatar-fallback">{initials}</div>
            )}
            <div>
              <div className="dp-emr-name-row">
                <h2>{patient.name}</h2>
                <span className="dp-id-badge">
                  PID: {patient._id?.slice(-8).toUpperCase()}
                </span>
                {patient.bloodGroup ? (
                  <span className="dp-blood-badge">
                    🩸 {patient.bloodGroup}
                  </span>
                ) : null}
              </div>
              <div className="dp-emr-contact-row">
                {patient.phone ? (
                  <span>
                    <FaPhoneAlt /> {patient.phone}
                  </span>
                ) : null}
                {patient.email ? (
                  <span>
                    <FaEnvelope /> {patient.email}
                  </span>
                ) : null}
                {age ? <span>{age} years old</span> : null}
                {patient.gender ? <span>{patient.gender}</span> : null}
                <span className="dp-hospital-badge">
                  <FaHospital /> {doctor?.hospitalName || "Hospital"}
                </span>
              </div>
            </div>
          </div>

          <div className="dp-emr-header-actions">
            <button
              type="button"
              className="dp-btn dp-btn-secondary"
              onClick={() => setSelectedPatientId(null)}
            >
              <FaChevronLeft /> Switch Patient
            </button>
            <button
              type="button"
              className="dp-btn dp-btn-outline"
              onClick={() => fetchEMR(selectedPatientId)}
              disabled={loading}
              title="Refresh EMR record from server"
            >
              <FaSyncAlt className={loading ? "dp-spin" : ""} /> Refresh
            </button>
            <button
              type="button"
              className="dp-btn dp-btn-outline"
              onClick={handlePrintEMR}
              title="Print EMR Record"
            >
              <FaPrint /> Print Record
            </button>
            <button
              type="button"
              className="dp-btn dp-btn-primary"
              onClick={openProfileModal}
            >
              <FaEdit /> Edit Clinical Profile
            </button>
          </div>
        </div>

        {/* Prominent Allergies & Chronic Conditions Alert Strip */}
        <div className="dp-emr-alert-banner">
          <div className="dp-eab-section">
            <strong className="text-rose">
              <FaExclamationTriangle /> Known Allergies:
            </strong>
            {patient.allergies?.length ? (
              <div className="dp-tags-inline">
                {patient.allergies.map((allergy, idx) => (
                  <span key={idx} className="dp-allergy-tag">
                    {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <span className="dp-empty-tag">
                No drug/food allergies recorded
              </span>
            )}
          </div>
          <div className="dp-eab-divider" />
          <div className="dp-eab-section">
            <strong className="text-amber">
              <FaNotesMedical /> Chronic Conditions:
            </strong>
            {patient.chronicConditions?.length ? (
              <div className="dp-tags-inline">
                {patient.chronicConditions.map((cond, idx) => (
                  <span key={idx} className="dp-condition-tag">
                    {cond}
                  </span>
                ))}
              </div>
            ) : (
              <span className="dp-empty-tag">
                No chronic conditions recorded
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 10 EMR Structured Tabs */}
      <div className="dp-emr-tabs-bar">
        {[
          ["overview", "Overview", <FaEye />],
          [
            "consultations",
            `Consultations (${consultations.length})`,
            <FaStethoscope />,
          ],
          ["diagnoses", `Diagnoses (${diagnoses.length})`, <FaNotesMedical />],
          ["medications", "Medications", <FaFileMedical />],
          [
            "prescriptions",
            `Prescriptions (${prescriptions.length})`,
            <FaPrint />,
          ],
          ["reports", `Reports (${reports.length})`, <FaUpload />],
          ["allergies", "Allergies & Conditions", <FaExclamationTriangle />],
          [
            "vitals",
            `Vitals History (${vitalsHistory.length})`,
            <FaHeartbeat />,
          ],
          ["notes", "Clinical Notes", <FaFileAlt />],
          ["timeline", `Timeline (${timeline.length})`, <FaHistory />],
        ].map(([tabKey, tabTitle, tabIcon]) => (
          <button
            key={tabKey}
            type="button"
            className={`dp-emr-tab-btn ${activeTab === tabKey ? "active" : ""}`}
            onClick={() => setActiveTab(tabKey)}
          >
            {tabIcon} {tabTitle}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="dp-emr-content-body">
        {/* 1. Overview Tab */}
        {activeTab === "overview" && (
          <div className="dp-emr-overview-grid">
            <div className="dp-overview-kpi-card">
              <span>Total Appointments</span>
              <strong>{overview.totalAppointments}</strong>
              <small>All scheduled bookings</small>
            </div>
            <div className="dp-overview-kpi-card">
              <span>Completed Consultations</span>
              <strong>{overview.completedVisits}</strong>
              <small>Conducted clinical visits</small>
            </div>
            <div className="dp-overview-kpi-card">
              <span>Total Spend / Billed</span>
              <strong>₹{overview.totalSpent?.toLocaleString("en-IN")}</strong>
              <small>Consultation fees</small>
            </div>
            <div className="dp-overview-kpi-card">
              <span>Last Visit</span>
              <strong>{overview.lastVisit || "None"}</strong>
              <small>Most recent appointment</small>
            </div>

            {/* Latest Clinical Vitals Snapshot */}
            <div className="dp-overview-full-card">
              <h3>
                <FaHeartbeat color="#0d9488" /> Latest Clinical Vitals Snapshot
              </h3>
              {overview.latestVitals ? (
                <div className="dp-vitals-snapshot-strip">
                  <div className="dp-vs-chip">
                    <span>Blood Pressure</span>
                    <strong>
                      {overview.latestVitals.bloodPressure || "N/A"}
                    </strong>
                  </div>
                  <div className="dp-vs-chip">
                    <span>Heart Rate</span>
                    <strong>
                      {overview.latestVitals.heartRate
                        ? `${overview.latestVitals.heartRate} bpm`
                        : "N/A"}
                    </strong>
                  </div>
                  <div className="dp-vs-chip">
                    <span>Temperature</span>
                    <strong>
                      {overview.latestVitals.temperature
                        ? `${overview.latestVitals.temperature}°F`
                        : "N/A"}
                    </strong>
                  </div>
                  <div className="dp-vs-chip">
                    <span>SpO2 Saturation</span>
                    <strong>
                      {overview.latestVitals.spO2
                        ? `${overview.latestVitals.spO2}%`
                        : "N/A"}
                    </strong>
                  </div>
                  <div className="dp-vs-chip">
                    <span>BMI</span>
                    <strong>{overview.latestVitals.bmi || "N/A"}</strong>
                  </div>
                </div>
              ) : (
                <p className="dp-empty-text">
                  No recorded vitals on file for this patient.
                </p>
              )}
            </div>

            {/* Recent Consultations Snapshot */}
            <div className="dp-overview-full-card">
              <h3>
                <FaStethoscope color="#2563eb" /> Recent Consultations
              </h3>
              {consultations.length ? (
                <div className="dp-table-wrap">
                  <table className="dp-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Diagnosis</th>
                        <th>Type</th>
                        <th>Doctor Notes</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultations.slice(0, 5).map((c) => (
                        <tr key={c._id}>
                          <td>
                            <strong>{c.date}</strong>{" "}
                            <span style={{ color: "#64748b" }}>({c.time})</span>
                          </td>
                          <td>
                            <span className="dp-diag-tag">
                              {c.diagnosis || "General Consultation"}
                            </span>
                          </td>
                          <td>
                            {c.consultationType === "video"
                              ? "Video"
                              : "Clinic"}
                          </td>
                          <td>
                            {c.medicalNotes ||
                              c.clinicalNotes?.assessment ||
                              "No notes"}
                          </td>
                          <td>
                            <span className={`dp-status-badge ${c.status}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="dp-empty-text">No consultations conducted yet.</p>
              )}
            </div>
          </div>
        )}

        {/* 2. Consultations Tab */}
        {activeTab === "consultations" && (
          <div className="dp-consult-history-list">
            {consultations.length === 0 ? (
              <p className="dp-empty-text">
                No previous consultations recorded.
              </p>
            ) : (
              consultations.map((c) => (
                <div key={c._id} className="dp-consult-history-card">
                  <div className="dp-chc-header">
                    <div>
                      <h4>{c.diagnosis || "General Consultation"}</h4>
                      <p>
                        Conducted on <strong>{c.date}</strong> at{" "}
                        <strong>{c.time}</strong> by {c.doctorName || "Doctor"}
                      </p>
                    </div>
                    <div className="dp-chc-badges">
                      <span className="dp-id-badge">{c.appointmentId}</span>
                      <span className={`dp-status-badge ${c.status}`}>
                        {c.status}
                      </span>
                      {c.consultationType === "video" ? (
                        <span className="dp-type-chip">
                          <FaVideo /> Video
                        </span>
                      ) : (
                        <span className="dp-type-chip">
                          <FaHospital /> In-Clinic
                        </span>
                      )}
                    </div>
                  </div>

                  {c.vitals && Object.values(c.vitals).some(Boolean) && (
                    <div className="dp-chc-vitals-row">
                      {c.vitals.bloodPressure && (
                        <span>
                          <strong>BP:</strong> {c.vitals.bloodPressure}
                        </span>
                      )}
                      {c.vitals.heartRate && (
                        <span>
                          <strong>Pulse:</strong> {c.vitals.heartRate} bpm
                        </span>
                      )}
                      {c.vitals.temperature && (
                        <span>
                          <strong>Temp:</strong> {c.vitals.temperature}°F
                        </span>
                      )}
                      {c.vitals.spO2 && (
                        <span>
                          <strong>SpO2:</strong> {c.vitals.spO2}%
                        </span>
                      )}
                      {c.vitals.bmi && (
                        <span>
                          <strong>BMI:</strong> {c.vitals.bmi}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="dp-chc-body">
                    {c.clinicalNotes?.chiefComplaint && (
                      <p>
                        <strong>Chief Complaint:</strong>{" "}
                        {c.clinicalNotes.chiefComplaint}
                      </p>
                    )}
                    {c.clinicalNotes?.examination && (
                      <p>
                        <strong>Examination:</strong>{" "}
                        {c.clinicalNotes.examination}
                      </p>
                    )}
                    {c.clinicalNotes?.assessment && (
                      <p>
                        <strong>Assessment:</strong>{" "}
                        {c.clinicalNotes.assessment}
                      </p>
                    )}
                    {c.medicalNotes && !c.clinicalNotes?.assessment && (
                      <p>
                        <strong>Clinical Notes:</strong> {c.medicalNotes}
                      </p>
                    )}
                    {c.prescription && (
                      <div className="dp-chc-rx-preview">
                        <strong>Prescription:</strong>
                        <pre>{c.prescription}</pre>
                      </div>
                    )}
                    {c.followUpAdvice && (
                      <p className="dp-chc-followup">
                        <strong>Follow-Up Advice:</strong> {c.followUpAdvice}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 3. Diagnoses Tab */}
        {activeTab === "diagnoses" && (
          <div className="dp-diagnoses-panel">
            {diagnoses.length === 0 ? (
              <p className="dp-empty-text">
                No diagnoses recorded for this patient.
              </p>
            ) : (
              <div className="dp-table-wrap">
                <table className="dp-table">
                  <thead>
                    <tr>
                      <th>Diagnosis Condition</th>
                      <th>First Recorded Date</th>
                      <th>Attending Doctor</th>
                      <th>Appointment ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnoses.map((d, i) => (
                      <tr key={i}>
                        <td>
                          <strong style={{ color: "#0d9488" }}>
                            {d.diagnosis}
                          </strong>
                        </td>
                        <td>{d.date}</td>
                        <td>{d.doctorName || "Doctor"}</td>
                        <td>
                          <span className="dp-id-badge">{d.appointmentId}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 4. Medications Tab */}
        {activeTab === "medications" && (
          <div className="dp-medications-panel">
            {prescriptions.length === 0 ? (
              <p className="dp-empty-text">No medication history recorded.</p>
            ) : (
              <div className="dp-meds-cards-grid">
                {prescriptions.map((rx) => (
                  <div key={rx._id} className="dp-med-card">
                    <div className="dp-mc-head">
                      <strong>
                        Diagnosis: {rx.diagnosis || "Medical Advice"}
                      </strong>
                      <small>Prescribed: {rx.date}</small>
                    </div>
                    <pre className="dp-mc-text">
                      {rx.prescription || "No medicine lines specified"}
                    </pre>
                    {rx.followUpAdvice && (
                      <p className="dp-mc-advice">
                        <strong>Advice:</strong> {rx.followUpAdvice}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Prescriptions Tab */}
        {activeTab === "prescriptions" && (
          <div className="dp-prescriptions-panel">
            {prescriptions.length === 0 ? (
              <p className="dp-empty-text">
                No prescriptions issued for this patient.
              </p>
            ) : (
              prescriptions.map((rx) => (
                <div key={rx._id} className="dp-rx-full-card">
                  <div className="dp-rx-card-top">
                    <div>
                      <h4>Prescription for {patient.name}</h4>
                      <p>
                        Date: {rx.date} · Doctor:{" "}
                        {rx.doctorName || doctor?.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="dp-btn dp-btn-outline"
                      onClick={() => {
                        const win = window.open("", "_blank");
                        win.document.write(`
                          <html>
                            <head><title>Prescription — ${patient.name}</title></head>
                            <body style="font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
                              <h2 style="color: #0d9488; margin-bottom: 4px;">HealPoint Healthcare</h2>
                              <p style="color: #64748b; margin-top: 0;">Official Digital Prescription</p>
                              <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
                              <p><strong>Patient:</strong> ${patient.name} | <strong>Age/Gender:</strong> ${age || "N/A"} yrs / ${patient.gender || "N/A"}</p>
                              <p><strong>Date:</strong> ${rx.date} | <strong>Appointment:</strong> ${rx.appointmentId}</p>
                              <p><strong>Diagnosis:</strong> ${rx.diagnosis || "General Checkup"}</p>
                              <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
                              <h3 style="color: #0f172a;">Rx / Medications</h3>
                              <pre style="background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 14px; white-space: pre-wrap;">${rx.prescription || "No medications"}</pre>
                              ${rx.followUpAdvice ? `<p><strong>Follow-Up Advice:</strong> ${rx.followUpAdvice}</p>` : ""}
                              <br/><br/>
                              <p style="text-align: right;"><strong>Dr. ${stripDrPrefix(rx.doctorName || doctor?.name)}</strong><br/><small>Licensed Care Provider</small></p>
                              <p style="text-align: right;"><strong>${formatDoctorTitle(rx.doctorName || doctor?.name)}</strong><br/><small>Licensed Care Provider</small></p>
                            </body>
                          </html>
                        `);
                        win.document.close();
                        win.print();
                      }}
                    >
                      <FaPrint /> Print / Export PDF
                    </button>
                  </div>
                  <div className="dp-rx-card-body">
                    <strong>Diagnosis: {rx.diagnosis || "Consultation"}</strong>
                    <pre>{rx.prescription || "No detailed items"}</pre>
                    {rx.followUpAdvice && (
                      <p>
                        <strong>Advice:</strong> {rx.followUpAdvice}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 6. Reports Tab */}
        {activeTab === "reports" && (
          <div className="dp-reports-panel">
            {reports.length === 0 ? (
              <p className="dp-empty-text">
                No medical reports uploaded for this patient.
              </p>
            ) : (
              <div className="dp-reports-grid">
                {reports.map((rep, idx) => (
                  <div key={idx} className="dp-report-item-card">
                    <FaFilePdf size={28} color="#ef4444" />
                    <div>
                      <strong>{rep.name}</strong>
                      <p>
                        Uploaded:{" "}
                        {new Date(
                          rep.uploadedAt || Date.now(),
                        ).toLocaleDateString("en-IN")}
                      </p>
                      <a
                        href={rep.url}
                        target="_blank"
                        rel="noreferrer"
                        className="dp-action-link"
                      >
                        <FaUpload /> View / Download Document
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. Allergies & Conditions Tab */}
        {activeTab === "allergies" && (
          <div className="dp-allergies-panel">
            <div className="dp-ac-card">
              <div className="dp-card-head">
                <h3>
                  <FaExclamationTriangle color="#e11d48" /> Known Patient
                  Allergies
                </h3>
                <button
                  type="button"
                  className="dp-btn dp-btn-secondary"
                  onClick={openProfileModal}
                >
                  <FaEdit /> Edit Allergies
                </button>
              </div>
              {patient.allergies?.length ? (
                <div className="dp-tags-wrap" style={{ marginTop: 12 }}>
                  {patient.allergies.map((a, i) => (
                    <span key={i} className="dp-allergy-tag-lg">
                      <FaExclamationTriangle /> {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="dp-empty-text">
                  No drug, substance, or food allergies reported for this
                  patient.
                </p>
              )}
            </div>

            <div className="dp-ac-card" style={{ marginTop: 20 }}>
              <div className="dp-card-head">
                <h3>
                  <FaNotesMedical color="#d97706" /> Chronic Medical Conditions
                </h3>
                <button
                  type="button"
                  className="dp-btn dp-btn-secondary"
                  onClick={openProfileModal}
                >
                  <FaEdit /> Edit Conditions
                </button>
              </div>
              {patient.chronicConditions?.length ? (
                <div className="dp-tags-wrap" style={{ marginTop: 12 }}>
                  {patient.chronicConditions.map((c, i) => (
                    <span key={i} className="dp-condition-tag-lg">
                      <FaNotesMedical /> {c}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="dp-empty-text">
                  No chronic medical conditions recorded for this patient.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 8. Vitals History Tab */}
        {activeTab === "vitals" && (
          <div className="dp-vitals-history-panel">
            <h3>
              <FaHeartbeat color="#0d9488" /> Historical Patient Vitals Log
            </h3>
            {vitalsHistory.length === 0 ? (
              <p className="dp-empty-text">
                No historical vital signs recorded across visits.
              </p>
            ) : (
              <div className="dp-table-wrap">
                <table className="dp-table dp-vitals-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Blood Pressure</th>
                      <th>Heart Rate</th>
                      <th>Temperature</th>
                      <th>Resp. Rate</th>
                      <th>SpO2</th>
                      <th>Weight</th>
                      <th>Height</th>
                      <th>BMI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitalsHistory.map((v, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{v.date}</strong>
                        </td>
                        <td>{v.time}</td>
                        <td>
                          {v.bloodPressure ? (
                            <span className="dp-vital-pill">
                              {v.bloodPressure}
                            </span>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td>{v.heartRate ? `${v.heartRate} bpm` : "--"}</td>
                        <td>{v.temperature ? `${v.temperature}°F` : "--"}</td>
                        <td>
                          {v.respiratoryRate
                            ? `${v.respiratoryRate}/min`
                            : "--"}
                        </td>
                        <td>{v.spO2 ? `${v.spO2}%` : "--"}</td>
                        <td>{v.weight ? `${v.weight} kg` : "--"}</td>
                        <td>{v.height ? `${v.height} cm` : "--"}</td>
                        <td>
                          {v.bmi ? (
                            <span
                              className={`dp-bmi-chip ${
                                Number(v.bmi) < 18.5
                                  ? "underweight"
                                  : Number(v.bmi) <= 24.9
                                    ? "normal"
                                    : "overweight"
                              }`}
                            >
                              {v.bmi}
                            </span>
                          ) : (
                            "--"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 9. Clinical Notes Tab */}
        {activeTab === "notes" && (
          <div className="dp-notes-history-panel">
            {consultations.filter((c) => c.clinicalNotes || c.medicalNotes)
              .length === 0 ? (
              <p className="dp-empty-text">
                No clinical observations or notes recorded.
              </p>
            ) : (
              consultations
                .filter((c) => c.clinicalNotes || c.medicalNotes)
                .map((c) => (
                  <div key={c._id} className="dp-note-card">
                    <div className="dp-nc-head">
                      <strong>
                        Visit Date: {c.date} ({c.time})
                      </strong>
                      <span className="dp-id-badge">{c.appointmentId}</span>
                    </div>
                    {c.clinicalNotes?.chiefComplaint && (
                      <p>
                        <strong>Chief Complaint:</strong>{" "}
                        {c.clinicalNotes.chiefComplaint}
                      </p>
                    )}
                    {c.clinicalNotes?.symptoms && (
                      <p>
                        <strong>Symptoms:</strong> {c.clinicalNotes.symptoms}
                      </p>
                    )}
                    {c.clinicalNotes?.examination && (
                      <p>
                        <strong>Examination:</strong>{" "}
                        {c.clinicalNotes.examination}
                      </p>
                    )}
                    {c.clinicalNotes?.assessment && (
                      <p>
                        <strong>Assessment:</strong>{" "}
                        {c.clinicalNotes.assessment}
                      </p>
                    )}
                    {c.clinicalNotes?.treatmentPlan && (
                      <p>
                        <strong>Plan:</strong> {c.clinicalNotes.treatmentPlan}
                      </p>
                    )}
                    {c.medicalNotes && !c.clinicalNotes?.assessment && (
                      <p>
                        <strong>Notes:</strong> {c.medicalNotes}
                      </p>
                    )}
                  </div>
                ))
            )}
          </div>
        )}

        {/* 10. Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="dp-emr-timeline">
            {timeline.length === 0 ? (
              <p className="dp-empty-text">No medical events on record.</p>
            ) : (
              timeline.map((event, idx) => (
                <div key={idx} className="dp-tl-item">
                  <div className={`dp-tl-bullet ${event.type}`}>
                    {event.type === "appointment" && <FaCalendarAlt />}
                    {event.type === "consultation" && <FaStethoscope />}
                    {event.type === "prescription" && <FaPrint />}
                    {event.type === "vitals" && <FaHeartbeat />}
                    {event.type === "diagnosis" && <FaNotesMedical />}
                    {event.type === "report" && <FaFileAlt />}
                    {event.type === "follow-up" && <FaCalendarCheck />}
                  </div>
                  <div className="dp-tl-content">
                    <div className="dp-tl-time">
                      {new Date(event.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <h5>{event.title}</h5>
                    <p>{event.description}</p>
                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noreferrer"
                        className="dp-action-link"
                      >
                        View Document
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Edit Clinical Profile Modal */}
      {profileModal.isOpen && (
        <div className="dp-modal-backdrop">
          <div className="dp-modal-dialog">
            <div className="dp-modal-header">
              <h3>Edit Clinical Profile — {patient.name}</h3>
              <button
                type="button"
                className="dp-modal-close"
                onClick={() =>
                  setProfileModal((prev) => ({ ...prev, isOpen: false }))
                }
              >
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="dp-modal-body">
                <label>
                  <span>Blood Group</span>
                  <select
                    value={profileModal.bloodGroup}
                    onChange={(e) =>
                      setProfileModal((prev) => ({
                        ...prev,
                        bloodGroup: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </label>

                <label>
                  <span>Known Allergies (Comma separated)</span>
                  <input
                    type="text"
                    placeholder="e.g. Penicillin, Peanuts, Sulfa drugs"
                    value={profileModal.allergies}
                    onChange={(e) =>
                      setProfileModal((prev) => ({
                        ...prev,
                        allergies: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Chronic Medical Conditions (Comma separated)</span>
                  <input
                    type="text"
                    placeholder="e.g. Hypertension, Type 2 Diabetes, Asthma"
                    value={profileModal.chronicConditions}
                    onChange={(e) =>
                      setProfileModal((prev) => ({
                        ...prev,
                        chronicConditions: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="dp-modal-footer">
                <button
                  type="button"
                  className="dp-btn dp-btn-secondary"
                  onClick={() =>
                    setProfileModal((prev) => ({ ...prev, isOpen: false }))
                  }
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dp-btn dp-btn-primary"
                  disabled={profileModal.saving}
                >
                  {profileModal.saving ? "Saving..." : "Save Clinical Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PrescriptionsView({
  doctorId,
  doctor,
  appointments = [],
  initialAppointmentId,
  initialPatientId,
  onSave,
  saving: globalSaving,
}) {
  const [viewMode, setViewMode] = useState(
    initialAppointmentId ? "editor" : "list",
  );
  const [prescriptionsList, setPrescriptionsList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    initialAppointmentId || appointments[0]?._id || "",
  );

  // Editor form state
  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState([
    {
      id: "med-1",
      name: "",
      dosage: "",
      frequency: "1-0-1",
      duration: "5 days",
      route: "Oral",
      timing: "After food",
      instructions: "",
    },
  ]);
  const [prescriptionInstructions, setPrescriptionInstructions] = useState({
    dietInstructions: "",
    generalInstructions: "",
    followUpInstructions: "",
    additionalNotes: "",
  });
  const [followUpAdvice, setFollowUpAdvice] = useState("");
  const [customPrescriptionText, setCustomPrescriptionText] = useState("");
  const [activeDoctorMeta, setActiveDoctorMeta] = useState(null);
  const [savingRx, setSavingRx] = useState(false);
  const [previewModalRx, setPreviewModalRx] = useState(null);

  // Fetch all prescriptions for doctor
  const fetchPrescriptions = async () => {
    if (!doctorId) return;
    setLoadingList(true);
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/prescriptions?search=${encodeURIComponent(
          searchQuery,
        )}`,
      );
      if (res.data.success) {
        setPrescriptionsList(res.data.prescriptions || []);
        if (res.data.doctor) setActiveDoctorMeta(res.data.doctor);
      }
    } catch (err) {
      console.error("Error loading prescriptions list:", err);
      toast.error("Could not load prescriptions list");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [doctorId, searchQuery]);

  // When initialAppointmentId is provided, switch to editor
  useEffect(() => {
    if (initialAppointmentId) {
      setSelectedAppointmentId(initialAppointmentId);
      setViewMode("editor");
    }
  }, [initialAppointmentId]);

  // Load selected appointment details into editor
  const loadAppointmentPrescription = async (aptId) => {
    if (!aptId || !doctorId) return;
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/appointment/${aptId}/prescription`,
      );
      if (res.data.success) {
        const apt = res.data.appointment || {};
        setDiagnosis(apt.diagnosis || "");
        if (Array.isArray(apt.medicines) && apt.medicines.length > 0) {
          setMedicines(
            apt.medicines.map((m, idx) => ({
              ...m,
              id: m._id || `med-${idx + 1}-${Date.now()}`,
            })),
          );
        } else {
          setMedicines([
            {
              id: "med-1",
              name: "",
              dosage: "",
              frequency: "1-0-1",
              duration: "5 days",
              route: "Oral",
              timing: "After food",
              instructions: "",
            },
          ]);
        }
        setPrescriptionInstructions({
          dietInstructions:
            apt.prescriptionInstructions?.dietInstructions || "",
          generalInstructions:
            apt.prescriptionInstructions?.generalInstructions || "",
          followUpInstructions:
            apt.prescriptionInstructions?.followUpInstructions || "",
          additionalNotes: apt.prescriptionInstructions?.additionalNotes || "",
        });
        setFollowUpAdvice(apt.followUpAdvice || "");
        setCustomPrescriptionText(apt.prescription || "");
        if (res.data.doctor) setActiveDoctorMeta(res.data.doctor);
      }
    } catch (err) {
      console.error("Error loading appointment prescription:", err);
    }
  };

  useEffect(() => {
    if (selectedAppointmentId && viewMode === "editor") {
      loadAppointmentPrescription(selectedAppointmentId);
    }
  }, [selectedAppointmentId, viewMode]);

  // Medicine list modifiers
  const addMedicineRow = () => {
    setMedicines((prev) => [
      ...prev,
      {
        id: `med-${Date.now()}-${Math.random()}`,
        name: "",
        dosage: "",
        frequency: "1-0-1",
        duration: "5 days",
        route: "Oral",
        timing: "After food",
        instructions: "",
      },
    ]);
  };

  const updateMedicineRow = (id, field, value) => {
    setMedicines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  };

  const removeMedicineRow = (id) => {
    if (medicines.length <= 1) {
      setMedicines([
        {
          id: `med-${Date.now()}`,
          name: "",
          dosage: "",
          frequency: "1-0-1",
          duration: "5 days",
          route: "Oral",
          timing: "After food",
          instructions: "",
        },
      ]);
      return;
    }
    setMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const moveMedicineRow = (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= medicines.length) return;
    const next = [...medicines];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setMedicines(next);
  };

  // Find active appointment object for editor
  const currentAppointment = useMemo(() => {
    return (
      appointments.find((a) => a._id === selectedAppointmentId) ||
      prescriptionsList.find((p) => p._id === selectedAppointmentId) ||
      {}
    );
  }, [appointments, prescriptionsList, selectedAppointmentId]);

  const currentPatient =
    currentAppointment.userId || currentAppointment.patient || {};

  // Save prescription handler
  const handleSavePrescription = async (e) => {
    if (e) e.preventDefault();
    if (!selectedAppointmentId) {
      toast.error("Please select an appointment");
      return;
    }

    const validMedicines = medicines
      .filter((m) => m.name && m.name.trim() !== "")
      .map(({ id, ...rest }) => rest);

    if (validMedicines.length === 0 && !customPrescriptionText.trim()) {
      toast.error("Please add at least one medication or prescription notes");
      return;
    }

    setSavingRx(true);
    try {
      const payload = {
        diagnosis: diagnosis.trim(),
        medicines: validMedicines,
        prescriptionInstructions,
        followUpAdvice:
          followUpAdvice.trim() ||
          prescriptionInstructions.followUpInstructions.trim(),
        prescription: customPrescriptionText.trim() || undefined,
      };

      const res = await api.post(
        `/api/v1/doctor/panel/${doctorId}/appointment/${selectedAppointmentId}/prescription`,
        payload,
      );

      if (res.data.success) {
        toast.success("Digital prescription saved successfully");
        await fetchPrescriptions();
        // Prepare preview modal or prompt print
        const savedRx = {
          appointment: res.data.appointment,
          patient: currentPatient,
          doctor: activeDoctorMeta || doctor,
          diagnosis: diagnosis.trim(),
          medicines: validMedicines,
          prescriptionInstructions,
          followUpAdvice,
          prescription: res.data.appointment?.prescription,
        };
        setPreviewModalRx(savedRx);
      }
    } catch (err) {
      console.error("Error saving prescription:", err);
      toast.error(
        err.response?.data?.message || "Failed to save digital prescription",
      );
    } finally {
      setSavingRx(false);
    }
  };

  const frequencyPresets = [
    "1-0-1",
    "1-0-0",
    "0-0-1",
    "1-1-1",
    "Once daily",
    "Twice daily",
    "Thrice daily",
    "SOS / As needed",
  ];
  const timingPresets = [
    "After food",
    "Before food",
    "With food",
    "At bedtime",
    "Empty stomach",
  ];
  const routePresets = [
    "Oral",
    "Topical",
    "Inhalation",
    "Intravenous",
    "Intramuscular",
    "Drops",
    "Sublingual",
  ];

  return (
    <div className="dp-rx-management-container">
      {/* Top Action Bar */}
      <div className="dp-rx-top-bar">
        <div>
          <h2>
            <FaNotesMedical color="#0d9488" /> Digital Prescription Studio
          </h2>
          <p>
            Create, issue, and manage professional hospital-grade digital
            prescriptions
          </p>
        </div>
        <div className="dp-rx-actions-group">
          {viewMode === "editor" ? (
            <button
              type="button"
              className="dp-btn dp-btn-secondary"
              onClick={() => setViewMode("list")}
            >
              <FaChevronLeft /> Back to Prescriptions List
            </button>
          ) : (
            <button
              type="button"
              className="dp-btn dp-btn-primary"
              onClick={() => {
                if (appointments.length > 0) {
                  setSelectedAppointmentId(appointments[0]._id);
                }
                setViewMode("editor");
              }}
            >
              <FaPlus /> Issue New Prescription
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: PRESCRIPTIONS LIST */}
      {viewMode === "list" && (
        <div className="dp-rx-list-view">
          {/* Summary KPIs */}
          <div className="dp-rx-stats-row">
            <div className="dp-rx-stat-card">
              <div
                className="dp-rx-stat-icon"
                style={{ background: "#ecfdf5", color: "#059669" }}
              >
                <FaFileInvoice size={22} />
              </div>
              <div>
                <span className="dp-rx-stat-label">Total Prescriptions</span>
                <strong className="dp-rx-stat-val">
                  {prescriptionsList.length}
                </strong>
              </div>
            </div>
            <div className="dp-rx-stat-card">
              <div
                className="dp-rx-stat-icon"
                style={{ background: "#eff6ff", color: "#2563eb" }}
              >
                <FaUserInjured size={22} />
              </div>
              <div>
                <span className="dp-rx-stat-label">Patients Treated</span>
                <strong className="dp-rx-stat-val">
                  {
                    new Set(
                      prescriptionsList.map((p) => p.userId?._id || p.userId),
                    ).size
                  }
                </strong>
              </div>
            </div>
            <div className="dp-rx-stat-card">
              <div
                className="dp-rx-stat-icon"
                style={{ background: "#f5f3ff", color: "#7c3aed" }}
              >
                <FaPills size={22} />
              </div>
              <div>
                <span className="dp-rx-stat-label">Medications Prescribed</span>
                <strong className="dp-rx-stat-val">
                  {prescriptionsList.reduce(
                    (acc, p) =>
                      acc + (p.medicines?.length || (p.prescription ? 1 : 0)),
                    0,
                  )}
                </strong>
              </div>
            </div>
          </div>

          {/* Search Bar & Refresh */}
          <div
            className="dp-rx-filter-box"
            style={{ display: "flex", gap: "10px", alignItems: "center" }}
          >
            <div className="dp-rx-search-input" style={{ flex: 1 }}>
              <FaSearch />
              <input
                type="text"
                placeholder="Search prescriptions by patient name, phone, diagnosis, or Rx ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="dp-clear-btn"
                  onClick={() => setSearchQuery("")}
                >
                  <FaTimes />
                </button>
              )}
            </div>
            <button
              type="button"
              className="dp-btn dp-btn-outline"
              onClick={fetchPrescriptions}
              disabled={loadingList}
              title="Refresh prescriptions list"
            >
              <FaSyncAlt className={loadingList ? "dp-spin" : ""} /> Refresh
            </button>
          </div>

          {/* Prescriptions Table */}
          {loadingList ? (
            <div className="dp-rx-loading">
              <FaSyncAlt className="dp-spin" size={24} />
              <p>Loading prescriptions...</p>
            </div>
          ) : prescriptionsList.length === 0 ? (
            <div className="dp-rx-empty-state">
              <FaNotesMedical size={42} color="#cbd5e1" />
              <h3>No Prescriptions Found</h3>
              <p>
                {searchQuery
                  ? "No prescriptions match your search criteria."
                  : "You haven't issued any digital prescriptions yet."}
              </p>
              <button
                type="button"
                className="dp-btn dp-btn-primary"
                onClick={() => {
                  if (appointments.length > 0)
                    setSelectedAppointmentId(appointments[0]._id);
                  setViewMode("editor");
                }}
              >
                <FaPlus /> Issue Your First Prescription
              </button>
            </div>
          ) : (
            <div className="dp-rx-table-container">
              <table className="dp-rx-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Date / Time</th>
                    <th>Diagnosis</th>
                    <th>Medicines</th>
                    <th>Instructions</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptionsList.map((item) => {
                    const pat = item.userId || {};
                    const medsCount = item.medicines?.length || 0;
                    return (
                      <tr key={item._id}>
                        <td>
                          <div className="dp-rx-pat-info">
                            <div className="dp-rx-pat-avatar">
                              {pat.name
                                ? pat.name.charAt(0).toUpperCase()
                                : "P"}
                            </div>
                            <div>
                              <strong>{pat.name || "Patient"}</strong>
                              <small>
                                {[pat.gender, pat.bloodGroup]
                                  .filter(Boolean)
                                  .join(" · ") ||
                                  pat.phone ||
                                  "ID: " +
                                    String(item._id).slice(-6).toUpperCase()}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="dp-rx-date-cell">
                            <strong>{item.slotDate || "—"}</strong>
                            <small>{item.slotTime || "Standard slot"}</small>
                          </div>
                        </td>
                        <td>
                          {item.diagnosis ? (
                            <span className="dp-rx-diag-badge">
                              {item.diagnosis}
                            </span>
                          ) : (
                            <span className="dp-rx-text-muted">
                              Not specified
                            </span>
                          )}
                        </td>
                        <td>
                          {medsCount > 0 ? (
                            <div className="dp-rx-meds-summary">
                              <span className="dp-rx-pill-count">
                                <FaPills size={11} /> {medsCount}{" "}
                                {medsCount === 1 ? "medicine" : "medicines"}
                              </span>
                              <small>
                                {item.medicines
                                  .slice(0, 2)
                                  .map((m) => m.name)
                                  .join(", ")}
                                {medsCount > 2 ? ` +${medsCount - 2} more` : ""}
                              </small>
                            </div>
                          ) : item.prescription ? (
                            <div className="dp-rx-legacy-text">
                              {item.prescription.substring(0, 45)}
                              {item.prescription.length > 45 ? "..." : ""}
                            </div>
                          ) : (
                            <span className="dp-rx-text-muted">
                              None recorded
                            </span>
                          )}
                        </td>
                        <td>
                          <small className="dp-rx-instr-text">
                            {item.prescriptionInstructions?.dietInstructions ||
                              item.followUpAdvice ||
                              "—"}
                          </small>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="dp-rx-row-actions">
                            <button
                              type="button"
                              className="dp-action-icon-btn"
                              title="Download Official Signed PDF"
                              onClick={() => {
                                let token = "";
                                try {
                                  const raw =
                                    sessionStorage.getItem("doctorApp") ||
                                    localStorage.getItem("doctorApp");
                                  token = JSON.parse(raw || "{}")?.token || "";
                                } catch (_) {}
                                const pdfUrl = `/api/v1/prescription/${item.prescriptionId || item._id}/pdf?token=${encodeURIComponent(token)}`;
                                window.open(pdfUrl, "_blank");
                              }}
                            >
                              <FaFilePdf color="#ef4444" />
                            </button>
                            <button
                              type="button"
                              className="dp-action-icon-btn"
                              title="Print / View Prescription Slip"
                              onClick={() => {
                                printPrescriptionSlip({
                                  appointment: item,
                                  patient: pat,
                                  doctor: activeDoctorMeta || doctor,
                                  diagnosis: item.diagnosis,
                                  medicines: item.medicines || [],
                                  prescriptionInstructions:
                                    item.prescriptionInstructions || {},
                                  followUpAdvice: item.followUpAdvice,
                                  prescription: item.prescription,
                                });
                              }}
                            >
                              <FaPrint color="#0d9488" />
                            </button>
                            <button
                              type="button"
                              className="dp-action-icon-btn"
                              title="Edit Prescription"
                              onClick={() => {
                                setSelectedAppointmentId(item._id);
                                setViewMode("editor");
                              }}
                            >
                              <FaEdit color="#2563eb" />
                            </button>
                            <Link
                              to={`/medical-history/${pat._id || ""}?tab=prescriptions`}
                              className="dp-action-icon-btn"
                              title="Patient EMR"
                            >
                              <FaHistory color="#7c3aed" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PRESCRIPTION PAD / EDITOR */}
      {viewMode === "editor" && (
        <form className="dp-rx-editor-view" onSubmit={handleSavePrescription}>
          {/* 1. Appointment Selector Dropdown */}
          <div className="dp-rx-editor-card dp-rx-selector-box">
            <label>
              <strong>Select Patient / Appointment:</strong>
              <select
                value={selectedAppointmentId}
                onChange={(e) => setSelectedAppointmentId(e.target.value)}
              >
                {appointments.map((apt) => {
                  const pat = apt.patient || apt.userId || {};
                  return (
                    <option key={apt._id} value={apt._id}>
                      {pat.name || "Patient"} — {apt.slotDate} (
                      {apt.slotTime || "OPD"}){" "}
                      {apt.status ? `[${apt.status}]` : ""}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="dp-rx-quick-tag">
              Patient ID:{" "}
              <strong>
                {currentPatient._id
                  ? String(currentPatient._id).slice(-8).toUpperCase()
                  : "N/A"}
              </strong>
            </div>
          </div>

          {/* 2. Official Prescription Header Preview */}
          <div className="dp-rx-pad-header">
            <div className="dp-rx-brand-block">
              <div className="dp-rx-brand-name">
                <FaClinicMedical /> HealPoint Clinic & Hospital
              </div>
              <div className="dp-rx-brand-tagline">
                Healing Made Human · Official Medical Prescription
              </div>
              <div className="dp-rx-hospital-meta">
                {activeDoctorMeta?.hospitalName ||
                  doctor?.hospitalName ||
                  "City Care Hospital"}
                {activeDoctorMeta?.hospitalAddress
                  ? ` · ${activeDoctorMeta.hospitalAddress}`
                  : ""}
              </div>
            </div>

            <div className="dp-rx-doc-block">
              <div className="dp-rx-doc-name">
                {activeDoctorMeta?.name || doctor?.name || "Dr. Manav Bedi"}
                {formatDoctorTitle(
                  activeDoctorMeta?.name || doctor?.name || "Manav Bedi",
                )}
              </div>
              <div className="dp-rx-doc-degree">
                {activeDoctorMeta?.qualification ||
                  doctor?.qualification ||
                  "MD / MBBS"}
                {" · "}
                {activeDoctorMeta?.specialization ||
                  doctor?.specialization ||
                  "General Medicine"}
              </div>
              <div className="dp-rx-doc-reg">
                Reg. No:{" "}
                <strong>
                  {activeDoctorMeta?.registrationNumber ||
                    doctor?.registrationNumber ||
                    "MCI-HP-REG"}
                </strong>
              </div>
              {(activeDoctorMeta?.phone || doctor?.phone) && (
                <div className="dp-rx-doc-contact">
                  Tel: {activeDoctorMeta?.phone || doctor?.phone}
                </div>
              )}
            </div>
          </div>

          {/* 3. Patient Demographics & Allergy Safety Alert */}
          <div className="dp-rx-patient-strip">
            <div className="dp-rx-patient-cell">
              <small>PATIENT NAME</small>
              <strong>{currentPatient.name || "Patient"}</strong>
            </div>
            <div className="dp-rx-patient-cell">
              <small>AGE / GENDER</small>
              <strong>
                {currentPatient.dob
                  ? new Date().getFullYear() -
                    new Date(currentPatient.dob).getFullYear() +
                    " Yrs"
                  : currentPatient.age || "—"}{" "}
                / {currentPatient.gender || "—"}
              </strong>
            </div>
            <div className="dp-rx-patient-cell">
              <small>BLOOD GROUP</small>
              <strong style={{ color: "#ef4444" }}>
                {currentPatient.bloodGroup || "Not recorded"}
              </strong>
            </div>
            <div className="dp-rx-patient-cell">
              <small>DATE OF VISIT</small>
              <strong>
                {currentAppointment.slotDate ||
                  new Date().toISOString().split("T")[0]}
              </strong>
            </div>
          </div>

          {/* Adverse Reaction Warnings */}
          {(currentPatient.allergies?.length > 0 ||
            currentPatient.chronicConditions?.length > 0) && (
            <div className="dp-rx-warning-strip">
              <FaExclamationTriangle color="#dc2626" />
              <div>
                {currentPatient.allergies?.length > 0 && (
                  <span>
                    <strong>Known Allergies: </strong>
                    {currentPatient.allergies.join(", ")}
                    {"  "}
                  </span>
                )}
                {currentPatient.chronicConditions?.length > 0 && (
                  <span>
                    <strong>Chronic Conditions: </strong>
                    {currentPatient.chronicConditions.join(", ")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 4. Clinical Diagnosis Section */}
          <div className="dp-rx-editor-card">
            <div className="dp-rx-card-title">
              <FaStethoscope color="#7c3aed" />
              <h3>Clinical Diagnosis & Assessment</h3>
            </div>
            <div className="dp-rx-field-row">
              <label className="dp-full-width">
                <span>
                  Primary Clinical Diagnosis{" "}
                  <span style={{ color: "#ef4444" }}>*</span>
                </span>
                <input
                  type="text"
                  placeholder="e.g. Acute Pharyngitis with Upper Respiratory Infection"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="dp-rx-highlight-input"
                />
              </label>
            </div>
          </div>

          {/* 5. Medicine Management Studio (Rx) */}
          <div className="dp-rx-editor-card">
            <div className="dp-rx-card-title dp-rx-meds-head">
              <div>
                <span className="dp-rx-symbol-badge">℞</span>
                <h3>Prescribed Medications & Formulations</h3>
              </div>
              <button
                type="button"
                className="dp-btn dp-btn-secondary dp-btn-sm"
                onClick={addMedicineRow}
              >
                <FaPlus /> Add Medicine
              </button>
            </div>

            <div className="dp-rx-meds-table-wrapper">
              <table className="dp-rx-edit-table">
                <thead>
                  <tr>
                    <th style={{ width: "24%" }}>Medicine Name</th>
                    <th style={{ width: "12%" }}>Dosage</th>
                    <th style={{ width: "16%" }}>Frequency</th>
                    <th style={{ width: "12%" }}>Duration</th>
                    <th style={{ width: "12%" }}>Route</th>
                    <th style={{ width: "14%" }}>Timing</th>
                    <th style={{ width: "10%", textAlign: "center" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {medicines.map((med, index) => (
                    <tr key={med.id}>
                      <td>
                        <input
                          type="text"
                          placeholder="e.g. Amoxicillin + Clav"
                          value={med.name}
                          onChange={(e) =>
                            updateMedicineRow(med.id, "name", e.target.value)
                          }
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="e.g. 625mg / 10ml"
                          value={med.dosage}
                          onChange={(e) =>
                            updateMedicineRow(med.id, "dosage", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="e.g. 1-0-1"
                          value={med.frequency}
                          onChange={(e) =>
                            updateMedicineRow(
                              med.id,
                              "frequency",
                              e.target.value,
                            )
                          }
                        />
                        <div className="dp-rx-chip-list">
                          {["1-0-1", "1-0-0", "0-0-1", "SOS"].map((f) => (
                            <button
                              key={f}
                              type="button"
                              className="dp-rx-micro-chip"
                              onClick={() =>
                                updateMedicineRow(med.id, "frequency", f)
                              }
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="e.g. 5 days"
                          value={med.duration}
                          onChange={(e) =>
                            updateMedicineRow(
                              med.id,
                              "duration",
                              e.target.value,
                            )
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={med.route || "Oral"}
                          onChange={(e) =>
                            updateMedicineRow(med.id, "route", e.target.value)
                          }
                        >
                          {routePresets.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={med.timing || "After food"}
                          onChange={(e) =>
                            updateMedicineRow(med.id, "timing", e.target.value)
                          }
                        >
                          {timingPresets.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="dp-rx-btn-row">
                          <button
                            type="button"
                            className="dp-icon-action"
                            title="Move Up"
                            disabled={index === 0}
                            onClick={() => moveMedicineRow(index, "up")}
                          >
                            <FaArrowUp size={11} />
                          </button>
                          <button
                            type="button"
                            className="dp-icon-action"
                            title="Move Down"
                            disabled={index === medicines.length - 1}
                            onClick={() => moveMedicineRow(index, "down")}
                          >
                            <FaArrowDown size={11} />
                          </button>
                          <button
                            type="button"
                            className="dp-icon-action dp-icon-danger"
                            title="Remove Medicine"
                            onClick={() => removeMedicineRow(med.id)}
                          >
                            <FaTrash size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Quick Medicine Add Button */}
            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="dp-btn dp-btn-outline dp-btn-sm"
                onClick={addMedicineRow}
              >
                <FaPlus /> Add Another Medicine Row
              </button>
            </div>
          </div>

          {/* 6. Clinical Instructions & Follow-up */}
          <div className="dp-rx-editor-card">
            <div className="dp-rx-card-title">
              <FaInfoCircle color="#0284c7" />
              <h3>Clinical Instructions & Dietary Advice</h3>
            </div>
            <div className="dp-rx-two-col-grid">
              <label>
                <span>Dietary & Hydration Instructions</span>
                <textarea
                  rows={3}
                  placeholder="e.g. Drink plenty of warm water. Avoid oily, spicy food and cold beverages."
                  value={prescriptionInstructions.dietInstructions}
                  onChange={(e) =>
                    setPrescriptionInstructions({
                      ...prescriptionInstructions,
                      dietInstructions: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>General Clinical Advice & Regimen</span>
                <textarea
                  rows={3}
                  placeholder="e.g. Steam inhalation twice daily for 5 minutes. Adequate bed rest."
                  value={prescriptionInstructions.generalInstructions}
                  onChange={(e) =>
                    setPrescriptionInstructions({
                      ...prescriptionInstructions,
                      generalInstructions: e.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Follow-Up Advice & Review Schedule</span>
                <input
                  type="text"
                  placeholder="e.g. Review in OPD after 5 days or if high fever persists"
                  value={followUpAdvice}
                  onChange={(e) => {
                    setFollowUpAdvice(e.target.value);
                    setPrescriptionInstructions((prev) => ({
                      ...prev,
                      followUpInstructions: e.target.value,
                    }));
                  }}
                />
              </label>
              <label>
                <span>Additional Clinical Notes (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Patient advised on medication compliance"
                  value={prescriptionInstructions.additionalNotes}
                  onChange={(e) =>
                    setPrescriptionInstructions({
                      ...prescriptionInstructions,
                      additionalNotes: e.target.value,
                    })
                  }
                />
              </label>
            </div>
          </div>

          {/* 7. Save and Print Action Buttons */}
          <div className="dp-rx-footer-bar">
            <button
              type="button"
              className="dp-btn dp-btn-secondary"
              onClick={() => setViewMode("list")}
            >
              Cancel
            </button>
            <div className="dp-rx-footer-actions">
              <button
                type="button"
                className="dp-btn dp-btn-secondary"
                onClick={() => {
                  printPrescriptionSlip({
                    appointment: currentAppointment,
                    patient: currentPatient,
                    doctor: activeDoctorMeta || doctor,
                    diagnosis,
                    medicines: medicines.filter((m) => m.name.trim() !== ""),
                    prescriptionInstructions,
                    followUpAdvice,
                    prescription: customPrescriptionText,
                  });
                }}
              >
                <FaPrint /> Print Preview
              </button>
              <button
                type="submit"
                className="dp-btn dp-btn-primary"
                disabled={savingRx || globalSaving}
              >
                <FaSave />{" "}
                {savingRx ? "Saving..." : "Save & Issue Prescription"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Prescription Saved Success Modal */}
      {previewModalRx && (
        <div className="dp-modal-overlay">
          <div className="dp-modal-dialog dp-rx-success-modal">
            <div className="dp-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaCheckCircle color="#059669" size={20} />
                <h3>Digital Prescription Issued Successfully</h3>
              </div>
              <button
                type="button"
                className="dp-btn-close"
                onClick={() => setPreviewModalRx(null)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="dp-modal-body">
              <p>
                The digital prescription for{" "}
                <strong>{previewModalRx.patient?.name}</strong> has been saved
                to their official medical record.
              </p>
              <div className="dp-rx-preview-summary">
                <div>
                  <strong>Diagnosis:</strong>{" "}
                  {previewModalRx.diagnosis || "Clinical evaluation"}
                </div>
                <div>
                  <strong>Medications:</strong>{" "}
                  {previewModalRx.medicines?.length || 0} items prescribed
                </div>
                <div>
                  <strong>Follow-up:</strong>{" "}
                  {previewModalRx.followUpAdvice || "As advised"}
                </div>
              </div>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#64748b",
                  margin: "12px 0 0",
                }}
              >
                The patient can now view this prescription directly in their
                Patient Portal.
              </p>
            </div>
            <div className="dp-modal-footer">
              <button
                type="button"
                className="dp-btn dp-btn-secondary"
                onClick={() => {
                  setPreviewModalRx(null);
                  setViewMode("list");
                }}
              >
                Back to Prescriptions
              </button>
              <button
                type="button"
                className="dp-btn dp-btn-outline"
                onClick={() => {
                  let token = "";
                  try {
                    const raw =
                      sessionStorage.getItem("doctorApp") ||
                      localStorage.getItem("doctorApp");
                    token = JSON.parse(raw || "{}")?.token || "";
                  } catch (_) {}
                  const docId =
                    previewModalRx.appointment?._id ||
                    previewModalRx.prescriptionNumber;
                  const pdfUrl = `/api/v1/prescription/${docId}/pdf?token=${encodeURIComponent(token)}`;
                  window.open(pdfUrl, "_blank");
                }}
              >
                <FaFilePdf color="#ef4444" /> Download Official PDF
              </button>
              <button
                type="button"
                className="dp-btn dp-btn-primary"
                onClick={() => {
                  printPrescriptionSlip(previewModalRx);
                  setPreviewModalRx(null);
                  setViewMode("list");
                }}
              >
                <FaPrint /> Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadReportsView({
  doctorId,
  doctor,
  appointments = [],
  initialAppointmentId,
  initialPatientId,
  onSave,
  saving,
}) {
  const [reportsList, setReportsList] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [summary, setSummary] = useState({
    total: 0,
    bloodTest: 0,
    radiology: 0,
    pathology: 0,
    other: 0,
  });

  // Upload Form Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(
    Boolean(initialAppointmentId),
  );
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    initialAppointmentId || appointments[0]?._id || "",
  );
  const [reportCategory, setReportCategory] = useState("Blood Test");
  const [reportName, setReportName] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Preview & Delete Modals
  const [previewReport, setPreviewReport] = useState(null);
  const [deleteReportTarget, setDeleteReportTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const categories = [
    "Blood Test",
    "X-Ray",
    "CT Scan",
    "MRI",
    "Ultrasound",
    "Pathology",
    "Other Medical Report",
  ];

  // Fetch reports from backend
  const fetchReports = async () => {
    if (!doctorId) return;
    setLoadingReports(true);
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/reports?search=${encodeURIComponent(
          searchQuery,
        )}&category=${encodeURIComponent(categoryFilter)}`,
      );
      if (res.data.success) {
        setReportsList(res.data.reports || []);
        if (res.data.summary) setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Error loading reports list:", err);
      toast.error("Could not load medical reports");
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [doctorId, searchQuery, categoryFilter]);

  // Handle file picker selection
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    if (files[0] && !reportName) {
      setReportName(files[0].name.replace(/\.[^/.]+$/, ""));
    }
  };

  // Submit report upload
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAppointmentId) {
      toast.error("Please select an appointment for this report");
      return;
    }
    if (!selectedFiles.length) {
      toast.error("Please choose a file to upload");
      return;
    }

    setIsUploading(true);
    try {
      // Process files using toDataUrl or multipart form data
      const processedReports = await Promise.all(
        selectedFiles.map(async (file) => ({
          name: reportName.trim() || file.name,
          filename: file.name,
          mimeType: file.type || "application/pdf",
          size: file.size,
          category: reportCategory,
          type: reportCategory,
          notes: reportNotes.trim(),
          url: await toDataUrl(file),
        })),
      );

      const res = await api.post(
        `/api/v1/doctor/panel/${doctorId}/appointment/${selectedAppointmentId}/report`,
        { reports: processedReports },
      );

      if (res.data.success) {
        toast.success("Medical report uploaded successfully");
        setUploadModalOpen(false);
        setSelectedFiles([]);
        setReportName("");
        setReportNotes("");
        await fetchReports();
      }
    } catch (err) {
      console.error("Error uploading report:", err);
      toast.error(
        err.response?.data?.message || "Failed to upload medical report",
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Delete report
  const handleConfirmDelete = async () => {
    if (!deleteReportTarget) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(
        `/api/v1/doctor/panel/${doctorId}/appointment/${deleteReportTarget.appointmentId}/report/${deleteReportTarget._id}`,
      );
      if (res.data.success) {
        toast.success("Report deleted successfully");
        setDeleteReportTarget(null);
        await fetchReports();
      }
    } catch (err) {
      console.error("Error deleting report:", err);
      toast.error(
        err.response?.data?.message || "Failed to delete medical report",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="dp-reports-management-container">
      {/* Top Header */}
      <div className="dp-rx-top-bar">
        <div>
          <h2>
            <FaUpload color="#0284c7" /> Diagnostic Reports & Lab Center
          </h2>
          <p>
            Upload, inspect, and organize authorized patient lab tests,
            radiology scans, and medical documents
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="dp-btn dp-btn-secondary"
            onClick={fetchReports}
            disabled={loadingReports}
            title="Refresh Diagnostic Reports"
          >
            <FaSyncAlt className={loadingReports ? "dp-spin" : ""} /> Refresh
          </button>
          <button
            type="button"
            className="dp-btn dp-btn-primary"
            onClick={() => {
              if (appointments.length > 0 && !selectedAppointmentId) {
                setSelectedAppointmentId(appointments[0]._id);
              }
              setUploadModalOpen(true);
            }}
          >
            <FaUpload /> Upload Patient Report
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="dp-rx-stats-row">
        <div className="dp-rx-stat-card">
          <div
            className="dp-rx-stat-icon"
            style={{ background: "#eff6ff", color: "#2563eb" }}
          >
            <FaFileMedical size={22} />
          </div>
          <div>
            <span className="dp-rx-stat-label">Total Reports</span>
            <strong className="dp-rx-stat-val">{summary.total}</strong>
          </div>
        </div>
        <div className="dp-rx-stat-card">
          <div
            className="dp-rx-stat-icon"
            style={{ background: "#fef2f2", color: "#dc2626" }}
          >
            <FaHeartbeat size={22} />
          </div>
          <div>
            <span className="dp-rx-stat-label">Blood & Lab Tests</span>
            <strong className="dp-rx-stat-val">{summary.bloodTest}</strong>
          </div>
        </div>
        <div className="dp-rx-stat-card">
          <div
            className="dp-rx-stat-icon"
            style={{ background: "#ecfdf5", color: "#059669" }}
          >
            <FaFileAlt size={22} />
          </div>
          <div>
            <span className="dp-rx-stat-label">Radiology / Scans</span>
            <strong className="dp-rx-stat-val">{summary.radiology}</strong>
          </div>
        </div>
        <div className="dp-rx-stat-card">
          <div
            className="dp-rx-stat-icon"
            style={{ background: "#f5f3ff", color: "#7c3aed" }}
          >
            <FaFolderOpen size={22} />
          </div>
          <div>
            <span className="dp-rx-stat-label">Pathology & Other</span>
            <strong className="dp-rx-stat-val">
              {summary.pathology + summary.other}
            </strong>
          </div>
        </div>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="dp-reports-filter-bar">
        <div className="dp-rx-search-input">
          <FaSearch />
          <input
            type="text"
            placeholder="Search reports by report title, patient name, or file name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="dp-clear-btn"
              onClick={() => setSearchQuery("")}
            >
              <FaTimes />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="dp-category-pill-group">
          {["all", ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              className={`dp-category-pill ${
                categoryFilter === cat ? "active" : ""
              }`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === "all" ? "All Categories" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table / List */}
      {loadingReports ? (
        <div className="dp-rx-loading">
          <FaSyncAlt className="dp-spin" size={24} />
          <p>Loading medical reports...</p>
        </div>
      ) : reportsList.length === 0 ? (
        <div className="dp-rx-empty-state">
          <FaUpload size={42} color="#cbd5e1" />
          <h3>No Medical Reports Found</h3>
          <p>
            {searchQuery || categoryFilter !== "all"
              ? "No reports match your current filters."
              : "No diagnostic or laboratory reports have been uploaded yet."}
          </p>
          <button
            type="button"
            className="dp-btn dp-btn-primary"
            onClick={() => setUploadModalOpen(true)}
          >
            <FaUpload /> Upload Medical Report
          </button>
        </div>
      ) : (
        <div className="dp-rx-table-container">
          <table className="dp-rx-table">
            <thead>
              <tr>
                <th>Report Details</th>
                <th>Category</th>
                <th>Patient</th>
                <th>Appointment Date</th>
                <th>Uploaded</th>
                <th>Notes</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reportsList.map((rep) => {
                const pat = rep.patient || {};
                const isPdf =
                  rep.mimeType === "application/pdf" ||
                  (rep.name || "").toLowerCase().endsWith(".pdf");
                return (
                  <tr key={rep._id}>
                    <td>
                      <div className="dp-report-file-item">
                        <div
                          className="dp-report-icon-box"
                          style={{
                            background: isPdf ? "#fef2f2" : "#eff6ff",
                            color: isPdf ? "#dc2626" : "#2563eb",
                          }}
                        >
                          {isPdf ? (
                            <FaFilePdf size={18} />
                          ) : (
                            <FaFileMedical size={18} />
                          )}
                        </div>
                        <div>
                          <strong>{rep.name}</strong>
                          <small>
                            {rep.size
                              ? `${Math.round(rep.size / 1024)} KB`
                              : "Document"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="dp-category-badge">{rep.category}</span>
                    </td>
                    <td>
                      <div className="dp-rx-pat-info">
                        <div>
                          <strong>{pat.name || "Patient"}</strong>
                          <small>{pat.phone || pat.email || "—"}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="dp-rx-date-cell">
                        <strong>{rep.slotDate || "—"}</strong>
                        <small>{rep.slotTime || "Consultation"}</small>
                      </div>
                    </td>
                    <td>
                      <small>
                        {rep.uploadedAt
                          ? new Date(rep.uploadedAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "—"}
                      </small>
                    </td>
                    <td>
                      <small className="dp-report-notes">
                        {rep.notes || "—"}
                      </small>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="dp-rx-row-actions">
                        <button
                          type="button"
                          className="dp-action-icon-btn"
                          title="Preview Report"
                          onClick={() => setPreviewReport(rep)}
                        >
                          <FaEye color="#2563eb" />
                        </button>
                        <a
                          href={rep.url}
                          download={rep.name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dp-action-icon-btn"
                          title="Download Report"
                        >
                          <FaDownload color="#059669" />
                        </a>
                        <button
                          type="button"
                          className="dp-action-icon-btn dp-danger-action"
                          title="Delete Report"
                          onClick={() => setDeleteReportTarget(rep)}
                        >
                          <FaTrash color="#dc2626" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* UPLOAD REPORT MODAL */}
      {uploadModalOpen && (
        <div className="dp-modal-overlay">
          <div className="dp-modal-dialog">
            <div className="dp-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaUpload color="#0284c7" />
                <h3>Upload Patient Medical Report</h3>
              </div>
              <button
                type="button"
                className="dp-btn-close"
                onClick={() => {
                  setUploadModalOpen(false);
                  setSelectedFiles([]);
                }}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <div className="dp-modal-body">
                {/* 1. Select Appointment */}
                <label className="dp-modal-field">
                  <span>
                    Select Patient / Appointment{" "}
                    <span style={{ color: "#ef4444" }}>*</span>
                  </span>
                  <select
                    value={selectedAppointmentId}
                    onChange={(e) => setSelectedAppointmentId(e.target.value)}
                    required
                  >
                    {appointments.map((apt) => {
                      const pat = apt.patient || apt.userId || {};
                      return (
                        <option key={apt._id} value={apt._id}>
                          {pat.name || "Patient"} — {apt.slotDate} (
                          {apt.slotTime || "OPD"})
                        </option>
                      );
                    })}
                  </select>
                </label>

                {/* 2. Category & Report Title */}
                <div className="dp-modal-two-col">
                  <label className="dp-modal-field">
                    <span>
                      Report Category{" "}
                      <span style={{ color: "#ef4444" }}>*</span>
                    </span>
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="dp-modal-field">
                    <span>Report Title / Document Name</span>
                    <input
                      type="text"
                      placeholder="e.g. Complete Blood Count (CBC)"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                    />
                  </label>
                </div>

                {/* 3. Clinical Notes */}
                <label className="dp-modal-field">
                  <span>Clinical Findings / Impression Notes</span>
                  <textarea
                    rows={2}
                    placeholder="e.g. Normal values, no acute pathology detected..."
                    value={reportNotes}
                    onChange={(e) => setReportNotes(e.target.value)}
                  />
                </label>

                {/* 4. File Drop Zone */}
                <label className="dp-upload-dropzone">
                  <input
                    type="file"
                    multiple
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <FaUpload size={28} color="#0284c7" />
                  <div>
                    <strong>Choose PDF or Image file (JPG/PNG)</strong>
                    <small>Supports files up to 15MB</small>
                  </div>
                  {selectedFiles.length > 0 && (
                    <div className="dp-selected-file-pill">
                      <FaCheckCircle color="#059669" /> {selectedFiles.length}{" "}
                      {selectedFiles.length === 1
                        ? "file selected"
                        : "files selected"}
                      : {selectedFiles.map((f) => f.name).join(", ")}
                    </div>
                  )}
                </label>
              </div>

              <div className="dp-modal-footer">
                <button
                  type="button"
                  className="dp-btn dp-btn-secondary"
                  onClick={() => {
                    setUploadModalOpen(false);
                    setSelectedFiles([]);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dp-btn dp-btn-primary"
                  disabled={isUploading || selectedFiles.length === 0}
                >
                  {isUploading ? (
                    <>
                      <FaSyncAlt className="dp-spin" /> Uploading...
                    </>
                  ) : (
                    <>
                      <FaUpload /> Upload & Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW REPORT MODAL */}
      {previewReport && (
        <div
          className="dp-modal-overlay"
          onClick={() => setPreviewReport(null)}
        >
          <div
            className="dp-modal-dialog dp-preview-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dp-modal-header">
              <div>
                <h3>{previewReport.name}</h3>
                <small>
                  {previewReport.category} · Uploaded:{" "}
                  {previewReport.uploadedAt
                    ? new Date(previewReport.uploadedAt).toLocaleDateString()
                    : "—"}
                </small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={previewReport.url}
                  download={previewReport.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dp-btn dp-btn-secondary dp-btn-sm"
                >
                  <FaDownload /> Download
                </a>
                <button
                  type="button"
                  className="dp-btn-close"
                  onClick={() => setPreviewReport(null)}
                >
                  <FaTimes />
                </button>
              </div>
            </div>
            <div className="dp-modal-body dp-preview-body">
              {previewReport.mimeType?.startsWith("image/") ||
              previewReport.url?.startsWith("data:image/") ||
              /\.(jpg|jpeg|png|webp)$/i.test(previewReport.url || "") ? (
                <img
                  src={previewReport.url}
                  alt={previewReport.name}
                  className="dp-preview-image"
                />
              ) : (
                <iframe
                  src={previewReport.url}
                  title={previewReport.name}
                  className="dp-preview-iframe"
                />
              )}
              {previewReport.notes && (
                <div className="dp-preview-notes-box">
                  <strong>Doctor's Findings:</strong> {previewReport.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteReportTarget && (
        <div className="dp-modal-overlay">
          <div className="dp-modal-dialog dp-delete-confirm-dialog">
            <div className="dp-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaExclamationTriangle color="#dc2626" size={20} />
                <h3>Delete Medical Report?</h3>
              </div>
              <button
                type="button"
                className="dp-btn-close"
                onClick={() => setDeleteReportTarget(null)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="dp-modal-body">
              <p>
                Are you sure you want to permanently delete{" "}
                <strong>{deleteReportTarget.name}</strong> from patient medical
                records?
              </p>
              <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
                This action cannot be undone and will remove the file for both
                doctor and patient.
              </p>
            </div>
            <div className="dp-modal-footer">
              <button
                type="button"
                className="dp-btn dp-btn-secondary"
                onClick={() => setDeleteReportTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dp-btn dp-btn-danger"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AvailabilityView({ doctor, doctorId, onSaved }) {
  const [activeTab, setActiveTab] = useState("calendar"); // "calendar" | "weekly" | "overrides"
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Doctor Schedule Config State
  const [scheduleConfig, setScheduleConfig] = useState({
    available: Boolean(doctor.available),
    slotDurationMinutes: doctor.slotDurationMinutes || 30,
    availabilitySchedule:
      doctor.availabilitySchedule || "Mon - Sat, 09:00 AM - 05:00 PM",
    weeklySchedule: doctor.weeklySchedule?.length
      ? doctor.weeklySchedule
      : [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ].map((day) => ({
          day,
          enabled: day !== "Sunday",
          startTime: "09:00 AM",
          endTime: "05:00 PM",
          sessions: [
            { name: "Morning OPD", startTime: "09:00 AM", endTime: "01:00 PM" },
            { name: "Evening OPD", startTime: "02:00 PM", endTime: "05:00 PM" },
          ],
          breaks: [
            { name: "Lunch Break", startTime: "01:00 PM", endTime: "02:00 PM" },
          ],
        })),
    breakTimes: doctor.breakTimes || [],
    dateOverrides: doctor.dateOverrides || [],
    leaves: doctor.leaves || [],
    leaveDates: doctor.leaveDates || [],
    blockedHolidays: doctor.blockedHolidays || [],
  });

  // Calendar State
  const [calendarViewMode, setCalendarViewMode] = useState("week"); // "day" | "week" | "month"
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);
  const [calendarSummary, setCalendarSummary] = useState(null);

  // Selected Slot / Appointment Detail Modal State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [blockingReason, setBlockingReason] = useState("");
  const [blockingLoading, setBlockingLoading] = useState(false);

  // Smart Slot Generation Modal State
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    rangePreset: "7", // "7", "14", "30", "custom"
    startDate: "",
    endDate: "",
    slotDuration: doctor.slotDurationMinutes || 30,
    overwriteExistingUnbooked: false,
  });
  const [generatingSlots, setGeneratingSlots] = useState(false);

  // Format Helper: date to DD-MM-YYYY
  const formatDateDDMMYYYY = (d) => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${d.getFullYear()}`;
  };

  // Fetch Doctor Schedule Configuration
  const loadScheduleConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/doctor/panel/${doctorId}/schedule`);
      if (res.data?.success && res.data?.schedule) {
        setScheduleConfig(res.data.schedule);
      }
    } catch (err) {
      console.error("Error loading doctor schedule config:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate Date Range based on current calendar date and view mode
  const getDateRangeForView = (currentDate, mode) => {
    const curr = new Date(currentDate);
    curr.setHours(0, 0, 0, 0);

    if (mode === "day") {
      const dStr = formatDateDDMMYYYY(curr);
      return { start: dStr, end: dStr };
    }

    if (mode === "week") {
      // Start on Monday of current week
      const day = curr.getDay();
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(curr.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        start: formatDateDDMMYYYY(monday),
        end: formatDateDDMMYYYY(sunday),
      };
    }

    if (mode === "month") {
      // 1st of month to last of month (up to 31 days)
      const firstDay = new Date(curr.getFullYear(), curr.getMonth(), 1);
      const lastDay = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
      return {
        start: formatDateDDMMYYYY(firstDay),
        end: formatDateDDMMYYYY(lastDay),
      };
    }

    return { start: formatDateDDMMYYYY(curr), end: formatDateDDMMYYYY(curr) };
  };

  // Fetch Calendar Slots for Current Range
  const loadCalendar = async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRangeForView(
        calendarDate,
        calendarViewMode,
      );
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/calendar?startDate=${start}&endDate=${end}`,
      );
      if (res.data?.success) {
        setCalendarDays(res.data.days || []);
        setCalendarSummary(res.data.summary || null);
      }
    } catch (err) {
      console.error("Error loading calendar slots:", err);
      toast.error(
        err.response?.data?.message || "Failed to load calendar slots",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScheduleConfig();
  }, [doctorId]);

  useEffect(() => {
    if (activeTab === "calendar") {
      loadCalendar();
    }
  }, [activeTab, calendarDate, calendarViewMode]);

  // Calendar Navigation
  const navigateCalendar = (step) => {
    const next = new Date(calendarDate);
    if (calendarViewMode === "day") {
      next.setDate(next.getDate() + step);
    } else if (calendarViewMode === "week") {
      next.setDate(next.getDate() + step * 7);
    } else if (calendarViewMode === "month") {
      next.setMonth(next.getMonth() + step);
    }
    setCalendarDate(next);
  };

  const jumpToToday = () => {
    setCalendarDate(new Date());
  };

  // Availability Master Toggle
  const toggleAvailableStatus = async () => {
    try {
      const nextStatus = !scheduleConfig.available;
      await api.patch(`/api/v1/doctor/panel/${doctorId}/availability`, {
        available: nextStatus,
      });
      setScheduleConfig((prev) => ({ ...prev, available: nextStatus }));
      toast.success(
        nextStatus
          ? "Doctor availability activated (Online for bookings)"
          : "Doctor availability paused (Offline for bookings)",
      );
      if (onSaved) onSaved();
    } catch (err) {
      toast.error("Failed to update availability status");
    }
  };

  // Save Weekly Schedule & Session Config
  const saveWeeklySchedule = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await api.patch(`/api/v1/doctor/panel/${doctorId}/schedule`, {
        weeklySchedule: scheduleConfig.weeklySchedule,
        slotDurationMinutes: scheduleConfig.slotDurationMinutes,
        breakTimes: scheduleConfig.breakTimes,
        dateOverrides: scheduleConfig.dateOverrides,
        leaveDates: scheduleConfig.leaveDates,
        blockedHolidays: scheduleConfig.blockedHolidays,
      });
      if (res.data?.success) {
        toast.success("Schedule configuration saved successfully");
        if (onSaved) onSaved();
        if (activeTab === "calendar") loadCalendar();
      }
    } catch (err) {
      console.error("Save schedule error:", err);
      toast.error(err.response?.data?.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  // Block Slot Handler
  const handleBlockSlot = async () => {
    if (!selectedSlot) return;
    try {
      setBlockingLoading(true);
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/slots/block`,
        {
          date: selectedSlot.date,
          slotTime: selectedSlot.slotTime || selectedSlot.startTime,
          reason: blockingReason || "Doctor Unavailable / Emergency",
        },
      );
      if (res.data?.success) {
        toast.success(res.data.message);
        setSelectedSlot(null);
        setBlockingReason("");
        loadCalendar();
      }
    } catch (err) {
      console.error("Block slot error:", err);
      toast.error(err.response?.data?.message || "Failed to block slot");
    } finally {
      setBlockingLoading(false);
    }
  };

  // Unblock Slot Handler
  const handleUnblockSlot = async () => {
    if (!selectedSlot) return;
    try {
      setBlockingLoading(true);
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/slots/unblock`,
        {
          date: selectedSlot.date,
          slotTime: selectedSlot.slotTime || selectedSlot.startTime,
        },
      );
      if (res.data?.success) {
        toast.success(res.data.message);
        setSelectedSlot(null);
        loadCalendar();
      }
    } catch (err) {
      console.error("Unblock slot error:", err);
      toast.error(err.response?.data?.message || "Failed to unblock slot");
    } finally {
      setBlockingLoading(false);
    }
  };

  // Smart Slot Generation Trigger
  const handleTriggerGenerate = async () => {
    let start = generateForm.startDate;
    let end = generateForm.endDate;

    if (generateForm.rangePreset !== "custom") {
      const daysCount = Number(generateForm.rangePreset) || 7;
      const s = new Date();
      const e = new Date();
      e.setDate(s.getDate() + (daysCount - 1));
      start = formatDateDDMMYYYY(s);
      end = formatDateDDMMYYYY(e);
    }

    if (!start) {
      toast.error("Please provide a valid start date");
      return;
    }

    try {
      setGeneratingSlots(true);
      const res = await api.post(
        `/api/v1/doctor/panel/${doctorId}/slots/generate`,
        {
          startDate: start,
          endDate: end,
          slotDuration: generateForm.slotDuration,
          overwriteExistingUnbooked: generateForm.overwriteExistingUnbooked,
        },
      );

      if (res.data?.success) {
        toast.success(res.data.message || "Slots generated successfully");
        setShowGenerateModal(false);
        loadCalendar();
      }
    } catch (err) {
      console.error("Generate slots error:", err);
      toast.error(err.response?.data?.message || "Failed to generate slots");
    } finally {
      setGeneratingSlots(false);
    }
  };

  return (
    <div className="dp-schedule-container">
      {/* Header & KPI Card */}
      <div className="dp-schedule-header-card">
        <div className="dp-schedule-header-top">
          <div className="dp-schedule-title-area">
            <h2>
              <FaCalendarAlt style={{ color: "#2563eb" }} /> Doctor Availability
              & Smart Scheduling
            </h2>
            <p>
              Manage outpatient session timings, generate booking slots, and
              organize clinical calendar in real-time.
            </p>
          </div>
          <div className="dp-schedule-header-controls">
            <button
              type="button"
              className={`dp-toggle-pill ${scheduleConfig.available ? "online" : "offline"}`}
              onClick={toggleAvailableStatus}
              title="Toggle Doctor Availability"
            >
              {scheduleConfig.available ? (
                <>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                  Online for Appointments
                </>
              ) : (
                <>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#ef4444",
                    }}
                  />
                  Offline / Paused
                </>
              )}
            </button>
            <div className="dp-slot-duration-badge">
              <FaClock /> {scheduleConfig.slotDurationMinutes} mins / slot
            </div>
            <button
              type="button"
              className="dp-light-btn"
              style={{ padding: "7px 16px", fontSize: "0.82rem" }}
              onClick={() => {
                const now = new Date();
                const end = new Date();
                end.setDate(now.getDate() + 6);
                setGenerateForm({
                  rangePreset: "7",
                  startDate: formatDateDDMMYYYY(now),
                  endDate: formatDateDDMMYYYY(end),
                  slotDuration: scheduleConfig.slotDurationMinutes,
                  overwriteExistingUnbooked: false,
                });
                setShowGenerateModal(true);
              }}
            >
              <FaSyncAlt /> Generate Slots
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="dp-schedule-kpi-grid">
          <div className="dp-schedule-kpi-tile">
            <div className="dp-schedule-kpi-icon blue">
              <FaCalendarDay />
            </div>
            <div className="dp-schedule-kpi-info">
              <span>View Total Slots</span>
              <strong>
                {calendarSummary ? calendarSummary.totalSlots : "—"}
              </strong>
            </div>
          </div>
          <div className="dp-schedule-kpi-tile">
            <div className="dp-schedule-kpi-icon green">
              <FaCheckCircle />
            </div>
            <div className="dp-schedule-kpi-info">
              <span>Available Slots</span>
              <strong>
                {calendarSummary ? calendarSummary.totalAvailable : "—"}
              </strong>
            </div>
          </div>
          <div className="dp-schedule-kpi-tile">
            <div className="dp-schedule-kpi-icon amber">
              <FaUserCheck />
            </div>
            <div className="dp-schedule-kpi-info">
              <span>Booked Patients</span>
              <strong>
                {calendarSummary ? calendarSummary.totalBooked : "—"}
              </strong>
            </div>
          </div>
          <div className="dp-schedule-kpi-tile">
            <div className="dp-schedule-kpi-icon red">
              <FaLock />
            </div>
            <div className="dp-schedule-kpi-info">
              <span>Blocked Slots</span>
              <strong>
                {calendarSummary ? calendarSummary.totalBlocked : "—"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="dp-schedule-tabs">
        <button
          type="button"
          className={`dp-schedule-tab-btn ${activeTab === "calendar" ? "active" : ""}`}
          onClick={() => setActiveTab("calendar")}
        >
          <FaCalendarAlt /> Smart Calendar Workspace
        </button>
        <button
          type="button"
          className={`dp-schedule-tab-btn ${activeTab === "weekly" ? "active" : ""}`}
          onClick={() => setActiveTab("weekly")}
        >
          <FaClock /> Weekly Schedule & Sessions
        </button>
        <button
          type="button"
          className={`dp-schedule-tab-btn ${activeTab === "overrides" ? "active" : ""}`}
          onClick={() => setActiveTab("overrides")}
        >
          <FaCalendarCheck /> Date Overrides & Leaves
        </button>
      </div>

      {/* TAB 1: SMART CALENDAR WORKSPACE */}
      {activeTab === "calendar" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Calendar Toolbar */}
          <div className="dp-calendar-toolbar">
            <div className="dp-calendar-nav-group">
              <button
                type="button"
                className="dp-light-btn"
                style={{ padding: "6px 12px" }}
                onClick={() => navigateCalendar(-1)}
                title="Previous"
              >
                <FaChevronLeft />
              </button>
              <button
                type="button"
                className="dp-light-btn"
                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                onClick={jumpToToday}
              >
                Today
              </button>
              <button
                type="button"
                className="dp-light-btn"
                style={{ padding: "6px 12px" }}
                onClick={() => navigateCalendar(1)}
                title="Next"
              >
                <FaChevronRight />
              </button>
              <span
                style={{
                  fontWeight: 700,
                  color: "#1e293b",
                  marginLeft: 8,
                  fontSize: "0.95rem",
                }}
              >
                {calendarSummary
                  ? `${calendarSummary.startDate} to ${calendarSummary.endDate}`
                  : formatDateDDMMYYYY(calendarDate)}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="dp-calendar-view-picker">
                <button
                  type="button"
                  className={`dp-calendar-view-btn ${calendarViewMode === "day" ? "active" : ""}`}
                  onClick={() => setCalendarViewMode("day")}
                >
                  Day
                </button>
                <button
                  type="button"
                  className={`dp-calendar-view-btn ${calendarViewMode === "week" ? "active" : ""}`}
                  onClick={() => setCalendarViewMode("week")}
                >
                  Week (7 Days)
                </button>
                <button
                  type="button"
                  className={`dp-calendar-view-btn ${calendarViewMode === "month" ? "active" : ""}`}
                  onClick={() => setCalendarViewMode("month")}
                >
                  Month
                </button>
              </div>
              <button
                type="button"
                className="dp-light-btn"
                style={{ padding: "6px 12px" }}
                onClick={loadCalendar}
                disabled={loading}
                title="Refresh Calendar"
              >
                <FaSyncAlt className={loading ? "dp-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Calendar Slots Grid */}
          <div className="dp-calendar-grid">
            {calendarDays.map((dayItem) => (
              <div className="dp-calendar-day-card" key={dayItem.date}>
                <div className="dp-calendar-day-header">
                  <div className="dp-calendar-day-title">
                    <strong>{dayItem.day}</strong>
                    <span>{dayItem.date}</span>
                  </div>
                  <span
                    className={`dp-calendar-day-badge ${
                      dayItem.leaveType
                        ? "leave"
                        : dayItem.isWorkingDay
                          ? "working"
                          : "off"
                    }`}
                  >
                    {dayItem.leaveType
                      ? "On Leave"
                      : dayItem.isWorkingDay
                        ? `${dayItem.availableSlots} Avail`
                        : dayItem.reason || "Off"}
                  </span>
                </div>

                <div className="dp-calendar-slots-scroll">
                  {dayItem.slots && dayItem.slots.length > 0 ? (
                    dayItem.slots.map((slot, idx) => {
                      const statusClass = (
                        slot.status || "available"
                      ).toLowerCase();
                      return (
                        <div
                          key={idx}
                          className={`dp-slot-pill ${statusClass}`}
                          onClick={() => setSelectedSlot(slot)}
                          title={`Click to view details or manage: ${slot.startTime} (${slot.status})`}
                        >
                          <span>{slot.startTime}</span>
                          <small>{slot.status}</small>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      style={{
                        padding: "24px 12px",
                        textAlign: "center",
                        width: "100%",
                        color: "#94a3b8",
                        fontSize: "0.85rem",
                      }}
                    >
                      {dayItem.isWorkingDay
                        ? "No slots generated for this day yet."
                        : `Not a working session: ${dayItem.reason || "Doctor Off"}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: WEEKLY SCHEDULE & SESSIONS */}
      {activeTab === "weekly" && (
        <Panel title="Weekly Outpatient Schedule & Working Sessions">
          <form
            onSubmit={saveWeeklySchedule}
            className="dp-form"
            style={{ maxWidth: "100%" }}
          >
            <div
              style={{
                display: "flex",
                gap: 20,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: 0,
                }}
              >
                <span>Slot Duration (Minutes):</span>
                <select
                  style={{ width: 130 }}
                  value={scheduleConfig.slotDurationMinutes}
                  onChange={(e) =>
                    setScheduleConfig({
                      ...scheduleConfig,
                      slotDurationMinutes: Number(e.target.value),
                    })
                  }
                >
                  <option value={15}>15 mins</option>
                  <option value={20}>20 mins</option>
                  <option value={30}>30 mins</option>
                  <option value={45}>45 mins</option>
                  <option value={60}>60 mins</option>
                </select>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: 0,
                }}
              >
                <span>Summary Label:</span>
                <input
                  type="text"
                  style={{ width: 280 }}
                  value={scheduleConfig.availabilitySchedule}
                  onChange={(e) =>
                    setScheduleConfig({
                      ...scheduleConfig,
                      availabilitySchedule: e.target.value,
                    })
                  }
                  placeholder="e.g. Mon - Sat, 09:00 AM - 05:00 PM"
                />
              </label>
            </div>

            <table className="dp-weekly-table">
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color: "#64748b",
                    fontSize: "0.82rem",
                  }}
                >
                  <th style={{ padding: "0 18px 8px" }}>WORKING DAY</th>
                  <th style={{ padding: "0 18px 8px" }}>START TIME</th>
                  <th style={{ padding: "0 18px 8px" }}>END TIME</th>
                  <th style={{ padding: "0 18px 8px" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {scheduleConfig.weeklySchedule.map((dayItem, index) => (
                  <tr className="dp-weekly-row" key={dayItem.day}>
                    <td>
                      <div className="dp-weekly-day-cell">
                        <input
                          type="checkbox"
                          checked={Boolean(dayItem.enabled)}
                          onChange={(e) => {
                            const next = [...scheduleConfig.weeklySchedule];
                            next[index].enabled = e.target.checked;
                            setScheduleConfig({
                              ...scheduleConfig,
                              weeklySchedule: next,
                            });
                          }}
                        />
                        <strong>{dayItem.day}</strong>
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        disabled={!dayItem.enabled}
                        value={dayItem.startTime || "09:00 AM"}
                        onChange={(e) => {
                          const next = [...scheduleConfig.weeklySchedule];
                          next[index].startTime = e.target.value;
                          setScheduleConfig({
                            ...scheduleConfig,
                            weeklySchedule: next,
                          });
                        }}
                        placeholder="09:00 AM"
                        style={{
                          padding: "7px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          width: 120,
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        disabled={!dayItem.enabled}
                        value={dayItem.endTime || "05:00 PM"}
                        onChange={(e) => {
                          const next = [...scheduleConfig.weeklySchedule];
                          next[index].endTime = e.target.value;
                          setScheduleConfig({
                            ...scheduleConfig,
                            weeklySchedule: next,
                          });
                        }}
                        placeholder="05:00 PM"
                        style={{
                          padding: "7px 10px",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          width: 120,
                        }}
                      />
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: dayItem.enabled ? "#15803d" : "#94a3b8",
                        }}
                      >
                        {dayItem.enabled ? "Active Session" : "Off / Closed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 20 }}>
              <label>
                <span>
                  Break times (Format per line: Day, Start, End — e.g. Monday,
                  01:00 PM, 02:00 PM)
                </span>
                <textarea
                  rows={4}
                  value={scheduleConfig.breakTimes
                    ?.map(
                      (b) => `${b.day || "All"}, ${b.startTime}, ${b.endTime}`,
                    )
                    .join("\n")}
                  onChange={(e) => {
                    const parsed = e.target.value
                      .split("\n")
                      .filter(Boolean)
                      .map((line) => {
                        const [day = "", startTime = "", endTime = ""] = line
                          .split(",")
                          .map((p) => p.trim());
                        return { day, startTime, endTime };
                      });
                    setScheduleConfig({
                      ...scheduleConfig,
                      breakTimes: parsed,
                    });
                  }}
                  placeholder="Monday, 01:00 PM, 02:00 PM"
                />
              </label>
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <button type="submit" disabled={saving} className="dp-light-btn">
                <FaSave />{" "}
                {saving ? "Saving Schedule..." : "Save Schedule Settings"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* TAB 3: DATE OVERRIDES & LEAVES */}
      {activeTab === "overrides" && (
        <Panel title="Doctor Leaves & Hospital Date Overrides">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Active Leaves */}
            <div
              style={{
                background: "#f8fafc",
                padding: 18,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px",
                  color: "#1e293b",
                  fontSize: "1rem",
                }}
              >
                Approved Doctor Leaves
              </h4>
              {scheduleConfig.leaves && scheduleConfig.leaves.length > 0 ? (
                scheduleConfig.leaves
                  .filter((l) => l.status !== "cancelled")
                  .map((l, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "10px 14px",
                        background: "#fff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        marginBottom: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <strong>🏖 Leave: {l.startDate}</strong>
                        {l.endDate && l.endDate !== l.startDate
                          ? ` to ${l.endDate}`
                          : ""}{" "}
                        <span style={{ color: "#64748b", marginLeft: 8 }}>
                          ({l.reason})
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "#dcfce7",
                          color: "#15803d",
                        }}
                      >
                        {l.status}
                      </span>
                    </div>
                  ))
              ) : (
                <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
                  No active leaves on record. Leaves can be requested through
                  hospital administration.
                </p>
              )}
            </div>

            {/* Date Overrides */}
            <div
              style={{
                background: "#f8fafc",
                padding: 18,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px",
                  color: "#1e293b",
                  fontSize: "1rem",
                }}
              >
                Specific Date Overrides
              </h4>
              {scheduleConfig.dateOverrides &&
              scheduleConfig.dateOverrides.length > 0 ? (
                scheduleConfig.dateOverrides.map((o, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "10px 14px",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                  >
                    <strong>🗓 {o.date}</strong> —{" "}
                    <span
                      style={{
                        color: o.isClosed ? "#dc2626" : "#16a34a",
                        fontWeight: "bold",
                      }}
                    >
                      {o.isClosed ? "CLOSED" : "SPECIAL OPD HOURS"}
                    </span>{" "}
                    {o.startTime && o.endTime
                      ? `(${o.startTime} - ${o.endTime})`
                      : ""}{" "}
                    {o.reason ? `— ${o.reason}` : ""}
                  </div>
                ))
              ) : (
                <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
                  No date overrides active. Regular weekly schedule applies
                  across all dates.
                </p>
              )}
            </div>

            {/* Blocked Hospital Holidays */}
            <div
              style={{
                background: "#f8fafc",
                padding: 18,
                borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}
            >
              <h4
                style={{
                  margin: "0 0 10px",
                  color: "#1e293b",
                  fontSize: "1rem",
                }}
              >
                Hospital Gazetted Holidays
              </h4>
              {scheduleConfig.blockedHolidays &&
              scheduleConfig.blockedHolidays.length > 0 ? (
                scheduleConfig.blockedHolidays.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "8px 12px",
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      marginBottom: 6,
                    }}
                  >
                    <strong>{h.date}:</strong>{" "}
                    {h.reason || "Official Hospital Holiday"}
                  </div>
                ))
              ) : (
                <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
                  No official hospital holidays configured for this period.
                </p>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* MODAL: SMART SLOT GENERATOR DIALOG */}
      {showGenerateModal && (
        <div
          className="dp-modal-overlay"
          onClick={() => setShowGenerateModal(false)}
        >
          <div className="dp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="dp-modal-header">
              <h3>
                <FaSyncAlt style={{ color: "#2563eb" }} /> Generate Appointment
                Slots
              </h3>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                }}
                onClick={() => setShowGenerateModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="dp-modal-body">
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#64748b",
                  margin: "0 0 16px",
                }}
              >
                Generate outpatient consultation slots according to your weekly
                schedule.
                <strong>
                  {" "}
                  Active patient bookings and blocked slots will strictly remain
                  preserved.
                </strong>
              </p>

              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: "0.85rem",
                  }}
                >
                  <strong>Generation Window Preset:</strong>
                  <select
                    value={generateForm.rangePreset}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        rangePreset: e.target.value,
                      })
                    }
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <option value="7">Next 7 Days (Upcoming Week)</option>
                    <option value="14">Next 14 Days (Two Weeks)</option>
                    <option value="30">Next 30 Days (Full Month)</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </label>

                {generateForm.rangePreset === "custom" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 12,
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: "0.85rem",
                      }}
                    >
                      <strong>Start Date (DD-MM-YYYY):</strong>
                      <input
                        type="text"
                        placeholder="DD-MM-YYYY"
                        value={generateForm.startDate}
                        onChange={(e) =>
                          setGenerateForm({
                            ...generateForm,
                            startDate: e.target.value,
                          })
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                        }}
                      />
                    </label>
                    <label
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        fontSize: "0.85rem",
                      }}
                    >
                      <strong>End Date (DD-MM-YYYY):</strong>
                      <input
                        type="text"
                        placeholder="DD-MM-YYYY"
                        value={generateForm.endDate}
                        onChange={(e) =>
                          setGenerateForm({
                            ...generateForm,
                            endDate: e.target.value,
                          })
                        }
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                        }}
                      />
                    </label>
                  </div>
                )}

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    fontSize: "0.85rem",
                  }}
                >
                  <strong>Slot Duration:</strong>
                  <select
                    value={generateForm.slotDuration}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        slotDuration: Number(e.target.value),
                      })
                    }
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={generateForm.overwriteExistingUnbooked}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        overwriteExistingUnbooked: e.target.checked,
                      })
                    }
                  />
                  <span>Re-align existing unbooked slots to new schedule</span>
                </label>
              </div>
            </div>
            <div className="dp-modal-footer">
              <button
                type="button"
                className="dp-light-btn"
                style={{ background: "#f1f5f9", color: "#475569" }}
                onClick={() => setShowGenerateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dp-light-btn"
                onClick={handleTriggerGenerate}
                disabled={generatingSlots}
              >
                {generatingSlots ? "Generating Slots..." : "Generate Slots Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SLOT DETAILS & MANAGEMENT DRAWER */}
      {selectedSlot && (
        <div className="dp-modal-overlay" onClick={() => setSelectedSlot(null)}>
          <div className="dp-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="dp-modal-header">
              <h3>
                <FaClock style={{ color: "#2563eb" }} /> Slot Details:{" "}
                {selectedSlot.startTime}
              </h3>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1.1rem",
                }}
                onClick={() => setSelectedSlot(null)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="dp-modal-body">
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                    Date:
                  </span>
                  <strong>{selectedSlot.date}</strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                    Time Window:
                  </span>
                  <strong>
                    {selectedSlot.startTime} - {selectedSlot.endTime || "—"}
                  </strong>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>
                    Status:
                  </span>
                  <span
                    className={`dp-slot-pill ${selectedSlot.status.toLowerCase()}`}
                    style={{ minWidth: "auto", padding: "3px 10px" }}
                  >
                    {selectedSlot.status}
                  </span>
                </div>

                {/* IF BOOKED APPOINTMENT */}
                {selectedSlot.status === "BOOKED" &&
                  selectedSlot.appointment && (
                    <div
                      style={{
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        borderRadius: 10,
                        padding: 14,
                        marginTop: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <h4
                        style={{
                          margin: 0,
                          color: "#1e40af",
                          fontSize: "0.95rem",
                        }}
                      >
                        Booked Patient Information
                      </h4>
                      <div style={{ fontSize: "0.85rem", color: "#1e3a8a" }}>
                        <strong>Patient Name:</strong>{" "}
                        {selectedSlot.appointment.patientName}
                      </div>
                      {selectedSlot.appointment.patientPhone && (
                        <div style={{ fontSize: "0.85rem", color: "#1e3a8a" }}>
                          <strong>Contact:</strong>{" "}
                          {selectedSlot.appointment.patientPhone}
                        </div>
                      )}
                      <div style={{ fontSize: "0.85rem", color: "#1e3a8a" }}>
                        <strong>Consultation Mode:</strong>{" "}
                        {selectedSlot.appointment.consultationType === "video"
                          ? "Video Call"
                          : "In-Person OPD"}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#1e3a8a" }}>
                        <strong>Booking Status:</strong>{" "}
                        {selectedSlot.appointment.status}
                      </div>

                      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                        <Link
                          to={`/consultation?appointmentId=${selectedSlot.appointment.id || selectedSlot.appointment.appointmentId}`}
                          className="dp-light-btn"
                          style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                        >
                          Open Consultation
                        </Link>
                      </div>
                    </div>
                  )}

                {/* IF BLOCKED */}
                {selectedSlot.status === "BLOCKED" && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 10,
                      padding: 14,
                      marginTop: 8,
                    }}
                  >
                    <h4
                      style={{
                        margin: "0 0 6px",
                        color: "#991b1b",
                        fontSize: "0.95rem",
                      }}
                    >
                      Slot is Blocked
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.85rem",
                        color: "#7f1d1d",
                      }}
                    >
                      Reason:{" "}
                      {selectedSlot.blockedReason || "Doctor / Admin Blocked"}
                    </p>
                    {selectedSlot.blockedBy && (
                      <small
                        style={{
                          color: "#b91c1c",
                          marginTop: 4,
                          display: "block",
                        }}
                      >
                        Blocked by: {selectedSlot.blockedBy}
                      </small>
                    )}
                  </div>
                )}

                {/* IF AVAILABLE: OPTION TO BLOCK */}
                {selectedSlot.status === "AVAILABLE" && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <label style={{ fontSize: "0.85rem", color: "#475569" }}>
                      <strong>Reason for blocking slot (optional):</strong>
                      <input
                        type="text"
                        placeholder="e.g. Emergency OT Duty, Ward Rounds, Personal Work"
                        value={blockingReason}
                        onChange={(e) => setBlockingReason(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          marginTop: 4,
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div className="dp-modal-footer">
              {selectedSlot.status === "AVAILABLE" && (
                <button
                  type="button"
                  className="dp-light-btn"
                  style={{ background: "#dc2626", color: "#fff" }}
                  onClick={handleBlockSlot}
                  disabled={blockingLoading}
                >
                  <FaLock />{" "}
                  {blockingLoading ? "Blocking..." : "Block This Slot"}
                </button>
              )}
              {selectedSlot.status === "BLOCKED" && (
                <button
                  type="button"
                  className="dp-light-btn"
                  style={{ background: "#16a34a", color: "#fff" }}
                  onClick={handleUnblockSlot}
                  disabled={blockingLoading}
                >
                  <FaCheckCircle />{" "}
                  {blockingLoading ? "Unblocking..." : "Unblock Slot"}
                </button>
              )}
              <button
                type="button"
                className="dp-light-btn"
                style={{ background: "#f1f5f9", color: "#475569" }}
                onClick={() => setSelectedSlot(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EarningsView({
  dashboard,
  doctorId,
  doctor,
  initialTab = "earnings",
}) {
  const storedDoctor = useMemo(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("doctorApp") || "null")?.doctor || {}
      );
    } catch {
      return {};
    }
  }, []);
  const effectiveDoctorId = doctorId || doctor?._id || storedDoctor._id;
  const effectiveDoctor = doctor || storedDoctor;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [filter, setFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [earningsData, setEarningsData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const fetchEarnings = async () => {
    if (!effectiveDoctorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let url = `/api/v1/doctor/panel/${effectiveDoctorId}/earnings?filter=${filter}`;
      if (filter === "custom" && customStartDate && customEndDate) {
        url += `&startDate=${customStartDate}&endDate=${customEndDate}`;
      }
      const res = await api.get(url);
      if (res.data?.success) {
        setEarningsData(res.data);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load earnings data",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!effectiveDoctorId) return;
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${effectiveDoctorId}/analytics`,
      );
      if (res.data?.success) {
        setAnalyticsData(res.data.analytics);
      }
    } catch (err) {
      console.error("Analytics fetch error:", err);
    }
  };

  useEffect(() => {
    fetchEarnings();
    fetchAnalytics();
  }, [effectiveDoctorId, filter, customStartDate, customEndDate]);

  const summary = earningsData?.summary || {
    totalEarnings: dashboard?.earnings?.total || 0,
    todayEarnings: dashboard?.earnings?.today || 0,
    weekEarnings: 0,
    monthEarnings: 0,
    yearEarnings: 0,
    paidAmount: dashboard?.earnings?.total || 0,
    pendingAmount: 0,
    refundedAmount: 0,
    onlineEarnings: 0,
    clinicEarnings: 0,
    totalConsultations: dashboard?.totals?.completed || 0,
    completedConsultations: dashboard?.totals?.completed || 0,
    paidConsultations: 0,
  };

  const transactions = earningsData?.transactions || [];
  const monthlyBreakdown =
    earningsData?.monthlyBreakdown || dashboard?.earnings?.monthly || [];

  // Filtered transactions for settlement table
  const filteredTransactions = transactions.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      (t.patientName && t.patientName.toLowerCase().includes(q)) ||
      (t.appointmentId && String(t.appointmentId).toLowerCase().includes(q)) ||
      (t.safeTransactionId &&
        String(t.safeTransactionId).toLowerCase().includes(q));

    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "paid" &&
        (t.paymentStatus === "paid" || t.status === "completed")) ||
      (statusFilter === "pending" &&
        (t.paymentStatus === "cash_pending" ||
          t.paymentStatus === "online_pending")) ||
      (statusFilter === "refunded" && t.paymentStatus === "refunded");

    const matchType =
      typeFilter === "all" ||
      (typeFilter === "clinic" && t.consultationType !== "video") ||
      (typeFilter === "video" && t.consultationType === "video");

    return matchQuery && matchStatus && matchType;
  });

  // Export to CSV
  const exportToCsv = () => {
    if (!filteredTransactions.length) {
      toast.info("No transaction records to export");
      return;
    }
    const headers = [
      "Appointment ID",
      "Patient Name",
      "Phone",
      "Slot Date",
      "Slot Time",
      "Mode",
      "Payment Method",
      "Payment Status",
      "Amount (INR)",
      "Safe Transaction Ref",
    ];
    const rows = filteredTransactions.map((t) => [
      `"${t.appointmentId || ""}"`,
      `"${t.patientName || ""}"`,
      `"${t.patientPhone || ""}"`,
      `"${t.slotDate || ""}"`,
      `"${t.slotTime || ""}"`,
      `"${t.consultationType || "clinic"}"`,
      `"${t.paymentMethod || "cash"}"`,
      `"${t.paymentStatus || "pending"}"`,
      t.amount || 0,
      `"${t.safeTransactionId || ""}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Doctor_Earnings_${effectiveDoctorId || "statement"}_${Date.now()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Earnings statement exported to CSV");
  };

  // PDF Export
  const exportPdfStatement = () => {
    const lines = [
      `Doctor: Dr. ${stripDrPrefix(effectiveDoctor.name)} (${effectiveDoctor.speciality || effectiveDoctor.department || "Specialist"})`,
      `Doctor: ${formatDoctorTitle(effectiveDoctor.name)} (${effectiveDoctor.speciality || effectiveDoctor.department || "Specialist"})`,
      `Hospital: ${effectiveDoctor.hospitalName || "HealPoint Hospital"}`,
      `Statement Date: ${new Date().toLocaleDateString("en-IN")}`,
      `Selected Range: ${filter.toUpperCase()}`,
      `Total Settled Earnings: Rs ${(summary.totalEarnings || 0).toLocaleString("en-IN")}`,
      `Total Consultations: ${summary.totalConsultations} (Completed: ${summary.completedConsultations})`,
      `Paid & Settled Amount: Rs ${(summary.paidAmount || 0).toLocaleString("en-IN")}`,
      `Pending Settlement Amount: Rs ${(summary.pendingAmount || 0).toLocaleString("en-IN")}`,
      `Online Video Revenue: Rs ${(summary.onlineEarnings || 0).toLocaleString("en-IN")}`,
      `In-Clinic Revenue: Rs ${(summary.clinicEarnings || 0).toLocaleString("en-IN")}`,
      `---`,
      `Recent Transaction Breakdown:`,
      ...filteredTransactions
        .slice(0, 30)
        .map(
          (t) =>
            `${t.slotDate} | ${t.patientName} | Apt #${t.appointmentId} | ${t.consultationType === "video" ? "Video" : "Clinic"} | Rs ${t.amount} | ${t.paymentStatus} | Ref: ${t.safeTransactionId}`,
        ),
    ];
    buildPdf(
      `Doctor Earnings & Financial Statement`,
      lines,
      `Doctor_Earnings_Statement_${Date.now()}.pdf`,
    );
    toast.success("PDF financial statement generated");
  };

  return (
    <Panel title="Doctor Financial & Clinical Analytics Hub">
      {/* Top Header & Sub-Tab Switcher */}
      <div className="dp-earnings-hub-header" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "16px",
          }}
        >
          <div
            className="dp-earnings-tabs"
            style={{ display: "flex", gap: "8px" }}
          >
            <button
              type="button"
              className={`dp-btn ${activeTab === "earnings" ? "dp-btn-primary" : "dp-btn-secondary"}`}
              onClick={() => setActiveTab("earnings")}
            >
              <FaMoneyBillWave /> Earnings Overview
            </button>
            <button
              type="button"
              className={`dp-btn ${activeTab === "analytics" ? "dp-btn-primary" : "dp-btn-secondary"}`}
              onClick={() => setActiveTab("analytics")}
            >
              <FaFileInvoice /> Clinical Analytics
            </button>
            <button
              type="button"
              className={`dp-btn ${activeTab === "transactions" ? "dp-btn-primary" : "dp-btn-secondary"}`}
              onClick={() => setActiveTab("transactions")}
            >
              <FaReceipt /> Settlement Records ({transactions.length})
            </button>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="dp-btn dp-btn-secondary"
              onClick={() => {
                fetchEarnings();
                fetchAnalytics();
              }}
              disabled={loading}
              title="Refresh financial and analytics data"
            >
              <FaSyncAlt className={loading ? "dp-spin" : ""} /> Refresh
            </button>
            <button
              type="button"
              className="dp-btn dp-btn-secondary"
              onClick={exportToCsv}
              title="Download CSV breakdown"
            >
              <FaDownload /> Export CSV
            </button>
            <button
              type="button"
              className="dp-btn dp-btn-secondary"
              onClick={exportPdfStatement}
              title="Download PDF statement"
            >
              <FaFilePdf /> Statement PDF
            </button>
          </div>
        </div>

        {/* Date Filter Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "0.85rem",
                color: "#64748b",
                fontWeight: "600",
                textTransform: "uppercase",
              }}
            >
              <FaFilter size={11} /> Range:
            </span>
            {[
              ["all", "All Time"],
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
              ["year", "This Year"],
              ["custom", "Custom Range"],
            ].map(([fKey, fLabel]) => (
              <button
                key={fKey}
                type="button"
                className={`dp-chip-filter ${filter === fKey ? "active" : ""}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "0.85rem",
                  fontWeight: "600",
                  cursor: "pointer",
                  border:
                    filter === fKey ? "1px solid #0d9488" : "1px solid #e2e8f0",
                  background: filter === fKey ? "#0d9488" : "#fff",
                  color: filter === fKey ? "#fff" : "#475569",
                  transition: "all 0.2s",
                }}
                onClick={() => setFilter(fKey)}
              >
                {fLabel}
              </button>
            ))}
          </div>

          {filter === "custom" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              />
              <span style={{ color: "#64748b" }}>to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                }}
              />
              <button
                type="button"
                className="dp-btn dp-btn-primary"
                style={{ padding: "6px 14px", fontSize: "0.85rem" }}
                onClick={fetchEarnings}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="dp-loading">Updating financial records...</div>
      )}

      {/* TAB 1: FINANCIAL OVERVIEW */}
      {activeTab === "earnings" && (
        <div>
          {/* 5 Primary Top KPI Cards */}
          <div
            className="dp-stats"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <article
              className="dp-kpi-tile-animate"
              style={{
                background: "linear-gradient(135deg, #0f766e, #0d9488)",
                color: "#fff",
                padding: "20px",
                borderRadius: "14px",
                boxShadow: "0 4px 12px rgba(13, 148, 136, 0.2)",
              }}
            >
              <span
                style={{
                  color: "#ccfbf1",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  fontWeight: "600",
                }}
              >
                Total Revenue Settled
              </span>
              <strong
                style={{
                  fontSize: "1.8rem",
                  display: "block",
                  marginTop: "6px",
                  color: "#fff",
                }}
              >
                ₹{(summary.totalEarnings || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{
                  color: "#e6fffa",
                  fontSize: "0.8rem",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                {summary.completedConsultations} completed consultations
              </small>
            </article>

            <article
              className="dp-kpi-tile-animate"
              style={{
                background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
                color: "#fff",
                padding: "20px",
                borderRadius: "14px",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)",
              }}
            >
              <span
                style={{
                  color: "#dbeafe",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  fontWeight: "600",
                }}
              >
                Today's Earnings
              </span>
              <strong
                style={{
                  fontSize: "1.8rem",
                  display: "block",
                  marginTop: "6px",
                  color: "#fff",
                }}
              >
                ₹{(summary.todayEarnings || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{
                  color: "#eff6ff",
                  fontSize: "0.8rem",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                Active visits for today
              </small>
            </article>

            <article
              className="dp-kpi-tile-animate"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
                color: "#fff",
                padding: "20px",
                borderRadius: "14px",
                boxShadow: "0 4px 12px rgba(139, 92, 246, 0.2)",
              }}
            >
              <span
                style={{
                  color: "#ede9fe",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  fontWeight: "600",
                }}
              >
                This Week
              </span>
              <strong
                style={{
                  fontSize: "1.8rem",
                  display: "block",
                  marginTop: "6px",
                  color: "#fff",
                }}
              >
                ₹{(summary.weekEarnings || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{
                  color: "#f5f3ff",
                  fontSize: "0.8rem",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                Last 7 days performance
              </small>
            </article>

            <article
              className="dp-kpi-tile-animate"
              style={{
                background: "linear-gradient(135deg, #0369a1, #0284c7)",
                color: "#fff",
                padding: "20px",
                borderRadius: "14px",
                boxShadow: "0 4px 12px rgba(2, 132, 199, 0.2)",
              }}
            >
              <span
                style={{
                  color: "#e0f2fe",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  fontWeight: "600",
                }}
              >
                This Month
              </span>
              <strong
                style={{
                  fontSize: "1.8rem",
                  display: "block",
                  marginTop: "6px",
                  color: "#fff",
                }}
              >
                ₹{(summary.monthEarnings || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{
                  color: "#f0f9ff",
                  fontSize: "0.8rem",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                Current calendar month
              </small>
            </article>

            <article
              className="dp-kpi-tile-animate"
              style={{
                background: "linear-gradient(135deg, #4338ca, #6366f1)",
                color: "#fff",
                padding: "20px",
                borderRadius: "14px",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.2)",
              }}
            >
              <span
                style={{
                  color: "#e0e7ff",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  fontWeight: "600",
                }}
              >
                This Year
              </span>
              <strong
                style={{
                  fontSize: "1.8rem",
                  display: "block",
                  marginTop: "6px",
                  color: "#fff",
                }}
              >
                ₹{(summary.yearEarnings || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{
                  color: "#eef2ff",
                  fontSize: "0.8rem",
                  marginTop: "4px",
                  display: "block",
                }}
              >
                Current calendar year total
              </small>
            </article>
          </div>

          {/* Secondary Financial Indicators */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                padding: "16px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: "600",
                  display: "block",
                }}
              >
                Paid & Received
              </span>
              <strong style={{ fontSize: "1.3rem", color: "#16a34a" }}>
                ₹{(summary.paidAmount || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{ display: "block", color: "#64748b", marginTop: "2px" }}
              >
                {summary.paidConsultations} settled visits
              </small>
            </div>

            <div
              style={{
                padding: "16px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: "600",
                  display: "block",
                }}
              >
                Pending Settlement
              </span>
              <strong style={{ fontSize: "1.3rem", color: "#d97706" }}>
                ₹{(summary.pendingAmount || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{ display: "block", color: "#64748b", marginTop: "2px" }}
              >
                Cash pending & processing
              </small>
            </div>

            <div
              style={{
                padding: "16px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: "600",
                  display: "block",
                }}
              >
                Online Video Revenue
              </span>
              <strong style={{ fontSize: "1.3rem", color: "#0284c7" }}>
                ₹{(summary.onlineEarnings || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{ display: "block", color: "#64748b", marginTop: "2px" }}
              >
                Google Meet visits
              </small>
            </div>

            <div
              style={{
                padding: "16px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: "600",
                  display: "block",
                }}
              >
                In-Clinic OPD Revenue
              </span>
              <strong style={{ fontSize: "1.3rem", color: "#0d9488" }}>
                ₹{(summary.clinicEarnings || 0).toLocaleString("en-IN")}
              </strong>
              <small
                style={{ display: "block", color: "#64748b", marginTop: "2px" }}
              >
                Hospital OPD visits
              </small>
            </div>

            <div
              style={{
                padding: "16px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#64748b",
                  textTransform: "uppercase",
                  fontWeight: "600",
                  display: "block",
                }}
              >
                Consultation Fee
              </span>
              <strong style={{ fontSize: "1.3rem", color: "#1e293b" }}>
                ₹{earningsData?.doctorFees || effectiveDoctor.fees || 500}
              </strong>
              <small
                style={{ display: "block", color: "#64748b", marginTop: "2px" }}
              >
                Per appointment rate
              </small>
            </div>
          </div>

          {/* Visual Revenue Analytics: Monthly Chart & Daily Trend */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))",
              gap: "20px",
              marginBottom: "24px",
            }}
          >
            {/* Monthly Revenue Chart */}
            <div
              style={{
                background: "#fff",
                padding: "20px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "1.05rem",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <FaCalendarAlt color="#0d9488" /> Monthly Revenue Trajectory
                </span>
                <small style={{ color: "#64748b", fontWeight: "normal", fontSize: "0.8rem" }}>
                  Real aggregated database values
                </small>
              </h3>

              {monthlyBreakdown.length === 0 ? (
                <p style={{ color: "#64748b", fontStyle: "italic", padding: "20px 0" }}>
                  No monthly revenue data available yet.
                </p>
              ) : (
                <div>
                  {/* SVG Monthly Bar Chart */}
                  <div style={{ width: "100%", height: "180px", marginBottom: "16px" }}>
                    {(() => {
                      const maxVal = Math.max(
                        ...monthlyBreakdown.map((b) => b.amount || 1),
                        1000,
                      );
                      const chartHeight = 140;
                      const barWidth = Math.min(
                        45,
                        Math.max(24, Math.floor(480 / (monthlyBreakdown.length || 1) - 16)),
                      );
                      const totalWidth = 520;
                      const step = totalWidth / (monthlyBreakdown.length || 1);

                      return (
                        <svg
                          viewBox="0 0 540 180"
                          style={{ width: "100%", height: "100%", overflow: "visible" }}
                        >
                          {/* Horizontal Gridlines */}
                          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                            const y = chartHeight - ratio * (chartHeight - 20) + 10;
                            return (
                              <g key={idx}>
                                <line
                                  x1="30"
                                  y1={y}
                                  x2="520"
                                  y2={y}
                                  stroke="#f1f5f9"
                                  strokeDasharray="4 4"
                                />
                                <text
                                  x="25"
                                  y={y + 4}
                                  textAnchor="end"
                                  fontSize="9"
                                  fill="#94a3b8"
                                >
                                  ₹{Math.round((maxVal * ratio) / 1000)}k
                                </text>
                              </g>
                            );
                          })}

                          {/* Bars */}
                          {monthlyBreakdown.map((m, idx) => {
                            const val = m.amount || 0;
                            const h = Math.max(4, Math.round((val / maxVal) * (chartHeight - 20)));
                            const x = 40 + idx * step + (step - barWidth) / 2;
                            const y = chartHeight + 10 - h;

                            return (
                              <g key={m.month || idx}>
                                <rect
                                  className="dp-chart-bar-rect"
                                  x={x}
                                  y={y}
                                  width={barWidth}
                                  height={h}
                                  rx="4"
                                  fill="url(#tealGradient)"
                                >
                                  <title>{`${m.month}: ₹${val.toLocaleString("en-IN")} (${m.count || 0} visits)`}</title>
                                </rect>
                                <text
                                  x={x + barWidth / 2}
                                  y={chartHeight + 25}
                                  textAnchor="middle"
                                  fontSize="10"
                                  fill="#475569"
                                  fontWeight="600"
                                >
                                  {m.month?.split(" ")[0]}
                                </text>
                              </g>
                            );
                          })}

                          <defs>
                            <linearGradient id="tealGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0d9488" />
                              <stop offset="100%" stopColor="#14b8a6" />
                            </linearGradient>
                          </defs>
                        </svg>
                      );
                    })()}
                  </div>

                  {/* Monthly List items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {monthlyBreakdown.slice(0, 5).map((m) => {
                      const maxAmt = Math.max(...monthlyBreakdown.map((b) => b.amount || 1));
                      const pct = Math.min(100, Math.round(((m.amount || 0) / maxAmt) * 100));
                      return (
                        <div
                          key={m.month}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "90px 1fr 110px",
                            alignItems: "center",
                            gap: "12px",
                          }}
                        >
                          <strong style={{ color: "#334155", fontSize: "0.85rem" }}>
                            {m.month}
                          </strong>
                          <div
                            style={{
                              background: "#f1f5f9",
                              height: "10px",
                              borderRadius: "5px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #0d9488, #14b8a6)",
                                borderRadius: "5px",
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              textAlign: "right",
                              fontWeight: "700",
                              color: "#0f172a",
                              fontSize: "0.9rem",
                            }}
                          >
                            ₹{(m.amount || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Daily Trend & Mode Distribution */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Consultation Mode Split Card */}
              <div
                style={{
                  background: "#fff",
                  padding: "20px",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h4 style={{ margin: "0 0 14px 0", color: "#0f172a", fontSize: "1rem" }}>
                  Consultation Mode Revenue Distribution
                </h4>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.85rem",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#0d9488",
                      fontWeight: "700",
                    }}
                  >
                    <FaClinicMedical /> In-Clinic OPD: ₹
                    {(summary.clinicEarnings || 0).toLocaleString("en-IN")} (
                    {summary.clinicCount || 0} visits)
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#0284c7",
                      fontWeight: "700",
                    }}
                  >
                    <FaVideo /> Video Meet: ₹
                    {(summary.onlineEarnings || 0).toLocaleString("en-IN")} (
                    {summary.onlineCount || 0} calls)
                  </span>
                </div>

                {(() => {
                  const totalRev =
                    (summary.clinicEarnings || 0) + (summary.onlineEarnings || 0);
                  const clinicPct =
                    totalRev > 0
                      ? Math.round(((summary.clinicEarnings || 0) / totalRev) * 100)
                      : 50;
                  const videoPct = 100 - clinicPct;

                  return (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          height: "14px",
                          borderRadius: "7px",
                          overflow: "hidden",
                          background: "#e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            width: `${clinicPct}%`,
                            background: "#0d9488",
                            transition: "width 0.5s ease",
                          }}
                          title={`Clinic: ${clinicPct}%`}
                        />
                        <div
                          style={{
                            width: `${videoPct}%`,
                            background: "#0284c7",
                            transition: "width 0.5s ease",
                          }}
                          title={`Video: ${videoPct}%`}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: "6px",
                          fontSize: "0.78rem",
                          color: "#64748b",
                        }}
                      >
                        <span>Clinic Share: {clinicPct}%</span>
                        <span>Online Share: {videoPct}%</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 14-Day Daily Performance Trend */}
              <div
                style={{
                  background: "#fff",
                  padding: "20px",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  flex: 1,
                }}
              >
                <h4 style={{ margin: "0 0 14px 0", color: "#0f172a", fontSize: "1rem" }}>
                  14-Day Daily Income Trajectory
                </h4>

                {(!earningsData?.dailyBreakdown ||
                  earningsData.dailyBreakdown.length === 0) ? (
                  <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.85rem" }}>
                    No daily revenue recorded in the last 14 days.
                  </p>
                ) : (
                  <div>
                    <div style={{ width: "100%", height: "110px" }}>
                      {(() => {
                        const daily = earningsData.dailyBreakdown;
                        const maxDaily = Math.max(
                          ...daily.map((d) => d.amount || 1),
                          500,
                        );
                        const chartH = 80;
                        const step = 460 / (daily.length || 1);
                        const bWidth = 16;

                        return (
                          <svg
                            viewBox="0 0 480 110"
                            style={{ width: "100%", height: "100%", overflow: "visible" }}
                          >
                            {daily.map((d, idx) => {
                              const val = d.amount || 0;
                              const h = Math.max(3, Math.round((val / maxDaily) * chartH));
                              const x = 10 + idx * step + (step - bWidth) / 2;
                              const y = chartH + 5 - h;

                              return (
                                <g key={d.date || idx}>
                                  <rect
                                    className="dp-chart-bar-rect"
                                    x={x}
                                    y={y}
                                    width={bWidth}
                                    height={h}
                                    rx="3"
                                    fill={val > 0 ? "#2563eb" : "#e2e8f0"}
                                  >
                                    <title>{`${d.label || d.date}: ₹${val.toLocaleString("en-IN")}`}</title>
                                  </rect>
                                  {idx % 2 === 0 && (
                                    <text
                                      x={x + bWidth / 2}
                                      y={chartH + 20}
                                      textAnchor="middle"
                                      fontSize="8"
                                      fill="#64748b"
                                    >
                                      {d.label?.split(" ")[0]}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLINICAL ANALYTICS */}
      {activeTab === "analytics" && (
        <div>
          {analyticsData ? (
            <div>
              {/* Analytics Top 4 KPIs */}
              <div
                className="dp-stats"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <article
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: "18px",
                    borderRadius: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "#64748b",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    Total Appointments
                  </span>
                  <strong
                    style={{
                      fontSize: "1.8rem",
                      color: "#0f172a",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    {analyticsData.totalAppointments}
                  </strong>
                  <small style={{ color: "#16a34a", fontWeight: "600" }}>
                    {analyticsData.completedAppointments} Completed
                  </small>
                </article>

                <article
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: "18px",
                    borderRadius: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "#64748b",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    Completion Rate
                  </span>
                  <strong
                    style={{
                      fontSize: "1.8rem",
                      color: "#16a34a",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    {analyticsData.completionRate}%
                  </strong>
                  <small style={{ color: "#64748b" }}>
                    Visit fulfillment ratio
                  </small>
                </article>

                <article
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: "18px",
                    borderRadius: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "#64748b",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    Cancellation Rate
                  </span>
                  <strong
                    style={{
                      fontSize: "1.8rem",
                      color:
                        analyticsData.cancellationRate > 15
                          ? "#ef4444"
                          : "#64748b",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    {analyticsData.cancellationRate}%
                  </strong>
                  <small style={{ color: "#64748b" }}>
                    {analyticsData.cancelledAppointments} Cancelled
                  </small>
                </article>

                <article
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: "18px",
                    borderRadius: "12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "#64748b",
                      textTransform: "uppercase",
                      fontWeight: "600",
                    }}
                  >
                    Patient Retention Rate
                  </span>
                  <strong
                    style={{
                      fontSize: "1.8rem",
                      color: "#8b5cf6",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    {analyticsData.patients?.returningRate || 0}%
                  </strong>
                  <small style={{ color: "#64748b" }}>
                    {analyticsData.patients?.returningPatients || 0} returning
                    patients
                  </small>
                </article>
              </div>

              {/* Breakdown Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "20px",
                  marginBottom: "24px",
                }}
              >
                {/* Mode Breakdown */}
                <div
                  style={{
                    background: "#fff",
                    padding: "20px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <h4 style={{ margin: "0 0 16px 0", color: "#0f172a" }}>
                    Consultation Mode Split
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "#0d9488",
                        fontWeight: "600",
                      }}
                    >
                      <FaClinicMedical /> In-Clinic:{" "}
                      {analyticsData.consultationModes?.clinic} (
                      {analyticsData.consultationModes?.clinicPercentage}%)
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        color: "#0284c7",
                        fontWeight: "600",
                      }}
                    >
                      <FaVideo /> Online Video:{" "}
                      {analyticsData.consultationModes?.video} (
                      {analyticsData.consultationModes?.videoPercentage}%)
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      height: "16px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "#e2e8f0",
                    }}
                  >
                    <div
                      style={{
                        width: `${analyticsData.consultationModes?.clinicPercentage || 50}%`,
                        background: "#0d9488",
                      }}
                    />
                    <div
                      style={{
                        width: `${analyticsData.consultationModes?.videoPercentage || 50}%`,
                        background: "#0284c7",
                      }}
                    />
                  </div>
                  <small
                    style={{
                      display: "block",
                      marginTop: "8px",
                      color: "#64748b",
                    }}
                  >
                    Based on total {analyticsData.totalAppointments}{" "}
                    consultations recorded in the system.
                  </small>
                </div>

                {/* Patient Demographics */}
                <div
                  style={{
                    background: "#fff",
                    padding: "20px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <h4 style={{ margin: "0 0 16px 0", color: "#0f172a" }}>
                    Patient Base Dynamics
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "12px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "10px",
                      }}
                    >
                      <small style={{ color: "#64748b" }}>Total Unique</small>
                      <strong
                        style={{
                          fontSize: "1.3rem",
                          display: "block",
                          color: "#0f172a",
                        }}
                      >
                        {analyticsData.patients?.totalUnique || 0}
                      </strong>
                    </div>
                    <div
                      style={{
                        background: "#f0fdf4",
                        padding: "12px",
                        borderRadius: "10px",
                      }}
                    >
                      <small style={{ color: "#166534" }}>New Patients</small>
                      <strong
                        style={{
                          fontSize: "1.3rem",
                          display: "block",
                          color: "#16a34a",
                        }}
                      >
                        {analyticsData.patients?.newPatients || 0}
                      </strong>
                    </div>
                    <div
                      style={{
                        background: "#f5f3ff",
                        padding: "12px",
                        borderRadius: "10px",
                      }}
                    >
                      <small style={{ color: "#5b21b6" }}>Returning</small>
                      <strong
                        style={{
                          fontSize: "1.3rem",
                          display: "block",
                          color: "#7c3aed",
                        }}
                      >
                        {analyticsData.patients?.returningPatients || 0}
                      </strong>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "#64748b" }}>
                      Patient Satisfaction:
                    </span>
                    <strong
                      style={{
                        color: "#eab308",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <FaStar /> {analyticsData.rating?.average || 5.0} / 5.0 (
                      {analyticsData.rating?.reviewCount || 0} reviews)
                    </strong>
                  </div>
                </div>
              </div>

              {/* Monthly Trend Table */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <h4 style={{ margin: 0, color: "#0f172a" }}>
                    Monthly Consultation & Revenue Log
                  </h4>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                      fontSize: "0.9rem",
                    }}
                  >
                    <thead
                      style={{
                        background: "#f8fafc",
                        color: "#64748b",
                        textTransform: "uppercase",
                        fontSize: "0.75rem",
                      }}
                    >
                      <tr>
                        <th style={{ padding: "12px 18px" }}>Month</th>
                        <th style={{ padding: "12px 18px" }}>
                          Total Appointments
                        </th>
                        <th style={{ padding: "12px 18px" }}>
                          Completed Visits
                        </th>
                        <th
                          style={{ padding: "12px 18px", textAlign: "right" }}
                        >
                          Generated Revenue
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analyticsData.monthlyTrends || []).map((t) => (
                        <tr
                          key={t.month}
                          style={{ borderBottom: "1px solid #f1f5f9" }}
                        >
                          <td
                            style={{
                              padding: "14px 18px",
                              fontWeight: "600",
                              color: "#0f172a",
                            }}
                          >
                            {t.month}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            {t.appointments} visits
                          </td>
                          <td
                            style={{
                              padding: "14px 18px",
                              color: "#16a34a",
                              fontWeight: "600",
                            }}
                          >
                            {t.completed}
                          </td>
                          <td
                            style={{
                              padding: "14px 18px",
                              textAlign: "right",
                              fontWeight: "700",
                              color: "#0f172a",
                            }}
                          >
                            ₹{(t.revenue || 0).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                      {(!analyticsData.monthlyTrends ||
                        analyticsData.monthlyTrends.length === 0) && (
                        <tr>
                          <td
                            colSpan={4}
                            style={{
                              padding: "24px",
                              textAlign: "center",
                              color: "#64748b",
                            }}
                          >
                            No trend data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ color: "#64748b" }}>Loading analytics...</p>
          )}
        </div>
      )}

      {/* TAB 3: SETTLEMENT RECORDS */}
      {activeTab === "transactions" && (
        <div>
          {/* Search and Filters Strip */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "16px",
              alignItems: "center",
            }}
          >
            <div style={{ flex: 1, minWidth: "220px", position: "relative" }}>
              <input
                type="text"
                placeholder="Search patient, appointment ID, payment reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 14px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.9rem",
                }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid & Settled</option>
              <option value="pending">Pending Settlement</option>
              <option value="refunded">Refunded</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                padding: "9px 14px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            >
              <option value="all">All Modes</option>
              <option value="clinic">In-Clinic Only</option>
              <option value="video">Online Video Only</option>
            </select>
          </div>

          {/* Transactions Table */}
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                  fontSize: "0.88rem",
                }}
              >
                <thead
                  style={{
                    background: "#f8fafc",
                    color: "#475569",
                    textTransform: "uppercase",
                    fontSize: "0.75rem",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <tr>
                    <th style={{ padding: "12px 16px" }}>Date & Time</th>
                    <th style={{ padding: "12px 16px" }}>Appointment ID</th>
                    <th style={{ padding: "12px 16px" }}>Patient</th>
                    <th style={{ padding: "12px 16px" }}>Mode</th>
                    <th style={{ padding: "12px 16px" }}>Method</th>
                    <th style={{ padding: "12px 16px" }}>Payment Status</th>
                    <th style={{ padding: "12px 16px" }}>Safe Ref ID</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((t) => (
                    <tr
                      key={t._id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td style={{ padding: "12px 16px", color: "#334155" }}>
                        <strong>{t.slotDate}</strong>
                        <small style={{ display: "block", color: "#64748b" }}>
                          {t.slotTime}
                        </small>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontWeight: "600",
                          color: "#0f172a",
                        }}
                      >
                        <Link
                          to={`/appointments/${t._id}`}
                          style={{ color: "#0284c7", textDecoration: "none" }}
                        >
                          #{t.appointmentId}
                        </Link>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ color: "#0f172a", display: "block" }}>
                          {t.patientName}
                        </strong>
                        <small style={{ color: "#64748b" }}>
                          {t.patientPhone}
                        </small>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "0.78rem",
                            fontWeight: "600",
                            background:
                              t.consultationType === "video"
                                ? "#e0f2fe"
                                : "#f1f5f9",
                            color:
                              t.consultationType === "video"
                                ? "#0369a1"
                                : "#475569",
                          }}
                        >
                          {t.consultationType === "video" ? (
                            <FaVideo size={10} />
                          ) : (
                            <FaHospital size={10} />
                          )}
                          {t.consultationType === "video" ? "Video" : "Clinic"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          textTransform: "capitalize",
                          color: "#475569",
                        }}
                      >
                        {t.paymentMethod || "cash"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "0.78rem",
                            fontWeight: "700",
                            background:
                              t.paymentStatus === "paid"
                                ? "#dcfce7"
                                : t.paymentStatus === "refunded"
                                  ? "#fee2e2"
                                  : "#fef3c7",
                            color:
                              t.paymentStatus === "paid"
                                ? "#166534"
                                : t.paymentStatus === "refunded"
                                  ? "#991b1b"
                                  : "#92400e",
                          }}
                        >
                          {t.paymentStatus === "paid"
                            ? "Paid"
                            : t.paymentStatus === "refunded"
                              ? "Refunded"
                              : "Pending"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontFamily: "monospace",
                          color: "#475569",
                          fontSize: "0.85rem",
                        }}
                      >
                        {t.safeTransactionId}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          textAlign: "right",
                          fontWeight: "700",
                          color: "#0f172a",
                        }}
                      >
                        ₹{(t.amount || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          padding: "32px",
                          textAlign: "center",
                          color: "#64748b",
                        }}
                      >
                        <EmptyState
                          title="No financial transactions found"
                          text="No appointments match your active search and filter criteria."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function NotificationsView({ doctorId, doctor, onCountChange, navigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState(null);

  const fetchNotifications = async () => {
    if (!doctorId) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/notifications`,
      );
      const list = res.data?.notifications || [];
      setNotifications(list);
      if (typeof res.data?.unreadCount === "number" && onCountChange) {
        onCountChange(res.data.unreadCount);
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load notifications",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [doctorId]);

  const markAsRead = async (notificationId) => {
    try {
      setMarkingId(notificationId);
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/notifications/${notificationId}/read`,
      );
      setNotifications((prev) =>
        prev.map((item) =>
          item._id === notificationId ? { ...item, isRead: true } : item,
        ),
      );
      if (typeof res.data?.unreadCount === "number" && onCountChange) {
        onCountChange(res.data.unreadCount);
      }
      toast.success("Notification marked as read");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update notification",
      );
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAll(true);
      const res = await api.patch(
        `/api/v1/doctor/panel/${doctorId}/notifications/mark-all`,
      );
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, isRead: true })),
      );
      if (onCountChange) onCountChange(0);
      toast.success(res.data?.message || "All notifications marked as read");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === "unread") return !item.isRead;
      if (filter === "appointment") {
        const t = (item.type || "").toLowerCase();
        return (
          t.includes("appointment") ||
          t.includes("booking") ||
          t.includes("cancel") ||
          t.includes("reschedule")
        );
      }
      if (filter === "system") {
        const t = (item.type || "").toLowerCase();
        return (
          t.includes("system") ||
          t.includes("security") ||
          t.includes("verification") ||
          t.includes("login")
        );
      }
      return true;
    });
  }, [notifications, filter]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const getNotificationIcon = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("appointment") || t.includes("booking")) {
      return { icon: <FaCalendarAlt />, boxClass: "appointment" };
    }
    if (
      t.includes("prescription") ||
      t.includes("report") ||
      t.includes("lab")
    ) {
      return { icon: <FaNotesMedical />, boxClass: "prescription" };
    }
    if (t.includes("review") || t.includes("feedback")) {
      return { icon: <FaStar />, boxClass: "review" };
    }
    if (
      t.includes("security") ||
      t.includes("password") ||
      t.includes("login") ||
      t.includes("lock")
    ) {
      return { icon: <FaShieldAlt />, boxClass: "security" };
    }
    return { icon: <FaBell />, boxClass: "default" };
  };

  return (
    <Panel title="Doctor Notification Center">
      <div className="dp-notify-container">
        <div className="dp-notify-header">
          <div className="dp-notify-tabs">
            <button
              type="button"
              className={`dp-notify-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`dp-notify-tab ${filter === "unread" ? "active" : ""}`}
              onClick={() => setFilter("unread")}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              className={`dp-notify-tab ${filter === "appointment" ? "active" : ""}`}
              onClick={() => setFilter("appointment")}
            >
              Appointments
            </button>
            <button
              type="button"
              className={`dp-notify-tab ${filter === "system" ? "active" : ""}`}
              onClick={() => setFilter("system")}
            >
              Security & System
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="dp-btn dp-btn-outline"
              onClick={fetchNotifications}
              title="Refresh notifications"
              disabled={loading}
            >
              <FaSyncAlt className={loading ? "dp-spin" : ""} /> Refresh
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                className="dp-btn dp-btn-primary"
                onClick={markAllAsRead}
                disabled={markingAll}
              >
                <FaCheckDouble />{" "}
                {markingAll ? "Marking..." : "Mark All as Read"}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div
            className="dp-loading"
            style={{ padding: "40px", textAlign: "center" }}
          >
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            title={
              filter === "unread"
                ? "No unread notifications"
                : "No notifications found"
            }
            text={
              filter === "unread"
                ? "You're completely caught up! Great job."
                : "You do not have any notifications in this category."
            }
          />
        ) : (
          <div className="dp-notify-list">
            {filteredNotifications.map((item) => {
              const { icon, boxClass } = getNotificationIcon(item.type);
              const isUnread = !item.isRead;
              return (
                <article
                  key={item._id}
                  className={`dp-notify-card ${isUnread ? "unread" : ""}`}
                >
                  <div className={`dp-notify-icon-box ${boxClass}`}>{icon}</div>
                  <div className="dp-notify-content">
                    <div className="dp-notify-top-line">
                      <div className="dp-notify-title">
                        {isUnread && (
                          <span className="dp-unread-dot" title="Unread" />
                        )}
                        <span>{item.title}</span>
                        {item.priority === "high" && (
                          <span
                            className="dp-badge-chip"
                            style={{
                              background: "#fef2f2",
                              color: "#dc2626",
                              fontSize: "0.7rem",
                              padding: "1px 6px",
                            }}
                          >
                            Urgent
                          </span>
                        )}
                      </div>
                      <span className="dp-notify-time">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Recently"}
                      </span>
                    </div>

                    <p className="dp-notify-body">{item.message}</p>

                    <div className="dp-notify-actions">
                      {item.link && (
                        <button
                          type="button"
                          className="dp-btn dp-btn-sm dp-btn-outline"
                          onClick={() => {
                            if (isUnread) markAsRead(item._id);
                            if (navigate && item.link.startsWith("/"))
                              navigate(item.link);
                            else window.open(item.link, "_blank");
                          }}
                        >
                          <FaExternalLinkAlt /> View Details
                        </button>
                      )}
                      {isUnread && (
                        <button
                          type="button"
                          className="dp-btn dp-btn-sm dp-btn-outline"
                          onClick={() => markAsRead(item._id)}
                          disabled={markingId === item._id}
                        >
                          <FaCheck />{" "}
                          {markingId === item._id
                            ? "Saving..."
                            : "Mark as read"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

function NotificationList({ notifications }) {
  if (!notifications?.length) return <EmptyState title="No notifications" />;
  return (
    <div className="dp-list">
      {notifications.map((item) => (
        <article className="dp-simple-row" key={item._id}>
          <strong>{item.title}</strong>
          <span>{item.message}</span>
        </article>
      ))}
    </div>
  );
}

function ReviewsView({ doctorId, doctor }) {
  const [data, setData] = useState({
    reviews: [],
    total: 0,
    averageRating: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchReviews = async () => {
    if (!doctorId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (ratingFilter !== "all") params.append("rating", ratingFilter);
      if (search.trim()) params.append("search", search.trim());
      params.append("page", page);
      params.append("limit", "10");

      const res = await api.get(
        `/api/v1/doctor/panel/${doctorId}/reviews?${params.toString()}`,
      );
      setData(
        res.data || {
          reviews: [],
          total: 0,
          averageRating: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          pages: 1,
        },
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [doctorId, ratingFilter, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReviews();
  };

  const renderStars = (rating) => {
    const num = Math.round(Number(rating || 0));
    return (
      <div className="dp-stars-row">
        {[1, 2, 3, 4, 5].map((s) => (
          <FaStar key={s} style={{ color: s <= num ? "#f59e0b" : "#cbd5e1" }} />
        ))}
      </div>
    );
  };

  const dist = data.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const totalCount = data.total || 0;

  return (
    <Panel title="Patient Reviews & Ratings">
      {/* Overview Card with Breakdown */}
      <div className="dp-reviews-summary-grid">
        <div className="dp-rating-overview-box">
          <div className="dp-rating-big-num">
            {Number(data.averageRating || 0).toFixed(1)}
          </div>
          {renderStars(data.averageRating)}
          <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
            Overall Doctor Rating
          </strong>
          <small style={{ color: "#64748b", marginTop: "4px" }}>
            Based on {totalCount} verified patient{" "}
            {totalCount === 1 ? "review" : "reviews"}
          </small>
        </div>

        <div className="dp-reviews-breakdown">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = dist[star] || 0;
            const pct =
              totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            return (
              <div key={star} className="dp-breakdown-row">
                <span className="dp-breakdown-label">
                  {star}{" "}
                  <FaStar style={{ color: "#f59e0b", fontSize: "0.85rem" }} />
                </span>
                <div className="dp-breakdown-bar-track">
                  <div
                    className="dp-breakdown-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="dp-breakdown-count">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Chips & Search Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {["all", "5", "4", "3", "2", "1"].map((val) => (
            <button
              key={val}
              type="button"
              className={`dp-notify-tab ${ratingFilter === val ? "active" : ""}`}
              onClick={() => {
                setRatingFilter(val);
                setPage(1);
              }}
            >
              {val === "all" ? "All Reviews" : `${val} Stars`}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSearchSubmit}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <FaSearch
              style={{ position: "absolute", left: "10px", color: "#94a3b8" }}
            />
            <input
              type="text"
              placeholder="Search in reviews..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 12px 8px 32px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.88rem",
              }}
            />
          </div>
          <button type="submit" className="dp-btn dp-btn-primary dp-btn-sm">
            Search
          </button>
          <button
            type="button"
            className="dp-btn dp-btn-outline dp-btn-sm"
            onClick={fetchReviews}
            disabled={loading}
            title="Refresh patient reviews"
          >
            <FaSyncAlt className={loading ? "dp-spin" : ""} /> Refresh
          </button>
        </form>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div
          className="dp-loading"
          style={{ padding: "40px", textAlign: "center" }}
        >
          Loading reviews...
        </div>
      ) : (data.reviews || []).length === 0 ? (
        <EmptyState
          title="No reviews found"
          text="No patient reviews match your selected filter criteria."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {(data.reviews || []).map((rev) => {
            const patientName = rev.name || rev.patientId?.name || "Patient";
            const initials = patientName
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const dateStr = rev.createdAt
              ? new Date(rev.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Recent";

            return (
              <article key={rev._id} className="dp-review-card">
                <div className="dp-review-card-header">
                  <div className="dp-reviewer-profile">
                    <div className="dp-reviewer-avatar">
                      {rev.avatar ? (
                        <img src={rev.avatar} alt={patientName} />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="dp-reviewer-info">
                      <strong>
                        {patientName}
                        <span className="dp-verified-patient-badge">
                          <FaCheckCircle
                            style={{ fontSize: "0.7rem", marginRight: "3px" }}
                          />
                          Verified Patient
                        </span>
                      </strong>
                      <small style={{ color: "#94a3b8" }}>{dateStr}</small>
                    </div>
                  </div>
                  {renderStars(rev.rating)}
                </div>

                {rev.title && (
                  <h4
                    style={{
                      margin: "2px 0 0",
                      color: "#0f172a",
                      fontSize: "0.95rem",
                    }}
                  >
                    {rev.title}
                  </h4>
                )}

                <p className="dp-review-comment">{rev.comment}</p>
              </article>
            );
          })}

          {/* Pagination */}
          {data.pages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
                marginTop: "16px",
              }}
            >
              <button
                type="button"
                className="dp-btn dp-btn-outline dp-btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <FaChevronLeft /> Previous
              </button>
              <span style={{ fontSize: "0.88rem", color: "#64748b" }}>
                Page {page} of {data.pages}
              </span>
              <button
                type="button"
                className="dp-btn dp-btn-outline dp-btn-sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              >
                Next <FaChevronRight />
              </button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function VerificationView({ doctor, doctorId, onSaved }) {
  const [uploadingField, setUploadingField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingReg, setSavingReg] = useState(false);

  const [regNumbers, setRegNumbers] = useState({
    medicalCouncilRegistrationNumber:
      doctor.medicalCouncilRegistrationNumber ||
      doctor.registrationNumber ||
      "",
    governmentRegistrationNumber: doctor.governmentRegistrationNumber || "",
  });

  const status = doctor.verificationStatus || "Pending";

  const saveRegNumbers = async (e) => {
    e?.preventDefault();
    if (!regNumbers.medicalCouncilRegistrationNumber.trim()) {
      return toast.error("Medical Council Registration Number is required");
    }
    setSavingReg(true);
    try {
      await api.patch(`/api/v1/doctor/panel/${doctorId}/profile`, {
        medicalCouncilRegistrationNumber:
          regNumbers.medicalCouncilRegistrationNumber.trim(),
        registrationNumber: regNumbers.medicalCouncilRegistrationNumber.trim(),
        governmentRegistrationNumber:
          regNumbers.governmentRegistrationNumber.trim(),
      });
      toast.success("Medical registration numbers saved successfully");
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save registration numbers",
      );
    } finally {
      setSavingReg(false);
    }
  };

  const uploadSingleDoc = async (fieldKey, file) => {
    if (!file) return;
    setUploadingField(fieldKey);
    const formData = new FormData();
    formData.append(fieldKey, file);

    try {
      await api.post(`/api/v1/doctor/upload-documents/${doctorId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded and saved to verification dossier");
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Document upload failed");
    } finally {
      setUploadingField(null);
    }
  };

  const submitVerification = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(
        `/api/v1/doctor/panel/${doctorId}/verification/submit`,
        {
          medicalCouncilRegistrationNumber:
            regNumbers.medicalCouncilRegistrationNumber,
          governmentRegistrationNumber:
            regNumbers.governmentRegistrationNumber,
          notes:
            "Doctor submitted credential documents for hospital board review.",
        },
      );
      if (res.data?.success) {
        toast.success(
          "Credentials submitted successfully. Awaiting hospital admin review.",
        );
        if (onSaved) onSaved();
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Verification submission failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Check which mandatory documents are ready
  const hasRegNo = Boolean(
    doctor.medicalCouncilRegistrationNumber || doctor.registrationNumber,
  );
  const hasLicense = Boolean(doctor.medicalLicenseUrl);
  const hasMbbs = Boolean(doctor.mbbsCertificateUrl);
  const hasIdProof = Boolean(doctor.governmentIdUrl || doctor.aadhaarPanUrl);

  const mandatoryCount = 4;
  const readyCount =
    (hasRegNo ? 1 : 0) +
    (hasLicense ? 1 : 0) +
    (hasMbbs ? 1 : 0) +
    (hasIdProof ? 1 : 0);
  const progressPct = Math.round((readyCount / mandatoryCount) * 100);

  const getStatusBanner = () => {
    switch (status) {
      case "Verified":
        return {
          bannerClass: "verified",
          icon: <FaCheckCircle className="dp-verify-icon" />,
          title: "Doctor Profile Fully Verified",
          desc: `Your medical registration and credentials were fully verified on ${doctor.verifiedAt ? new Date(doctor.verifiedAt).toLocaleDateString("en-IN") : "record"}. Your clinical practice, OPD scheduling, and online video consultations are 100% active.`,
        };
      case "Rejected":
        return {
          bannerClass: "rejected",
          icon: <FaTimesCircle className="dp-verify-icon" />,
          title: "Verification Rejected by Hospital Administration",
          desc:
            doctor.verificationNotes ||
            "Uploaded credentials could not be validated against the State/National Medical Council database. Please review the comments, update legitimate documents, and re-submit.",
        };
      case "Correction Requested":
        return {
          bannerClass: "correction",
          icon: <FaExclamationTriangle className="dp-verify-icon" />,
          title: "Credential Correction Requested",
          desc:
            doctor.verificationNotes ||
            "The credentialing committee requested clearer copies of your certificates or updated registration information. Please review and re-upload below.",
        };
      case "Suspended":
      case "Blocked":
        return {
          bannerClass: "rejected",
          icon: <FaTimesCircle className="dp-verify-icon" />,
          title: `Account ${status}`,
          desc:
            doctor.verificationNotes ||
            "Clinical activities for this doctor profile have been suspended by hospital administration.",
        };
      default:
        return {
          bannerClass: "pending",
          icon: <FaClock className="dp-verify-icon" />,
          title: "Credentials Under Hospital Review",
          desc:
            doctor.verificationNotes ||
            "Your medical credentials and certificates are currently being reviewed by the hospital credentialing board. Typical turnaround time is 24 to 48 hours.",
        };
    }
  };

  const banner = getStatusBanner();

  return (
    <Panel
      title="Doctor Verification & Credential Dossier"
      action={
        <button
          type="button"
          className="dp-btn dp-btn-outline dp-btn-sm"
          onClick={() => {
            if (onSaved) onSaved();
          }}
          title="Refresh Verification Status from server"
        >
          <FaSyncAlt /> Refresh Status
        </button>
      }
    >
      {/* Real Verification Status Banner */}
      <div className={`dp-verify-banner ${banner.bannerClass}`}>
        {banner.icon}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem" }}>
            {banner.title}
          </h3>
          <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
            {banner.desc}
          </p>
        </div>
      </div>

      {/* Verification Readiness Progress Strip */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "18px 20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <strong
              style={{
                fontSize: "1rem",
                color: "#0f172a",
                display: "block",
                marginBottom: "2px",
              }}
            >
              Verification Credential Readiness: {readyCount} / {mandatoryCount}{" "}
              Mandatory Requirements Ready
            </strong>
            <small style={{ color: "#64748b" }}>
              Upload your State Medical Council registration, medical degree,
              and government identity proof.
            </small>
          </div>
          <button
            type="button"
            className="dp-btn dp-btn-primary"
            disabled={submitting || readyCount < mandatoryCount || status === "Verified"}
            onClick={submitVerification}
            style={{ padding: "8px 18px", fontSize: "0.9rem" }}
          >
            {submitting ? (
              <>
                <FaSyncAlt className="dp-spin" /> Submitting...
              </>
            ) : status === "Verified" ? (
              <>
                <FaCheckCircle /> Verified & Approved
              </>
            ) : (
              <>
                <FaShieldAlt /> Submit for Credential Review
              </>
            )}
          </button>
        </div>

        <div className="dp-verify-progress-bar-track">
          <div
            className="dp-verify-progress-bar-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Official Medical Council Registration Identifiers */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <h4 style={{ margin: "0 0 14px 0", color: "#0f172a", fontSize: "1rem" }}>
          <FaCertificate color="#0d9488" style={{ marginRight: "6px" }} />
          Official Medical Registration Identifiers
        </h4>
        <form
          onSubmit={saveRegNumbers}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr)) 120px",
            gap: "16px",
            alignItems: "flex-end",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155" }}>
              Medical Council Reg. Number <span style={{ color: "#ef4444" }}>*</span>
            </span>
            <input
              value={regNumbers.medicalCouncilRegistrationNumber}
              onChange={(e) =>
                setRegNumbers({
                  ...regNumbers,
                  medicalCouncilRegistrationNumber: e.target.value,
                })
              }
              placeholder="e.g. MCI-2015-87421 / G-45120"
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155" }}>
              State / Government Registry Ref
            </span>
            <input
              value={regNumbers.governmentRegistrationNumber}
              onChange={(e) =>
                setRegNumbers({
                  ...regNumbers,
                  governmentRegistrationNumber: e.target.value,
                })
              }
              placeholder="e.g. GOV-REG-MH-2018"
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={savingReg}
            className="dp-btn dp-btn-primary"
            style={{ height: "40px" }}
          >
            {savingReg ? "Saving..." : "Save Numbers"}
          </button>
        </form>
      </div>

      {/* 5 Categorized Credential Document Cards */}
      <h4 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: "1.05rem" }}>
        Official Verification Documents & Certificates
      </h4>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {/* Document 1: Medical Council License */}
        <div className="dp-verify-doc-card">
          <div>
            <div className="dp-verify-doc-header">
              <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                1. State Medical Council License Certificate
              </strong>
              <span
                className={`dp-doc-status-chip ${doctor.medicalLicenseUrl ? "ready" : "missing"}`}
              >
                {doctor.medicalLicenseUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#64748b" }}>
              Official medical council license / permanent registration certificate
              (PDF or high-res image).
            </p>
            {doctor.medicalLicenseUrl && (
              <div style={{ marginBottom: "12px" }}>
                <a
                  href={doctor.medicalLicenseUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.85rem",
                    color: "#0d9488",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaEye /> View Current Certificate File
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="dp-btn dp-btn-outline dp-btn-sm" style={{ cursor: "pointer", display: "inline-block" }}>
              <FaUpload />{" "}
              {uploadingField === "medicalLicense"
                ? "Uploading..."
                : doctor.medicalLicenseUrl
                  ? "Replace Certificate"
                  : "Upload Certificate"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                disabled={uploadingField === "medicalLicense"}
                onChange={(e) =>
                  uploadSingleDoc("medicalLicense", e.target.files?.[0])
                }
              />
            </label>
          </div>
        </div>

        {/* Document 2: MBBS / Primary Degree Certificate */}
        <div className="dp-verify-doc-card">
          <div>
            <div className="dp-verify-doc-header">
              <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                2. MBBS / Primary Degree Certificate
              </strong>
              <span
                className={`dp-doc-status-chip ${doctor.mbbsCertificateUrl ? "ready" : "missing"}`}
              >
                {doctor.mbbsCertificateUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#64748b" }}>
              Graduation degree certificate or university passing diploma.
            </p>
            {doctor.mbbsCertificateUrl && (
              <div style={{ marginBottom: "12px" }}>
                <a
                  href={doctor.mbbsCertificateUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.85rem",
                    color: "#0d9488",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaEye /> View Degree Certificate
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="dp-btn dp-btn-outline dp-btn-sm" style={{ cursor: "pointer", display: "inline-block" }}>
              <FaUpload />{" "}
              {uploadingField === "mbbs"
                ? "Uploading..."
                : doctor.mbbsCertificateUrl
                  ? "Replace Degree"
                  : "Upload Degree"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                disabled={uploadingField === "mbbs"}
                onChange={(e) => uploadSingleDoc("mbbs", e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        {/* Document 3: MD / MS / Specialization Certificate */}
        <div className="dp-verify-doc-card">
          <div>
            <div className="dp-verify-doc-header">
              <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                3. MD / MS / Post-Grad Specialization
              </strong>
              <span
                className={`dp-doc-status-chip ${doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl ? "ready" : "missing"}`}
              >
                {doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>Optional / Pending</>
                )}
              </span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#64748b" }}>
              Post-graduate degree certificate, fellowship, or board specialization.
            </p>
            {(doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl) && (
              <div style={{ marginBottom: "12px" }}>
                <a
                  href={doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.85rem",
                    color: "#0d9488",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaEye /> View Specialization Document
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="dp-btn dp-btn-outline dp-btn-sm" style={{ cursor: "pointer", display: "inline-block" }}>
              <FaUpload />{" "}
              {uploadingField === "mdMs"
                ? "Uploading..."
                : doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl
                  ? "Replace Specialization"
                  : "Upload Specialization"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                disabled={uploadingField === "mdMs"}
                onChange={(e) => uploadSingleDoc("mdMs", e.target.files?.[0])}
              />
            </label>
          </div>
        </div>

        {/* Document 4: Government Photo ID / Aadhaar */}
        <div className="dp-verify-doc-card">
          <div>
            <div className="dp-verify-doc-header">
              <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                4. Government Identity Proof (Aadhaar / Passport)
              </strong>
              <span
                className={`dp-doc-status-chip ${doctor.governmentIdUrl || doctor.aadhaarPanUrl ? "ready" : "missing"}`}
              >
                {doctor.governmentIdUrl || doctor.aadhaarPanUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#64748b" }}>
              Government issued ID for doctor identity validation (strictly confidential).
            </p>
            {(doctor.governmentIdUrl || doctor.aadhaarPanUrl) && (
              <div style={{ marginBottom: "12px" }}>
                <a
                  href={doctor.governmentIdUrl || doctor.aadhaarPanUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.85rem",
                    color: "#0d9488",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaEye /> View Confidential ID
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="dp-btn dp-btn-outline dp-btn-sm" style={{ cursor: "pointer", display: "inline-block" }}>
              <FaUpload />{" "}
              {uploadingField === "governmentId"
                ? "Uploading..."
                : doctor.governmentIdUrl || doctor.aadhaarPanUrl
                  ? "Replace Identity ID"
                  : "Upload Identity ID"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                disabled={uploadingField === "governmentId"}
                onChange={(e) =>
                  uploadSingleDoc("governmentId", e.target.files?.[0])
                }
              />
            </label>
          </div>
        </div>

        {/* Document 5: Hospital Affiliation / Appointment Letter */}
        <div className="dp-verify-doc-card">
          <div>
            <div className="dp-verify-doc-header">
              <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                5. Hospital Affiliation / Appointment Letter
              </strong>
              <span
                className={`dp-doc-status-chip ${doctor.hospitalAffiliationLetterUrl ? "ready" : "missing"}`}
              >
                {doctor.hospitalAffiliationLetterUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>Optional</>
                )}
              </span>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#64748b" }}>
              Official appointment letter or credentialing authorization from the affiliated hospital.
            </p>
            {doctor.hospitalAffiliationLetterUrl && (
              <div style={{ marginBottom: "12px" }}>
                <a
                  href={doctor.hospitalAffiliationLetterUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.85rem",
                    color: "#0d9488",
                    fontWeight: "600",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <FaEye /> View Affiliation Letter
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="dp-btn dp-btn-outline dp-btn-sm" style={{ cursor: "pointer", display: "inline-block" }}>
              <FaUpload />{" "}
              {uploadingField === "affiliationLetter"
                ? "Uploading..."
                : doctor.hospitalAffiliationLetterUrl
                  ? "Replace Letter"
                  : "Upload Letter"}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                disabled={uploadingField === "affiliationLetter"}
                onChange={(e) =>
                  uploadSingleDoc("affiliationLetter", e.target.files?.[0])
                }
              />
            </label>
          </div>
        </div>
      </div>

      {/* Verification Audit Timeline / History */}
      {doctor.verificationLogs && doctor.verificationLogs.length > 0 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "20px",
          }}
        >
          <h4 style={{ margin: "0 0 16px 0", color: "#0f172a", fontSize: "1rem" }}>
            <FaHistory color="#0d9488" style={{ marginRight: "6px" }} />
            Credentialing Review Audit History
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[...doctor.verificationLogs].reverse().map((log, idx) => (
              <div
                key={log._id || idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "10px 14px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  borderLeft: `4px solid ${log.status === "Verified" ? "#16a34a" : log.status === "Rejected" ? "#dc2626" : log.status === "Correction Requested" ? "#d97706" : "#2563eb"}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.85rem",
                      marginBottom: "4px",
                    }}
                  >
                    <strong style={{ color: "#0f172a" }}>{log.status}</strong>
                    <span style={{ color: "#64748b" }}>
                      {log.createdAt
                        ? new Date(log.createdAt).toLocaleString("en-IN")
                        : "Recent"}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569" }}>
                    {log.note || "Status update logged by system"}
                  </p>
                  {log.changedByName && (
                    <small style={{ color: "#94a3b8", display: "block", marginTop: "2px" }}>
                      Reviewed by: {log.changedByName}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function ProfileView({ doctor, doctorId, onSaved }) {
  const [activeTab, setActiveTab] = useState("personal");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: doctor.name || "",
    phone: doctor.phone || "",
    address: doctor.address || "",
    speciality: doctor.speciality || "",
    department: doctor.department || "",
    specialization: doctor.specialization || "",
    degree: doctor.degree || "",
    qualification: doctor.qualification || "",
    experience: doctor.experience || "",
    fees: doctor.fees || "",
    slotDurationMinutes: doctor.slotDurationMinutes || 30,
    about: doctor.about || "",
    image: doctor.image || "",
    hdProfilePicture: doctor.hdProfilePicture || doctor.image || "",
    coverBanner: doctor.coverBanner || "",
    signatureImage: doctor.signatureImage || "",
    biography: doctor.biography || "",
    gender: doctor.gender || "male",
    dob: doctor.dob || "",
    languages: (doctor.languages || []).join(", "),
    consultationTypes: doctor.consultationTypes || ["clinic", "video"],
    clinicInfo: {
      name: doctor.clinicInfo?.name || doctor.hospitalName || "",
      address: doctor.clinicInfo?.address || "",
      phone: doctor.clinicInfo?.phone || "",
      roomNo: doctor.clinicInfo?.roomNo || "",
    },
    qualificationTimeline: doctor.qualificationTimeline || [],
    experienceTimeline: doctor.experienceTimeline || [],
    awards: (doctor.awards || []).join(", "),
    researchPapers: (doctor.researchPapers || []).join(", "),
  });

  const save = async (event) => {
    event?.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.speciality.trim()) {
      return toast.error("Doctor name, phone, and speciality are required");
    }
    if (Number(form.fees) < 100) {
      return toast.error("Consultation fees must be at least ₹100");
    }
    if (Number(form.experience) < 0) {
      return toast.error("Experience years cannot be negative");
    }

    setSaving(true);
    try {
      await api.patch(`/api/v1/doctor/panel/${doctorId}/profile`, {
        ...form,
        fees: Number(form.fees),
        experience: Number(form.experience),
        slotDurationMinutes: Number(form.slotDurationMinutes || 30),
        languages: form.languages
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        awards: form.awards
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        researchPapers: form.researchPapers
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      toast.success("Doctor profile updated successfully");
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Profile update failed");
    } finally {
      setSaving(false);
    }
  };

  const imageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const highResolutionSource = await toDataUrl(file);
      setForm((prev) => ({
        ...prev,
        image: highResolutionSource,
        hdProfilePicture: highResolutionSource,
      }));
      toast.info("Photo preview updated. Click 'Save Profile' to apply changes.");
    }
  };

  const signatureUpload = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const sigData = await toDataUrl(file);
      setForm((prev) => ({
        ...prev,
        signatureImage: sigData,
      }));
      toast.info("Digital signature updated. Click 'Save Profile' to apply.");
    }
  };

  const toggleConsultationType = (type) => {
    const current = new Set(form.consultationTypes);
    if (current.has(type)) {
      if (current.size === 1) {
        return toast.warning("At least one consultation mode must be active");
      }
      current.delete(type);
    } else {
      current.add(type);
    }
    setForm({ ...form, consultationTypes: Array.from(current) });
  };

  // Timeline helpers
  const addEduItem = () => {
    setForm({
      ...form,
      qualificationTimeline: [
        ...form.qualificationTimeline,
        { title: "", institute: "", year: "", description: "" },
      ],
    });
  };

  const updateEduItem = (idx, key, val) => {
    const updated = [...form.qualificationTimeline];
    updated[idx][key] = val;
    setForm({ ...form, qualificationTimeline: updated });
  };

  const removeEduItem = (idx) => {
    setForm({
      ...form,
      qualificationTimeline: form.qualificationTimeline.filter((_, i) => i !== idx),
    });
  };

  const addExpItem = () => {
    setForm({
      ...form,
      experienceTimeline: [
        ...form.experienceTimeline,
        { title: "", hospital: "", startYear: "", endYear: "", description: "" },
      ],
    });
  };

  const updateExpItem = (idx, key, val) => {
    const updated = [...form.experienceTimeline];
    updated[idx][key] = val;
    setForm({ ...form, experienceTimeline: updated });
  };

  const removeExpItem = (idx) => {
    setForm({
      ...form,
      experienceTimeline: form.experienceTimeline.filter((_, i) => i !== idx),
    });
  };

  const avatarSrc = imageSource(form.hdProfilePicture || form.image);

  return (
    <Panel
      title="Doctor Profile & Clinical Workspace"
      action={
        <button
          type="button"
          className="dp-btn dp-btn-outline dp-btn-sm"
          onClick={() => {
            if (onSaved) onSaved();
          }}
          title="Reload profile from server"
        >
          <FaSyncAlt /> Refresh Profile
        </button>
      }
    >
      {/* 5 Distinct Profile Sub-Tabs */}
      <div className="dp-profile-tabs">
        <button
          type="button"
          className={`dp-profile-tab-btn ${activeTab === "personal" ? "active" : ""}`}
          onClick={() => setActiveTab("personal")}
        >
          Personal & Contact
        </button>
        <button
          type="button"
          className={`dp-profile-tab-btn ${activeTab === "clinical" ? "active" : ""}`}
          onClick={() => setActiveTab("clinical")}
        >
          Clinical & Fees
        </button>
        <button
          type="button"
          className={`dp-profile-tab-btn ${activeTab === "experience" ? "active" : ""}`}
          onClick={() => setActiveTab("experience")}
        >
          Career & Achievements
        </button>
        <button
          type="button"
          className={`dp-profile-tab-btn ${activeTab === "clinic" ? "active" : ""}`}
          onClick={() => setActiveTab("clinic")}
        >
          Clinic & Hospital
        </button>
        <button
          type="button"
          className={`dp-profile-tab-btn ${activeTab === "biography" ? "active" : ""}`}
          onClick={() => setActiveTab("biography")}
        >
          Biography & Media
        </button>
      </div>

      <form className="dp-form" onSubmit={save}>
        {/* Tab 1: Personal & Contact */}
        {activeTab === "personal" && (
          <div className="dp-form grid">
            <label>
              <span>
                Doctor Full Name <span style={{ color: "#ef4444" }}>*</span>
              </span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Dr. John Doe"
              />
            </label>

            <label>
              <span>
                Contact Phone <span style={{ color: "#ef4444" }}>*</span>
              </span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 9876543210"
              />
            </label>

            <label>
              <span>
                Email Address <span className="dp-field-badge">Read-Only</span>
              </span>
              <input
                value={doctor.email || ""}
                disabled
                className="dp-read-only-field"
                title="System account identifier cannot be changed directly"
              />
            </label>

            <label>
              <span>
                Verification Status{" "}
                <span className="dp-field-badge">System Status</span>
              </span>
              <input
                value={doctor.verificationStatus || "Pending"}
                disabled
                className="dp-read-only-field"
              />
            </label>

            <label>
              <span>Gender</span>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              <span>Date of Birth</span>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
            </label>

            <label className="wide">
              <span>Residential / Chamber Address</span>
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Clinic Street, City, State"
              />
            </label>
          </div>
        )}

        {/* Tab 2: Clinical & Fees */}
        {activeTab === "clinical" && (
          <div className="dp-form grid">
            <label>
              <span>
                Primary Speciality <span style={{ color: "#ef4444" }}>*</span>
              </span>
              <input
                value={form.speciality}
                onChange={(e) =>
                  setForm({ ...form, speciality: e.target.value })
                }
                placeholder="Cardiologist, Neurologist, General Physician..."
              />
            </label>

            <label>
              <span>Department</span>
              <input
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                placeholder="Outpatient Department, Cardiology OPD"
              />
            </label>

            <label>
              <span>Sub-Specialization</span>
              <input
                value={form.specialization}
                onChange={(e) =>
                  setForm({ ...form, specialization: e.target.value })
                }
                placeholder="Interventional Cardiology, Pediatric Neurology"
              />
            </label>

            <label>
              <span>Degree / Academic Title</span>
              <input
                value={form.degree}
                onChange={(e) => setForm({ ...form, degree: e.target.value })}
                placeholder="MBBS, MD, DM"
              />
            </label>

            <label>
              <span>Years of Clinical Experience</span>
              <input
                type="number"
                min="0"
                max="70"
                value={form.experience}
                onChange={(e) =>
                  setForm({ ...form, experience: e.target.value })
                }
                placeholder="10"
              />
            </label>

            <label>
              <span>Consultation Fees (₹) <span style={{ color: "#ef4444" }}>*</span></span>
              <input
                type="number"
                min="100"
                value={form.fees}
                onChange={(e) => setForm({ ...form, fees: e.target.value })}
                placeholder="500"
              />
            </label>

            <label>
              <span>Slot Duration (Minutes)</span>
              <select
                value={form.slotDurationMinutes}
                onChange={(e) =>
                  setForm({ ...form, slotDurationMinutes: Number(e.target.value) })
                }
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              >
                <option value="15">15 Minutes</option>
                <option value="20">20 Minutes</option>
                <option value="30">30 Minutes (Recommended)</option>
                <option value="45">45 Minutes</option>
                <option value="60">60 Minutes</option>
              </select>
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#334155" }}>
                Active Consultation Modes
              </span>
              <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.consultationTypes.includes("clinic")}
                    onChange={() => toggleConsultationType("clinic")}
                  />
                  <span>In-Clinic OPD</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.consultationTypes.includes("video")}
                    onChange={() => toggleConsultationType("video")}
                  />
                  <span>Online Video Consultation</span>
                </label>
              </div>
            </div>

            <label className="wide">
              <span>Languages Spoken (comma separated)</span>
              <input
                value={form.languages}
                placeholder="English, Hindi, Gujarati, Marathi"
                onChange={(e) =>
                  setForm({ ...form, languages: e.target.value })
                }
              />
            </label>
          </div>
        )}

        {/* Tab 3: Career & Achievements */}
        {activeTab === "experience" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Qualification Timeline */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <strong style={{ color: "#0f172a", fontSize: "1rem" }}>
                  Academic Qualifications Timeline
                </strong>
                <button
                  type="button"
                  className="dp-btn dp-btn-outline dp-btn-sm"
                  onClick={addEduItem}
                >
                  <FaPlus /> Add Qualification
                </button>
              </div>

              {form.qualificationTimeline.length === 0 ? (
                <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.88rem" }}>
                  No academic qualifications added. Click "Add Qualification" to add MBBS, MD, or diplomas.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {form.qualificationTimeline.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.5fr 2fr 1fr auto",
                        gap: "10px",
                        alignItems: "center",
                        background: "#f8fafc",
                        padding: "10px 14px",
                        borderRadius: "8px",
                      }}
                    >
                      <input
                        placeholder="Degree / Diploma"
                        value={item.title || ""}
                        onChange={(e) => updateEduItem(idx, "title", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <input
                        placeholder="Institute / University"
                        value={item.institute || ""}
                        onChange={(e) => updateEduItem(idx, "institute", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <input
                        placeholder="Year (e.g. 2018)"
                        value={item.year || ""}
                        onChange={(e) => updateEduItem(idx, "year", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeEduItem(idx)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "6px" }}
                        title="Remove"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Experience Timeline */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <strong style={{ color: "#0f172a", fontSize: "1rem" }}>
                  Clinical Experience & Hospital Appointments
                </strong>
                <button
                  type="button"
                  className="dp-btn dp-btn-outline dp-btn-sm"
                  onClick={addExpItem}
                >
                  <FaPlus /> Add Hospital Experience
                </button>
              </div>

              {form.experienceTimeline.length === 0 ? (
                <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.88rem" }}>
                  No experience history listed. Click "Add Hospital Experience" to specify previous clinical tenure.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {form.experienceTimeline.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.5fr 2fr 1fr 1fr auto",
                        gap: "10px",
                        alignItems: "center",
                        background: "#f8fafc",
                        padding: "10px 14px",
                        borderRadius: "8px",
                      }}
                    >
                      <input
                        placeholder="Role / Title"
                        value={item.title || ""}
                        onChange={(e) => updateExpItem(idx, "title", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <input
                        placeholder="Hospital / Medical Center"
                        value={item.hospital || ""}
                        onChange={(e) => updateExpItem(idx, "hospital", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <input
                        placeholder="Start Year"
                        value={item.startYear || ""}
                        onChange={(e) => updateExpItem(idx, "startYear", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <input
                        placeholder="End Year / Present"
                        value={item.endYear || ""}
                        onChange={(e) => updateExpItem(idx, "endYear", e.target.value)}
                        style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeExpItem(idx)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "6px" }}
                        title="Remove"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Awards & Research */}
            <div className="dp-form grid">
              <label className="wide">
                <span>Honors & Awards (comma separated)</span>
                <input
                  value={form.awards}
                  placeholder="e.g. Best Cardiologist 2024, IMA Outstanding Service Award"
                  onChange={(e) => setForm({ ...form, awards: e.target.value })}
                />
              </label>

              <label className="wide">
                <span>Research Papers & Medical Publications (comma separated)</span>
                <input
                  value={form.researchPapers}
                  placeholder="e.g. Study on Coronary Angioplasty (Lancet 2023), Clinical Hypertension Trial (IJMR)"
                  onChange={(e) =>
                    setForm({ ...form, researchPapers: e.target.value })
                  }
                />
              </label>
            </div>
          </div>
        )}

        {/* Tab 4: Clinic & Hospital */}
        {activeTab === "clinic" && (
          <div className="dp-form grid">
            <label>
              <span>
                Affiliated Hospital{" "}
                <span className="dp-field-badge">Hospital Directory</span>
              </span>
              <input
                value={
                  doctor.hospitalId?.name ||
                  doctor.hospitalName ||
                  "HealPoint Hospital"
                }
                disabled
                className="dp-read-only-field"
              />
            </label>

            <label>
              <span>Clinic / OPD Center Name</span>
              <input
                value={form.clinicInfo.name || ""}
                placeholder="e.g. City Health Care Center"
                onChange={(e) =>
                  setForm({
                    ...form,
                    clinicInfo: { ...form.clinicInfo, name: e.target.value },
                  })
                }
              />
            </label>

            <label>
              <span>OPD Room / Chamber Number</span>
              <input
                value={form.clinicInfo.roomNo || ""}
                placeholder="Room 204, 2nd Floor"
                onChange={(e) =>
                  setForm({
                    ...form,
                    clinicInfo: { ...form.clinicInfo, roomNo: e.target.value },
                  })
                }
              />
            </label>

            <label>
              <span>Clinic Helpline Phone</span>
              <input
                value={form.clinicInfo.phone || ""}
                placeholder="+91 22 1234 5678"
                onChange={(e) =>
                  setForm({
                    ...form,
                    clinicInfo: { ...form.clinicInfo, phone: e.target.value },
                  })
                }
              />
            </label>

            <label className="wide">
              <span>Clinic / Center Address</span>
              <input
                value={form.clinicInfo.address || ""}
                placeholder="Full address of OPD clinic"
                onChange={(e) =>
                  setForm({
                    ...form,
                    clinicInfo: { ...form.clinicInfo, address: e.target.value },
                  })
                }
              />
            </label>
          </div>
        )}

        {/* Tab 5: Biography & Media */}
        {activeTab === "biography" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            {/* HD Photo Box */}
            <div className="dp-photo-upload-box">
              {avatarSrc ? (
                <img
                  className="dp-photo-preview-avatar"
                  src={avatarSrc}
                  alt="Doctor profile"
                />
              ) : (
                <div
                  className="dp-photo-preview-avatar"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    background: "#e2e8f0",
                    color: "#475569",
                    fontWeight: 800,
                  }}
                >
                  HD
                </div>
              )}
              <div style={{ flex: 1, minWidth: "220px" }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: "0.95rem",
                    color: "#0f172a",
                    marginBottom: "4px",
                  }}
                >
                  HD Profile Photograph
                </strong>
                <small
                  style={{
                    display: "block",
                    color: "#64748b",
                    marginBottom: "10px",
                  }}
                >
                  Upload a crisp portrait photo in JPEG, PNG, or WebP. Max 5MB.
                </small>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={imageUpload}
                />
              </div>
            </div>

            {/* Digital Signature Upload Box (Used for digital prescriptions) */}
            <div
              style={{
                display: "flex",
                gap: "16px",
                alignItems: "center",
                padding: "16px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                flexWrap: "wrap",
              }}
            >
              {form.signatureImage ? (
                <img
                  src={imageSource(form.signatureImage)}
                  alt="Digital Signature"
                  style={{
                    width: "140px",
                    height: "60px",
                    objectFit: "contain",
                    background: "#fff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "4px",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "140px",
                    height: "60px",
                    background: "#fff",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "6px",
                    display: "grid",
                    placeItems: "center",
                    color: "#94a3b8",
                    fontSize: "0.8rem",
                  }}
                >
                  No Signature
                </div>
              )}
              <div style={{ flex: 1, minWidth: "220px" }}>
                <strong
                  style={{
                    display: "block",
                    fontSize: "0.95rem",
                    color: "#0f172a",
                    marginBottom: "2px",
                  }}
                >
                  Digital Prescription Signature
                </strong>
                <small
                  style={{
                    display: "block",
                    color: "#64748b",
                    marginBottom: "8px",
                  }}
                >
                  Upload your doctor signature stamp/file (PNG with transparent background recommended) for official electronic prescriptions.
                </small>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={signatureUpload}
                />
              </div>
            </div>

            <label className="wide">
              <span>Short Professional Summary (About)</span>
              <textarea
                rows={3}
                value={form.about}
                placeholder="Brief summary displayed on patient search cards..."
                onChange={(e) => setForm({ ...form, about: e.target.value })}
              />
            </label>

            <label className="wide">
              <span>Full Clinical Biography & Expertise</span>
              <textarea
                rows={5}
                value={form.biography}
                placeholder="Detailed career history, specialized treatments, hospital background, clinical philosophy..."
                onChange={(e) =>
                  setForm({ ...form, biography: e.target.value })
                }
              />
            </label>
          </div>
        )}

        <div
          style={{
            marginTop: "24px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="submit"
            disabled={saving}
            className="dp-btn dp-btn-primary"
          >
            <FaSave /> {saving ? "Saving Changes..." : "Save Profile"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function SettingsView({ doctor, doctorId, onSaved, logout }) {
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPass, setChangingPass] = useState(false);

  const [settings, setSettings] = useState({
    appointmentAlerts: true,
    cancellationAlerts: true,
    rescheduleAlerts: true,
    completionAlerts: true,
    securityAlerts: true,
    ...(doctor.notificationSettings || {}),
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    const p = passwords.newPassword;
    if (!p) return { score: 0, label: "None" };
    let score = 0;
    if (p.length >= 8) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/\d/.test(p)) score += 1;
    if (/[^A-Za-z0-9]/.test(p)) score += 1;

    if (score <= 1) return { score: 1, label: "Weak" };
    if (score <= 3) return { score: 2, label: "Medium" };
    return { score: 3, label: "Strong" };
  }, [passwords.newPassword]);

  const changePassword = async (event) => {
    event.preventDefault();
    if (
      !passwords.currentPassword ||
      !passwords.newPassword ||
      !passwords.confirmPassword
    ) {
      return toast.error("Please fill in all password fields");
    }
    if (passwords.newPassword.length < 6) {
      return toast.error("New password must be at least 6 characters long");
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      return toast.error("New password and confirm password do not match");
    }
    setChangingPass(true);
    try {
      await api.patch(
        `/api/v1/doctor/panel/${doctorId}/change-password`,
        passwords,
      );
      toast.success("Password changed successfully");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Password change failed");
    } finally {
      setChangingPass(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.patch(
        `/api/v1/doctor/panel/${doctorId}/notification-settings`,
        settings,
      );
      toast.success("Notification preferences saved");
      if (onSaved) onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <section className="dp-grid two">
      {/* Change Password Card */}
      <Panel title="Security & Password Change">
        <form className="dp-form" onSubmit={changePassword}>
          <label>
            <span>Current Password</span>
            <div className="dp-password-input-group">
              <input
                type={showCurrent ? "text" : "password"}
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords({
                    ...passwords,
                    currentPassword: e.target.value,
                  })
                }
                placeholder="Enter current password"
              />
              <button
                type="button"
                className="dp-password-toggle-btn"
                onClick={() => setShowCurrent(!showCurrent)}
                tabIndex={-1}
              >
                {showCurrent ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          <label>
            <span>New Password</span>
            <div className="dp-password-input-group">
              <input
                type={showNew ? "text" : "password"}
                value={passwords.newPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, newPassword: e.target.value })
                }
                placeholder="Enter new password (min 6 chars)"
              />
              <button
                type="button"
                className="dp-password-toggle-btn"
                onClick={() => setShowNew(!showNew)}
                tabIndex={-1}
              >
                {showNew ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          {/* Strength Meter */}
          {passwords.newPassword && (
            <div style={{ marginTop: "-6px", marginBottom: "8px" }}>
              <div className="dp-strength-meter">
                <div
                  className={`dp-strength-step ${
                    passwordStrength.score >= 1
                      ? passwordStrength.score === 1
                        ? "weak"
                        : passwordStrength.score === 2
                          ? "medium"
                          : "strong"
                      : ""
                  }`}
                />
                <div
                  className={`dp-strength-step ${
                    passwordStrength.score >= 2
                      ? passwordStrength.score === 2
                        ? "medium"
                        : "strong"
                      : ""
                  }`}
                />
                <div
                  className={`dp-strength-step ${
                    passwordStrength.score >= 3 ? "strong" : ""
                  }`}
                />
              </div>
              <small style={{ color: "#64748b", fontSize: "0.75rem" }}>
                Strength: {passwordStrength.label}
              </small>
            </div>
          )}

          <label>
            <span>Confirm New Password</span>
            <div className="dp-password-input-group">
              <input
                type={showConfirm ? "text" : "password"}
                value={passwords.confirmPassword}
                onChange={(e) =>
                  setPasswords({
                    ...passwords,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Re-enter new password"
              />
              <button
                type="button"
                className="dp-password-toggle-btn"
                onClick={() => setShowConfirm(!showConfirm)}
                tabIndex={-1}
              >
                {showConfirm ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={changingPass}
            className="dp-btn dp-btn-primary"
            style={{ marginTop: "10px" }}
          >
            <FaLock />{" "}
            {changingPass ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </Panel>

      {/* Notification Preferences Card */}
      <Panel title="Notification Preferences">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[
            {
              key: "appointmentAlerts",
              title: "New Appointment Booking Alerts",
              desc: "Get notified immediately when a patient books a new consultation slot.",
            },
            {
              key: "cancellationAlerts",
              title: "Patient Cancellation Alerts",
              desc: "Receive alert notifications when an appointment is cancelled.",
            },
            {
              key: "rescheduleAlerts",
              title: "Reschedule Notification Alerts",
              desc: "Notifications when appointment timings are updated or requested.",
            },
            {
              key: "completionAlerts",
              title: "Consultation Completion Receipts",
              desc: "Confirmations when prescriptions and consultation notes are submitted.",
            },
            {
              key: "securityAlerts",
              title: "Account Security & New Login Alerts",
              desc: "Receive urgent notifications whenever a login attempt or password change occurs.",
            },
          ].map(({ key, title, desc }) => (
            <label key={key} className="dp-toggle-label">
              <div>
                <strong
                  style={{
                    display: "block",
                    fontSize: "0.92rem",
                    color: "#0f172a",
                  }}
                >
                  {title}
                </strong>
                <small style={{ color: "#64748b", fontSize: "0.78rem" }}>
                  {desc}
                </small>
              </div>
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={(e) =>
                  setSettings({ ...settings, [key]: e.target.checked })
                }
                style={{
                  width: "18px",
                  height: "18px",
                  accentColor: "#2563eb",
                  cursor: "pointer",
                }}
              />
            </label>
          ))}

          <button
            type="button"
            onClick={saveSettings}
            disabled={savingSettings}
            className="dp-btn dp-btn-primary"
            style={{ alignSelf: "flex-start", marginTop: "8px" }}
          >
            <FaSave /> {savingSettings ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </Panel>

      {/* Login History & Session Security */}
      <div style={{ gridColumn: "1 / -1" }}>
        <Panel title="Login History & Active Session Security">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span className="dp-badge-chip dp-badge-verified">
                <FaCheckCircle /> Active Session
              </span>
              <small style={{ color: "#64748b" }}>
                Connected to HealPoint Secure Clinical API
              </small>
            </div>
            {logout && (
              <button
                type="button"
                className="dp-btn dp-btn-danger dp-btn-sm"
                onClick={logout}
              >
                <FaSignOutAlt /> Terminate Session & Logout
              </button>
            )}
          </div>

          <div className="dp-list">
            {(doctor.loginHistory || []).map((item, idx) => (
              <article
                className="dp-simple-row"
                key={item._id || item.loggedInAt || idx}
                style={{ padding: "12px 16px" }}
              >
                <div>
                  <strong style={{ color: "#0f172a" }}>
                    {new Date(item.loggedInAt).toLocaleString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                  <small
                    style={{
                      display: "block",
                      color: "#64748b",
                      marginTop: "2px",
                    }}
                  >
                    IP: {item.ip || "127.0.0.1 (Local Session)"}
                  </small>
                </div>
                <span
                  className="dp-badge-chip"
                  style={{
                    background:
                      item.status === "failed" ? "#fef2f2" : "#ecfdf5",
                    color: item.status === "failed" ? "#dc2626" : "#059669",
                  }}
                >
                  {item.status === "failed"
                    ? "Failed Attempt"
                    : "Successful Login"}
                </span>
              </article>
            ))}
            {!doctor.loginHistory?.length && (
              <EmptyState
                title="No prior login history"
                text="Current session was authenticated via standard JWT credentials."
              />
            )}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function MedicalForm({ form, setForm, onSubmit, saving }) {
  return (
    <form
      className="dp-form grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        <span>Diagnosis</span>
        <input
          value={form.diagnosis}
          onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
        />
      </label>
      <label>
        <span>Follow-up Advice</span>
        <input
          value={form.followUpAdvice}
          onChange={(e) => setForm({ ...form, followUpAdvice: e.target.value })}
        />
      </label>
      <label className="wide">
        <span>Prescription</span>
        <textarea
          value={form.prescription}
          onChange={(e) => setForm({ ...form, prescription: e.target.value })}
        />
      </label>
      <label className="wide">
        <span>Medical Notes</span>
        <textarea
          value={form.medicalNotes}
          onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })}
        />
      </label>
      <button disabled={saving}>Save Medical Record</button>
    </form>
  );
}

function ReportsList({ reports, appointmentId, onDelete }) {
  return (
    <div className="dp-report-list">
      <h3>Reports</h3>
      {reports?.length ? (
        reports.map((report) => (
          <div className="dp-report-row" key={report._id || report.url}>
            <a href={report.url} target="_blank" rel="noreferrer">
              Download {report.name}
            </a>
            {onDelete && report._id && (
              <button
                type="button"
                className="dp-danger"
                onClick={() => onDelete(appointmentId, report._id)}
              >
                Delete
              </button>
            )}
          </div>
        ))
      ) : (
        <p>No reports uploaded.</p>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <article className="dp-info">
      <span>{label}</span>
      <strong>{value || "Not available"}</strong>
    </article>
  );
}

function Panel({ title, children }) {
  return (
    <section className="dp-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
