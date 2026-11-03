const fs = require('fs');
const path = require('path');

const doctorWebDir = path.join(__dirname, '..', 'HealPointDoctorWeb', 'src');

const replacements = [
  // Hex color codes
  { from: /#0d9488/gi, to: '#2563EB' }, // teal-600 -> royal blue
  { from: /#0f766e/gi, to: '#1D4ED8' }, // teal-700 -> royal blue dark
  { from: /#115e59/gi, to: '#1E40AF' }, // teal-800 -> royal blue deeper
  { from: /#134e4a/gi, to: '#172554' }, // teal-900 -> navy
  { from: /#14b8a6/gi, to: '#60A5FA' }, // teal-500 -> sky blue
  { from: /#2dd4bf/gi, to: '#60A5FA' }, // teal-400 -> sky blue
  { from: /#5eead4/gi, to: '#93C5FD' }, // teal-300 -> light sky blue
  { from: /#99f6e4/gi, to: '#BFDBFE' }, // teal-200 -> soft sky blue
  { from: /#ccfbf1/gi, to: '#DBEAFE' }, // teal-100 -> ice blue
  { from: /#f0fdfa/gi, to: '#EFF6FF' }, // teal-50 -> softest blue tint
  { from: /#e6f6f3/gi, to: '#EFF6FF' },
  { from: /#cdeee9/gi, to: '#BFDBFE' },
  { from: /#0e9f8e/gi, to: '#2563EB' },
  { from: /#0b7d70/gi, to: '#1D4ED8' },

  // Dark teal gradients
  { from: /#0c2b2a/gi, to: '#FFFFFF' },
  { from: /#0b3a36/gi, to: '#F8FAFC' },
  { from: /#0e4a44/gi, to: '#FFFFFF' },
  { from: /#0e3d3a/gi, to: '#1D4ED8' },

  // RGBA values
  { from: /rgba\(\s*13\s*,\s*148\s*,\s*136\s*,/g, to: 'rgba(37, 99, 235,' },
  { from: /rgba\(\s*14\s*,\s*159\s*,\s*142\s*,/g, to: 'rgba(37, 99, 235,' },
  { from: /rgba\(\s*15\s*,\s*118\s*,\s*110\s*,/g, to: 'rgba(29, 78, 216,' },
  { from: /rgba\(\s*45\s*,\s*212\s*,\s*191\s*,/g, to: 'rgba(96, 165, 250,' },
  { from: /rgba\(\s*20\s*,\s*184\s*,\s*166\s*,/g, to: 'rgba(96, 165, 250,' },
  { from: /rgba\(\s*204\s*,\s*251\s*,\s*241\s*,/g, to: 'rgba(239, 246, 255,' },
  { from: /rgba\(\s*153\s*,\s*246\s*,\s*228\s*,/g, to: 'rgba(191, 219, 254,' },

  // Variable names
  { from: /--hp-teal-50/g, to: '--hp-sky-50' },
  { from: /--hp-teal-100/g, to: '--hp-sky-100' },
  { from: /--hp-teal-200/g, to: '--hp-sky-200' },
  { from: /--hp-teal-300/g, to: '--hp-sky-300' },
  { from: /--hp-teal-400/g, to: '--hp-sky-400' },
  { from: /--hp-teal-500/g, to: '--hp-sky-500' },
  { from: /--hp-teal-600/g, to: '--hp-primary' },
  { from: /--hp-teal-700/g, to: '--hp-primary-dark' },
  { from: /--hp-teal-800/g, to: '--hp-primary-darker' },
];

const cssFiles = [
  'DesignSystem.css',
  'DoctorPremier.css',
  'HealPointPremier.css',
  'HealPointSaaS.css',
  'PremiumWorkspace.css',
  'UnifiedHealPoint.css',
  'styles.css'
];

cssFiles.forEach((fileName) => {
  const fullPath = path.join(doctorWebDir, fileName);
  if (!fs.existsSync(fullPath)) return;
  let code = fs.readFileSync(fullPath, 'utf8');
  let original = code;

  for (const { from, to } of replacements) {
    code = code.replace(from, to);
  }

  if (code !== original) {
    fs.writeFileSync(fullPath, code, 'utf8');
    console.log(`Updated theme tokens in ${fileName}`);
  }
});

console.log("Done updating Doctor Portal theme colors to Royal Blue / Sky Blue / White!");

