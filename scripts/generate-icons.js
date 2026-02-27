#!/usr/bin/env node

/**
 * generate-icons.js
 *
 * Generates minimal valid PNG placeholder icons for the Wardrobez app.
 *
 * Brand colors:
 *   Primary purple : #6C63FF
 *   Dark background: #1A1A2E
 *
 * The PNGs produced here are solid-color placeholders.
 * Replace them with real designed icons before any production build.
 *
 * Usage:
 *   node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------------------
// PNG helpers
// ---------------------------------------------------------------------------

/**
 * CRC-32 lookup table (ISO 3309 / ITU-T V.42 polynomial).
 */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a single PNG chunk.
 *   chunk = length (4 B) + type (4 B) + data + crc (4 B)
 */
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');           // 4 bytes
  const dataBytes = data ? Buffer.from(data) : Buffer.alloc(0);

  const length = Buffer.alloc(4);
  length.writeUInt32BE(dataBytes.length, 0);

  const crcInput = Buffer.concat([typeBytes, dataBytes]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBytes, dataBytes, crcBuf]);
}

/**
 * Create a minimal valid PNG file filled with a single RGBA color.
 *
 * @param {number} width   - image width  in pixels
 * @param {number} height  - image height in pixels
 * @param {number[]} rgba  - [r, g, b, a] color (0-255 each)
 * @returns {Buffer}       - complete PNG file
 */
function createPng(width, height, rgba) {
  // -- PNG signature --
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // -- IHDR --
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // -- Raw image data (filter byte 0 + RGBA pixels per row) --
  const rowLen = 1 + width * 4;        // 1 filter byte + pixel data
  const raw = Buffer.alloc(rowLen * height);

  for (let y = 0; y < height; y++) {
    const offset = y * rowLen;
    raw[offset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 4;
      raw[px]     = rgba[0];
      raw[px + 1] = rgba[1];
      raw[px + 2] = rgba[2];
      raw[px + 3] = rgba[3];
    }
  }

  // Compress with zlib deflate (sync for simplicity)
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // -- IDAT --
  const idatChunk = pngChunk('IDAT', compressed);

  // -- IEND --
  const iendChunk = pngChunk('IEND', null);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    idatChunk,
    iendChunk,
  ]);
}

/**
 * Create a PNG with a simple centered design rather than a flat fill.
 * Draws a dark background with a purple rounded-rectangle "wardrobe" shape
 * and a triangular "hanger" hook on top.
 *
 * This is still a placeholder but is more visually recognizable than a
 * single-color square.
 */
function createIconPng(width, height) {
  const bg   = [0x1a, 0x1a, 0x2e, 0xff]; // #1A1A2E
  const fg   = [0x6c, 0x63, 0xff, 0xff]; // #6C63FF

  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(rowLen * height);

  // Margins for the wardrobe body (inner rectangle)
  const marginX = Math.round(width * 0.2);
  const topBody = Math.round(height * 0.3);
  const bottomBody = Math.round(height * 0.85);

  // Hanger triangle top
  const hangerApex = Math.round(height * 0.12);
  const hangerBase = topBody;
  const hangerCenterX = Math.round(width / 2);
  const hangerHalfW = Math.round(width * 0.15);

  // Corner radius for wardrobe body
  const radius = Math.round(width * 0.05);

  for (let y = 0; y < height; y++) {
    const offset = y * rowLen;
    raw[offset] = 0; // filter: None

    for (let x = 0; x < width; x++) {
      const px = offset + 1 + x * 4;
      let color = bg;

      // --- Hanger hook (triangle from apex to base) ---
      if (y >= hangerApex && y <= hangerBase) {
        const t = (y - hangerApex) / (hangerBase - hangerApex); // 0..1
        const halfW = t * hangerHalfW;
        if (Math.abs(x - hangerCenterX) <= halfW + 2 &&
            Math.abs(x - hangerCenterX) >= Math.max(0, halfW - 2)) {
          color = fg;
        }
        // small circle at apex
        const dx = x - hangerCenterX;
        const dy = y - hangerApex;
        if (dx * dx + dy * dy <= (width * 0.03) * (width * 0.03)) {
          color = fg;
        }
      }

      // --- Wardrobe body (rounded rect) ---
      if (x >= marginX && x < width - marginX && y >= topBody && y < bottomBody) {
        // Check rounded corners
        const innerLeft   = marginX + radius;
        const innerRight  = width - marginX - radius - 1;
        const innerTop    = topBody + radius;
        const innerBottom = bottomBody - radius - 1;

        let inside = true;
        // Top-left corner
        if (x < innerLeft && y < innerTop) {
          const dx = x - innerLeft;
          const dy = y - innerTop;
          if (dx * dx + dy * dy > radius * radius) inside = false;
        }
        // Top-right corner
        if (x > innerRight && y < innerTop) {
          const dx = x - innerRight;
          const dy = y - innerTop;
          if (dx * dx + dy * dy > radius * radius) inside = false;
        }
        // Bottom-left corner
        if (x < innerLeft && y > innerBottom) {
          const dx = x - innerLeft;
          const dy = y - innerBottom;
          if (dx * dx + dy * dy > radius * radius) inside = false;
        }
        // Bottom-right corner
        if (x > innerRight && y > innerBottom) {
          const dx = x - innerRight;
          const dy = y - innerBottom;
          if (dx * dx + dy * dy > radius * radius) inside = false;
        }

        if (inside) {
          color = fg;

          // Vertical center line (wardrobe door division)
          if (Math.abs(x - hangerCenterX) <= 1) {
            color = bg;
          }
          // Small door handles
          const handleY = Math.round((topBody + bottomBody) / 2);
          const handleLeftX  = hangerCenterX - Math.round(width * 0.06);
          const handleRightX = hangerCenterX + Math.round(width * 0.06);
          const handleR = Math.round(width * 0.015);
          {
            const dx1 = x - handleLeftX;
            const dy1 = y - handleY;
            if (dx1 * dx1 + dy1 * dy1 <= handleR * handleR) color = bg;
            const dx2 = x - handleRightX;
            const dy2 = y - handleY;
            if (dx2 * dx2 + dy2 * dy2 <= handleR * handleR) color = bg;
          }
        }
      }

      raw[px]     = color[0];
      raw[px + 1] = color[1];
      raw[px + 2] = color[2];
      raw[px + 3] = color[3];
    }
  }

  // Compress
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', null),
  ]);
}

/**
 * Splash icon: simpler version -- just the hanger symbol on dark bg.
 */
function createSplashPng(width, height) {
  // For the splash icon we reuse createIconPng -- same branding.
  return createIconPng(width, height);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const assetsDir = path.resolve(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

const icons = [
  { name: 'icon.png',          width: 1024, height: 1024, builder: 'icon'   },
  { name: 'adaptive-icon.png', width: 1024, height: 1024, builder: 'icon'   },
  { name: 'favicon.png',       width:   48, height:   48, builder: 'icon'   },
  { name: 'splash-icon.png',   width:  200, height:  200, builder: 'splash' },
];

console.log('Wardrobez icon generator');
console.log('========================');
console.log(`Brand purple : #6C63FF`);
console.log(`Dark bg      : #1A1A2E`);
console.log(`Output dir   : ${assetsDir}`);
console.log();

for (const icon of icons) {
  const filePath = path.join(assetsDir, icon.name);

  let buf;
  if (icon.builder === 'icon') {
    buf = createIconPng(icon.width, icon.height);
  } else {
    buf = createSplashPng(icon.width, icon.height);
  }

  fs.writeFileSync(filePath, buf);

  const kb = (buf.length / 1024).toFixed(1);
  console.log(`  [OK] ${icon.name.padEnd(20)} ${icon.width}x${icon.height}  (${kb} KB)`);
}

console.log();
console.log('Done. These are placeholder icons with the Wardrobez branding.');
console.log('Replace them with professionally designed assets before a production build.');
