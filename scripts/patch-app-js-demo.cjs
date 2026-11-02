const fs = require('fs');
let code = fs.readFileSync('HealPointBackend/app.js', 'utf8');

const regex = /environment:\s*process\.env\.NODE_ENV\s*\|\|\s*"development",\r?\n\s*timestamp:\s*new Date\(\)\.toISOString\(\),/;
const replacement = `environment: process.env.NODE_ENV || "development",
    demoMode: process.env.DEMO_MODE !== "false",
    isStandaloneDemo: true,
    sosSimulationOnly: true,
    realEmergencyServicesEnabled: false,
    timestamp: new Date().toISOString(),`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('HealPointBackend/app.js', code, 'utf8');
  console.log('app.js health check updated successfully');
} else {
  console.log('Regex match failed in app.js');
}
