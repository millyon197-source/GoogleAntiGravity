import fs from 'fs';

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.bin';
const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const largeV = [];
for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const vy = floats[i * stride + 1];
  const vz = floats[i * stride + 2];
  if (Math.abs(vy) > 190 || Math.abs(vz) > 190) {
    largeV.push({ vx, vy, vz });
  }
}
console.log(`Found ${largeV.length} vertices with |vy|>190 or |vz|>190.`);
// Histogram of vx for these vertices
const vxBins = {};
for (const v of largeV) {
  const bin = Math.round(v.vx / 50) * 50;
  vxBins[bin] = (vxBins[bin] || 0) + 1;
}
console.log('vx distribution of outer vertices:', vxBins);
