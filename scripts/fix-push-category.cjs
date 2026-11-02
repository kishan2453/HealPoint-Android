const fs = require('fs');
let code = fs.readFileSync('HealPointBackend/services/pushNotificationService.js', 'utf8');

const target = `    // Standalone Demo Mode: Suppress external push for SOS emergency alerts
    if (category === "emergency" && process.env.EXTERNAL_SOS_NOTIFICATIONS_ENABLED !== "true") {
      console.log(\`[PushService: DEMO MODE] External push suppressed for emergency alert. Retained strictly in-app/simulated.\`);
      return { success: true, simulated: true, reason: "Demo mode: External emergency push disabled" };
    }`;

const replacement = `    // Standalone Demo Mode: Suppress external push for SOS emergency alerts
    const categoryName = (data.category || data.type || "").toLowerCase();
    if (
      (categoryName === "emergency" || categoryName === "sos") &&
      process.env.EXTERNAL_SOS_NOTIFICATIONS_ENABLED !== "true"
    ) {
      console.log(\`[PushService: DEMO MODE] External push suppressed for emergency alert. Retained strictly in-app/simulated.\`);
      return { success: true, simulated: true, reason: "Demo mode: External emergency push disabled" };
    }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('HealPointBackend/services/pushNotificationService.js', code, 'utf8');
  console.log('pushNotificationService.js fixed categoryName');
}

