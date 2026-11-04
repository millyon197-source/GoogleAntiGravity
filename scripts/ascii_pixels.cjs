const fs = require('fs');

const ddsBuf = fs.readFileSync('assets1/textures/fx/pattern_hex_01.dds');
// Let's decode full 256x256
const rgba = Buffer.alloc(256 * 256 * 4);
let offset = 128;
for (let by = 0; by < 64; by++) {
  for (let bx = 0; bx < 64; bx++) {
    const c0 = ddsBuf.readUInt16LE(offset);
    const c1 = ddsBuf.readUInt16LE(offset + 2);
    const bits = ddsBuf.readUInt32LE(offset + 4);
    offset += 8;

    const r0 = ((c0 >> 11) & 31) * 255 / 31;
    const r1 = ((c1 >> 11) & 31) * 255 / 31;
    const r = [
      r0,
      r1,
      c0 > c1 ? (2 * r0 + r1) / 3 : (r0 + r1) / 2,
      c0 > c1 ? (r0 + 2 * r1) / 3 : 0
    ];

    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const code = (bits >> ((py * 4 + px) * 2)) & 3;
        rgba[((by * 4 + py) * 256 + (bx * 4 + px)) * 4] = r[code];
      }
    }
  }
}

// Print 64x64 ASCII by sampling every 4th pixel
const grid = [];
for (let y = 0; y < 64; y++) {
  let row = '';
  for (let x = 0; x < 64; x++) {
    const v = rgba[(y * 4 * 256 + x * 4) * 4];
    if (v < 80) row += ' ';
    else if (v < 150) row += '.';
    else if (v < 220) row += '+';
    else row += '#';
  }
  grid.push(row);
}
console.log(grid.slice(0, 32).join('\n'));
