const fs = require('fs');
let code = fs.readFileSync('hooks/use-emergency.ts', 'utf8');

const regex = /const getCurrentLocation = useCallback\(async \(\): Promise<EmergencyLocation \| undefined> => \{\r?\n\s*try \{/;
const replacement = `const getCurrentLocation = useCallback(async (): Promise<EmergencyLocation | undefined> => {
    // Standalone Demo Mode: Return simulated static demo coordinates to prevent real-world location tracking
    return {
      latitude: 23.0225,
      longitude: 72.5714,
      address: "HealPoint Demo Healthcare Hub, Ahmedabad (Simulated Coordinates)",
      accuracy: 10,
      sharedAt: new Date().toISOString(),
    };
    try {`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('hooks/use-emergency.ts', code, 'utf8');
  console.log('use-emergency.ts updated successfully with regex');
} else {
  console.log('Regex failed on use-emergency.ts');
}
