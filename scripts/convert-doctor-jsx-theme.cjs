const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src', 'pages', 'DoctorPortal.jsx');
let code = fs.readFileSync(filePath, 'utf8');

const replacements = [
  { from: /#0d9488/gi, to: '#2563EB' },
  { from: /#0f766e/gi, to: '#1D4ED8' },
  { from: /#14b8a6/gi, to: '#60A5FA' },
  { from: /#f0fdfa/gi, to: '#EFF6FF' },
  { from: /#ccfbf1/gi, to: '#DBEAFE' },
  { from: /tealGradient/g, to: 'royalBlueGradient' },
  { from: /doc\.setTextColor\(13,\s*148,\s*136\)/g, to: 'doc.setTextColor(37, 99, 235)' },
];

for (const { from, to } of replacements) {
  code = code.replace(from, to);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log("Successfully converted DoctorPortal.jsx inline styles to Royal Blue / Sky Blue!");
