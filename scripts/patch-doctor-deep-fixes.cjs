const fs = require('fs');
const path = require('path');

const doctorPortalPath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'pages', 'DoctorPortal.jsx');
let dpContent = fs.readFileSync(doctorPortalPath, 'utf8');
const isCrlf = dpContent.includes('\r\n');
dpContent = dpContent.replace(/\r\n/g, '\n');

// 1. Add useRef to react imports if missing
if (!dpContent.includes('useRef')) {
  dpContent = dpContent.replace(
    'import React, { useEffect, useMemo, useState }',
    'import React, { useEffect, useMemo, useRef, useState }'
  );
  console.log("✓ Added useRef to react imports");
}

// 2. Add panelRefreshing state and handleRefreshDashboard
const searchInitTarget = `  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [activeEmergencyAlerts, setActiveEmergencyAlerts] = useState([]);`;

const searchInitReplacement = `  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [panelRefreshing, setPanelRefreshing] = useState(false);
  const [activeEmergencyAlerts, setActiveEmergencyAlerts] = useState([]);
  const searchRef = useRef(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("hp_doctor_sidebar_collapsed") === "true";
  });

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("hp_doctor_sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleRefreshDashboard = async () => {
    if (panelRefreshing || !doctorId) return;
    setPanelRefreshing(true);
    try {
      await loadPanel();
      await fetchUnreadCount();
      toast.success("Dashboard data refreshed");
    } catch (err) {
      toast.error("Failed to refresh dashboard");
    } finally {
      setPanelRefreshing(false);
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);`;

if (dpContent.includes(searchInitTarget)) {
  dpContent = dpContent.replace(searchInitTarget, searchInitReplacement);
  console.log("✓ Added panelRefreshing, localStorage sidebar toggle, and search dropdown state");
} else {
  console.log("Warning: searchInitTarget not matched");
}

// 3. Replace sidebar toggle button with toggleSidebarCollapse
dpContent = dpContent.replace(
  'onClick={() => setSidebarCollapsed((prev) => !prev)}',
  'onClick={toggleSidebarCollapse}'
);

// 4. Update Header Refresh Button with loading state and handleRefreshDashboard
const oldHeaderRefresh = `              <button
                type="button"
                onClick={loadPanel}
                className="dp-light-btn"
              >
                <FaSyncAlt /> Refresh
              </button>`;

const newHeaderRefresh = `              <button
                type="button"
                onClick={handleRefreshDashboard}
                disabled={panelRefreshing}
                className="dp-header-refresh-btn"
                title="Refresh live portal data"
                aria-label="Refresh live portal data"
              >
                <FaSyncAlt className={panelRefreshing ? "dp-spin" : ""} />
                <span>{panelRefreshing ? "Refreshing..." : "Refresh"}</span>
              </button>`;

if (dpContent.includes(oldHeaderRefresh)) {
  dpContent = dpContent.replace(oldHeaderRefresh, newHeaderRefresh);
  console.log("✓ Patched Header Refresh button with handleRefreshDashboard");
} else {
  console.log("Warning: oldHeaderRefresh not matched");
}

// 5. Update Global Search Input in Header with live autocomplete
const oldGlobalSearchForm = `          <form className="dp-global-search" onSubmit={handleGlobalSearch}>
            <FaSearch />
            <input
              placeholder="Search patients, appointments..."
              aria-label="Search portal"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </form>`;

const newGlobalSearchForm = `          <div className="dp-global-search-container" ref={searchRef}>
            <form className="dp-global-search" onSubmit={handleGlobalSearch}>
              <FaSearch />
              <input
                placeholder="Search patients, appointments..."
                aria-label="Search portal"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setSearchFocused(true);
                }}
                onFocus={() => setSearchFocused(true)}
              />
              {globalSearch && (
                <button
                  type="button"
                  className="dp-search-clear-btn"
                  onClick={() => setGlobalSearch("")}
                  title="Clear search"
                >
                  <FaTimes />
                </button>
              )}
            </form>
            {searchFocused && globalSearch.trim().length >= 2 && (() => {
              const q = globalSearch.trim().toLowerCase();
              const matchedPatients = (patients || []).filter(
                (p) =>
                  (p.name || "").toLowerCase().includes(q) ||
                  (p.phone || "").includes(q) ||
                  (p.email || "").toLowerCase().includes(q)
              ).slice(0, 4);

              const matchedAppts = (allAppointments || []).filter(
                (a) =>
                  (a._id || "").toLowerCase().includes(q) ||
                  (a.appointmentId || "").toLowerCase().includes(q) ||
                  (a.patient?.name || a.userId?.name || "").toLowerCase().includes(q)
              ).slice(0, 4);

              const totalMatches = matchedPatients.length + matchedAppts.length;

              return (
                <div className="dp-search-results-dropdown">
                  {totalMatches === 0 ? (
                    <div className="dp-search-empty-drop">
                      <FaSearch style={{ color: "#94a3b8", fontSize: "1.2rem" }} />
                      <p>No matching patients or appointments for "{globalSearch}"</p>
                      <button
                        type="button"
                        className="dp-btn dp-btn-sm dp-btn-primary"
                        onClick={() => {
                          setSearchFocused(false);
                          navigate(\`/appointments?search=\${encodeURIComponent(globalSearch.trim())}\`);
                        }}
                      >
                        Search All Appointments
                      </button>
                    </div>
                  ) : (
                    <>
                      {matchedPatients.length > 0 && (
                        <div className="dp-search-drop-group">
                          <div className="dp-search-drop-group-title">
                            <FaUserInjured /> Matching Patients
                          </div>
                          {matchedPatients.map((p) => (
                            <div
                              key={p._id}
                              className="dp-search-drop-item"
                              onClick={() => {
                                setSearchFocused(false);
                                navigate(\`/patients/\${p._id}\`);
                              }}
                            >
                              <div className="dp-search-drop-avatar">
                                {(p.name || "P").slice(0, 1).toUpperCase()}
                              </div>
                              <div className="dp-search-drop-info">
                                <strong>{p.name}</strong>
                                <small>{p.phone || p.email || "Patient record"}</small>
                              </div>
                              <FaArrowRight className="dp-search-drop-arrow" />
                            </div>
                          ))}
                        </div>
                      )}
                      {matchedAppts.length > 0 && (
                        <div className="dp-search-drop-group">
                          <div className="dp-search-drop-group-title">
                            <FaCalendarDay /> Matching Appointments
                          </div>
                          {matchedAppts.map((a) => {
                            const patName = a.patient?.name || a.userId?.name || "Patient";
                            return (
                              <div
                                key={a._id}
                                className="dp-search-drop-item"
                                onClick={() => {
                                  setSearchFocused(false);
                                  navigate(\`/appointments/\${a._id}\`);
                                }}
                              >
                                <div className="dp-search-drop-badge">
                                  #{a._id.slice(-5).toUpperCase()}
                                </div>
                                <div className="dp-search-drop-info">
                                  <strong>{patName}</strong>
                                  <small>{a.slotDate} · {a.slotTime} · {a.status}</small>
                                </div>
                                <FaArrowRight className="dp-search-drop-arrow" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div
                        className="dp-search-drop-footer"
                        onClick={() => {
                          setSearchFocused(false);
                          navigate(\`/appointments?search=\${encodeURIComponent(globalSearch.trim())}\`);
                        }}
                      >
                        View all search results for "<strong>{globalSearch}</strong>" →
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>`;

if (dpContent.includes(oldGlobalSearchForm)) {
  dpContent = dpContent.replace(oldGlobalSearchForm, newGlobalSearchForm);
  console.log("✓ Patched Global Search with live autocomplete dropdown");
} else {
  console.log("Warning: oldGlobalSearchForm not matched");
}

// 6. Fix AppointmentsView to sync search query when initialSearch changes
const oldApptInitSearch = `  const [activeTab, setActiveTab] = useState(view);
  const [search, setSearch] = useState(initialSearch);`;

const newApptInitSearch = `  const [activeTab, setActiveTab] = useState(view);
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);`;

if (dpContent.includes(oldApptInitSearch)) {
  dpContent = dpContent.replace(oldApptInitSearch, newApptInitSearch);
  console.log("✓ Synced AppointmentsView search state with URL initialSearch prop");
} else {
  console.log("Warning: oldApptInitSearch not matched");
}

// 7. Fix PatientsManagementView to sync search query when initialSearch changes
const oldPatientInitSearch = `function PatientsManagementView({ doctorId, initialSearch = "" }) {
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [search, setSearch] = useState(initialSearch);`;

const newPatientInitSearch = `function PatientsManagementView({ doctorId, initialSearch = "" }) {
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearch(initialSearch);
    }
  }, [initialSearch]);`;

if (dpContent.includes(oldPatientInitSearch)) {
  dpContent = dpContent.replace(oldPatientInitSearch, newPatientInitSearch);
  console.log("✓ Synced PatientsManagementView search state with URL initialSearch prop");
} else {
  console.log("Warning: oldPatientInitSearch not matched");
}

// 8. Add Refresh Button to Patient Directory toolbar
const oldPatientControls = `          <div className="dp-sort-box">
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
        </div>`;

const newPatientControls = `          <div className="dp-sort-box">
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

          <button
            type="button"
            className="dp-btn dp-btn-outline dp-btn-sm"
            onClick={() => {
              fetchPatients(1, search, sortBy);
              toast.success("Patient directory refreshed");
            }}
            disabled={loading}
            title="Reload patients from database"
            style={{ height: "42px", display: "inline-flex", alignItems: "center", gap: 6, padding: "0 14px", fontWeight: 700 }}
          >
            <FaSyncAlt className={loading ? "dp-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>`;

if (dpContent.includes(oldPatientControls)) {
  dpContent = dpContent.replace(oldPatientControls, newPatientControls);
  console.log("✓ Added working Refresh button to Patient Directory");
} else {
  console.log("Warning: oldPatientControls not matched");
}

// 9. Add Refresh Button to PrescriptionsView toolbar
const oldRxActions = `          {viewMode === "editor" ? (
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
          )}`;

const newRxActions = `          {viewMode === "editor" ? (
            <button
              type="button"
              className="dp-btn dp-btn-secondary"
              onClick={() => setViewMode("list")}
            >
              <FaChevronLeft /> Back to Prescriptions List
            </button>
          ) : (
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <button
                type="button"
                className="dp-btn dp-btn-outline"
                onClick={() => {
                  fetchPrescriptionsList();
                  toast.success("Prescriptions list refreshed");
                }}
                disabled={loadingList}
                title="Refresh Prescriptions"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <FaSyncAlt className={loadingList ? "dp-spin" : ""} /> Refresh
              </button>
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
            </div>
          )}`;

if (dpContent.includes(oldRxActions)) {
  dpContent = dpContent.replace(oldRxActions, newRxActions);
  console.log("✓ Added working Refresh button to Prescriptions Studio");
} else {
  console.log("Warning: oldRxActions not matched");
}

// Write back DoctorPortal.jsx
if (isCrlf) {
  dpContent = dpContent.replace(/\n/g, '\r\n');
}
fs.writeFileSync(doctorPortalPath, dpContent, 'utf8');
console.log("All DoctorPortal.jsx deep patches applied successfully.");

