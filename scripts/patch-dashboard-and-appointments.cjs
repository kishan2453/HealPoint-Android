const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../HealPointDoctorWeb/src/pages/DoctorPortal.jsx');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let code = raw.replace(/\r\n/g, '\n');

// 1. Rebuild DashboardView
const startDash = code.indexOf('function DashboardView({');
const endDash = code.indexOf('function AppointmentsView({');

if (startDash === -1 || endDash === -1) {
  console.error('Could not find DashboardView boundaries');
  process.exit(1);
}

const newDashboardView = `function DashboardView({
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
    \`\${String(todayDate.getDate()).padStart(2, "0")}-\${String(todayDate.getMonth() + 1).padStart(2, "0")}-\${todayDate.getFullYear()}\`
  );
  const daySchedule = (doctor.weeklySchedule || []).find(
    (item) => String(item.day).toLowerCase() === weekday.toLowerCase()
  );
  const workingHours = daySchedule
    ? \`\${daySchedule.startTime || "09:00 AM"} - \${daySchedule.endTime || "05:00 PM"}\`
    : doctor.availabilitySchedule || "09:00 AM - 05:00 PM";

  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + index);
    const key = \`\${String(date.getDate()).padStart(2, "0")}-\${String(date.getMonth() + 1).padStart(2, "0")}-\${date.getFullYear()}\`;
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
    return [...map.values()].slice(0, 5);
  }, [appointments]);

  // Analytics metrics
  const completedCount = totals.completed || appointments.filter((a) => a.status === "completed").length;
  const totalCount = appointments.length || 1;
  const completionRate = Math.round((completedCount / totalCount) * 100);
  const videoConsults = appointments.filter((a) => a.consultationType === "video").length;
  const inClinicConsults = appointments.filter((a) => a.consultationType !== "video").length;

  return (
    <div className="dp-dashboard-root">
      {/* 1. Primary Clinical & Financial KPI Grid */}
      <section className="dp-kpi-grid">
        <article
          className="dp-kpi-card dp-kpi-today"
          onClick={() => navigate("/today")}
          title="View today's patient visits"
          role="button"
          tabIndex={0}
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaCalendarAlt />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">{totals.today || todayAppts.length || 0}</div>
            <div className="dp-kpi-label">Today's Appointments</div>
            <div className="dp-kpi-sub">Visits scheduled for today</div>
          </div>
        </article>

        <article
          className="dp-kpi-card dp-kpi-pending"
          onClick={() => navigate("/appointments?search=pending")}
          title="View pending appointment requests"
          role="button"
          tabIndex={0}
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaClock />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">{totals.pending || appointments.filter((a) => a.status === "pending").length || 0}</div>
            <div className="dp-kpi-label">Pending Requests</div>
            <div className="dp-kpi-sub">Awaiting confirmation</div>
          </div>
        </article>

        <article
          className="dp-kpi-card dp-kpi-completed"
          onClick={() => navigate("/appointments?search=completed")}
          title="View concluded appointments"
          role="button"
          tabIndex={0}
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaCheckCircle />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">{completedCount}</div>
            <div className="dp-kpi-label">Completed Consults</div>
            <div className="dp-kpi-sub">Successfully concluded</div>
          </div>
        </article>

        <article
          className="dp-kpi-card dp-kpi-patients"
          onClick={() => navigate("/patients")}
          title="View all patient records"
          role="button"
          tabIndex={0}
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaUserInjured />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">
              {totals.patients || totals.totalPatients || patientCount || recentPatients.length || 0}
            </div>
            <div className="dp-kpi-label">Total Patients</div>
            <div className="dp-kpi-sub">Assigned to your care</div>
          </div>
        </article>

        <article
          className="dp-kpi-card dp-kpi-earnings"
          onClick={() => navigate("/earnings")}
          title="View revenue and billing analytics"
          role="button"
          tabIndex={0}
        >
          <div className="dp-kpi-header">
            <div className="dp-kpi-icon">
              <FaMoneyBillWave />
            </div>
            <FaArrowRight className="dp-kpi-arrow" />
          </div>
          <div>
            <div className="dp-kpi-value">₹{totals.todayEarnings || dashboard.earnings?.today || 0}</div>
            <div className="dp-kpi-label">Today's Earnings</div>
            <div className="dp-kpi-sub">
              Total Revenue: ₹{totals.revenue || totals.earnings || dashboard.earnings?.total || 0}
            </div>
          </div>
        </article>
      </section>

      {/* 2. Middle Section: Quick Action Command Center (8 Enterprise Action Cards) */}
      <section className="dp-command-hub">
        <div className="dp-command-hub-header">
          <h3>
            <FaStethoscope color="#2563EB" /> Doctor Quick Action Command Hub
          </h3>
          <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}>
            Quick clinical shortcuts & workspace navigation
          </span>
        </div>
        <div className="dp-command-grid">
          <Link to="/today" className="dp-command-card blue" title="View Today's Appointments Lineup">
            <div className="dp-command-card-icon">
              <FaCalendarAlt />
            </div>
            <div className="dp-command-card-info">
              <strong className="dp-command-card-title">Today's Visits</strong>
              <span className="dp-command-card-sub">Check arrivals & today's schedule</span>
            </div>
            <FaArrowRight className="dp-command-card-arrow" />
          </Link>

          <Link to="/queue" className="dp-command-card sky" title="Open Live OPD Queue">
            <div className="dp-command-card-icon">
              <FaUserCheck />
            </div>
            <div className="dp-command-card-info">
              <strong className="dp-command-card-title">OPD Patient Queue</strong>
              <span className="dp-command-card-sub">Call in-clinic patients to room</span>
            </div>
            <FaArrowRight className="dp-command-card-arrow" />
          </Link>

          <Link to="/appointments" className="dp-command-card amber" title="Browse All Appointment Bookings">
            <div className="dp-command-card-icon">
              <FaCalendarDay />
            </div>
            <div className="dp-command-card-info">
              <strong className="dp-command-card-title">All Appointments</strong>
              <span className="dp-command-card-sub">Full booking roster & filter tools</span>
            </div>
            <FaArrowRight className="dp-command-card-arrow" />
          </Link>

          <Link to="/patients" className="dp-command-card indigo" title="Access Patient Directory">
            <div className="dp-command-card-icon">
              <FaUserInjured />
            </div>
            <div className="dp-command-card-info">
              <strong className="dp-command-card-title">Patient Directory</strong>
              <span className="dp-command-card-sub">Clinical profiles & visit records</span>
            </div>
            <FaArrowRight className="dp-command-card-arrow" />
          </Link>

          <Link to="/prescriptions" className="dp-command-card blue" title="Draft & Manage Medical Prescriptions">
            <div className="dp-command-card-icon">
              <FaNotesMedical />
            </div>
            <div className="dp-command-card-info">
              <strong className="dp-command-card-title">Prescriptions Studio</strong>
              <span className="dp-command-card-sub">Write, export & print digital Rx</span>
            </div>
            <FaArrowRight className="dp-command-card-arrow" />
          </Link>

          <Link to="/upload-reports" className="dp-command-card sky" title="Inspect Attached Medical Reports">
            <div className="dp-command-card-icon">
              <FaUpload />
            </div>
            <div className="dp-command-card-info">
              <strong className="dp-command-card-title">Medical Reports</strong>
              <span className="dp-command-card-sub">Lab diagnostics & attached PDFs</span>
            </div>
            <FaArrowRight className="dp-command-card-arrow" />
          </Link>

          <Link to="/online-consultations" className="dp-command-card amber" title="Start Online Video Consultations">
            <div className="dp-command-card-icon">
              <FaVideo />
            </div>
            <div className="dp-command-card-info">
              <strong className="dp-command-card-title">Video Consultations</strong>
              <span className="dp-command-card-sub">Launch secure teleconsult rooms</span>
            </div>
            <FaArrowRight className="dp-command-card-arrow" />
          </Link>

          <Link to="/availability" className="dp-command-card indigo" title="Configure Working Hours & Slots">
            <div className="dp-command-card-icon">
              <FaClock />
            </div>
            <div className="dp-command-card-info">
              <strong className="dp-command-card-title">Manage Availability</strong>
              <span className="dp-command-card-sub">Set weekly timetable & OPD hours</span>
            </div>
            <FaArrowRight className="dp-command-card-arrow" />
          </Link>
        </div>
      </section>

      {/* 3. Operational Grid: Left Column (Schedule & Upcoming) + Right Column (Analytics & Patients) */}
      <section className="dp-grid two">
        {/* Left Column: Today's Clinical Schedule */}
        <Panel
          title="Today's Schedule & Availability"
          action={
            <Link to="/availability" className="dp-btn dp-btn-outline dp-btn-sm" style={{ textDecoration: "none" }}>
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
              <strong>In-Clinic & Online Video</strong>
            </div>
            <div className="dp-schedule-row">
              <span>Hospital Department</span>
              <strong>{doctor.speciality || doctor.department || "Specialist Clinical Practice"}</strong>
            </div>
            <div className="dp-schedule-row">
              <span>Booked Visits Today</span>
              <strong style={{ color: "#2563eb" }}>
                {todayAppts.length} {todayAppts.length === 1 ? "appointment" : "appointments"}
              </strong>
            </div>
            <div className="dp-schedule-row">
              <span>Consultation Status</span>
              <strong style={{ color: doctor.onlineStatus === "online" ? "#16a34a" : "#64748b" }}>
                {doctor.onlineStatus === "online" ? "Active (Accepting Consultations)" : "Offline (Schedule Only)"}
              </strong>
            </div>
          </div>

          {todayAppts.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h4 style={{ fontSize: "0.92rem", color: "#0f172a", marginBottom: 10, fontWeight: 750 }}>
                Today's Patient Lineup ({todayAppts.length})
              </h4>
              {todayAppts.map((item) => {
                const patient = item.patient || item.userId || {};
                return (
                  <div className="dp-lineup-card" key={item._id}>
                    <div className="dp-lineup-time">{item.slotTime}</div>
                    <div className="dp-lineup-patient">
                      <div className="dp-patient-avatar-sm">
                        {(patient.name || "P").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="dp-lineup-details">
                        <strong>{patient.name || "Patient"}</strong>
                        <small>
                          {item.consultationType === "video" ? "Online Video" : "Clinic Visit"} · {item.slotDate}
                        </small>
                      </div>
                    </div>
                    <Link to={\`/appointments/\${item._id}\`} className="dp-btn dp-btn-outline dp-btn-sm">
                      Details
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Right Column: Clinical Analytics & Breakdown */}
        <Panel
          title="Clinical Performance & Analytics"
          action={
            <Link to="/analytics" className="dp-btn dp-btn-outline dp-btn-sm" style={{ textDecoration: "none" }}>
              Full Analytics
            </Link>
          }
        >
          <div className="dp-analytics-grid">
            <div className="dp-analytics-stat-card">
              <small>Completion Rate</small>
              <strong style={{ color: "#16a34a" }}>{completionRate}%</strong>
            </div>
            <div className="dp-analytics-stat-card">
              <small>Total Appointments</small>
              <strong>{appointments.length}</strong>
            </div>
            <div className="dp-analytics-stat-card">
              <small>In-Clinic Visits</small>
              <strong style={{ color: "#2563eb" }}>{inClinicConsults}</strong>
            </div>
            <div className="dp-analytics-stat-card">
              <small>Video Teleconsults</small>
              <strong style={{ color: "#6366f1" }}>{videoConsults}</strong>
            </div>
          </div>

          <h4 style={{ fontSize: "0.92rem", color: "#0f172a", margin: "14px 0 8px", fontWeight: 750 }}>
            Weekly Consultation Trajectory
          </h4>
          <MiniChart data={weekly} />

          <h4 style={{ fontSize: "0.92rem", color: "#0f172a", margin: "18px 0 8px", fontWeight: 750 }}>
            Monthly Revenue Analytics
          </h4>
          <MiniChart data={monthly} money />
        </Panel>

        {/* Left Column: Upcoming Appointments Snapshot */}
        <Panel
          title="Upcoming Appointments"
          action={
            <Link to="/appointments" className="dp-btn dp-btn-outline dp-btn-sm" style={{ textDecoration: "none" }}>
              View All ({appointments.length})
            </Link>
          }
        >
          {appointments.length === 0 ? (
            <EmptyState
              title="No upcoming appointments"
              text="You do not have any pending or confirmed bookings for future dates."
            />
          ) : (
            <div className="dp-list">
              {appointments.slice(0, 5).map((item) => {
                const p = item.patient || item.userId || {};
                return (
                  <article className="dp-appointment-row" key={item._id}>
                    <div className="dp-patient-avatar-sm">
                      {(p.name || "P").slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: "block", color: "#0f172a" }}>{p.name || "Patient"}</strong>
                      <span style={{ display: "block", color: "#64748b", fontSize: "0.82rem" }}>
                        {item.slotDate} at {item.slotTime} · {item.consultationType === "video" ? "Video" : "Clinic"}
                      </span>
                      <small style={{ color: "#94a3b8", fontSize: "0.76rem" }}>
                        Payment: {item.paymentStatus || "cash_pending"} · ₹{item.amount || 0}
                      </small>
                    </div>
                    <span className={\`dp-pill dp-pill-\${item.status}\`}>
                      {statusLabel[item.status] || item.status}
                    </span>
                    <div className="dp-actions">
                      <Link to={\`/appointments/\${item._id}\`} className="dp-btn dp-btn-outline dp-btn-sm">
                        Details
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Right Column: Recent Patients Dossier */}
        <Panel
          title="Recent Patients & Clinical Dossier"
          action={
            <Link to="/patients" className="dp-btn dp-btn-outline dp-btn-sm" style={{ textDecoration: "none" }}>
              Patient Directory ({totals.patients || patientCount || recentPatients.length})
            </Link>
          }
        >
          {recentPatients.length === 0 ? (
            <EmptyState
              title="No patient records yet"
              text="Patient visits will be cataloged here automatically as appointments are scheduled."
            />
          ) : (
            <div className="dp-list">
              {recentPatients.map((patient) => (
                <article className="dp-simple-row" key={patient._id}>
                  <div className="dp-patient-avatar-sm">
                    {(patient.name || "P").slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", color: "#0f172a" }}>{patient.name}</strong>
                    <small style={{ color: "#64748b" }}>
                      {patient.phone || patient.email || "Contact on record"} · Last visit:{" "}
                      {patient.lastAppointment?.slotDate || "Recent"}
                    </small>
                  </div>
                  <Link
                    to={\`/patients/\${patient._id}\`}
                    className="dp-btn dp-btn-outline dp-btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    View History
                  </Link>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function MiniChart({ data, money = false }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  if (!data.length)
    return (
      <EmptyState
        title="No chart data yet"
        text="Completed appointments will appear here automatically."
      />
    );
  return (
    <div className="dp-chart">
      {data.map((item) => (
        <div className="dp-chart-item" key={item.label}>
          <span
            style={{ height: \`\${Math.max(8, (item.value / max) * 100)}%\` }}
            title={\`\${money ? "₹" : ""}\${item.value}\`}
          />
          <small>{item.label}</small>
          <b>{money ? \`₹\${item.value}\` : item.value}</b>
        </div>
      ))}
    </div>
  );
}

`;

code = code.substring(0, startDash) + newDashboardView + code.substring(endDash);
console.log('Successfully replaced DashboardView');

// 2. Upgrade AppointmentsView
const startAppts = code.indexOf('function AppointmentsView({');
const endAppts = code.indexOf('function AppointmentDetailsView({');

if (startAppts === -1 || endAppts === -1) {
  console.error('Could not find AppointmentsView boundaries');
  process.exit(1);
}

const newAppointmentsView = `function AppointmentsView({
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

  useEffect(() => {
    setActiveTab(view);
  }, [view]);

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);

  const [consultationType, setConsultationType] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [loadingList, setLoadingList] = useState(false);
  const [masterAppointments, setMasterAppointments] = useState([]);

  const fetchAppointments = async () => {
    if (!doctorId) return;
    setLoadingList(true);
    try {
      const res = await api.get(\`/api/v1/doctor/panel/\${doctorId}/appointments\`);
      const list = res.data.appointments || [];
      setMasterAppointments(list.length > 0 ? list : fallbackAppointments);
    } catch (err) {
      console.warn("Appointments list API error, using fallback dataset", err);
      setMasterAppointments(fallbackAppointments);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [doctorId]);

  // Compute dynamic tab counts based on all loaded appointments
  const tabCounts = useMemo(() => {
    const list = masterAppointments.length > 0 ? masterAppointments : fallbackAppointments;
    const now = new Date();
    const todayStr = \`\${String(now.getDate()).padStart(2, "0")}-\${String(now.getMonth() + 1).padStart(2, "0")}-\${now.getFullYear()}\`;
    
    return {
      all: list.length,
      today: list.filter((a) => a.isToday || a.slotDate === todayStr || (a.slotDate && a.slotDate.includes(String(now.getFullYear())))).length,
      upcoming: list.filter((a) => ["confirmed", "pending"].includes((a.status || "").toLowerCase())).length,
      pending: list.filter((a) => (a.status || "").toLowerCase() === "pending").length,
      completed: list.filter((a) => (a.status || "").toLowerCase() === "completed").length,
      cancelled: list.filter((a) => ["cancel", "cancelled", "missed"].includes((a.status || "").toLowerCase())).length,
    };
  }, [masterAppointments, fallbackAppointments]);

  // Filter visible list based on active tab and filter controls
  const filteredAppointments = useMemo(() => {
    let list = masterAppointments.length > 0 ? masterAppointments : fallbackAppointments;
    const now = new Date();
    const todayStr = \`\${String(now.getDate()).padStart(2, "0")}-\${String(now.getMonth() + 1).padStart(2, "0")}-\${now.getFullYear()}\`;

    // Filter by Active Tab
    if (activeTab === "today") {
      list = list.filter((a) => a.isToday || a.slotDate === todayStr || (a.slotDate && a.slotDate.includes(String(now.getFullYear()))));
    } else if (activeTab === "upcoming") {
      list = list.filter((a) => ["confirmed", "pending"].includes((a.status || "").toLowerCase()));
    } else if (activeTab === "pending") {
      list = list.filter((a) => (a.status || "").toLowerCase() === "pending");
    } else if (activeTab === "completed") {
      list = list.filter((a) => (a.status || "").toLowerCase() === "completed");
    } else if (activeTab === "cancelled") {
      list = list.filter((a) => ["cancel", "cancelled", "missed"].includes((a.status || "").toLowerCase()));
    }

    // Filter by Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) => {
        const pName = (a.patient?.name || a.userId?.name || a.patientName || "").toLowerCase();
        const pPhone = (a.patient?.phone || a.userId?.phone || a.patientPhone || "").toLowerCase();
        const pEmail = (a.patient?.email || a.userId?.email || "").toLowerCase();
        const aptId = (a.appointmentId || a._id || "").toLowerCase();
        return pName.includes(q) || pPhone.includes(q) || pEmail.includes(q) || aptId.includes(q);
      });
    }

    // Filter by Consultation Mode
    if (consultationType !== "all") {
      list = list.filter((a) => a.consultationType === consultationType);
    }

    // Filter by Payment Status
    if (paymentStatus !== "all") {
      list = list.filter((a) => {
        const s = (a.paymentStatus || "").toLowerCase();
        if (paymentStatus === "paid") return s === "paid" || s === "success" || a.payment === true;
        if (paymentStatus === "cash_pending") return s.includes("cash") || s.includes("pending") || !s;
        return s === paymentStatus;
      });
    }

    // Filter by Date
    if (selectedDate) {
      const [y, m, d] = selectedDate.split("-");
      const targetDate = \`\${d}-\${m}-\${y}\`;
      list = list.filter((a) => a.slotDate === targetDate || a.slotDate === selectedDate);
    }

    return list;
  }, [masterAppointments, fallbackAppointments, activeTab, search, consultationType, paymentStatus, selectedDate]);

  // Paginated slice
  const totalPages = Math.ceil(filteredAppointments.length / pageSize) || 1;
  const paginatedList = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAppointments.slice(startIndex, startIndex + pageSize);
  }, [filteredAppointments, page, pageSize]);

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
    selectedDate
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
            onClick={async () => {
              await fetchAppointments();
              if (onRefresh) onRefresh();
              toast.success("Appointments updated");
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
              openPrintWindow(reportTitle, appointmentLines(filteredAppointments))
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
                appointmentLines(filteredAppointments),
                \`\${String(title || "appointments").toLowerCase().replace(/\\W+/g, "-") || "appointments"}-\${Date.now()}.pdf\`
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
              className={\`dp-filter-tab \${activeTab === tab.id ? "active" : ""}\`}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
            >
              <span>{tab.label}</span>
              <span className="dp-tab-count">{tab.count}</span>
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
              className="dp-btn dp-btn-outline dp-btn-sm"
              onClick={handleClearFilters}
              style={{ height: "38px" }}
            >
              <FaTimesCircle style={{ marginRight: 4 }} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Appointments List / Table Container */}
      <div className="dp-table-wrapper">
        {loadingList ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
            <FaSyncAlt className="dp-spin" style={{ fontSize: "1.5rem", marginBottom: 8, color: "#2563EB" }} />
            <p style={{ margin: 0, fontWeight: 700 }}>Loading appointments...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No matching appointments" : "No appointments found"}
            text={
              hasActiveFilters
                ? "No appointments match your active search or filters. Try adjusting your filters or search terms."
                : "There are no appointments cataloged in this category."
            }
          />
        ) : (
          <>
            {/* Desktop Table View */}
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
                {paginatedList.map((item) => {
                  const patient = item.patient || item.userId || {};
                  const patientAvatar = imageSource(patient.image);
                  const isVideo = item.consultationType === "video";
                  const isPaid = item.paymentStatus === "paid" || item.paymentStatus === "SUCCESS" || item.payment === true;
                  const isCompleted = (item.status || "").toLowerCase() === "completed";
                  const isConfirmed = (item.status || "").toLowerCase() === "confirmed";
                  const isPending = (item.status || "").toLowerCase() === "pending";
                  const isCancelled = ["cancel", "cancelled", "missed"].includes((item.status || "").toLowerCase());

                  return (
                    <tr key={item._id}>
                      <td>
                        <div className="dp-table-patient-cell">
                          {patientAvatar ? (
                            <img src={patientAvatar} alt="" className="dp-patient-avatar-sm" />
                          ) : (
                            <div className="dp-patient-avatar-sm">
                              {(patient.name || "P").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <strong>
                              <Link to={\`/appointments/\${item._id}\`}>{patient.name || "Patient"}</Link>
                            </strong>
                            <div className="dp-id-sub">
                              {patient.phone || "No phone"} {patient.gender ? \`· \${patient.gender}\` : ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong style={{ color: "#0f172a", display: "block" }}>{item.slotDate}</strong>
                        <span style={{ color: "#2563eb", fontWeight: 750 }}>{item.slotTime}</span>
                        <span style={{ display: "block", color: "#94a3b8", fontSize: "0.72rem" }}>
                          ID: {(item.appointmentId || item._id).slice(-6).toUpperCase()}
                        </span>
                      </td>

                      <td>
                        <span className={\`dp-pill \${isVideo ? "dp-pill-video" : "dp-pill-clinic"}\`}>
                          {isVideo ? <FaVideo /> : <FaHospital />}
                          {isVideo ? "Video Consult" : "Clinic Visit"}
                        </span>
                      </td>

                      <td>
                        <span className={\`dp-pill \${isPaid ? "dp-pill-paid" : "dp-pill-cash-pending"}\`}>
                          {isPaid ? "Paid" : "Pending"}
                        </span>
                        <strong style={{ display: "block", marginTop: 3, color: "#0f172a" }}>
                          ₹{item.amount || 0}
                        </strong>
                      </td>

                      <td>
                        <span className={\`dp-pill dp-pill-\${item.status}\`}>
                          {statusLabel[item.status] || item.status}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="dp-table-actions" style={{ justifyContent: "flex-end" }}>
                          <Link to={\`/appointments/\${item._id}\`} className="dp-btn dp-btn-outline dp-btn-sm" title="View Full Appointment Record">
                            <FaEye /> View
                          </Link>

                          {(isCompleted || isConfirmed) && (
                            <Link
                              to={\`/prescriptions?appointmentId=\${item._id}&patientId=\${patient._id || ""}\`}
                              className="dp-btn dp-btn-primary dp-btn-sm"
                              title="Issue / Edit Prescription in Studio"
                            >
                              <FaNotesMedical /> Prescription
                            </Link>
                          )}

                          {isVideo && item.meetingUrl && !isCompleted && !isCancelled && (
                            <a
                              href={item.meetingUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="dp-btn dp-btn-emerald dp-btn-sm"
                              title="Join Live Video Room"
                            >
                              <FaVideo /> Join
                            </a>
                          )}

                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="dp-btn dp-btn-emerald dp-btn-sm"
                                disabled={saving}
                                onClick={() => onStatus(item._id, "confirmed", "Confirm Appointment")}
                                title="Confirm this booking"
                              >
                                <FaCheck /> Accept
                              </button>
                              <button
                                type="button"
                                className="dp-btn dp-btn-danger dp-btn-sm"
                                disabled={saving}
                                onClick={() => onStatus(item._id, "cancel", "Reject Appointment")}
                                title="Reject this booking"
                              >
                                <FaTimes /> Reject
                              </button>
                            </>
                          )}

                          {isConfirmed && (
                            <>
                              <button
                                type="button"
                                className="dp-btn dp-btn-emerald dp-btn-sm"
                                disabled={saving}
                                onClick={() => onStatus(item._id, "completed", "Complete Appointment")}
                                title="Mark consultation completed"
                              >
                                <FaCheckDouble /> Complete
                              </button>
                              <button
                                type="button"
                                className="dp-btn dp-btn-secondary dp-btn-sm"
                                disabled={saving}
                                onClick={() => onReschedule(item)}
                                title="Reschedule date / time"
                              >
                                <FaExchangeAlt /> Reschedule
                              </button>
                              <button
                                type="button"
                                className="dp-btn dp-btn-danger dp-btn-sm"
                                disabled={saving}
                                onClick={() => onStatus(item._id, "cancel", "Cancel Appointment")}
                                title="Cancel this appointment"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile Cards (<= 820px) */}
            <div className="dp-mobile-appointment-cards">
              {paginatedList.map((item) => {
                const patient = item.patient || item.userId || {};
                const patientAvatar = imageSource(patient.image);
                const isVideo = item.consultationType === "video";
                const isPaid = item.paymentStatus === "paid" || item.paymentStatus === "SUCCESS" || item.payment === true;
                const isCompleted = (item.status || "").toLowerCase() === "completed";
                const isConfirmed = (item.status || "").toLowerCase() === "confirmed";
                const isPending = (item.status || "").toLowerCase() === "pending";

                return (
                  <article className="dp-mobile-card" key={item._id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {patientAvatar ? (
                        <img src={patientAvatar} alt="" className="dp-patient-avatar-sm" />
                      ) : (
                        <div className="dp-patient-avatar-sm">
                          {(patient.name || "P").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: "#0f172a", display: "block" }}>{patient.name || "Patient"}</strong>
                        <small style={{ color: "#64748b" }}>{patient.phone || "No phone"}</small>
                      </div>
                      <span className={\`dp-pill dp-pill-\${item.status}\`}>
                        {statusLabel[item.status] || item.status}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#475569" }}>
                      <div>
                        <strong>Date: </strong>{item.slotDate} at {item.slotTime}
                      </div>
                      <div>
                        <strong>Fee: </strong>₹{item.amount || 0} ({isPaid ? "Paid" : "Pending"})
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
                      <Link to={\`/appointments/\${item._id}\`} className="dp-btn dp-btn-outline dp-btn-sm">
                        <FaEye /> Details
                      </Link>
                      {(isCompleted || isConfirmed) && (
                        <Link
                          to={\`/prescriptions?appointmentId=\${item._id}&patientId=\${patient._id || ""}\`}
                          className="dp-btn dp-btn-primary dp-btn-sm"
                        >
                          <FaNotesMedical /> Prescription
                        </Link>
                      )}
                      {isPending && (
                        <>
                          <button
                            type="button"
                            className="dp-btn dp-btn-emerald dp-btn-sm"
                            disabled={saving}
                            onClick={() => onStatus(item._id, "confirmed", "Confirm Appointment")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="dp-btn dp-btn-danger dp-btn-sm"
                            disabled={saving}
                            onClick={() => onStatus(item._id, "cancel", "Reject Appointment")}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {isConfirmed && (
                        <>
                          <button
                            type="button"
                            className="dp-btn dp-btn-emerald dp-btn-sm"
                            disabled={saving}
                            onClick={() => onStatus(item._id, "completed", "Complete Appointment")}
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            className="dp-btn dp-btn-secondary dp-btn-sm"
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
              <div style={{ fontWeight: 600, color: "#475569", fontSize: "0.88rem" }}>
                Showing {Math.min((page - 1) * pageSize + 1, filteredAppointments.length)}–
                {Math.min(page * pageSize, filteredAppointments.length)} of {filteredAppointments.length} appointments
              </div>
              <div className="dp-pagination-buttons">
                <button
                  type="button"
                  className="dp-page-btn"
                  disabled={page <= 1 || loadingList}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <FaChevronLeft /> Previous
                </button>
                <span style={{ fontWeight: 750, color: "#0f172a" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="dp-page-btn"
                  disabled={page >= totalPages || loadingList}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

`;

code = code.substring(0, startAppts) + newAppointmentsView + code.substring(endAppts);
console.log('Successfully replaced AppointmentsView');

// 3. Update MedicalForm submit button with proper classes & icons
code = code.replace(
  '<button disabled={saving}>Save Medical Record</button>',
  `<button
        type="submit"
        className="dp-btn dp-btn-primary"
        disabled={saving}
        style={{ padding: "12px 28px", fontSize: "0.95rem", fontWeight: 700 }}
      >
        {saving ? (
          <>
            <FaSyncAlt className="dp-spin" /> Saving Medical Record...
          </>
        ) : (
          <>
            <FaNotesMedical /> Save Medical Record & Clinical Notes
          </>
        )}
      </button>`
);

if (isCrlf) code = code.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, code, 'utf8');
console.log('File DoctorPortal.jsx written successfully');

