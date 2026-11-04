const fs = require('fs');

const buf = fs.readFileSync('assets1/textures/fx/pattern_hex_01.dds');
let offset = 128;
let minVal = 255, maxVal = 0;
for (let i = 0; i < 4096; i++) {
  const c0 = buf.readUInt16LE(offset + i * 8);
  const c1 = buf.readUInt16LE(offset + i * 8 + 2);
  const r0 = ((c0 >> 11) & 31) * 255 / 31;
  const r1 = ((c1 >> 11) & 31) * 255 / 31;
  if (r0 < minVal) minVal = r0;
  if (r1 < minVal) minVal = r1;
  if (r0 > maxVal) maxVal = r0;
  if (r1 > maxVal) maxVal = r1;
}
console.log(`Min R: ${minVal}, Max R: ${maxVal}`);
