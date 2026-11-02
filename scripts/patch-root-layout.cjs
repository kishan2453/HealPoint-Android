const fs = require("fs");
const path = require("path");

const layoutPath = path.join(__dirname, "../app/_layout.tsx");
let layout = fs.readFileSync(layoutPath, "utf8");

if (!layout.includes("LanguageProvider")) {
  layout = layout.replace(
    'import { AuthProvider } from "@/hooks/use-auth";',
    'import { AuthProvider } from "@/hooks/use-auth";\nimport { LanguageProvider } from "@/hooks/use-language";\nimport { OfflineBanner } from "@/components/OfflineBanner";'
  );

  // Wrap around AuthProvider or inside AuthProvider
  layout = layout.replace(
    "<AuthProvider>",
    "<AuthProvider>\n          <LanguageProvider>\n            <OfflineBanner />"
  );

  layout = layout.replace(
    "</AuthProvider>",
    "  </LanguageProvider>\n        </AuthProvider>"
  );

  fs.writeFileSync(layoutPath, layout, "utf8");
  console.log("Successfully updated app/_layout.tsx with LanguageProvider and OfflineBanner");
} else {
  console.log("LanguageProvider already in app/_layout.tsx");
}

