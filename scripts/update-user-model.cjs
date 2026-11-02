const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "../HealPointBackend/models/userModel.js");
let content = fs.readFileSync(filePath, "utf8");

if (!content.includes("languagePreference")) {
  const target = "notificationPreferences: {";
  const addition = `languagePreference: {
      type: String,
      enum: ["en", "hi", "gu"],
      default: "en",
    },
    accessibilityPreferences: {
      highContrast: { type: Boolean, default: false },
      fontScale: { type: String, enum: ["normal", "large", "extra-large"], default: "normal" },
      reduceMotion: { type: Boolean, default: false },
    },
    notificationPreferences: {`;
  content = content.replace(target, addition);
  fs.writeFileSync(filePath, content, "utf8");
  console.log("Updated userModel with language and accessibility preferences");
} else {
  console.log("Already updated");
}

