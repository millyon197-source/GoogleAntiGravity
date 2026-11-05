import fs from 'fs';

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.bin';
const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

// Let's find vertices near vx ~ 798.88 with large Z or large Y:
const nearCross = [];
for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const vy = floats[i * stride + 1];
  const vz = floats[i * stride + 2];
  if (Math.abs(vx - 798.88) < 10) {
    if (Math.abs(vz) > 180 || Math.abs(vy) > 180) {
      nearCross.push({ vx, vy, vz });
    }
  }
}
console.log(`Found ${nearCross.length} cross collar vertices near vx ~ 798.88 with |vy|>180 or |vz|>180:`);
console.log('Sample:', nearCross.slice(0, 5));
