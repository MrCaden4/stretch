// tools/make-icons.js
// Generates icons/icon-192.png, icons/icon-512.png and icons/icon-maskable-512.png
// with nothing but Node (zlib for the PNG deflate). Run: node tools/make-icons.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'icons');

const BG = [15, 17, 21];
const RING = [45, 212, 191];
const RING_DIM = [38, 54, 62];
const HAND = [232, 234, 237];

// ---- PNG encoding ---------------------------------------------------------------

const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Drawing -----------------------------------------------------------------------

// Colour of one sample at normalised coordinates (u, v) in [0, 1].
// Returns [r, g, b, a] with a in [0, 1].
function sample(u, v, maskable) {
  const x = u - 0.5;
  const y = v - 0.5;
  // Background: full bleed for maskable, rounded square otherwise.
  if (!maskable) {
    const half = 0.5;
    const r = 0.21;
    const qx = Math.abs(x) - (half - r);
    const qy = Math.abs(y) - (half - r);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
    if (outside > 0) return [0, 0, 0, 0];
  }
  // Ring: stopwatch arc, 12 o'clock clockwise, 300 of 360 degrees lit.
  const scale = maskable ? 0.78 : 1; // keep the content inside the maskable safe zone
  const d = Math.hypot(x, y) / scale;
  const inner = 0.25;
  const outer = 0.355;
  let color = BG;
  if (d >= inner && d <= outer) {
    let ang = Math.atan2(x, -y); // 0 at 12 o'clock, clockwise positive
    if (ang < 0) ang += Math.PI * 2;
    color = ang <= (300 / 360) * Math.PI * 2 ? RING : RING_DIM;
  }
  // Hand: from the centre up to the ring, with a round cap.
  const hx = x / scale;
  const hy = y / scale;
  const w = 0.028;
  const top = -inner + 0.045;
  if (Math.abs(hx) <= w && hy <= 0 && hy >= top) color = HAND;
  if (Math.hypot(hx, hy - top) <= w) color = HAND;
  if (Math.hypot(hx, hy) <= 0.055) color = HAND;
  return [color[0], color[1], color[2], 1];
}

function render(size, maskable) {
  const SS = 4; // supersampling per axis
  const out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          const c = sample(u, v, maskable);
          r += c[0] * c[3];
          g += c[1] * c[3];
          b += c[2] * c[3];
          a += c[3];
        }
      }
      const n = SS * SS;
      const o = (py * size + px) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePNG(size, size, out);
}

mkdirSync(outDir, { recursive: true });
const files = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
];
for (const [name, size, maskable] of files) {
  const png = render(size, maskable);
  writeFileSync(join(outDir, name), png);
  console.log(`${name}: ${size}x${size}, ${png.length} bytes`);
}
