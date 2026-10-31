const { execSync } = require('child_process');

function checkPortal(name, baseUrl, paths) {
  console.log(`\n=== Checking ${name} (${baseUrl}) ===`);
  for (const p of paths) {
    try {
      const out = execSync(`npx vercel curl ${baseUrl}${p}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const ok = out.includes('<div id="root"></div>') || out.includes('<div id="root"') || out.includes('__next') || out.includes('HealPoint') || out.includes('<html');
      console.log(`${p.padEnd(25)} -> ${ok ? '✅ PASS' : '❌ FAIL'}`);
      if (!ok) {
        console.log('   Preview:', out.slice(0, 150));
      }
    } catch (e) {
      console.log(`${p.padEnd(25)} -> ❌ ERROR: ${e.message}`);
    }
  }
}

checkPortal('Hospital Admin', 'https://heal-point-hospital-admin.vercel.app', [
  '/',
  '/login',
  '/doctors',
  '/appointments',
  '/check-in',
  '/reports',
  '/compliance',
  '/unknown-tab'
]);

checkPortal('Doctor Web', 'https://heal-point-doctor-web.vercel.app', [
  '/',
  '/login',
  '/appointments',
  '/patients',
  '/queue',
  '/today',
  '/upcoming',
  '/availability',
  '/unknown-doctor-tab'
]);

checkPortal('Super Admin', 'https://heal-point-super-admin.vercel.app', [
  '/',
  '/home',
  '/all-doctors',
  '/appointments',
  '/system-health',
  '/audit-logs',
  '/unknown-super-admin-tab'
]);

checkPortal('Patient Mobile Web', 'https://heal-point-mauve.vercel.app', [
  '/',
  '/doctors',
  '/emergency',
  '/health-wallet',
  '/booking/60c72b2f9b1d8b2badbee5a1',
  '/appointment/60c72b2f9b1d8b2badbee5a2',
  '/doctor/60c72b2f9b1d8b2badbee5a3',
  '/non-existent-route-404'
]);
