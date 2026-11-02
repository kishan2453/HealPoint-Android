const fs = require('fs');
let code = fs.readFileSync('HealPointBackend/tests/part15Demo.test.js', 'utf8');

code = code.replace(
  'assert.ok(content.includes("SIMULATION ONLY"), "Must specify simulation only");',
  'assert.ok(content.toLowerCase().includes("simulation only"), "Must specify simulation only");'
);

code = code.replace(
  `      const result = await sendExpoPushNotification({
        user: dummyUser,
        title: "Test Emergency Alert",
        body: "Test Emergency Body",
        category: "emergency",
      });`,
  `      const result = await sendExpoPushNotification({
        recipientUserId: "60c72b2f9b1d8b2badbee5a1",
        title: "Test Emergency Alert",
        body: "Test Emergency Body",
        data: { category: "emergency" },
      });`
);

fs.writeFileSync('HealPointBackend/tests/part15Demo.test.js', code, 'utf8');
console.log('part15Demo.test.js updated');
