/**
 * HealPoint Healthcare — Multi-Portal SPA Routing, Deep-Linking & Refresh Verification Suite.
 */
async function checkPortal(name, baseUrl, paths) {
  console.log(`\n=== Checking ${name} (${baseUrl}) ===`);
  for (const p of paths) {
    try {
      const url = `${baseUrl}${p}`;
      const res = await fetch(url, { headers: { "User-Agent": "HealPoint-Route-Audit/2.0" } });
      const text = await res.text();
      const hasContent =
        text.includes('<div id="root"></div>') ||
        text.includes('<div id="root"') ||
        text.includes('__next') ||
        text.includes('HealPoint') ||
        text.includes('<html') ||
        text.includes('notification');
      const ok = res.status === 200 && hasContent;
      console.log(`${p.padEnd(35)} -> ${ok ? '✅ PASS (HTTP 200)' : `❌ FAIL (HTTP ${res.status})`}`);
    } catch (e) {
      console.log(`${p.padEnd(35)} -> ❌ ERROR: ${e.message}`);
    }
  }
}

async function run() {
  await checkPortal('Hospital Admin', 'https://heal-point-hospital-admin.vercel.app', [
    '/',
    '/login',
    '/doctors',
    '/appointments',
    '/check-in',
    '/reports',
    '/compliance',
    '/notifications',
    '/unknown-tab'
  ]);

  await checkPortal('Doctor Web', 'https://heal-point-doctor-web.vercel.app', [
    '/',
    '/login',
    '/appointments',
    '/patients',
    '/queue',
    '/today',
    '/upcoming',
    '/availability',
    '/notifications',
    '/unknown-doctor-tab'
  ]);

  await checkPortal('Super Admin', 'https://heal-point-super-admin.vercel.app', [
    '/',
    '/home',
    '/all-doctors',
    '/appointments',
    '/system-health',
    '/audit-logs',
    '/notifications',
    '/unknown-super-admin-tab'
  ]);

  await checkPortal('Patient Mobile Web', 'https://heal-point-mauve.vercel.app', [
    '/',
    '/doctors',
    '/emergency',
    '/health-wallet',
    '/notification',
    '/booking/60c72b2f9b1d8b2badbee5a1',
    '/appointment/60c72b2f9b1d8b2badbee5a2',
    '/doctor/60c72b2f9b1d8b2badbee5a3',
    '/non-existent-route-404'
  ]);
}

run();
