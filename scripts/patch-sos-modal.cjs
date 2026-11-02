const fs = require('fs');
let code = fs.readFileSync('components/emergency/EmergencySosModal.tsx', 'utf8');

code = code.replace('<Text style={styles.title}>EMERGENCY SOS</Text>', '<Text style={styles.title}>EMERGENCY SOS SIMULATION</Text>');
code = code.replace(
  'Alerting response teams & sharing your GPS location',
  'SIMULATION ONLY – No real emergency services are contacted.'
);
code = code.replace(
  'Broadcasting in {countdown}s... Tap Cancel to abort',
  'Simulating SOS in {countdown}s... Tap Cancel to abort'
);
code = code.replace('BROADCAST SOS NOW', 'TRIGGER DEMO SOS (SIMULATION)');

fs.writeFileSync('components/emergency/EmergencySosModal.tsx', code, 'utf8');
console.log('EmergencySosModal.tsx updated for simulation');

