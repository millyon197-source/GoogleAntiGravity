const fs = require('fs');

// Decode DXT1 into RGBA buffer
function dxt1ToRgba(buf, width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  let offset = 128; // DDS Header

  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      const c0 = buf.readUInt16LE(offset);
      const c1 = buf.readUInt16LE(offset + 2);
      const bits = buf.readUInt32LE(offset + 4);
      offset += 8;

      const r0 = Math.round(((c0 >> 11) & 31) * 255 / 31);
      const g0 = Math.round(((c0 >> 5) & 63) * 255 / 63);
      const b0 = Math.round((c0 & 31) * 255 / 31);

      const r1 = Math.round(((c1 >> 11) & 31) * 255 / 31);
      const g1 = Math.round(((c1 >> 5) & 63) * 255 / 63);
      const b1 = Math.round((c1 & 31) * 255 / 31);

      const colors = [
        [r0, g0, b0, 255],
        [r1, g1, b1, 255],
        c0 > c1
          ? [Math.round((2 * r0 + r1) / 3), Math.round((2 * g0 + g1) / 3), Math.round((2 * b0 + b1) / 3), 255]
          : [Math.round((r0 + r1) / 2), Math.round((g0 + g1) / 2), Math.round((b0 + b1) / 2), 255],
        c0 > c1
          ? [Math.round((r0 + 2 * r1) / 3), Math.round((g0 + 2 * g1) / 3), Math.round((b0 + 2 * b1) / 3), 255]
          : [0, 0, 0, 0]
      ];

      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          const shift = (py * 4 + px) * 2;
          const code = (bits >> shift) & 3;
          const col = colors[code];
          const pixelIndex = ((y + py) * width + (x + px)) * 4;
          rgba[pixelIndex] = col[0];
          rgba[pixelIndex + 1] = col[1];
          rgba[pixelIndex + 2] = col[2];
          rgba[pixelIndex + 3] = col[3];
        }
      }
    }
  }
  return rgba;
}

// Write simple uncompressed PPM or BMP
function writeBmp(rgba, width, height, outPath) {
  const rowSize = width * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;
  const header = Buffer.alloc(54);

  header.write('BM', 0);
  header.writeUInt32LE(fileSize, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(-height, 22); // Top-down
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(32, 28); // 32 bits BGRA
  header.writeUInt32LE(0, 30);
  header.writeUInt32LE(imageSize, 34);

  const bgra = Buffer.alloc(imageSize);
  for (let i = 0; i < width * height; i++) {
    bgra[i * 4] = rgba[i * 4 + 2];     // B
    bgra[i * 4 + 1] = rgba[i * 4 + 1]; // G
    bgra[i * 4 + 2] = rgba[i * 4];     // R
    bgra[i * 4 + 3] = rgba[i * 4 + 3]; // A
  }

  fs.writeFileSync(outPath, Buffer.concat([header, bgra]));
  console.log(`Saved BMP to ${outPath}`);
}

const ddsBuf = fs.readFileSync('assets1/textures/fx/pattern_hex_01.dds');
const rgba = dxt1ToRgba(ddsBuf, 256, 256);
writeBmp(rgba, 256, 256, 'C:/Users/Zeus/.gemini/antigravity/brain/d33b323a-9bcc-485d-a23b-37f25a01e05b/pattern_hex_01.bmp');
