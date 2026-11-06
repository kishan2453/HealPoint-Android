async function verifyLive() {
  const url = 'https://heal-point-doctor-web.vercel.app';
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  console.log(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  console.log('HTML snippet: ' + html.slice(0, 300));

  const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (jsMatch) {
    const jsUrl = url + jsMatch[1];
    console.log(`Fetching JS bundle: ${jsUrl}`);
    const jsRes = await fetch(jsUrl);
    const jsText = await jsRes.text();
    console.log(`JS Bundle status: ${jsRes.status} | Size: ${jsText.length} bytes`);
    console.log(`Contains classifyAppointment: ${jsText.includes('classifyAppointment')}`);
    console.log(`Contains Expand sidebar navigation: ${jsText.includes('Expand sidebar navigation')}`);
    console.log(`Contains Appointments Command Center: ${jsText.includes('Appointments Command Center')}`);
  }
}
verifyLive();
