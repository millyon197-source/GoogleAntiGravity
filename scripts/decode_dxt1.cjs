const fs = require('fs');

function decodeDXT1(buf, width, height) {
  // DXT1 block is 8 bytes for 4x4 pixels: 2x 16-bit RGB565 colors + 32-bit lookup table
  let offset = 128; // header
  let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
  let totalNonBlack = 0, totalBlack = 0;

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const c0 = buf.readUInt16LE(offset);
      const c1 = buf.readUInt16LE(offset + 2);
      const bits = buf.readUInt32LE(offset + 4);
      offset += 8;

      const r0 = ((c0 >> 11) & 31) * 255 / 31;
      const g0 = ((c0 >> 5) & 63) * 255 / 63;
      const b0 = (c0 & 31) * 255 / 31;

      const r1 = ((c1 >> 11) & 31) * 255 / 31;
      const g1 = ((c1 >> 5) & 63) * 255 / 63;
      const b1 = (c1 & 31) * 255 / 31;

      if (r0 > 10 || g0 > 10 || b0 > 10 || r1 > 10 || g1 > 10 || b1 > 10) {
        totalNonBlack++;
      } else {
        totalBlack++;
      }
    }
  }
  console.log(`Blocks: ${totalNonBlack} non-black, ${totalBlack} black`);
}

const ddsBuffer = fs.readFileSync('assets1/textures/fx/pattern_hex_01.dds');
decodeDXT1(ddsBuffer, 256, 256);
