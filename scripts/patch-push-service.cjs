const fs = require('fs');
let code = fs.readFileSync('HealPointBackend/services/pushNotificationService.js', 'utf8');

const target = `    // 3. Check Quiet Hours (urgent alerts bypass quiet hours)`;
const replacement = `    // Standalone Demo Mode: Suppress external push for SOS emergency alerts
    if (category === "emergency" && process.env.EXTERNAL_SOS_NOTIFICATIONS_ENABLED !== "true") {
      console.log(\`[PushService: DEMO MODE] External push suppressed for emergency alert. Retained strictly in-app/simulated.\`);
      return { success: true, simulated: true, reason: "Demo mode: External emergency push disabled" };
    }

    // 3. Check Quiet Hours (urgent alerts bypass quiet hours)`;

if (code.includes(target) && !code.includes('EXTERNAL_SOS_NOTIFICATIONS_ENABLED')) {
  code = code.replace(target, replacement);
  fs.writeFileSync('HealPointBackend/services/pushNotificationService.js', code, 'utf8');
  console.log('pushNotificationService.js updated for demo safety');
} else {
  console.log('Target not found or already patched in pushNotificationService.js');
}

