const fs = require('fs');
let code = fs.readFileSync('HealPointSuperAdminWeb/src/App.jsx', 'utf8');

const target = `<AdminPreloader show={loadingExperience} />`;
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
        <span>HealPoint Super Admin · Educational simulation platform · Not a real healthcare provider</span>
      </div>
      <AdminPreloader show={loadingExperience} />`;

if (code.includes(target) && !code.includes('HealPoint Super Admin · Educational simulation')) {
  code = code.replace(target, replacement);
  fs.writeFileSync('HealPointSuperAdminWeb/src/App.jsx', code, 'utf8');
  console.log('Super Admin App.jsx updated with Demo banner');
} else {
  console.log('Target not found or already patched in Super Admin App.jsx');
}

