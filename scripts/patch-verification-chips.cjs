const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../HealPointDoctorWeb/src/pages/DoctorPortal.jsx');
let raw = fs.readFileSync(filePath, 'utf8');
const isCrlf = raw.includes('\r\n');
let code = raw.replace(/\r\n/g, '\n');

// 1. Medical License
const target1 = `              <span
                className={\`dp-doc-status-chip \${doctor.medicalLicenseUrl ? "ready" : "missing"}\`}
              >
                {doctor.medicalLicenseUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>`;

const replace1 = `              <span
                className={\`dp-doc-status-chip \${doctor.medicalLicenseUrl || isProfileVerified ? "ready" : "missing"}\`}
              >
                {doctor.medicalLicenseUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : isProfileVerified ? (
                  <>
                    <FaCheck /> Verified on Record
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>`;

// 2. MBBS
const target2 = `              <span
                className={\`dp-doc-status-chip \${doctor.mbbsCertificateUrl ? "ready" : "missing"}\`}
              >
                {doctor.mbbsCertificateUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>`;

const replace2 = `              <span
                className={\`dp-doc-status-chip \${doctor.mbbsCertificateUrl || isProfileVerified ? "ready" : "missing"}\`}
              >
                {doctor.mbbsCertificateUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : isProfileVerified ? (
                  <>
                    <FaCheck /> Verified on Record
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>`;

// 3. MD / MS
const target3 = `              <span
                className={\`dp-doc-status-chip \${doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl ? "ready" : "missing"}\`}
              >
                {doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>Optional / Pending</>
                )}
              </span>`;

const replace3 = `              <span
                className={\`dp-doc-status-chip \${doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl || isProfileVerified ? "ready" : "missing"}\`}
              >
                {doctor.mdMsCertificateUrl || doctor.specializationCertificateUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : isProfileVerified ? (
                  <>
                    <FaCheck /> Verified on Record
                  </>
                ) : (
                  <>Optional / Pending</>
                )}
              </span>`;

// 4. Gov ID
const target4 = `              <span
                className={\`dp-doc-status-chip \${doctor.governmentIdUrl || doctor.aadhaarPanUrl ? "ready" : "missing"}\`}
              >
                {doctor.governmentIdUrl || doctor.aadhaarPanUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>`;

const replace4 = `              <span
                className={\`dp-doc-status-chip \${doctor.governmentIdUrl || doctor.aadhaarPanUrl || isProfileVerified ? "ready" : "missing"}\`}
              >
                {doctor.governmentIdUrl || doctor.aadhaarPanUrl ? (
                  <>
                    <FaCheck /> Uploaded
                  </>
                ) : isProfileVerified ? (
                  <>
                    <FaCheck /> Verified on Record
                  </>
                ) : (
                  <>
                    <FaExclamationTriangle /> Missing
                  </>
                )}
              </span>`;

let count = 0;
if (code.includes(target1)) { code = code.replace(target1, replace1); count++; }
if (code.includes(target2)) { code = code.replace(target2, replace2); count++; }
if (code.includes(target3)) { code = code.replace(target3, replace3); count++; }
if (code.includes(target4)) { code = code.replace(target4, replace4); count++; }

console.log('Replaced count:', count);
if (count > 0) {
  if (isCrlf) code = code.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('File written successfully');
}

