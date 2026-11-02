const fs = require('fs');
let code = fs.readFileSync('HealPointBackend/services/emailService.js', 'utf8');

const target = `  const client = getTransporter();
  if (client) {`;

const replacement = `  // Standalone Demo Mode: Bypass live SMTP entirely
  if (process.env.DEMO_MODE !== "false") {
    console.log(\`[EmailService: DEMO MODE] Simulated reminder email (\${reminderType}) to \${to} for appointment \${appointmentId}\`);
    return { success: true, messageId: \`demo_sim_\${Date.now()}\`, simulated: true, isDemo: true };
  }

  const client = getTransporter();
  if (client) {`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('HealPointBackend/services/emailService.js', code, 'utf8');
  console.log('emailService.js updated for demo simulation');
} else {
  console.log('Target not found in emailService.js');
}

