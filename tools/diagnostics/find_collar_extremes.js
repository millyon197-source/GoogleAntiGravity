import fs from 'fs';

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.bin';
const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

// Find max |vz| in the entire mesh
let maxZ = -Infinity, vertexAtMaxZ = null;
let minZ = Infinity, vertexAtMinZ = null;
let maxY = -Infinity, vertexAtMaxY = null;
let minY = Infinity, vertexAtMinY = null;

for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const vy = floats[i * stride + 1];
  const vz = floats[i * stride + 2];
  if (vz > maxZ) { maxZ = vz; vertexAtMaxZ = { vx, vy, vz }; }
  if (vz < minZ) { minZ = vz; vertexAtMinZ = { vx, vy, vz }; }
  if (vy > maxY) { maxY = vy; vertexAtMaxY = { vx, vy, vz }; }
  if (vy < minY) { minY = vy; vertexAtMinY = { vx, vy, vz }; }
}

console.log('Vertex at maxZ:', vertexAtMaxZ);
console.log('Vertex at minZ:', vertexAtMinZ);
console.log('Vertex at maxY:', vertexAtMaxY);
console.log('Vertex at minY:', vertexAtMinY);
