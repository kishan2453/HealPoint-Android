const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const distFontsDir = path.join(distDir, 'fonts');
const publicFontsDir = path.join(projectRoot, 'public', 'fonts');
const sourceFontsDir = path.join(
  projectRoot,
  'node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'Fonts'
);

console.log('[prepare-web-build] Ensuring public/fonts contains all icon fonts...');
if (!fs.existsSync(publicFontsDir)) {
  fs.mkdirSync(publicFontsDir, { recursive: true });
}

if (fs.existsSync(sourceFontsDir)) {
  const fontFiles = fs.readdirSync(sourceFontsDir).filter(f => f.endsWith('.ttf'));
  for (const file of fontFiles) {
    const src = path.join(sourceFontsDir, file);
    const dest = path.join(publicFontsDir, file);
    if (!fs.existsSync(dest) || fs.statSync(src).size !== fs.statSync(dest).size) {
      fs.copyFileSync(src, dest);
    }
  }
}

if (fs.existsSync(distDir)) {
  console.log('[prepare-web-build] Ensuring dist/fonts contains all icon fonts...');
  if (!fs.existsSync(distFontsDir)) {
    fs.mkdirSync(distFontsDir, { recursive: true });
  }

  const publicFiles = fs.readdirSync(publicFontsDir).filter(f => f.endsWith('.ttf'));
  for (const file of publicFiles) {
    fs.copyFileSync(path.join(publicFontsDir, file), path.join(distFontsDir, file));
  }

  // Also copy to dist/assets/fonts as fallback
  const distAssetsFontsDir = path.join(distDir, 'assets', 'fonts');
  if (!fs.existsSync(distAssetsFontsDir)) {
    fs.mkdirSync(distAssetsFontsDir, { recursive: true });
  }
  for (const file of publicFiles) {
    fs.copyFileSync(path.join(publicFontsDir, file), path.join(distAssetsFontsDir, file));
  }

  // Copy PWA manifest and sw.js
  const publicDir = path.join(projectRoot, 'public');
  const manifestSrc = path.join(publicDir, 'manifest.json');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, path.join(distDir, 'manifest.json'));
  }
  const swSrc = path.join(publicDir, 'sw.js');
  if (fs.existsSync(swSrc)) {
    fs.copyFileSync(swSrc, path.join(distDir, 'sw.js'));
  }

  // Copy PWA icons
  const publicIconsDir = path.join(publicDir, 'icons');
  const distIconsDir = path.join(distDir, 'icons');
  if (fs.existsSync(publicIconsDir)) {
    if (!fs.existsSync(distIconsDir)) {
      fs.mkdirSync(distIconsDir, { recursive: true });
    }
    const iconFiles = fs.readdirSync(publicIconsDir);
    for (const file of iconFiles) {
      fs.copyFileSync(path.join(publicIconsDir, file), path.join(distIconsDir, file));
    }
  }

  // Patch JS bundle to rewrite any node_modules/@expo/vector-icons font paths to /fonts/
  const jsDir = path.join(distDir, '_expo', 'static', 'js', 'web');
  if (fs.existsSync(jsDir)) {
    const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
      const filePath = path.join(jsDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      const pattern = /\/assets\/node_modules\/@expo\/vector-icons\/build\/vendor\/react-native-vector-icons\/Fonts\/([A-Za-z0-9_]+)\.[a-f0-9]+\.ttf/g;
      if (pattern.test(content)) {
        console.log(`[prepare-web-build] Patching vector icon asset URLs in ${file}...`);
        content = content.replace(pattern, (match, fontName) => {
          return `/fonts/${fontName}.ttf`;
        });
        fs.writeFileSync(filePath, content, 'utf8');
      }

      // Ensure production backend URL is used instead of any local LAN IP
      const lanPattern = /http:\/\/(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|localhost|127\.0\.0\.1):8080\/api\/v1/g;
      if (lanPattern.test(content)) {
        console.log(`[prepare-web-build] Replacing local LAN API URL with production backend URL in ${file}...`);
        content = content.replace(lanPattern, 'https://heal-point-backend.vercel.app/api/v1');
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
  }
}

console.log('[prepare-web-build] Done!');

