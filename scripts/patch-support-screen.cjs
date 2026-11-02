const fs = require("fs");
const path = require("path");

const supportPath = path.join(__dirname, "../app/(drawer)/support.tsx");
let content = fs.readFileSync(supportPath, "utf8");

if (!content.includes('import { useLanguage } from "@/hooks/use-language";')) {
  content = content.replace(
    'import { useAuth } from "@/hooks/use-auth";',
    'import { useAuth } from "@/hooks/use-auth";\nimport { useLanguage } from "@/hooks/use-language";'
  );
}

// In SupportScreen, extract t and highContrast
if (!content.includes("const { t, highContrast } = useLanguage();")) {
  content = content.replace(
    "export default function SupportScreen() {",
    "export default function SupportScreen() {\n  const { t, highContrast } = useLanguage();"
  );

  // Update DrawerHeader
  content = content.replace(
    'title="Help & Support"',
    'title={t("support.title", "Help & Support")}'
  );
  content = content.replace(
    'subtitle="24×7 Healthcare assistance & guides"',
    'subtitle={t("support.subtitle", "24×7 Healthcare assistance & guides")}'
  );
}

fs.writeFileSync(supportPath, content, "utf8");
console.log("Updated app/(drawer)/support.tsx with useLanguage");

