import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const partOffset = [-63.88318, -140.9294, 27.99579];

let minY = Infinity;
for (let i = 0; i < meta.vertexCount; i++) {
  const vy = floats[i * stride + 1];
  if (vy < minY) minY = vy;
}

const lowestVerts = [];
for (let i = 0; i < meta.vertexCount; i++) {
  const vx = floats[i * stride];
  const vy = floats[i * stride + 1];
  const vz = floats[i * stride + 2];
  if (vy <= minY + 2.0) {
    lowestVerts.push({
      raw: [vx, vy, vz],
      offset: [vx + partOffset[0], vy + partOffset[1], vz + partOffset[2]]
    });
  }
}

// Split into the two clusters (Cluster 1: Z < -200, Cluster 2: Z > 0)
const cluster1 = lowestVerts.filter(v => v.raw[2] < -200);
const cluster2 = lowestVerts.filter(v => v.raw[2] > 0);

function getStats(verts, coordKey) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const v of verts) {
    const pt = v[coordKey];
    minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]);
    minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1]);
    minZ = Math.min(minZ, pt[2]); maxZ = Math.max(maxZ, pt[2]);
    sumX += pt[0]; sumY += pt[1]; sumZ += pt[2];
  }
  return {
    count: verts.length,
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    midpoint: [(minX + maxX)/2, (minY + maxY)/2, (minZ + maxZ)/2],
    centroid: [sumX / verts.length, sumY / verts.length, sumZ / verts.length]
  };
}

console.log('=== CLUSTER 1 (ConnectionSnap001 region, Z ~ -600) ===');
console.log('RAW MESH:');
console.log(getStats(cluster1, 'raw'));
console.log('WITH XML OFFSET:');
console.log(getStats(cluster1, 'offset'));

console.log('\n=== CLUSTER 2 (ConnectionSnap002 region, Z ~ +200) ===');
console.log('RAW MESH:');
console.log(getStats(cluster2, 'raw'));
console.log('WITH XML OFFSET:');
console.log(getStats(cluster2, 'offset'));
