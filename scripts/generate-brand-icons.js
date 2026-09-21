/**
 * HealPoint brand asset generator.
 *
 * Dev-time utility that writes HealPoint app icons + splash using pure Node.js
 * (zlib only) — no external dependencies. Produces clean, supersampled,
 * high-resolution assets with the upgraded medical cross and focal point mark.
 *
 * Usage:  node scripts/generate-brand-icons.js
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "assets", "images");

// ---------------------------------------------------------------------------
// Minimal PNG encoder (RGBA, 8-bit)
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Mathematical Geometry for the Upgraded HealPoint Brand
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function inRoundedRect(px, py, hw, hl, r) {
  const qx = Math.abs(px) - (hw - r);
  const qy = Math.abs(py) - (hl - r);
  if (qx <= 0 || qy <= 0) return Math.abs(px) <= hw && Math.abs(py) <= hl;
  return qx * qx + qy * qy <= r * r;
}

/**
 * Inside the HealPoint medical cross + focal point glyph (normalized space -0.5..0.5).
 */
function inHealPointGlyph(dx, dy) {
  const centerDist = Math.sqrt(dx * dx + dy * dy);
  const beaconR = 0.065;
  const apertureR = 0.145;

  // Center beacon point
  if (centerDist <= beaconR) return true;
  // Center aperture cutout
  if (centerDist <= apertureR) return false;

  // Vitality channel cutouts on the horizontal arm
  if (Math.abs(dy) <= 0.016 && Math.abs(dx) >= 0.16 && Math.abs(dx) <= 0.28) {
    return false;
  }

  // Cross arms (vertical and horizontal with soft rounded corners)
  const inVert = inRoundedRect(dx, dy, 0.11, 0.31, 0.035);
  const inHoriz = inRoundedRect(dx, dy, 0.31, 0.11, 0.035);
  return inVert || inHoriz;
}

/**
 * Superellipse squircle for app icon background.
 */
function inSquircle(dx, dy) {
  const nx = Math.abs(dx) / 0.45;
  const ny = Math.abs(dy) / 0.45;
  return Math.pow(nx, 4.2) + Math.pow(ny, 4.2) <= 1.0;
}

/**
 * Render an icon with 4x supersampling (anti-aliasing).
 */
function renderIcon(size, bgHex, fgHex, glyphScale = 1) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = bgHex ? hexToRgb(bgHex) : null;
  const fg = hexToRgb(fgHex);
  const S = 4; // 4x supersampling (16 sub-pixel samples per pixel)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let glyphCoverage = 0;
      let bgCoverage = 0;

      for (let sy = 0; sy < S; sy += 1) {
        for (let sx = 0; sx < S; sx += 1) {
          // Normalized from -0.5 to +0.5
          const nx = (x + (sx + 0.5) / S) / size - 0.5;
          const ny = (y + (sy + 0.5) / S) / size - 0.5;

          // Scaled for glyph
          const gdx = nx / glyphScale;
          const gdy = ny / glyphScale;

          if (inHealPointGlyph(gdx, gdy)) {
            glyphCoverage += 1;
          }

          if (bg) {
            if (inSquircle(nx, ny)) {
              bgCoverage += 1;
            }
          }
        }
      }

      const glyphAlpha = glyphCoverage / (S * S);
      const bgAlpha = bg ? bgCoverage / (S * S) : 0;
      const idx = (y * size + x) * 4;

      if (bg) {
        // Composite white glyph over teal background squircle
        if (glyphAlpha > 0) {
          rgba[idx] = Math.round(fg[0] * glyphAlpha + bg[0] * (1 - glyphAlpha));
          rgba[idx + 1] = Math.round(
            fg[1] * glyphAlpha + bg[1] * (1 - glyphAlpha),
          );
          rgba[idx + 2] = Math.round(
            fg[2] * glyphAlpha + bg[2] * (1 - glyphAlpha),
          );
          rgba[idx + 3] = Math.round(Math.max(bgAlpha, glyphAlpha) * 255);
        } else if (bgAlpha > 0) {
          rgba[idx] = bg[0];
          rgba[idx + 1] = bg[1];
          rgba[idx + 2] = bg[2];
          rgba[idx + 3] = Math.round(bgAlpha * 255);
        } else {
          rgba[idx] = 0;
          rgba[idx + 1] = 0;
          rgba[idx + 2] = 0;
          rgba[idx + 3] = 0;
        }
      } else {
        // Pure glyph with transparent background (splash icon & foregrounds)
        rgba[idx] = fg[0];
        rgba[idx + 1] = fg[1];
        rgba[idx + 2] = fg[2];
        rgba[idx + 3] = Math.round(glyphAlpha * 255);
      }
    }
  }
  return encodePng(size, size, rgba);
}

const BRAND_TEAL = "#0E9F8E";
const BRAND_WHITE = "#FFFFFF";

function write(name, buffer) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, buffer);
  console.log(`wrote ${file} (${buffer.length} bytes)`);
}

console.log("Generating premium HealPoint brand icons...");
write("icon.png", renderIcon(1024, BRAND_TEAL, BRAND_WHITE, 0.9));
write("splash-icon.png", renderIcon(1024, null, BRAND_WHITE, 0.52));
write(
  "android-icon-background.png",
  renderIcon(432, BRAND_TEAL, BRAND_WHITE, 0.72),
);
write("android-icon-foreground.png", renderIcon(432, null, BRAND_WHITE, 0.66));
write("android-icon-monochrome.png", renderIcon(432, null, BRAND_WHITE, 0.66));
write("favicon.png", renderIcon(96, BRAND_TEAL, BRAND_WHITE, 0.88));
console.log("HealPoint brand assets generated successfully.");
