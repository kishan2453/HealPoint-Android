const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "../HealPointHospitalAdminWeb/src/App.jsx");
let app = fs.readFileSync(appPath, "utf8");

if (!app.includes('import api from "./services/api";')) {
  app = 'import api from "./services/api";\n' + app;
}

// Replace the fetch call matching loosely
const regex = /const res = await fetch\(\s*"http:\/\/localhost:8080\/api\/v1\/webmessage\/create"[\s\S]*?throw new Error\(resData\.message \|\| "Failed to submit ticket\."\);\s*}/;

const replacement = `const res = await api.post("/api/v1/webmessage/create", {
        name: admin?.name || "Hospital Admin",
        email: admin?.email || "admin@hospital.com",
        subject: \`[\${supportForm.category}] \${supportForm.subject}\`,
        message: supportForm.message,
        category: supportForm.category,
        hospitalId: admin?.hospitalId || admin?.hospital?._id,
      });
      if (!res.data?.success) {
        throw new Error(res.data?.message || "Failed to submit ticket.");
      }`;

if (regex.test(app)) {
  app = app.replace(regex, replacement);
  fs.writeFileSync(appPath, app, "utf8");
  console.log("Successfully replaced hardcoded localhost fetch in Hospital Admin App.jsx");
} else {
  console.log("Regex did not match");
}
