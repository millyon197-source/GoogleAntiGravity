import fs from 'fs';

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.bin';
const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

// Find min/max Y and Z at vx around -900, vx around 0, vx around +200, vx around +900
function getSlice(minX, maxX) {
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let count = 0;
  for (let i = 0; i < meta.vertexCount; i++) {
    const vx = floats[i * stride];
    if (vx >= minX && vx <= maxX) {
      count++;
      const vy = floats[i * stride + 1];
      const vz = floats[i * stride + 2];
      minY = Math.min(minY, vy); maxY = Math.max(maxY, vy);
      minZ = Math.min(minZ, vz); maxZ = Math.max(maxZ, vz);
    }
  }
  return { count, Y: [minY, maxY], Z: [minZ, maxZ] };
}

console.log('vx from -1000 to -900:', getSlice(-1000, -900));
console.log('vx from -700 to -600:', getSlice(-700, -600));
console.log('vx from -100 to 0:', getSlice(-100, 0));
console.log('vx from 180 to 220:', getSlice(180, 220));
console.log('vx from 900 to 1000:', getSlice(900, 1000));
