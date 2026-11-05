import fs from 'fs';

const meta = JSON.parse(fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.json', 'utf8'));
const buf = fs.readFileSync('assets1/structures/production/prod_gen_refinedmetals_data/part_main-lod0.bin');
const floats = new Float32Array(buf.buffer, buf.byteOffset, meta.vertexCount * (meta.vertexStrideBytes / 4));
const stride = meta.vertexStrideBytes / 4;

const partOffset = [-63.88318, -140.9294, 27.99579];

// Centered snap positions on the lowest Y mesh parts
const snap1 = [-327.77, -400.0, -600.0];
const snap2 = [77.39, -400.0, 200.0];

console.log('Testing snap positions in viewer space:');
console.log('Snap 1:', snap1);
console.log('Snap 2:', snap2);

// In viewer space, mesh vertices are (vx + partOffset[0], vy + partOffset[1], vz + partOffset[2])
for (const [name, snap] of [['ConnectionSnap001', snap1], ['ConnectionSnap002', snap2]]) {
  // Find vertices near this snap point (within 80m)
  const nearby = [];
  let minDist = Infinity;
  let closestV = null;

  for (let i = 0; i < meta.vertexCount; i++) {
    const vx = floats[i * stride] + partOffset[0];
    const vy = floats[i * stride + 1] + partOffset[1];
    const vz = floats[i * stride + 2] + partOffset[2];

    const d = Math.hypot(vx - snap[0], vy - snap[1], vz - snap[2]);
    if (d < minDist) {
      minDist = d;
      closestV = [vx, vy, vz];
    }
    if (d <= 75.0) {
      nearby.push([vx, vy, vz]);
    }
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const v of nearby) {
    minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
    minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
    minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
    sumX += v[0]; sumY += v[1]; sumZ += v[2];
  }

  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const midZ = (minZ + maxZ) / 2;

  console.log(`\n=== ${name} ===`);
  console.log(`  Snap point: [${snap.join(', ')}]`);
  console.log(`  Closest mesh vertex: [${closestV.map(n => n.toFixed(2)).join(', ')}] (dist: ${minDist.toFixed(2)}m)`);
  console.log(`  Part bounds: X=[${minX.toFixed(2)}, ${maxX.toFixed(2)}], Y=[${minY.toFixed(2)}, ${maxY.toFixed(2)}], Z=[${minZ.toFixed(2)}, ${maxZ.toFixed(2)}]`);
  console.log(`  Part midpoint: [${midX.toFixed(2)}, ${midY.toFixed(2)}, ${midZ.toFixed(2)}]`);
  console.log(`  Offset from midpoint: dx=${Math.abs(snap[0] - midX).toFixed(2)}m, dy=${Math.abs(snap[1] - minY).toFixed(2)}m, dz=${Math.abs(snap[2] - midZ).toFixed(2)}m`);
}
