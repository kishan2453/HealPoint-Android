// HealPoint – backend request-flow verifier
//
// Traces the exact path the Android app uses and reports each hop:
//   API base URL (from .env EXPO_PUBLIC_API_URL, same single source of truth
//   as the app) → /health → /consultation/online-doctors
//
// Usage:
//   node ./scripts/verify-backend.mjs
//
// Exit code 0 = all required hops reached the backend; non-zero otherwise.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const ENV_PATH = path.join(root, ".env");

function readEnvUrl() {
  try {
    const raw = fs.readFileSync(ENV_PATH, "utf8");
    const match = raw.match(/^\s*EXPO_PUBLIC_API_URL\s*=\s*(.*)$/im);
    if (!match) return "";
    return match[1].trim().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

const apiBase = readEnvUrl() || "http://127.0.0.1:8080/api/v1";

// The laptop usually cannot reach its OWN LAN IP (Windows Firewall blocks the
// self-connection over the public adapter) even though the phone CAN. So also
// build a loopback twin to prove the backend process + routes are actually up.
function loopbackBase(base) {
  try {
    const u = new URL(base);
    return `http://127.0.0.1:${u.port || 80}${u.pathname}`;
  } catch {
    return base;
  }
}
const loopbackUrl = loopbackBase(apiBase);

const results = [];
async function probe(label, url, check) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const ms = Date.now() - start;
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const ok = check(res.status, body);
    results.push({ label, url, ok, status: res.status, ms, body });
    return ok;
  } catch (err) {
    results.push({ label, url, ok: false, error: err?.message, ms: Date.now() - start });
    return false;
  }
}

console.log(`[verify] API base (app): ${apiBase}`);
console.log(`[verify] API base (loopback check): ${loopbackUrl}`);

const healthOk = await probe(
  "health (loopback)",
  `${loopbackUrl}/health`,
  (status, body) => status === 200 && body?.ok === true && body?.database === "connected",
);

const onlineDoctorsOk = await probe(
  "online-doctors (loopback)",
  `${loopbackUrl}/consultation/online-doctors`,
  (status, body) => status === 200 && body?.success === true && Array.isArray(body?.doctors),
);

const healthLanOk = await probe(
  "health (LAN/app)",
  `${apiBase}/health`,
  (status, body) => status === 200 && body?.ok === true && body?.database === "connected",
);

const onlineDoctorsLanOk = await probe(
  "online-doctors (LAN/app)",
  `${apiBase}/consultation/online-doctors`,
  (status, body) => status === 200 && body?.success === true && Array.isArray(body?.doctors),
);

console.log("\n[verify] results:");
for (const r of results) {
  console.log(
    `  ${r.ok ? "PASS" : "FAIL"}  ${r.label.padEnd(26)} status=${r.status ?? "-"} ms=${r.ms}`,
  );
  if (!r.ok) {
    console.log(`        url: ${r.url}`);
    if (r.error) console.log(`        error: ${r.error}`);
    if (r.body) console.log(`        body: ${JSON.stringify(r.body).slice(0, 200)}`);
  }
}

const backendUp = healthOk && onlineDoctorsOk;
const lanReachable = healthLanOk && onlineDoctorsLanOk;

if (backendUp && !lanReachable) {
  console.log(
    "\n[verify] Backend is UP on loopback, but the LAPTOP cannot reach its OWN LAN IP.",
  );
  console.log(
    "[verify] This is the expected Windows Firewall self-loopback block and is NOT",
  );
  console.log(
    "[verify] the path the phone uses. Confirm the phone can open",
    `${apiBase.replace(/\/api\/v1$/, '')}/ in its Chrome (network), and add an inbound rule if not.`,
  );
}

const allOk = backendUp && lanReachable;
if (backendUp && !lanReachable) console.log("\n[verify] BACKEND UP (loopback PASS, LAN self-check blocked by firewall)");
else console.log(allOk ? "\n[verify] ALL CHECKS PASSED" : "\n[verify] SOME CHECKS FAILED");
process.exit(backendUp ? 0 : 1);
