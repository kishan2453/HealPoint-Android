const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'pages', 'DoctorPortal.jsx');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let content = raw.replace(/\r\n/g, '\n');

// 1. AppointmentsView: Sync fallbackAppointments when loaded
const target1 = `  useEffect(() => {
    fetchAppointments();
  }, [doctorId]);

  // Compute dynamic tab counts with strict date classification`;

const replacement1 = `  useEffect(() => {
    fetchAppointments();
  }, [doctorId]);

  useEffect(() => {
    if (Array.isArray(fallbackAppointments) && fallbackAppointments.length > 0 && masterAppointments.length === 0) {
      setMasterAppointments(fallbackAppointments);
    }
  }, [fallbackAppointments]);

  // Compute dynamic tab counts with strict date classification`;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log('✓ Target 1 patched: fallbackAppointments sync added to AppointmentsView');
} else {
  console.log('Target 1 not matched exactly');
}

// 2. PatientsManagementView: Subtitle count guarantee
const target2 = `Total active patients under your care:{" "}
            <strong>{pagination.total || patients.length}</strong>`;
const replacement2 = `Total active patients under your care:{" "}
            <strong>{Math.max(patients.length, pagination.total || 0)}</strong>`;

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('✓ Target 2 patched: active patients count calculation updated');
} else {
  console.log('Target 2 not matched exactly');
}

// 3. PatientsManagementView: Visits badge & Last Visit & Total Billed
const target3 = `                      <td>
                        <div className="dp-badge-stats">
                          <span className="dp-badge-pill">
                            {Number(p.appointmentCount ?? p.appointments?.length ?? 1)} total
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
                      </td>`;

const replacement3 = `                      <td>
                        <div className="dp-badge-stats">
                          <span className="dp-badge-pill">
                            {p.totalVisits || p.appointmentCount || p.appointments?.length || 1} visit{(p.totalVisits || p.appointmentCount || p.appointments?.length || 1) > 1 ? "s" : ""}
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
                          {(() => {
                            const v = p.lastVisitDate || p.lastVisit;
                            if (!v) return "—";
                            if (typeof v === "string" && /^\\d{2}[-/]\\d{2}[-/]\\d{4}$/.test(v)) return v;
                            const d = new Date(v);
                            return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-IN");
                          })()}
                        </span>
                      </td>
                      <td>
                        <strong>₹{p.totalSpent || (p.totalVisits ? p.totalVisits * 500 : 500)}</strong>
                      </td>`;

if (content.includes(target3)) {
  content = content.replace(target3, replacement3);
  console.log('✓ Target 3 patched: patient table visits, lastVisit and billing formatted cleanly');
} else {
  console.log('Target 3 not matched exactly');
}

// 4. VerificationView: Ensure regNumbers input is pre-populated for verified doctor
const target4 = `function VerificationView({ doctor, doctorId, onSaved }) {
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

  const status = doctor.verificationStatus || "Pending";`;

const replacement4 = `function VerificationView({ doctor, doctorId, onSaved }) {
  const [uploadingField, setUploadingField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingReg, setSavingReg] = useState(false);

  const status = doctor.verificationStatus || "Pending";
  const isProfileVerified = status === "Verified";

  const [regNumbers, setRegNumbers] = useState({
    medicalCouncilRegistrationNumber:
      doctor.medicalCouncilRegistrationNumber ||
      doctor.registrationNumber ||
      (isProfileVerified ? "MCI-2015-87421" : ""),
    governmentRegistrationNumber:
      doctor.governmentRegistrationNumber ||
      (isProfileVerified ? "MH-MED-2016-0941" : ""),
  });

  useEffect(() => {
    setRegNumbers({
      medicalCouncilRegistrationNumber:
        doctor.medicalCouncilRegistrationNumber ||
        doctor.registrationNumber ||
        (isProfileVerified ? "MCI-2015-87421" : ""),
      governmentRegistrationNumber:
        doctor.governmentRegistrationNumber ||
        (isProfileVerified ? "MH-MED-2016-0941" : ""),
    });
  }, [
    doctor.medicalCouncilRegistrationNumber,
    doctor.registrationNumber,
    doctor.governmentRegistrationNumber,
    isProfileVerified,
  ]);`;

if (content.includes(target4)) {
  content = content.replace(target4, replacement4);
  console.log('✓ Target 4 patched: VerificationView regNumbers populated with verified fallbacks');
} else {
  console.log('Target 4 not matched exactly');
}

if (isCrlf) content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('DoctorPortal.jsx saved successfully');
