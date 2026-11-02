const fs = require("fs");
const path = require("path");

const a11yCss = `
/* ==========================================================================
   HEALPOINT ACCESSIBILITY (A11Y) & KEYBOARD NAVIGATION ENHANCEMENTS
   ========================================================================== */
:focus-visible {
  outline: 2.5px solid #2563EB !important;
  outline-offset: 2px !important;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[role="button"]:focus-visible,
[tabindex="0"]:focus-visible {
  outline: 2.5px solid #2563EB !important;
  outline-offset: 2px !important;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.2) !important;
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;

const targets = [
  "HealPointDoctorWeb/src/DesignSystem.css",
  "HealPointHospitalAdminWeb/src/DesignSystem.css",
  "HealPointSuperAdminWeb/src/DesignSystem.css",
];

for (const target of targets) {
  const fullPath = path.join(__dirname, "..", target);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, "utf8");
    if (!content.includes("HEALPOINT ACCESSIBILITY (A11Y)")) {
      content += a11yCss;
      fs.writeFileSync(fullPath, content, "utf8");
      console.log(`Appended A11Y CSS to ${target}`);
    } else {
      console.log(`A11Y CSS already present in ${target}`);
    }
  }
}

