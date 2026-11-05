import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

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
  if (vy <= minY + 5.0) {
    lowestVerts.push([vx, vy, vz]);
  }
}

// Cluster by connectivity / distance
const clusters = [];
for (const v of lowestVerts) {
  let found = false;
  for (const c of clusters) {
    if (Math.hypot(v[0] - c.center[0], v[2] - c.center[2]) < 100) {
      c.points.push(v);
      c.center = [
        c.points.reduce((s, p) => s + p[0], 0) / c.points.length,
        c.points.reduce((s, p) => s + p[1], 0) / c.points.length,
        c.points.reduce((s, p) => s + p[2], 0) / c.points.length
      ];
      found = true;
      break;
    }
  }
  if (!found) {
    clusters.push({ center: [v[0], v[1], v[2]], points: [v] });
  }
}

console.log('Lowest Y in raw mesh:', minY.toFixed(2));
console.log('Found ' + clusters.length + ' clusters at lowest Y:');
clusters.forEach((c, i) => {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of c.points) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minZ = Math.min(minZ, p[2]); maxZ = Math.max(maxZ, p[2]);
  }
  console.log(`Cluster ${i+1}:`);
  console.log(`  Count: ${c.points.length}`);
  console.log(`  Center: [${c.center.map(n => n.toFixed(2)).join(', ')}]`);
  console.log(`  X bounds: [${minX.toFixed(2)}, ${maxX.toFixed(2)}] (size: ${(maxX - minX).toFixed(2)}, midpoint: ${((minX + maxX)/2).toFixed(2)})`);
  console.log(`  Z bounds: [${minZ.toFixed(2)}, ${maxZ.toFixed(2)}] (size: ${(maxZ - minZ).toFixed(2)}, midpoint: ${((minZ + maxZ)/2).toFixed(2)})`);
});
