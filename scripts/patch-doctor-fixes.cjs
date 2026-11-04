const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'pages', 'DoctorPortal.jsx');
let content = fs.readFileSync(filePath, 'utf8');
const isCrlf = content.includes('\r\n');
content = content.replace(/\r\n/g, '\n');

// 1. Fix unrecognized views list in DoctorPortal.jsx (add 'tasks', 'pending', 'report', 'reports')
const oldViewList = `        {![
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
        ].includes(activeView) && (`;

const newViewList = `        {![
          "dashboard",
          "today",
          "upcoming",
          "completed",
          "cancelled",
          "pending",
          "appointments",
          "queue",
          "tasks",
          "patients",
          "online-consultations",
          "consultations",
          "consultation",
          "medical-history",
          "prescriptions",
          "upload-reports",
          "report",
          "reports",
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
        ].includes(activeView) && (`;

if (content.includes(oldViewList)) {
  content = content.replace(oldViewList, newViewList);
  console.log("✓ Successfully patched recognized views list (added tasks, pending, etc.)");
} else {
  console.log("Warning: oldViewList target not matched verbatim");
}

// 2. Fix AppointmentsView vs AppointmentDetailsView rendering clash
const oldApptRender = `        {["today", "upcoming", "pending", "completed", "appointments"].includes(
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
        {activeView === "tasks" && (
          <DoctorTasksView doctor={doctor} />
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
          )}`;

const newApptRender = `        {["today", "upcoming", "pending", "completed", "appointments"].includes(
          activeView,
        ) &&
          !selectedAppointmentId && (
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
        {activeView === "tasks" && (
          <DoctorTasksView doctor={doctor} />
        )}
        {activeView === "queue" && (
          <PatientQueueView
            doctorId={doctorId}
            doctor={doctor}
            onRefresh={loadPanel}
          />
        )}
        {activeView === "appointments" && selectedAppointmentId && (
          <AppointmentDetailsView
            appointment={appointmentById}
            appointmentId={selectedAppointmentId}
            doctorId={doctorId}
            doctor={doctor}
            onSave={savePrescription}
            onDeleteReport={deleteReport}
            saving={saving}
            onStatus={openStatusModal}
            onReschedule={openRescheduleModal}
          />
        )}`;

if (content.includes(oldApptRender)) {
  content = content.replace(oldApptRender, newApptRender);
  console.log("✓ Successfully patched AppointmentsView & AppointmentDetailsView separation");
} else {
  console.log("Warning: oldApptRender target not matched verbatim");
}

// 3. Fix AppointmentDetailsView signature & internal loading
const oldApptDetailsSig = `function AppointmentDetailsView({
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

  const patient = appointment.patient || appointment.userId || {};`;

const newApptDetailsSig = `function AppointmentDetailsView({
  appointment: initialAppointment,
  appointmentId,
  doctorId,
  doctor,
  onSave,
  onDeleteReport,
  saving,
  onStatus,
  onReschedule,
}) {
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(initialAppointment || null);
  const [loading, setLoading] = useState(!initialAppointment && Boolean(appointmentId));
  const [form, setForm] = useState({
    diagnosis: initialAppointment?.diagnosis || "",
    prescription: initialAppointment?.prescription || "",
    medicalNotes: initialAppointment?.medicalNotes || "",
    followUpAdvice: initialAppointment?.followUpAdvice || "",
  });

  useEffect(() => {
    if (initialAppointment) {
      setAppointment(initialAppointment);
      setForm({
        diagnosis: initialAppointment.diagnosis || "",
        prescription: initialAppointment.prescription || "",
        medicalNotes: initialAppointment.medicalNotes || "",
        followUpAdvice: initialAppointment.followUpAdvice || "",
      });
      return;
    }
    if (appointmentId && doctorId) {
      setLoading(true);
      api
        .get(\`/api/v1/doctor/panel/\${doctorId}/appointment/\${appointmentId}\`)
        .then((res) => {
          if (res.data?.success && res.data.appointment) {
            setAppointment(res.data.appointment);
            setForm({
              diagnosis: res.data.appointment.diagnosis || "",
              prescription: res.data.appointment.prescription || "",
              medicalNotes: res.data.appointment.medicalNotes || "",
              followUpAdvice: res.data.appointment.followUpAdvice || "",
            });
          }
        })
        .catch((err) => console.warn("Failed to load appointment details", err))
        .finally(() => setLoading(false));
    }
  }, [initialAppointment, appointmentId, doctorId]);

  if (loading) {
    return (
      <div className="dp-card" style={{ padding: 48, textAlign: "center" }}>
        <FaSyncAlt className="dp-spin" style={{ fontSize: 28, color: "#2563eb", marginBottom: 12 }} />
        <h3 style={{ margin: 0, color: "#172033" }}>Loading appointment record...</h3>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="dp-card" style={{ padding: 48, textAlign: "center" }}>
        <FaExclamationTriangle style={{ fontSize: 36, color: "#f59e0b", marginBottom: 12 }} />
        <h3 style={{ margin: "0 0 8px 0", color: "#172033" }}>Appointment Record Not Found</h3>
        <p style={{ color: "#64748b", marginBottom: 20 }}>The requested appointment record could not be located.</p>
        <button type="button" className="dp-btn dp-btn-primary" onClick={() => navigate("/appointments")}>
          Back to Appointments
        </button>
      </div>
    );
  }

  const patient = appointment.patient || appointment.userId || {};`;

if (content.includes(oldApptDetailsSig)) {
  content = content.replace(oldApptDetailsSig, newApptDetailsSig);
  console.log("✓ Successfully patched AppointmentDetailsView component with async loader & fallback");
} else {
  console.log("Warning: oldApptDetailsSig target not matched verbatim");
}

// 4. Fix AppointmentDetailsView header & action buttons (replace repetitive download buttons)
const oldApptDetailsHeader = `  return (
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
      </p>`;

const newApptDetailsHeader = `  return (
    <Panel
      title={\`Appointment Details · #\${(appointment._id || "").slice(-6).toUpperCase()}\`}
      action={
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="dp-btn dp-btn-outline dp-btn-sm"
            onClick={() => navigate("/appointments")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <FaChevronLeft /> Back to Appointments
          </button>
          <button
            type="button"
            className="dp-btn dp-btn-primary dp-btn-sm"
            onClick={downloadPrescriptionPdf}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <FaFilePdf /> Download PDF
          </button>
          <button
            type="button"
            className="dp-btn dp-btn-outline dp-btn-sm"
            onClick={() => window.print()}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <FaPrint /> Print Rx
          </button>
        </div>
      }
    >
      <p className="dp-hint" style={{ marginTop: 0, marginBottom: 16 }}>
        Official clinical appointment sheet · Print or export securely for patient records.
      </p>`;

if (content.includes(oldApptDetailsHeader)) {
  content = content.replace(oldApptDetailsHeader, newApptDetailsHeader);
  console.log("✓ Successfully patched AppointmentDetailsView header & action buttons");
} else {
  console.log("Warning: oldApptDetailsHeader target not matched verbatim");
}

// 5. Fix Panel definition at the bottom of DoctorPortal.jsx
const oldPanel = `function Panel({ title, children }) {
  return (
    <section className="dp-panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}`;

const newPanel = `function Panel({ title, action, children, className = "" }) {
  return (
    <section className={\`dp-panel \${className}\`.trim()}>
      <div className="dp-panel-head">
        <h2>{title}</h2>
        {action && <div className="dp-panel-action">{action}</div>}
      </div>
      <div className="dp-panel-content">
        {children}
      </div>
    </section>
  );
}`;

if (content.includes(oldPanel)) {
  content = content.replace(oldPanel, newPanel);
  console.log("✓ Successfully patched function Panel with action & head");
} else {
  console.log("Warning: oldPanel target not matched verbatim");
}

// 6. Fix Patient Directory Total Count fallback
content = content.replace(
  `Total active patients under your care:{" "}\n            <strong>{pagination.total}</strong>`,
  `Total active patients under your care:{" "}\n            <strong>{pagination.total || patients.length}</strong>`
);

// 7. Fix Patient Directory table appointmentCount fallback
content = content.replace(
  `{p.appointmentCount} total`,
  `{Number(p.appointmentCount ?? p.appointments?.length ?? 1)} total`
);

// 8. Fix Verification Readiness Contradiction (when status === "Verified", mark readiness as 4/4 and 100%)
const oldReadiness = `  const mandatoryCount = 4;
  const readyCount =
    (hasRegNo ? 1 : 0) +
    (hasLicense ? 1 : 0) +
    (hasMbbs ? 1 : 0) +
    (hasIdProof ? 1 : 0);
  const progressPct = Math.round((readyCount / mandatoryCount) * 100);`;

const newReadiness = `  const isProfileVerified = status === "Verified";
  const mandatoryCount = 4;
  const readyCount = isProfileVerified
    ? 4
    : (hasRegNo ? 1 : 0) +
      (hasLicense ? 1 : 0) +
      (hasMbbs ? 1 : 0) +
      (hasIdProof ? 1 : 0);
  const progressPct = isProfileVerified ? 100 : Math.round((readyCount / mandatoryCount) * 100);`;

if (content.includes(oldReadiness)) {
  content = content.replace(oldReadiness, newReadiness);
  console.log("✓ Successfully patched Verification Readiness calculation");
} else {
  console.log("Warning: oldReadiness target not matched verbatim");
}

// Write back with original line endings
if (isCrlf) {
  content = content.replace(/\n/g, '\r\n');
}
fs.writeFileSync(filePath, content, 'utf8');
console.log("DoctorPortal.jsx patching completed successfully.");
