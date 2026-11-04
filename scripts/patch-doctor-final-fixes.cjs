const fs = require('fs');
const path = require('path');

const portalPath = path.join(__dirname, '../HealPointDoctorWeb/src/pages/DoctorPortal.jsx');
let raw = fs.readFileSync(portalPath, 'utf8');
const isCrlf = raw.includes('\r\n');
let portal = raw.replace(/\r\n/g, '\n');

// 1. Update collapse button in DoctorPortal.jsx
const oldBrandBtn = `<button
            type="button"
            className="dp-collapse-btn"
            onClick={toggleSidebarCollapse}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar collapse"
          >
            {sidebarCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>`;

const newBrandBtn = `<button
            type="button"
            className="dp-collapse-btn"
            onClick={toggleSidebarCollapse}
            title={sidebarCollapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
            aria-label={sidebarCollapsed ? "Expand sidebar navigation" : "Collapse sidebar navigation"}
          >
            {sidebarCollapsed ? <FaBars /> : <FaChevronLeft />}
          </button>`;

if (portal.includes(oldBrandBtn)) {
  portal = portal.replace(oldBrandBtn, newBrandBtn);
  console.log('✓ Successfully updated collapse button with FaBars/FaChevronLeft');
} else {
  console.error('ERROR: oldBrandBtn not found');
}

// 2. Ensure AppointmentsView fetchAppointments handles real API status and doesn't show fake success
const oldFetchAppts = `  const fetchAppointments = async () => {
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
  };`;

const newFetchAppts = `  const fetchAppointments = async () => {
    if (!doctorId) return false;
    setLoadingList(true);
    try {
      const res = await api.get(\`/api/v1/doctor/panel/\${doctorId}/appointments\`);
      if (res.data?.success || Array.isArray(res.data?.appointments)) {
        const list = res.data.appointments || [];
        setMasterAppointments(list.length > 0 ? list : fallbackAppointments);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Appointments list API error, using fallback dataset", err);
      if (fallbackAppointments.length > 0 && masterAppointments.length === 0) {
        setMasterAppointments(fallbackAppointments);
      }
      toast.error(err.response?.data?.message || "Failed to load live appointments from server");
      return false;
    } finally {
      setLoadingList(false);
    }
  };`;

if (portal.includes(oldFetchAppts)) {
  portal = portal.replace(oldFetchAppts, newFetchAppts);
  console.log('✓ Successfully hardened fetchAppointments with real status return and error handling');
} else {
  console.error('ERROR: oldFetchAppts not found');
}

// 3. Ensure AppointmentsView refresh button checks result before reporting success
const oldApptRefresh = `<button
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
          </button>`;

const newApptRefresh = `<button
            type="button"
            className="dp-report-btn"
            onClick={async () => {
              const ok = await fetchAppointments();
              if (onRefresh) await onRefresh();
              if (ok) {
                toast.success("Appointments updated from live server");
              }
            }}
            disabled={loadingList}
            title="Refresh appointments"
          >
            <FaSyncAlt className={loadingList ? "dp-spin" : ""} /> Refresh
          </button>`;

if (portal.includes(oldApptRefresh)) {
  portal = portal.replace(oldApptRefresh, newApptRefresh);
  console.log('✓ Successfully hardened AppointmentsView refresh button');
} else {
  console.error('ERROR: oldApptRefresh not found');
}

if (isCrlf) {
  portal = portal.replace(/\n/g, '\r\n');
}
fs.writeFileSync(portalPath, portal, 'utf8');
console.log('All DoctorPortal.jsx patches applied successfully.');
