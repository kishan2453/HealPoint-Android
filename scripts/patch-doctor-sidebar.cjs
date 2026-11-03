const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'pages', 'DoctorPortal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Target the aside block
const oldAsideStart = '<aside className="dp-sidebar">';
const oldAsideEnd = '</aside>';

const startIndex = content.indexOf(oldAsideStart);
const endIndex = content.indexOf(oldAsideEnd, startIndex);

if (startIndex === -1 || endIndex === -1) {
  console.error("Could not locate aside block in DoctorPortal.jsx");
  process.exit(1);
}

const newAside = `<aside className={\`dp-sidebar\${sidebarCollapsed ? " is-collapsed" : ""}\`}>
        <div className="dp-brand">
          <div className="dp-brand-info">
            <img
              src="/logo.png"
              alt="HealPoint"
              width={38}
              height={38}
              style={{ borderRadius: 10, flexShrink: 0 }}
            />
            {!sidebarCollapsed && (
              <div className="dp-brand-text">
                <strong>HealPoint</strong>
                <small>Doctor Portal</small>
              </div>
            )}
          </div>
          <button
            type="button"
            className="dp-collapse-btn"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle sidebar collapse"
          >
            {sidebarCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>

        <div className="dp-doctor-identity">
          <div className="dp-identity-avatar-wrap">
            {doctorAvatar ? (
              <img src={doctorAvatar} alt={formatDoctorTitle(doctor.name)} className="dp-identity-avatar" />
            ) : (
              <span className="dp-identity-initials">{doctorInitials}</span>
            )}
            <span
              className={\`dp-status-dot-badge \${doctor.onlineStatus === "online" ? "is-online" : "is-offline"}\`}
              title={doctor.onlineStatus === "online" ? "Doctor Online" : "Doctor Offline"}
            />
          </div>
          {!sidebarCollapsed && (
            <div className="dp-identity-details">
              <strong className="dp-identity-name">{formatDoctorTitle(doctor.name)}</strong>
              <small className="dp-identity-spec">
                {doctor.speciality || doctor.department || "Specialist"}
              </small>
              <button
                type="button"
                className={\`dp-online-toggle-btn \${doctor.onlineStatus === "online" ? "is-online" : "is-offline"}\`}
                onClick={toggleOnlineStatus}
                title="Click to toggle Online/Offline availability"
              >
                <i />
                <span>{doctor.onlineStatus === "online" ? "Online" : "Offline"}</span>
              </button>
            </div>
          )}
        </div>

        <nav className="dp-grouped-nav">
          {navigationSections.map((group) => (
            <div key={group.title} className="dp-nav-section">
              {!sidebarCollapsed && (
                <div className="dp-nav-group-title">{group.title}</div>
              )}
              <div className="dp-nav-group-items">
                {group.items.map((item) => (
                  <Link
                    key={item.key}
                    to={\`/\${item.key}\`}
                    className={\`dp-nav-link \${activeView === item.key ? "active" : ""}\`}
                    title={sidebarCollapsed ? item.label : undefined}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="dp-nav-icon">{item.icon}</span>
                    {!sidebarCollapsed && (
                      <span className="dp-nav-label">{item.label}</span>
                    )}
                    {item.hasBadge && unreadNotificationsCount > 0 && (
                      <span className="dp-nav-badge">
                        {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="dp-sidebar-footer">
          <button type="button" className="dp-logout" onClick={logout} title="Sign out of Doctor Portal">
            <FaSignOutAlt /> {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>`;

content = content.slice(0, startIndex) + newAside + content.slice(endIndex + oldAsideEnd.length);
fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully patched Doctor Portal sidebar with structured collapsible sections!");
