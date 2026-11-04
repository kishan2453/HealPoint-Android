const fs = require('fs');
let content = fs.readFileSync('HealPointDoctorWeb/src/pages/DoctorPortal.jsx', 'utf8');
const target = '["today", "upcoming", "pending", "completed", "appointments"]';
const replacement = '["today", "upcoming", "pending", "completed", "cancelled", "appointments"]';
if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('HealPointDoctorWeb/src/pages/DoctorPortal.jsx', content, 'utf8');
  console.log('Successfully updated activeView array to include cancelled');
} else {
  console.error('Target not found');
  process.exit(1);
}

