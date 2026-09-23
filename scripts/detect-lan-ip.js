#!/usr/bin/env node
/**
 * HealPoint - LAN IP detection helper.
 *
 * Finds the dev machine's actual LAN IPv4 address and writes it into `.env` as
 * `EXPO_PUBLIC_API_URL=http://<LAN_IP>:8080/api/v1`. This is the most reliable
 * way to point a physical Android device (Expo Go) at the local backend without
 * depending on Metro host detection.
 *
 * Usage (from the mobile app root):
 *   npm run detect:ip
 *
 * Then restart Expo so the new env value is loaded:
 *   npx expo start --clear
 *
 * Notes:
 *   - Only EXPO_PUBLIC_* values ship to the client; no secrets are written.
 *   - If EXPO_PUBLIC_API_URL is already set to a non-empty value this script
 *     will NOT overwrite it — it just reports the current value.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const API_PORT = 8080;
const ENV_PATH = path.join(__dirname, "..", ".env");
const KEY = "EXPO_PUBLIC_API_URL";

/** Return the preferred LAN IPv4, or '' when none is available. */
function detectLanIPv4() {
  const networks = os.networkInterfaces();
  const candidates = [];

  const virtualName =
    /virtual|vethernet|wsl|hyper|loopback|docker|vmware|virtualbox|tailscale|zerotier|tap|tun|cisco|vpn/i;

  for (const key of Object.keys(networks)) {
    // Skip virtual adapters (WSL/Hyper-V/Docker/VPN) — their IPs are not
    // reachable from a physical phone on the Wi-Fi.
    if (virtualName.test(key)) continue;
    for (const net of networks[key] || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      const ip = net.address;
      // Skip modern WSL/Windows gateway ranges that look private but are not
      // bridged to the physical LAN.
      if (
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip) &&
        /vethernet|wsl|hyper/i.test(key)
      )
        continue;
      candidates.push({ ip, name: key });
    }
  }

  // Prefer a private range that a phone on the same Wi-Fi can actually hit.
  const isPrivate = (ip) =>
    /^192\.168\./.test(ip) ||
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  const isLikelyWifi = (name) => /wi-?fi|wireless/i.test(name);

  const score = (c) => {
    let s = 0;
    if (isPrivate(c.ip)) s += 10;
    if (isLikelyWifi(c.name)) s += 5;
    if (/^192\.168\./.test(c.ip)) s += 3;
    if (/^10\./.test(c.ip)) s += 2;
    return s;
  };

  candidates.sort((a, b) => score(b) - score(a));
  const entry = candidates[0];

  if (!entry) return "";
  console.log(`[detect:ip] Interface "${entry.name}" → ${entry.ip}`);
  return entry.ip;
}

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return "";
  return fs.readFileSync(ENV_PATH, "utf8");
}

/** Upsert `KEY` (preserving comments and trailing whitespace). */
function upsertEnvKey(content, value) {
  const lines = content.split(/\r?\n/);
  const regex = new RegExp(`^\\s*${KEY}\\s*=`, "i");
  let replaced = false;

  const updated = lines.map((line) => {
    if (!replaced && regex.test(line)) {
      replaced = true;
      return `${KEY}=${value}`;
    }
    return line;
  });

  if (!replaced) {
    if (updated.length > 0 && updated[updated.length - 1].trim() !== "") {
      updated.push("");
    }
    updated.push(`${KEY}=${value}`);
  }

  return updated.join("\n");
}

function run() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const explicit = args.find((a) => !a.startsWith("--"));

  if (explicit && !/^(\d{1,3}\.){3}\d{1,3}$/.test(explicit)) {
    console.error(`[detect:ip] "${explicit}" is not a valid IPv4 address.`);
    process.exit(1);
  }

  const current = readEnv();
  const match = current.match(/^\s*EXPO_PUBLIC_API_URL\s*=\s*(.*)$/im);
  const currentValue = match ? match[1].trim() : "";

  const ip = explicit || detectLanIPv4();
  if (!ip) {
    console.error("[detect:ip] Could not find a LAN IPv4 address.");
    console.error(
      "            Pass it manually, e.g.:  node scripts/detect-lan-ip.js 192.168.1.34",
    );
    process.exit(1);
  }

  const url = `http://${ip}:${API_PORT}/api/v1`;

  if (currentValue === url && !force) {
    console.log(
      `[detect:ip] EXPO_PUBLIC_API_URL is already up-to-date: ${currentValue}`,
    );
    process.exit(0);
  }

  if (currentValue && currentValue !== url && !force) {
    console.log(
      `[detect:ip] Network IP change detected (${currentValue} -> ${url}). Updating .env...`,
    );
  }

  const next = upsertEnvKey(current, url);
  fs.writeFileSync(ENV_PATH, next, "utf8");

  // Also sync DEFAULT_LAN_IP in lib/env.ts
  const envTsPath = path.join(__dirname, "..", "lib", "env.ts");
  if (fs.existsSync(envTsPath)) {
    const envTsContent = fs.readFileSync(envTsPath, "utf8");
    const updatedEnvTs = envTsContent.replace(
      /export const DEFAULT_LAN_IP = ".*?";/,
      `export const DEFAULT_LAN_IP = "${ip}";`,
    );
    if (updatedEnvTs !== envTsContent) {
      fs.writeFileSync(envTsPath, updatedEnvTs, "utf8");
      console.log(`[detect:ip] Synced DEFAULT_LAN_IP in lib/env.ts → ${ip}`);
    }
  }

  // Also sync preview build profile in eas.json
  const easPath = path.join(__dirname, "..", "eas.json");
  if (fs.existsSync(easPath)) {
    try {
      const easRaw = fs.readFileSync(easPath, "utf8");
      const easJson = JSON.parse(easRaw);
      if (easJson.build && easJson.build.preview) {
        easJson.build.preview.env = easJson.build.preview.env || {};
        easJson.build.preview.env.EXPO_PUBLIC_API_URL = url;
        fs.writeFileSync(
          easPath,
          JSON.stringify(easJson, null, 2) + "\n",
          "utf8",
        );
        console.log(`[detect:ip] Synced preview env in eas.json → ${url}`);
      }
    } catch (err) {
      console.warn(`[detect:ip] Could not update eas.json: ${err.message}`);
    }
  }

  console.log(`[detect:ip] Wrote EXPO_PUBLIC_API_URL=${url}`);
  console.log("[detect:ip] Restart Expo with:  npx expo start --clear");
  console.log("[detect:ip] Keep the phone and laptop on the same Wi-Fi.");
}

run();
