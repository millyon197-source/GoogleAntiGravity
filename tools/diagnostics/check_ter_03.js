import fs from 'fs';

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_03_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_03_data/part_main-lod0.bin';
const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

console.log('pier_ter_harbor_03:');
console.log('boundingBox:', meta.boundingBox);

let minX = Infinity, maxX = -Infinity;
for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  minX = Math.min(minX, vx); maxX = Math.max(maxX, vx);
}
console.log(`X range: [${minX.toFixed(2)}, ${maxX.toFixed(2)}]`);
