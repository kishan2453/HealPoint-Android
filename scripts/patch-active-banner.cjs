const fs = require('fs');
let code = fs.readFileSync('components/emergency/ActiveEmergencyBanner.tsx', 'utf8');

code = code.replace(
  `const STEPS: { status: EmergencyStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { status: "pending", label: "SOS Sent", icon: "radio" },
  { status: "accepted", label: "Hospital Alerted", icon: "business" },
  { status: "in_progress", label: "Ambulance / En Route", icon: "car-sport" },
  { status: "resolved", label: "Assistance Arrived", icon: "checkmark-circle" },
];`,
  `const STEPS: { status: EmergencyStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { status: "pending", label: "Demo SOS Created", icon: "radio" },
  { status: "accepted", label: "Demo Review", icon: "business" },
  { status: "in_progress", label: "Simulated En Route", icon: "car-sport" },
  { status: "resolved", label: "Simulation Closed", icon: "checkmark-circle" },
];`
);

code = code.replace(
  '<Text style={styles.headerTitle}>ACTIVE EMERGENCY SOS</Text>',
  '<Text style={styles.headerTitle}>ACTIVE EMERGENCY (SIMULATION)</Text>'
);

fs.writeFileSync('components/emergency/ActiveEmergencyBanner.tsx', code, 'utf8');
console.log('ActiveEmergencyBanner.tsx updated for simulation');
