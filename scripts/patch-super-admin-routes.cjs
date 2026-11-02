const fs = require('fs');
const path = require('path');

// 1. Patch App.jsx
const appPath = path.join(__dirname, '..', 'HealPointSuperAdminWeb', 'src', 'App.jsx');
let appContent = fs.readFileSync(appPath, 'utf8');

const importTarget = `import GlobalResourceCapacity from "./pages/GlobalResourceCapacity";`;
const newImport = `import GlobalResourceCapacity from "./pages/GlobalResourceCapacity";
import SystemConfiguration from "./pages/SystemConfiguration";`;
appContent = appContent.replace(importTarget, newImport);

const routeTarget = `        <Route
          path="/system-health"`;
const newRoute = `        <Route
          path="/system-configuration"
          element={
            <ProtectedRoute requiredPermission="settings">
              <SystemConfiguration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-health"`;
appContent = appContent.replace(routeTarget, newRoute);

fs.writeFileSync(appPath, appContent, 'utf8');
console.log('Successfully patched HealPointSuperAdminWeb/src/App.jsx');

// 2. Patch Menus.jsx
const menusPath = path.join(__dirname, '..', 'HealPointSuperAdminWeb', 'src', 'components', 'Layout', 'Menus.jsx');
let menusContent = fs.readFileSync(menusPath, 'utf8');

const menuIconTarget = `  FaHeartbeat,\n  FaCog,\n} from "react-icons/fa";`;
const newMenuIcons = `  FaHeartbeat,
  FaCog,
  FaSlidersH,
} from "react-icons/fa";`;
menusContent = menusContent.replace(menuIconTarget, newMenuIcons);

const menuItemTarget = `      {
        to: "/settings",
        label: "Settings",
        icon: <FaCog />,
        permission: "settings",
      },`;
const newMenuItem = `      {
        to: "/system-configuration",
        label: "Configuration Center",
        icon: <FaSlidersH />,
        permission: "settings",
      },
      {
        to: "/settings",
        label: "Settings",
        icon: <FaCog />,
        permission: "settings",
      },`;
menusContent = menusContent.replace(menuItemTarget, newMenuItem);

fs.writeFileSync(menusPath, menusContent, 'utf8');
console.log('Successfully patched HealPointSuperAdminWeb/src/components/Layout/Menus.jsx');
