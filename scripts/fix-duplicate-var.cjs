const fs = require('fs');
let code = fs.readFileSync('HealPointDoctorWeb/src/pages/DoctorPortal.jsx', 'utf8');
const isCrlf = code.includes('\r\n');
let norm = code.replace(/\r\n/g, '\n');
const target = '  const isProfileVerified = status === "Verified";\n  const mandatoryCount = 4;';
const rep = '  const mandatoryCount = 4;';
const idx = norm.indexOf(target);
if (idx !== -1) {
  norm = norm.slice(0, idx) + rep + norm.slice(idx + target.length);
  if (isCrlf) norm = norm.replace(/\n/g, '\r\n');
  fs.writeFileSync('HealPointDoctorWeb/src/pages/DoctorPortal.jsx', norm, 'utf8');
  console.log('✓ Successfully removed duplicate isProfileVerified declaration');
} else {
  console.error('Target not found');
}
