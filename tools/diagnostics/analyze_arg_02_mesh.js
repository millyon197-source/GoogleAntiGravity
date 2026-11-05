import fs from 'fs';

const jsonPath = 'assets1/structures/dock/pier_arg_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_arg_harbor_02_data/part_main-lod0.bin';

const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

console.log('pier_arg_harbor_02 vertexCount:', meta.vertexCount);
console.log('boundingBox:', meta.boundingBox);

const bins = {};
for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const bin = Math.floor(vx / 100) * 100;
  bins[bin] = (bins[bin] || 0) + 1;
}
console.log('X histogram:');
for (const b of Object.keys(bins).sort((a,b) => parseFloat(a) - parseFloat(b))) {
  console.log(`  ${b} to ${parseFloat(b)+100}: ${bins[b]} vertices`);
}
