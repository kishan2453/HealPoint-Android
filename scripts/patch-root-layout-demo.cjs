const fs = require('fs');
let code = fs.readFileSync('app/_layout.tsx', 'utf8');

if (!code.includes('DemoModeBanner')) {
  code = code.replace(
    'import { OfflineBanner } from "@/components/OfflineBanner";',
    'import { OfflineBanner } from "@/components/OfflineBanner";\nimport { DemoModeBanner } from "@/components/DemoModeBanner";'
  );
  code = code.replace(
    '<OfflineBanner />',
    '<DemoModeBanner />\n            <OfflineBanner />'
  );
  fs.writeFileSync('app/_layout.tsx', code, 'utf8');
  console.log('app/_layout.tsx updated with DemoModeBanner');
} else {
  console.log('DemoModeBanner already in app/_layout.tsx');
}
