const fs = require('fs');
let code = fs.readFileSync('HealPointBackend/services/pushNotificationService.js', 'utf8');

const regex = /if \(!recipientUserId\) return \{ success: false, reason: "No recipientUserId specified" \};[\s\S]*?try \{/;
const replacement = `if (!recipientUserId) return { success: false, reason: "No recipientUserId specified" };

  // Standalone Demo Mode: Suppress external push for SOS emergency alerts immediately
  const categoryName = (data.category || data.type || "").toLowerCase();
  if (
    (categoryName === "emergency" || categoryName === "sos") &&
    process.env.EXTERNAL_SOS_NOTIFICATIONS_ENABLED !== "true"
  ) {
    console.log("[PushService: DEMO MODE] External push suppressed for emergency alert. Retained strictly in-app/simulated.");
    return { success: true, simulated: true, reason: "Demo mode: External emergency push disabled" };
  }

  try {`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('HealPointBackend/services/pushNotificationService.js', code, 'utf8');
  console.log('pushNotificationService.js patched via regex');
} else {
  console.log('Regex failed');
}
