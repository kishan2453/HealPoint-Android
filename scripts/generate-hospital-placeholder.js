/**
 * HealPoint - generate the branded hospital placeholder image.
 *
 * Produces `assets/images/hospital-placeholder.png` (800x450, 16:9) with a
 * clean healthcare look: teal vertical gradient, a soft white halo and a
 * rounded white medical cross. Uses only Node built-ins (zlib) so it runs on
 * any machine without native dependencies.
 *
 *   node scripts/generate-hospital-placeholder.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WIDTH = 800;
const HEIGHT = 450;

// ---------------------------------------------------------------------------
// PNG encoding helpers (filter-0 scanlines, CRC32, chunk writer)
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

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Each scanline is prefixed with filter byte 0 (None).
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function mixWithWhite(rgb, alpha) {
  const inv = 1 - alpha;
  return [
    Math.round(rgb[0] * inv + 255 * alpha),
    Math.round(rgb[1] * inv + 255 * alpha),
    Math.round(rgb[2] * inv + 255 * alpha),
  ];
}

/** True when (x, y) lies inside a rounded rectangle with given rect + radius. */
function inRoundedRect(x, y, rx, ry, rw, rh, radius) {
  const left = rx;
  const right = rx + rw;
  const top = ry;
  const bottom = ry + rh;
  if (x < left || x > right || y < top || y > bottom) return false;

  const cx = Math.max(left + radius, Math.min(right - radius, x));
  const cy = Math.max(top + radius, Math.min(bottom - radius, y));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

// ---------------------------------------------------------------------------
// Draw the placeholder
// ---------------------------------------------------------------------------

const TOP = [18, 169, 150]; // #12A996
const BOTTOM = [11, 133, 123]; // #0B857B
const CROSS_WHITE = [255, 255, 255];

const centerX = WIDTH / 2;
const centerY = HEIGHT / 2;
const haloRadius = 118;
const barThickness = 46;
const barLength = 168;
const barRadius = barThickness / 2;

const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
for (let y = 0; y < HEIGHT; y += 1) {
  const t = y / (HEIGHT - 1);
  const base = lerpColor(TOP, BOTTOM, t);

  for (let x = 0; x < WIDTH; x += 1) {
    let color = base;

    // Soft halo behind the cross.
    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < haloRadius) {
      const falloff = 1 - dist / haloRadius;
      color = mixWithWhite(color, 0.1 * falloff * falloff);
    }

    // Rounded medical cross.
    const inV = inRoundedRect(x, y, centerX - barThickness / 2, centerY - barLength / 2, barThickness, barLength, barRadius);
    const inH = inRoundedRect(x, y, centerX - barLength / 2, centerY - barThickness / 2, barLength, barThickness, barRadius);
    if (inV || inH) {
      color = CROSS_WHITE;
    }

    const offset = (y * WIDTH + x) * 4;
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = 255;
  }
}

const png = encodePng(WIDTH, HEIGHT, pixels);
const outFile = path.join(__dirname, '..', 'assets', 'images', 'hospital-placeholder.png');
fs.writeFileSync(outFile, png);
console.log(`Wrote ${outFile} (${png.length} bytes)`);
