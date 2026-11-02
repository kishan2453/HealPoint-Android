const fs = require("fs");
const path = require("path");

// 1. Update app.json
const appJsonPath = path.join(__dirname, "../app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

const desiredPermissions = [
  "android.permission.CAMERA",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.INTERNET"
];

appJson.expo.android.permissions = desiredPermissions;

// Check if expo-location plugin is present
const hasLocationPlugin = appJson.expo.plugins.some(p => 
  (Array.isArray(p) && p[0] === "expo-location") || p === "expo-location"
);

if (!hasLocationPlugin) {
  appJson.expo.plugins.push([
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "HealPoint needs your location to dispatch emergency medical services to your exact location."
    }
  ]);
}

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n", "utf8");
console.log("Updated app.json with location permissions and plugin");

// 2. Update eas.json
const easJsonPath = path.join(__dirname, "../eas.json");
const easJson = JSON.parse(fs.readFileSync(easJsonPath, "utf8"));

if (!easJson.build.production.env) {
  easJson.build.production.env = {};
}
easJson.build.production.env.EXPO_PUBLIC_API_URL = "https://heal-point-backend.vercel.app/api/v1";

if (!easJson.build.preview.env) {
  easJson.build.preview.env = {};
}
// Ensure preview can also connect to production if local is not reachable
easJson.build.preview.env.EXPO_PUBLIC_API_URL = "https://heal-point-backend.vercel.app/api/v1";

fs.writeFileSync(easJsonPath, JSON.stringify(easJson, null, 2) + "\n", "utf8");
console.log("Updated eas.json production and preview env EXPO_PUBLIC_API_URL");
