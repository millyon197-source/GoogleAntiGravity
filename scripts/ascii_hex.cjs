const fs = require('fs');

const ddsBuf = fs.readFileSync('assets1/textures/fx/pattern_hex_01.dds');
// Check 16x16 grid of values in the 256x256 image
// Let's decode 4x4 blocks and sample one pixel per block (giving a 64x64 grid)
// and print it as ASCII art!
let offset = 128;
const grid = [];
for (let by = 0; by < 64; by++) {
  let row = '';
  for (let bx = 0; bx < 64; bx++) {
    const c0 = ddsBuf.readUInt16LE(offset);
    const c1 = ddsBuf.readUInt16LE(offset + 2);
    offset += 8;
    const r0 = ((c0 >> 11) & 31) * 255 / 31;
    // Map to ASCII: dark '.' medium '+' bright '#'
    if (r0 < 130) row += ' ';
    else if (r0 < 180) row += '.';
    else if (r0 < 220) row += '+';
    else row += '#';
  }
  grid.push(row);
}
console.log('Sample of 30 rows of 64x64 ASCII:');
console.log(grid.slice(0, 30).map(r => r.substring(0, 60)).join('\n'));
