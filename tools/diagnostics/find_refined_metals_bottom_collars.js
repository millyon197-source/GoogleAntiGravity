import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const partOffset = [-63.88318, -140.9294, 27.99579];

let bottomVerts = [];
for (let i = 0; i < meta.vertexCount; i++) {
  const ox = floats[i * stride] + partOffset[0];
  const oy = floats[i * stride + 1] + partOffset[1];
  const oz = floats[i * stride + 2] + partOffset[2];
  if (oy <= -380) {
    bottomVerts.push([ox, oy, oz]);
  }
}

console.log('Vertices at oy <= -380:', bottomVerts.length);

// Find clusters or bounds of these bottom vertices
let bMinX = Infinity, bMaxX = -Infinity;
let bMinZ = Infinity, bMaxZ = -Infinity;
for (const v of bottomVerts) {
  bMinX = Math.min(bMinX, v[0]); bMaxX = Math.max(bMaxX, v[0]);
  bMinZ = Math.min(bMinZ, v[2]); bMaxZ = Math.max(bMaxZ, v[2]);
}

console.log('Bottom vertices bounds: X:', bMinX.toFixed(1), 'to', bMaxX.toFixed(1), 'Z:', bMinZ.toFixed(1), 'to', bMaxZ.toFixed(1));

// Let's cluster the bottom vertices:
// Check around where they are grouped
const clusters = [];
for (const v of bottomVerts) {
  let matched = false;
  for (const c of clusters) {
    if (Math.hypot(v[0] - c.center[0], v[2] - c.center[2]) < 50) {
      c.points.push(v);
      c.center = [
        c.points.reduce((s, p) => s + p[0], 0) / c.points.length,
        c.points.reduce((s, p) => s + p[1], 0) / c.points.length,
        c.points.reduce((s, p) => s + p[2], 0) / c.points.length
      ];
      matched = true;
      break;
    }
  }
  if (!matched) {
    clusters.push({ center: [v[0], v[1], v[2]], points: [v] });
  }
}

console.log('Clusters found at bottom face:');
for (const c of clusters) {
  console.log(`  Count: ${c.points.length}, Center: [${c.center.map(n => n.toFixed(1)).join(', ')}]`);
}
