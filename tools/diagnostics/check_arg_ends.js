import fs from 'fs';

const jsonPath = 'assets1/structures/dock/pier_arg_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_arg_harbor_02_data/part_main-lod0.bin';

const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

// Let's find vertices at minX vs maxX:
const minV = [];
const maxV = [];
for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const vy = floats[i * stride + 1];
  const vz = floats[i * stride + 2];
  if (vx < -980) minV.push({ vx, vy, vz });
  if (vx > 980) maxV.push({ vx, vy, vz });
}

console.log('pier_arg_harbor_02:');
console.log(`near -1000m: ${minV.length} vertices, sample:`, minV[0]);
console.log(`near +1000m: ${maxV.length} vertices, sample:`, maxV[0]);
