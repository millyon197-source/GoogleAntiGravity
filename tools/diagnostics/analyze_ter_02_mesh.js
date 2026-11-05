import fs from 'fs';

const jsonPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.json';
const binPath = 'assets1/structures/dock/pier_ter_harbor_02_data/part_main-lod0.bin';

const meta = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const buf = fs.readFileSync(binPath);
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

// Histogram of vertex X positions in 50m bins
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

// Find vertices with Y or Z around +-200 or collar rings
console.log('\nChecking ends of the mesh:');
const nearMinX = [];
const nearMaxX = [];
const nearZeroX = [];
const near200X = [];

for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const vy = floats[i * stride + 1];
  const vz = floats[i * stride + 2];
  if (vx < -950) nearMinX.push({ vx, vy, vz });
  if (vx > 950) nearMaxX.push({ vx, vy, vz });
  if (Math.abs(vx) < 50) nearZeroX.push({ vx, vy, vz });
  if (Math.abs(vx - 200) < 50) near200X.push({ vx, vy, vz });
}

console.log(`nearMinX (around -1000m): ${nearMinX.length} vertices`);
console.log(`nearMaxX (around +1000m): ${nearMaxX.length} vertices`);
console.log(`nearZeroX (around 0m): ${nearZeroX.length} vertices`);
console.log(`near200X (around +200m): ${near200X.length} vertices`);

// What does the geometry look like near +1000m vs -1000m?
// In X4 pier_ter_harbor_02:
// Is +1000 the dock end or the station connector end?
if (nearMaxX.length > 0) {
  const sample = nearMaxX[0];
  console.log('Sample near +1000:', sample);
}
if (nearMinX.length > 0) {
  const sample = nearMinX[0];
  console.log('Sample near -1000:', sample);
}
