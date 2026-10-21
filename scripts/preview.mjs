// Builds assets/preview.png: one horizontal strip of the idle frames.
// Run: node scripts/preview.mjs   (needs no dependencies, parses PNG by hand)
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync, inflateSync} from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const CELL_W = 192;
const CELL_H = 208;
const IDLE_FRAMES = 6;

const png = await readFile(join(root, 'pets/deepseek-whale-v2/spritesheet.png'));
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (png.readUInt32BE(12) !== 0x49484452) throw new Error('not a PNG');
if (width !== CELL_W * 8 || height !== CELL_H * 11) throw new Error(`unexpected sheet size ${width}x${height}`);

// IHDR layout: width@16, height@20, bitDepth@24, colourType@25.
const bitDepth = png[24];
const colourType = png[25];
const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0;
if (!channels || bitDepth !== 8) throw new Error(`unsupported PNG: depth ${bitDepth}, colour type ${colourType}`);

// Collect IDAT, inflate, then undo the per-scanline filters.
const idat = [];
let offset = 8;
while (offset < png.length) {
  const length = png.readUInt32BE(offset);
  const type = png.toString('ascii', offset + 4, offset + 8);
  if (type === 'IDAT') idat.push(png.subarray(offset + 8, offset + 8 + length));
  if (type === 'IEND') break;
  offset += 12 + length;
}
const raw = inflateSync(Buffer.concat(idat));
const stride = width * channels;
const pixels = Buffer.alloc(stride * height);
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? pixels[y * stride + x - channels] : 0;
    const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
    const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
    let value = line[x];
    if (filter === 1) value += a;
    else if (filter === 2) value += b;
    else if (filter === 3) value += (a + b) >> 1;
    else if (filter === 4) value += paeth(a, b, c);
    pixels[y * stride + x] = value & 0xff;
  }
}

// Compose on the dark background DSH uses, so the blue hair reads correctly.
const background = [18, 20, 26];
const outW = CELL_W * IDLE_FRAMES;
const outH = CELL_H;
const out = Buffer.alloc(outW * outH * 3);
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    const frame = Math.floor(x / CELL_W);
    const sx = frame * CELL_W + (x % CELL_W);
    const i = y * stride + sx * channels;
    const alpha = channels === 4 ? pixels[i + 3] / 255 : 1;
    for (let c = 0; c < 3; c++) {
      out[(y * outW + x) * 3 + c] = Math.round(pixels[i + c] * alpha + background[c] * (1 - alpha));
    }
  }
}

// Encode as RGB PNG with filter 0 rows.
const rawOut = Buffer.alloc(outH * (outW * 3 + 1));
for (let y = 0; y < outH; y++) out.copy(rawOut, y * (outW * 3 + 1) + 1, y * outW * 3, (y + 1) * outW * 3);
const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buffer => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(outW, 0);
ihdr.writeUInt32BE(outH, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const file = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(rawOut, {level: 9})),
  chunk('IEND', Buffer.alloc(0))
]);
await writeFile(join(root, 'assets/preview.png'), file);
console.log(`assets/preview.png ${outW}x${outH} (${IDLE_FRAMES} idle frames)`);
