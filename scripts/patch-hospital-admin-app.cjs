const fs = require('fs');
let code = fs.readFileSync('HealPointHospitalAdminWeb/src/App.jsx', 'utf8');

const target = `<ToastContainer position="top-right" />`;
const replacement = `<div
        role="alert"
        aria-label="HealPoint Demo Mode Announcement"
        style={{
          background: "#0284C7",
          color: "#FFFFFF",
          padding: "6px 16px",
          fontSize: "12px",
          fontWeight: "600",
          textAlign: "center",
          letterSpacing: "0.4px",
          zIndex: 9999,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            background: "#F59E0B",
            color: "#0F172A",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "10px",
            fontWeight: "800",
          }}
        >
          DEMO MODE
        </span>
        <span>HealPoint Hospital Admin · Educational simulation only · Fictional healthcare organization</span>
      </div>
      <ToastContainer position="top-right" />`;

if (code.includes(target) && !code.includes('HealPoint Hospital Admin · Educational simulation')) {
  code = code.replace(target, replacement);
  fs.writeFileSync('HealPointHospitalAdminWeb/src/App.jsx', code, 'utf8');
  console.log('Hospital Admin App.jsx updated with Demo banner');
} else {
  console.log('Target not found or already patched in Hospital Admin App.jsx');
}

