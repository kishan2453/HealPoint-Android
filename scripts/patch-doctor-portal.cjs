const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'pages', 'DoctorPortal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add FaTasks icon import
const iconTarget = `  FaStarHalfAlt,\n} from "react-icons/fa";`;
const newIcon = `  FaStarHalfAlt,
  FaTasks,
} from "react-icons/fa";`;
content = content.replace(iconTarget, newIcon);

// 2. Add Component Import
const importTarget = `import OnlineConsultations from "../components/OnlineConsultations";`;
const newImport = `import OnlineConsultations from "../components/OnlineConsultations";
import DoctorTasksView from "../components/DoctorTasksView";`;
content = content.replace(importTarget, newImport);

// 3. Add to menuItems
const menuTarget = `  ["queue", "Patient Queue (OPD)", <FaUserCheck />],`;
const newMenu = `  ["queue", "Patient Queue (OPD)", <FaUserCheck />],
  ["tasks", "Assigned Tasks", <FaTasks />],`;
content = content.replace(menuTarget, newMenu);

// 4. Render view
const viewTarget = `        {activeView === "queue" && (`;
const newView = `        {activeView === "tasks" && (
          <DoctorTasksView doctor={doctor} />
        )}
        {activeView === "queue" && (`;
content = content.replace(viewTarget, newView);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched HealPointDoctorWeb/src/pages/DoctorPortal.jsx');
