const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'HealPointHospitalAdminWeb', 'src', 'App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

// 1. Add Icons
const iconTarget = `  FaTrash,\n  FaAmbulance,\n} from "react-icons/fa";`;
const newIcons = `  FaTrash,
  FaAmbulance,
  FaCogs,
  FaTasks,
  FaRobot,
  FaSlidersH,
  FaFileAlt,
  FaExchangeAlt,
} from "react-icons/fa";`;

content = content.replace(iconTarget, newIcons);

// 2. Add Component Imports
const importTarget = `import StaffRoster from "./pages/StaffRoster";`;
const newImports = `import StaffRoster from "./pages/StaffRoster";
import WorkflowsAutomation from "./pages/WorkflowsAutomation";
import TaskManagement from "./pages/TaskManagement";
import AiAdminAssistant from "./pages/AiAdminAssistant";
import BusinessRules from "./pages/BusinessRules";
import AdvancedSupport from "./pages/AdvancedSupport";
import ReportBuilder from "./pages/ReportBuilder";
import InternalAlerts from "./pages/InternalAlerts";
import GlobalSearch from "./pages/GlobalSearch";
import DataImportExport from "./pages/DataImportExport";`;

content = content.replace(importTarget, newImports);

// 3. Add to menuGroups
const menuTarget = `    label: "Operations",
    items: [
      ["emergency", "Emergency SOS Queue", FaAmbulance],
      ["check-in", "Check-In & Queue", FaQrcode],
      ["appointments", "Appointments", FaClipboardList],
      ["online-consultations", "Online Consultations", FaVideo],
      ["availability", "Doctor Scheduling", FaCalendarAlt],
      ["departments", "Departments & Services", FaClinicMedical],
      ["resources", "Resource & Capacity", FaLayerGroup],
      ["roster", "Staff & Duty Roster", FaUserCheck],
    ],
  },`;

const newMenu = `    label: "Operations",
    items: [
      ["emergency", "Emergency SOS Queue", FaAmbulance],
      ["check-in", "Check-In & Queue", FaQrcode],
      ["appointments", "Appointments", FaClipboardList],
      ["online-consultations", "Online Consultations", FaVideo],
      ["availability", "Doctor Scheduling", FaCalendarAlt],
      ["departments", "Departments & Services", FaClinicMedical],
      ["resources", "Resource & Capacity", FaLayerGroup],
      ["roster", "Staff & Duty Roster", FaUserCheck],
    ],
  },
  {
    label: "Intelligent Operations",
    items: [
      ["workflows", "Workflow Automation", FaCogs],
      ["tasks", "Task & Work Management", FaTasks],
      ["ai-assistant", "AI Admin Assistant", FaRobot],
      ["business-rules", "Business Rule Engine", FaSlidersH],
      ["advanced-support", "Support & Complaints", FaHeadset],
      ["report-builder", "Report Builder", FaFileAlt],
      ["internal-alerts", "Smart Alert Center", FaExclamationTriangle],
      ["global-search", "Command Search", FaSearch],
      ["data-import", "Data Import & Export", FaExchangeAlt],
    ],
  },`;

content = content.replace(menuTarget, newMenu);

// 4. Mount views
const viewMountTarget = `        {view === "check-in" && <CheckInScannerView session={session()} />}
        {view === "resources" && <ResourcesCapacity />}
        {view === "roster" && <StaffRoster />}`;

const newViewMounts = `        {view === "check-in" && <CheckInScannerView session={session()} />}
        {view === "resources" && <ResourcesCapacity />}
        {view === "roster" && <StaffRoster />}
        {view === "workflows" && <WorkflowsAutomation />}
        {view === "tasks" && <TaskManagement />}
        {view === "ai-assistant" && <AiAdminAssistant />}
        {view === "business-rules" && <BusinessRules />}
        {view === "advanced-support" && <AdvancedSupport />}
        {view === "report-builder" && <ReportBuilder />}
        {view === "internal-alerts" && <InternalAlerts />}
        {view === "global-search" && <GlobalSearch onNavigateTab={setView} />}
        {view === "data-import" && <DataImportExport />}`;

content = content.replace(viewMountTarget, newViewMounts);

// 5. Update allowed view keys
const allowedViewsTarget = `          "settings",
          "security",
          "support",
          "check-in",
        ].includes(view)`;

const newAllowedViews = `          "settings",
          "security",
          "support",
          "check-in",
          "resources",
          "roster",
          "workflows",
          "tasks",
          "ai-assistant",
          "business-rules",
          "advanced-support",
          "report-builder",
          "internal-alerts",
          "global-search",
          "data-import",
        ].includes(view)`;

content = content.replace(allowedViewsTarget, newAllowedViews);

fs.writeFileSync(appPath, content, 'utf8');
console.log('Successfully patched HealPointHospitalAdminWeb/src/App.jsx');
