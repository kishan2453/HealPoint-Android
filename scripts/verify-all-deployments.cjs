async function verifyAll() {
  const targets = [
    { name: "Backend Health", url: "https://heal-point-backend.vercel.app/api/v1/health" },
    { name: "Online Doctors Endpoint", url: "https://heal-point-backend.vercel.app/api/v1/consultation/online-doctors" },
    { name: "Patient Mobile Web", url: "https://heal-point-mauve.vercel.app" },
    { name: "Doctor Portal Web", url: "https://heal-point-doctor-web.vercel.app" },
    { name: "Hospital Admin Web", url: "https://heal-point-hospital-admin.vercel.app" },
    { name: "Super Admin Web", url: "https://heal-point-super-admin.vercel.app" }
  ];
  for (const t of targets) {
    try {
      const res = await fetch(t.url);
      console.log(`PASS [HTTP ${res.status}] ${t.name.padEnd(25)} : ${t.url}`);
    } catch (err) {
      console.error(`FAIL ${t.name.padEnd(25)} : ${err.message}`);
    }
  }
}
verifyAll();
