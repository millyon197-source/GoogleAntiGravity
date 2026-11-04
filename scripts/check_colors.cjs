const fs = require('fs');

const buf = fs.readFileSync('assets1/textures/fx/pattern_hex_01.dds');
let offset = 128;
for (let i = 0; i < 5; i++) {
  const c0 = buf.readUInt16LE(offset + i * 8);
  const c1 = buf.readUInt16LE(offset + i * 8 + 2);
  const r0 = ((c0 >> 11) & 31) * 255 / 31;
  const g0 = ((c0 >> 5) & 63) * 255 / 63;
  const b0 = (c0 & 31) * 255 / 31;
  const r1 = ((c1 >> 11) & 31) * 255 / 31;
  const g1 = ((c1 >> 5) & 63) * 255 / 63;
  const b1 = (c1 & 31) * 255 / 31;
  console.log(`Block ${i}: c0=(r:${r0.toFixed(0)}, g:${g0.toFixed(0)}, b:${b0.toFixed(0)}), c1=(r:${r1.toFixed(0)}, g:${g1.toFixed(0)}, b:${b1.toFixed(0)})`);
}
