const fs = require('fs');
let code = fs.readFileSync('app/(drawer)/emergency.tsx', 'utf8');

const startStr = '// Direct Phone Dialing Handler';
const endStr = '// Open Directions in Native Maps';

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `// Direct Phone Dialing Handler - Standalone Demo Simulation
  const callNumber = (phone: string, label: string) => {
    Alert.alert(
      "SIMULATION ONLY – DEMO MODE",
      \`Calling is disabled in Demo Mode.\\n\\n"\${label}" (\${phone}) is a simulated educational placeholder.\\n\\nNo real-world hospital, ambulance, or emergency service is contacted.\`,
      [{ text: "Understood", style: "default" }]
    );
  };

  `;
  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync('app/(drawer)/emergency.tsx', code, 'utf8');
  console.log('Successfully replaced callNumber with Demo simulation alert');
} else {
  console.log('Indices not found:', startIndex, endIndex);
}

