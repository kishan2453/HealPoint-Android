import fs from "fs";
import path from "path";

const sourceLogo = path.resolve("assets/images/logo.png");
const sourceFavicon = path.resolve("assets/images/favicon.png");

if (!fs.existsSync(sourceLogo)) {
  console.error("Source logo not found:", sourceLogo);
  process.exit(1);
}

const portals = [
  "HealPointDoctorWeb",
  "HealPointHospitalAdminWeb",
  "HealPointSuperAdminWeb",
];

for (const portal of portals) {
  const publicDir = path.resolve(portal, "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Copy logo.png
  const destLogo = path.join(publicDir, "logo.png");
  fs.copyFileSync(sourceLogo, destLogo);
  console.log(`Copied logo.png to ${portal}/public/`);

  // Copy favicon
  const destFavicon = path.join(publicDir, "favicon.png");
  if (fs.existsSync(sourceFavicon)) {
    fs.copyFileSync(sourceFavicon, destFavicon);
  } else {
    fs.copyFileSync(sourceLogo, destFavicon);
  }
  console.log(`Copied favicon.png to ${portal}/public/`);

  // Update index.html to use png favicon and logo
  const indexPath = path.resolve(portal, "index.html");
  if (fs.existsSync(indexPath)) {
    let indexHtml = fs.readFileSync(indexPath, "utf8");
    indexHtml = indexHtml.replace(
      /<link rel="icon"[^>]+>/,
      '<link rel="icon" type="image/png" href="/logo.png" />'
    );
    fs.writeFileSync(indexPath, indexHtml, "utf8");
    console.log(`Updated favicon link in ${portal}/index.html`);
  }
}

// Update HealPointDoctorWeb brand logo references
const docPortalPath = path.resolve("HealPointDoctorWeb/src/pages/DoctorPortal.jsx");
if (fs.existsSync(docPortalPath)) {
  let content = fs.readFileSync(docPortalPath, "utf8");
  content = content.replace(/src="\/healpoint-favicon\.svg"/g, 'src="/logo.png"');
  fs.writeFileSync(docPortalPath, content, "utf8");
  console.log("Updated HealPointDoctorWeb/src/pages/DoctorPortal.jsx logo src");
}

const docLoginPath = path.resolve("HealPointDoctorWeb/src/pages/Login.jsx");
if (fs.existsSync(docLoginPath)) {
  let content = fs.readFileSync(docLoginPath, "utf8");
  content = content.replace(/src="\/healpoint-favicon\.svg"/g, 'src="/logo.png"');
  fs.writeFileSync(docLoginPath, content, "utf8");
  console.log("Updated HealPointDoctorWeb/src/pages/Login.jsx logo src");
}

// Update HealPointHospitalAdminWeb brand logo references
const hospAppPath = path.resolve("HealPointHospitalAdminWeb/src/App.jsx");
if (fs.existsSync(hospAppPath)) {
  let content = fs.readFileSync(hospAppPath, "utf8");
  content = content.replace(/src="\/healpoint-favicon\.svg"/g, 'src="/logo.png"');
  fs.writeFileSync(hospAppPath, content, "utf8");
  console.log("Updated HealPointHospitalAdminWeb/src/App.jsx logo src");
}

const hospLoginPath = path.resolve("HealPointHospitalAdminWeb/src/pages/HospitalLogin.jsx");
if (fs.existsSync(hospLoginPath)) {
  let content = fs.readFileSync(hospLoginPath, "utf8");
  content = content.replace(/src="\/healpoint-favicon\.svg"/g, 'src="/logo.png"');
  fs.writeFileSync(hospLoginPath, content, "utf8");
  console.log("Updated HealPointHospitalAdminWeb/src/pages/HospitalLogin.jsx logo src");
}

// Update HealPointSuperAdminWeb brand logo references
const superLoginPath = path.resolve("HealPointSuperAdminWeb/src/pages/user/Login.jsx");
if (fs.existsSync(superLoginPath)) {
  let content = fs.readFileSync(superLoginPath, "utf8");
  content = content.replace(/src="\/healpoint-favicon\.svg"/g, 'src="/logo.png"');
  fs.writeFileSync(superLoginPath, content, "utf8");
  console.log("Updated HealPointSuperAdminWeb/src/pages/user/Login.jsx logo src");
}

// Update HealPointBrandLogo.jsx in Super Admin to use the real logo image
const superBrandLogoPath = path.resolve("HealPointSuperAdminWeb/src/components/common/HealPointBrandLogo.jsx");
if (fs.existsSync(superBrandLogoPath)) {
  const brandLogoComponent = `import React from "react";

export const HealPointEmblem = ({ size = 36, className = "" }) => (
  <img
    src="/logo.png"
    alt="HealPoint Logo"
    width={size}
    height={size}
    className={className}
    style={{ objectFit: "contain", flexShrink: 0, borderRadius: 8 }}
  />
);

const HealPointBrandLogo = ({
  size = 38,
  showTagline = true,
  className = "",
  taglineText = "Your Health, Our Priority",
}) => {
  return (
    <div
      className={\`hp-brand-lockup \${className}\`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        userSelect: "none",
      }}
    >
      <HealPointEmblem size={size} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#0F172A",
            fontFamily: "inherit",
          }}
        >
          Heal<span style={{ color: "#2563EB" }}>Point</span>
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              color: "#64748B",
              marginTop: "2px",
              letterSpacing: "0.01em",
            }}
          >
            {taglineText}
          </span>
        )}
      </div>
    </div>
  );
};

export default HealPointBrandLogo;
`;
  fs.writeFileSync(superBrandLogoPath, brandLogoComponent, "utf8");
  console.log("Updated HealPointSuperAdminWeb/src/components/common/HealPointBrandLogo.jsx to render official 3D logo");
}

console.log("--- All Web Portals Synced with Official 3D HealPoint Logo ---");

