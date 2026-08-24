/**
 * HealPoint brand asset generator.
 *
 * Dev-time utility that writes HealPoint app icons + splash (no Expo starter
 * branding). Pure Node (zlib only) — no external image libraries.
 *
 * Usage:  node scripts/generate-brand-icons.js
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'images');

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
  const typeBuf = Buffer.from(type, 'ascii');
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
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

/** Inside the HealPoint "H" glyph (normalized 0..1 space). */
function inH(x, y) {
  const left = x >= 0.22 && x <= 0.4 && y >= 0.18 && y <= 0.82;
  const right = x >= 0.6 && x <= 0.78 && y >= 0.18 && y <= 0.82;
  const bar = y >= 0.45 && y <= 0.55 && x >= 0.22 && x <= 0.78;
  return left || right || bar;
}

/**
 * Render an icon.
 * @param size pixel size
 * @param bgHex background color or null for transparent
 * @param fgHex foreground glyph color
 * @param glyphScale scale glyph within the canvas (1 = full, 0.66 = adaptive safe zone)
 */
function renderIcon(size, bgHex, fgHex, glyphScale = 1) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = bgHex ? hexToRgb(bgHex) : null;
  const fg = hexToRgb(fgHex);
  const S = 4; // supersampling
  const margin = (1 - glyphScale) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let coverage = 0;
      for (let sy = 0; sy < S; sy += 1) {
        for (let sx = 0; sx < S; sx += 1) {
          const px = (x + (sx + 0.5) / S) / size;
          const py = (y + (sy + 0.5) / S) / size;
          const nx = margin + px * (1 - margin * 2);
          const ny = margin + py * (1 - margin * 2);
          if (inH(nx, ny)) coverage += 1;
        }
      }
      const alpha = coverage / (S * S);
      const idx = (y * size + x) * 4;
      if (bg) {
        // Composite foreground over background.
        rgba[idx] = Math.round(fg[0] * alpha + bg[0] * (1 - alpha));
        rgba[idx + 1] = Math.round(fg[1] * alpha + bg[1] * (1 - alpha));
        rgba[idx + 2] = Math.round(fg[2] * alpha + bg[2] * (1 - alpha));
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = fg[0];
        rgba[idx + 1] = fg[1];
        rgba[idx + 2] = fg[2];
        rgba[idx + 3] = Math.round(alpha * 255);
      }
    }
  }
  return encodePng(size, size, rgba);
}

const BRAND_TEAL = '#0E9F8E';
const BRAND_WHITE = '#FFFFFF';

function write(name, buffer) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, buffer);
  console.log(`wrote ${file} (${buffer.length} bytes)`);
}

write('icon.png', renderIcon(1024, BRAND_TEAL, BRAND_WHITE, 0.92));
write('splash-icon.png', renderIcon(1024, null, BRAND_WHITE, 0.5));
write('android-icon-background.png', renderIcon(432, BRAND_TEAL, BRAND_WHITE, 0.72));
write('android-icon-foreground.png', renderIcon(432, null, BRAND_WHITE, 0.66));
write('android-icon-monochrome.png', renderIcon(432, null, BRAND_WHITE, 0.66));
console.log('HealPoint brand assets generated.');